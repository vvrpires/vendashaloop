import { createServerFn } from "@tanstack/react-start";
import { createFiscalProvider } from "@adatechnology/fiscal-provider";
import forge from "node-forge";
import { SignedXml } from "xml-crypto";
import { XMLParser } from "fast-xml-parser";
import nodeHTTPS from "node:https";
import { existsSync, readFileSync } from "node:fs";
import { gunzipSync, gzipSync } from "node:zlib";
import { authMiddleware } from "@/lib/auth/middleware";
import { getSql } from "@/lib/db";
import { num } from "@/lib/money";
import { pode } from "@/lib/permissoes";
import { caminhoCertificado, certificadoAusente } from "@/lib/certificado.functions";

function digits$1(value) {
  return value.replace(/\D/g, "");
}
function escapeXml(value) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
function isoDate(value) {
  const match = value.match(/\d{4}-\d{2}-\d{2}/);
  if (match) return match[0];
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return new Date().toISOString().slice(0, 10);
  return date.toISOString().slice(0, 10);
}
function codigoNacional(codigo) {
  const clean = digits$1(codigo);
  if (clean.length === 6) return clean;
  if (clean.length === 4) return `${clean}01`;
  throw new Error(
    "No catálogo, o código do serviço precisa ter 6 dígitos da lista nacional. Exemplo: 010701.",
  );
}
function certificate() {
  const file = caminhoCertificado();
  const senha = process.env.NFE_CERT_PASSWORD || "";
  if (!senha || !existsSync(file)) throw new Error(certificadoAusente());
  const pfx = readFileSync(file);
  const asn1 = forge.asn1.fromDer(forge.util.createBuffer(pfx.toString("binary")));
  const p12 = forge.pkcs12.pkcs12FromAsn1(asn1, senha);
  const keyBag = p12.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag })[
    forge.pki.oids.pkcs8ShroudedKeyBag
  ]?.[0];
  const certBag = p12.getBags({ bagType: forge.pki.oids.certBag })[forge.pki.oids.certBag]?.[0];
  if (!keyBag?.key || !certBag?.cert) throw new Error("Não foi possível ler o certificado A1.");
  return {
    key: forge.pki.privateKeyToPem(keyBag.key),
    cert: forge.pki.certificateToPem(certBag.cert),
  };
}
function sign(xmlText, id, key, cert) {
  const sig = new SignedXml({
    privateKey: key,
    publicCert: cert,
  });
  sig.canonicalizationAlgorithm = "http://www.w3.org/TR/2001/REC-xml-c14n-20010315";
  sig.signatureAlgorithm = "http://www.w3.org/2001/04/xmldsig-more#rsa-sha256";
  sig.addReference({
    xpath: `//*[@Id='${id}']`,
    digestAlgorithm: "http://www.w3.org/2001/04/xmlenc#sha256",
    transforms: [
      "http://www.w3.org/2000/09/xmldsig#enveloped-signature",
      "http://www.w3.org/TR/2001/REC-xml-c14n-20010315",
    ],
  });
  sig.computeSignature(xmlText, {
    location: {
      reference: `//*[@Id='${id}']`,
      action: "after",
    },
  });
  return sig.getSignedXml();
}
function postJson(url, body, key, cert) {
  return new Promise((resolve, reject) => {
    const req = nodeHTTPS.request(
      url,
      {
        method: "POST",
        key,
        cert,
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          "Content-Length": Buffer.byteLength(body),
        },
      },
      (res) => {
        const chunks = [];
        res.on("data", (chunk) => chunks.push(chunk));
        res.on("end", () =>
          resolve({
            status: res.statusCode ?? 0,
            body: Buffer.concat(chunks).toString("utf8"),
          }),
        );
      },
    );
    req.on("error", reject);
    req.write(body);
    req.end();
  });
}
function mensagemErro(payload) {
  try {
    const json = JSON.parse(payload);
    const lista = json.erros ?? (json.erro ? [json.erro] : []);
    if (lista.length)
      return lista
        .map((item) =>
          [item.Codigo ?? item.codigo, item.Descricao ?? item.descricao ?? item.Mensagem]
            .filter(Boolean)
            .join(" "),
        )
        .join(" | ");
    if (json.message) return json.message;
  } catch {}
  return payload.replace(/\s+/g, " ").slice(0, 500);
}
async function emitirNfseNacional(nota) {
  const { key, cert } = certificate();
  const cnpj = digits$1(nota.cnpj);
  const doc = digits$1(nota.tomadorDoc);
  const data = isoDate(nota.data);
  const numero = String(Number(nota.numero) || 1);
  const serie = "1";
  const id = `DPS${nota.codigoMunicipio}2${cnpj.padStart(14, "0")}${serie.padStart(5, "0")}${numero.padStart(15, "0")}`;
  if (id.length !== 45) throw new Error("Não foi possível montar o identificador da NFS-e nacional.");
  const dhEmi = new Date(new Date().getTime() - 108e5).toISOString().slice(0, 19) + "-03:00";
  const trib = codigoNacional(nota.codigoServico);
  const docTag = doc.length === 14 ? `<CNPJ>${doc}</CNPJ>` : `<CPF>${doc}</CPF>`;
  const signed = sign(
    `<?xml version="1.0" encoding="UTF-8"?><DPS versao="1.00" xmlns="http://www.sped.fazenda.gov.br/nfse"><infDPS Id="${id}"><tpAmb>${nota.ambiente === "producao" ? "1" : "2"}</tpAmb><dhEmi>${dhEmi}</dhEmi><verAplic>Vendas1</verAplic><serie>${serie}</serie><nDPS>${numero}</nDPS><dCompet>${data}</dCompet><tpEmit>1</tpEmit><finNFSe>0</finNFSe><cLocEmi>${nota.codigoMunicipio}</cLocEmi><prest><CNPJ>${cnpj}</CNPJ><regTrib><opSimpNac>2</opSimpNac><regEspTrib>0</regEspTrib></regTrib></prest><toma>${docTag}<xNome>${escapeXml(nota.tomadorNome)}</xNome></toma><serv><locPrest><cLocPrestacao>${nota.codigoMunicipio}</cLocPrestacao></locPrest><cServ><cTribNac>${trib}</cTribNac><xDescServ>${escapeXml(nota.discriminacao)}</xDescServ></cServ></serv><valores><vServPrest><vServ>${nota.total.toFixed(2)}</vServ></vServPrest><trib><tribMun><tribISSQN>1</tribISSQN><tpRetISSQN>1</tpRetISSQN></tribMun><totTrib><indTotTrib>0</indTotTrib></totTrib></trib></valores></infDPS></DPS>`,
    id,
    key,
    cert,
  );
  const dpsXmlGZipB64 = gzipSync(Buffer.from(signed, "utf8")).toString("base64");
  const response = await postJson(
    nota.ambiente === "producao"
      ? "https://sefin.nfse.gov.br/SefinNacional/nfse"
      : "https://sefin.producaorestrita.nfse.gov.br/SefinNacional/nfse",
    JSON.stringify({ dpsXmlGZipB64 }),
    key,
    cert,
  );
  if (response.status === 201 || response.status === 200) {
    const json = JSON.parse(response.body);
    let numeroNota = numero;
    if (json.nfseXmlGZipB64) {
      const xmlNota = new TextDecoder().decode(gunzipSync(Buffer.from(json.nfseXmlGZipB64, "base64")));
      const parsed = new XMLParser({
        ignoreAttributes: false,
        removeNSPrefix: true,
      }).parse(xmlNota);
      const nNfse = parsed?.NFSe?.infNFSe?.nNFSe ?? parsed?.CompNFSe?.NFSe?.infNFSe?.nNFSe;
      if (nNfse) numeroNota = String(nNfse);
    }
    return {
      numero: numeroNota,
      chave: json.chaveAcesso ?? "",
    };
  }
  throw new Error(
    mensagemErro(response.body) || `A NFS-e nacional recusou o envio (HTTP ${response.status}).`,
  );
}
function digits(value) {
  return value.replace(/\D/g, "");
}
function cert() {
  const path = caminhoCertificado();
  const fallback = `${process.cwd()}/.data/certificado.pfx`;
  const file = existsSync(path) ? path : fallback;
  const senha = process.env.NFE_CERT_PASSWORD || "";
  if (!senha || !existsSync(file)) throw new Error(certificadoAusente());
  return {
    certificadoBase64: readFileSync(file).toString("base64"),
    certificadoSenha: senha,
  };
}
function payMethod(pagamento) {
  if (pagamento === "Cartão de Crédito") return "card_credit";
  if (pagamento === "Dinheiro") return "cash";
  return "pix";
}
export const emitirNota = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input) => {
    const row = input ?? {};
    const id = String(row.id ?? "").trim();
    const tipo = row.tipo === "nfe" ? "nfe" : row.tipo === "nfse" ? "nfse" : "";
    if (!id || !tipo) throw new Error("Informe o orçamento e o tipo da nota.");
    return {
      id,
      tipo,
    };
  })
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const who = await sql`
      select p.role, coalesce(g.permissoes, '') as permissoes
      from profiles p
      left join grupos g on g.id = p.grupo_id
      where p.user_id = ${context.userId}
    `;
    if (!who[0]) throw new Error("Sessão sem perfil.");
    if (!pode(who[0].role, who[0].permissoes || "", "orcamentos_nota"))
      throw new Error("Seu usuário não tem acesso a esta ação.");
    if (who[0].role !== "admin" && who[0].role !== "superadmin") {
      const dono = await sql`
        select o.created_by::text as created_by, autor.grupo_id
        from orcamentos o
        left join profiles autor on autor.user_id = o.created_by
        where o.id = ${data.id}
      `;
      const meu = await sql`select grupo_id from profiles where user_id = ${context.userId}`;
      const mesmoGrupo = meu[0]?.grupo_id && meu[0].grupo_id === dono[0]?.grupo_id;
      const proprio = dono[0]?.created_by === String(context.userId);
      if (!mesmoGrupo && !proprio) throw new Error("Esse orçamento é de outro grupo.");
    }
    const row = (await sql`select * from orcamentos where id = ${data.id}`)[0];
    if (!row) throw new Error("Orçamento não encontrado.");
    if (String(row.status) !== "venda") throw new Error("Confirme a venda antes de emitir a nota.");
    const emp = (await sql`select * from empresa where id = 1`)[0];
    if (!emp || !String(emp.nome ?? "").trim())
      throw new Error("Cadastre a empresa em Minha empresa antes de emitir a nota.");
    const cnpj = digits(String(emp.cnpj ?? ""));
    if (cnpj.length !== 14) throw new Error("CNPJ da empresa inválido.");
    const doc = digits(String(row.cliente_doc ?? ""));
    if (doc.length !== 11 && doc.length !== 14) throw new Error("Informe o CPF ou CNPJ do cliente.");
    const nomeCliente = String(row.cliente_nome ?? "").trim();
    if (!nomeCliente) throw new Error("Informe o nome do cliente.");
    const cliente = (
      await sql`
      select * from clientes where nome = ${nomeCliente} order by created_at desc limit 1
    `
    )[0];
    const produtos = await sql`select descricao, tipo, ncm, cfop, cst, unidade from produtos`;
    const itens = JSON.parse(String(row.itens ?? "[]"));
    const total = num(row.total);
    const desconto = num(row.desconto);
    const certificado = cert();
    const ambiente = emp.ambiente === "producao" ? "producao" : "homologacao";
    const base = {
      environment: ambiente,
      cnpj,
      inscricaoEstadual: digits(String(emp.ie ?? "")),
      razaoSocial: String(emp.nome),
      uf: String(emp.uf || "TO"),
      municipio: String(emp.municipio || "ARAGUAINA"),
      cep: digits(String(emp.cep ?? "")),
      logradouro: String(emp.logradouro || ""),
      numero: String(emp.numero_end || "S/N"),
      bairro: String(emp.bairro || ""),
      crt: emp.crt === "2" || emp.crt === "3" ? emp.crt : "1",
      ...certificado,
    };
    if (base.cep.length !== 8 || !base.logradouro || !base.bairro)
      throw new Error("Preencha CEP, logradouro e bairro em Minha empresa.");
    if (data.tipo === "nfse") {
      if (String(row.nfse_numero ?? "")) throw new Error("Este orçamento já tem NFS-e.");
      const im = digits(String(emp.im ?? ""));
      if (!im) throw new Error("Informe a inscrição municipal em Minha empresa.");
      const seq = await sql`select proximo_nfse::int as n from empresa where id = 1`;
      const discriminacao = itens
        .map((item) => String(item.desc ?? "").trim())
        .filter(Boolean)
        .join("; ");
      const nota = await emitirNfseNacional({
        numero: String(seq[0]?.n || 1),
        data: String(row.data ?? ""),
        total,
        cnpj,
        inscricaoMunicipal: im,
        codigoServico: String(emp.codigo_servico || "010701"),
        codigoMunicipio: String(emp.codigo_municipio || "1702109"),
        discriminacao: discriminacao || "Prestação de serviço de tecnologia",
        tomadorDoc: doc,
        tomadorNome: nomeCliente,
        ambiente,
      });
      await sql`update empresa set proximo_nfse = proximo_nfse + 1 where id = 1`;
      await sql`
        update orcamentos set nfse_numero = ${nota.numero}, nfse_protocolo = ${nota.chave}, updated_at = now()
        where id = ${data.id}
      `;
      return {
        tipo: "nfse",
        numero: nota.numero,
        protocolo: nota.chave,
        chave: nota.chave,
      };
    }
    if (String(row.nfe_chave ?? "")) throw new Error("Este orçamento já tem NF-e.");
    const cepCli = digits(String(cliente?.cep ?? ""));
    const logradouro = String(cliente?.endereco ?? "").trim();
    const numero = String(cliente?.numero ?? "").trim();
    const bairro = String(cliente?.bairro ?? "").trim();
    const municipio = String(cliente?.municipio || emp.municipio || "ARAGUAINA");
    const uf = String(cliente?.uf || emp.uf || "TO").toUpperCase();
    if (cepCli.length !== 8 || !logradouro || !numero || !bairro)
      throw new Error("No cliente, preencha endereço, número, bairro e CEP antes da NF-e.");
    const catalog = new Map(produtos.map((item) => [String(item.descricao).trim().toLowerCase(), item]));
    const items = [];
    for (const item of itens) {
      const desc = String(item.desc ?? "").trim();
      if (!desc) continue;
      const found = catalog.get(desc.toLowerCase());
      if (!found || found.tipo === "servico") continue;
      const ncm = digits(String(found.ncm ?? ""));
      const cfop = digits(String(found.cfop ?? ""));
      if (ncm.length !== 8 || cfop.length !== 4)
        throw new Error(`O produto "${desc}" precisa de NCM com 8 dígitos e CFOP com 4.`);
      const quantidade = num(item.qtd) || 1;
      const valorUnitario = num(item.unit);
      items.push({
        codigo: desc.slice(0, 20),
        descricao: desc,
        ncm,
        cfop,
        cst: String(found.cst || "102"),
        unidade: String(found.unidade || "UN")
          .slice(0, 6)
          .toUpperCase(),
        quantidade,
        valorUnitario,
        valorTotal: Math.round(quantidade * valorUnitario * 100) / 100,
      });
    }
    if (!items.length)
      throw new Error("Não há produto no orçamento. Cadastre o item como produto, com NCM e CFOP.");
    const seq = await sql`
      update empresa set proximo_nfe = proximo_nfe + 1 where id = 1 returning (proximo_nfe - 1)::int as n
    `;
    const config = {
      ...base,
      model: "nfe",
      serie: String(emp.serie_nfe || "1").replace(/^0+/, "") || "1",
      numeroNf: num(seq[0]?.n) || 1,
      codigoMunicipio: String(emp.codigo_municipio || "1702109"),
      telefone: digits(String(emp.telefone ?? "")),
      responsavelTecnico: {
        cnpj,
        xContato: String(emp.nome).trim().slice(0, 60),
        email: String(emp.email ?? "").trim(),
        fone: digits(String(emp.telefone ?? "")),
      },
    };
    if (!config.responsavelTecnico.email.includes("@") || config.responsavelTecnico.fone.length < 6)
      throw new Error(
        "Preencha e-mail e telefone em Minha empresa. A SEFAZ do Tocantins exige o responsável técnico.",
      );
    const result = await createFiscalProvider(config).emit({
      referenceId: data.id,
      items,
      payments: [
        {
          method: payMethod(String(row.pagamento ?? "")),
          amount: total,
        },
      ],
      totalAmount: total,
      discountAmount: desconto,
      customerCpf: doc.length === 11 ? doc : undefined,
      config,
      nfeData: {
        destinatario: {
          ...(doc.length === 14 ? { cnpj: doc } : { cpf: doc }),
          xNome: nomeCliente,
          codigoMunicipio: String(emp.codigo_municipio || "1702109"),
          cep: cepCli,
          logradouro,
          numero,
          bairro,
          municipio,
          uf,
          telefone: digits(String(row.cliente_telefone ?? "")),
          email: String(row.cliente_email ?? ""),
          indicadorIe: doc.length === 11 ? "9" : "2",
        },
        naturezaOperacao: "Venda de mercadoria",
        indFinal: doc.length === 11 ? "1" : "0",
        informacoesAdicionais: `Orcamento ${String(row.numero ?? "")}`,
      },
    });
    if (!result.success)
      throw new Error(result.errorHint || result.errorMessage || "A SEFAZ rejeitou a NF-e.");
    const numeroNf = String(result.numeroDocumento ?? config.numeroNf);
    await sql`
      update orcamentos
      set nfe_chave = ${result.chaveAcesso ?? ""}, nfe_protocolo = ${result.protocolo ?? ""}, nfe_numero = ${numeroNf}, updated_at = now()
      where id = ${data.id}
    `;
    return {
      tipo: "nfe",
      numero: numeroNf,
      protocolo: result.protocolo ?? "",
      chave: result.chaveAcesso ?? "",
    };
  });
