import { createServerFn } from "@tanstack/react-start";
import { hashPassword, verifyPassword } from "better-auth/crypto";
import { authMiddleware } from "@/lib/auth/middleware";
import { getSql } from "@/lib/db";
import { num } from "@/lib/money";
import { PERMISSOES, pode } from "@/lib/permissoes";

const ADMIN_EMAIL = "admin@haloop.com.br";
const ADMIN_PASSWORD = "admin";
const ADMIN_USERNAME = "admin";
const STATUSES = ["pendente", "aprovado", "rejeitado", "venda", "cancelado"];
const PAGS = ["aberto", "parcial", "pago"];
const PAYS = ["", "PIX", "Boleto", "Cartão de Crédito", "Dinheiro", "Transferência"];
function clip(value, max) {
  return String(value ?? "")
    .trim()
    .slice(0, max);
}
function usernameOf(value) {
  const username = clip(value, 32).toLowerCase();
  if (!/^[a-z0-9][a-z0-9._-]{2,31}$/.test(username))
    throw new Error("Use um usuário de 3 a 32 caracteres: letras, números, ponto, _ ou -.");
  return username;
}
function asStatus(value) {
  return STATUSES.includes(value) ? value : "pendente";
}
function asPag(value) {
  return PAGS.includes(value) ? value : "aberto";
}
function asPay(value) {
  const v = clip(value, 40);
  return PAYS.includes(v) ? v : "";
}
function parseItens(value) {
  let raw = value;
  if (typeof value === "string")
    try {
      raw = JSON.parse(value);
    } catch {
      return [];
    }
  if (!Array.isArray(raw)) return [];
  return raw
    .slice(0, 80)
    .map((row) => {
      const item = row;
      return {
        desc: clip(item.desc, 240),
        qtd: Math.max(0, num(item.qtd)),
        unit: Math.max(0, num(item.unit)),
      };
    })
    .filter((item) => item.desc.length > 0);
}
function compute(itens, desconto, descontoPct, imposto) {
  const subtotal = itens.reduce((sum, item) => sum + item.qtd * item.unit, 0);
  const descontoValor = Math.min(
    subtotal,
    Math.max(0, desconto) + (subtotal * Math.max(0, descontoPct)) / 100,
  );
  const base = Math.max(0, subtotal - descontoValor);
  const impostoValor = (base * Math.max(0, imposto)) / 100;
  return {
    subtotal: round2(subtotal),
    total: round2(base + impostoValor),
  };
}
function round2(n) {
  return Math.round(n * 100) / 100;
}
function mapOrc(row) {
  return {
    id: String(row.id),
    seq: num(row.seq),
    numero: String(row.numero ?? ""),
    osSeq: num(row.os_seq),
    osNumero: String(row.os_numero ?? ""),
    data: String(row.data ?? "").slice(0, 10),
    validade: num(row.validade) || 15,
    status: asStatus(row.status),
    clienteNome: String(row.cliente_nome ?? ""),
    clienteDoc: String(row.cliente_doc ?? ""),
    clienteTelefone: String(row.cliente_telefone ?? ""),
    clienteEmail: String(row.cliente_email ?? ""),
    clienteEndereco: String(row.cliente_endereco ?? ""),
    itens: parseItens(row.itens),
    desconto: num(row.desconto),
    descontoPct: num(row.desconto_pct),
    imposto: num(row.imposto),
    pagamento: String(row.pagamento ?? ""),
    pagStatus: asPag(row.pag_status),
    valorPago: num(row.valor_pago),
    observacoes: String(row.observacoes ?? ""),
    subtotal: num(row.subtotal),
    total: num(row.total),
    createdBy: String(row.created_by ?? ""),
    nfeChave: String(row.nfe_chave ?? ""),
    nfeProtocolo: String(row.nfe_protocolo ?? ""),
    nfeNumero: String(row.nfe_numero ?? ""),
    nfseNumero: String(row.nfse_numero ?? ""),
    nfseProtocolo: String(row.nfse_protocolo ?? ""),
  };
}
function senhaVencida(expira, em) {
  if (!expira || !em) return false;
  const momento = new Date(em).getTime();
  if (Number.isNaN(momento)) return false;
  return Date.now() - momento > 2592e6;
}
function montarPerfil(row, id, name, username, role) {
  return {
    userId: id,
    name,
    username,
    role,
    ativo: row ? row.ativo !== false : true,
    trocarSenha:
      Boolean(row?.trocar_senha) || senhaVencida(Boolean(row?.senha_expira), row?.senha_em ?? null),
    senhaExpira: Boolean(row?.senha_expira),
    grupoId: row?.grupo_id ? String(row.grupo_id) : "",
    grupoNome: row?.grupo_nome || "",
    permissoes: row?.permissoes || "",
  };
}
async function member(userId) {
  const id = String(userId);
  const sql = await getSql();
  const existing = await sql`
    select p.user_id, p.name, p.role, p.username, p.ativo, p.trocar_senha, p.senha_expira, p.senha_em,
           p.grupo_id, g.nome as grupo_nome, coalesce(g.permissoes, '') as permissoes
    from profiles p
    left join grupos g on g.id = p.grupo_id
    where p.user_id = ${id}
  `;
  const account = await sql`
    select name, email from "user" where id = ${id}
  `;
  const email = account[0]?.email ?? "";
  const name = account[0]?.name || existing[0]?.name || "Usuário";
  const derived = (existing[0]?.username || email.split("@")[0] || "usuario").toLowerCase();
  if (existing[0]) {
    if (existing[0].ativo === false) throw new Error("Usuário inativo.");
    const role = papel(existing[0].role, email);
    const username = role === "superadmin" && email === ADMIN_EMAIL ? ADMIN_USERNAME : derived;
    if (existing[0].role !== role || !existing[0].username)
      await sql`update profiles set role = ${role}, name = ${name}, username = ${username} where user_id = ${id}`;
    return {
      ...montarPerfil(existing[0], id, name, username, role),
      email,
    };
  }
  const count = await sql`select count(*)::int as n from profiles`;
  const role = num(count[0]?.n) === 0 ? "superadmin" : papel("", email);
  const username = role === "superadmin" && email === ADMIN_EMAIL ? ADMIN_USERNAME : derived;
  await sql`
    insert into profiles (user_id, name, role, username)
    values (${id}, ${name}, ${role}, ${username})
    on conflict (user_id) do nothing
  `;
  return {
    ...montarPerfil(undefined, id, name, username, role),
    email,
  };
}
function papel(valor, email) {
  if (valor === "superadmin" || email === ADMIN_EMAIL) return "superadmin";
  if (valor === "admin") return "admin";
  return "vendedor";
}
function ehDono(role) {
  return role === "admin" || role === "superadmin";
}
async function exigirOrcamento(who, id) {
  const sql = await getSql();
  const rows = await sql`select created_by::text as created_by from orcamentos where id = ${id}`;
  if (!rows[0]) throw new Error("Orçamento não encontrado.");
  if (ehDono(who.role)) return;
  if (!who.grupoId) {
    if (rows[0].created_by !== who.userId) throw new Error("Esse orçamento é de outro grupo.");
    return;
  }
  if (
    !(
      await sql`
    select exists(
      select 1 from profiles where user_id = ${rows[0].created_by} and grupo_id = ${who.grupoId}
    ) as ok
  `
    )[0]?.ok
  )
    throw new Error("Esse orçamento é de outro grupo.");
}
function permissoesDe(value) {
  const validas = new Set(PERMISSOES.map((item) => item.id));
  return String(value ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter((item) => validas.has(item))
    .join(",");
}
function exigir(who, chave) {
  if (!pode(who.role, who.permissoes, chave)) throw new Error("Seu usuário não tem acesso a esta ação.");
}
function exigirAlgum(who, chaves) {
  if (!chaves.some((chave) => pode(who.role, who.permissoes, chave)))
    throw new Error("Seu usuário não tem acesso a esta ação.");
}
async function exigirUsuarios(userId) {
  const who = await member(userId);
  exigir(who, "usuarios");
  return who;
}
const GRUPO_ADMIN = "administrador";
async function grupoAdminId(sql) {
  const rows = await sql`select id from grupos where lower(trim(nome)) = ${GRUPO_ADMIN}`;
  return rows[0] ? String(rows[0].id) : "";
}
async function exigirSuper(userId) {
  const who = await member(userId);
  if (who.role !== "superadmin") throw new Error("Apenas o administrador do sistema pode fazer isso.");
  return who;
}
export const bootstrapAdmin = createServerFn({ method: "POST" }).handler(async () => {
  const sql = await getSql();
  const found = await sql`select id from "user" where email = ${ADMIN_EMAIL}`;
  if (found[0]) {
    await sql`
      insert into profiles (user_id, name, role, username)
      values (${found[0].id}, 'Administrador', 'superadmin', ${ADMIN_USERNAME})
      on conflict (user_id) do update set role = 'superadmin', username = ${ADMIN_USERNAME}
    `;
    return {
      email: ADMIN_EMAIL,
      ready: true,
    };
  }
  const hash = await hashPassword(ADMIN_PASSWORD);
  const now = new Date().toISOString();
  const id = (
    await sql`
    insert into "user" ("name", "email", "emailVerified", "createdAt", "updatedAt")
    values ('Administrador', ${ADMIN_EMAIL}, true, ${now}, ${now})
    returning id
  `
  )[0].id;
  await sql`
    insert into "account" ("accountId", "providerId", "userId", "password", "createdAt", "updatedAt")
    values (${String(id)}, 'credential', ${id}, ${hash}, ${now}, ${now})
  `;
  await sql`
    insert into profiles (user_id, name, role, username)
    values (${id}, 'Administrador', 'admin', ${ADMIN_USERNAME})
    on conflict (user_id) do update set role = 'admin', username = ${ADMIN_USERNAME}
  `;
  return {
    email: ADMIN_EMAIL,
    ready: true,
  };
});
export const ensureProfile = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => member(context.userId));
function crtOf(value) {
  return value === "2" || value === "3" ? value : "1";
}
function ambienteOf(value) {
  return value === "producao" ? "producao" : "homologacao";
}
function imageOf(value) {
  const raw = String(value ?? "").trim();
  if (!raw) return "";
  if (!/^data:image\/(png|jpeg|jpg|webp);base64,[a-z0-9+/=\s]+$/i.test(raw) || raw.length > 6e5)
    throw new Error("A logo precisa ser PNG, JPG ou WebP de até 400 KB.");
  return raw;
}
function corOf(value) {
  const raw = String(value ?? "").trim();
  return /^#[0-9a-fA-F]{6}$/.test(raw) ? raw.toLowerCase() : "#0056b3";
}
function fundoModo(value) {
  return value === "cor" || value === "imagem" ? value : "padrao";
}
function fundoOf(value) {
  const raw = String(value ?? "").trim();
  if (!raw) return "";
  if (!/^data:image\/(png|jpeg|jpg|webp);base64,[a-z0-9+/=\s]+$/i.test(raw) || raw.length > 9e5)
    throw new Error("O fundo precisa ser PNG, JPG ou WebP de até 600 KB.");
  return raw;
}
function corOpcional(value, fallback) {
  const raw = String(value ?? "").trim();
  return /^#[0-9a-fA-F]{6}$/.test(raw) ? raw.toLowerCase() : fallback;
}
function logoPosicaoOf(value) {
  return value === "centro" ? "centro" : "lado";
}
function loginLadoOf(value) {
  return value === "esquerda" || value === "direita" ? value : "centro";
}
function faviconOf(value) {
  const raw = String(value ?? "").trim();
  if (!raw) return "";
  if (!/^data:image\/(png|jpeg|jpg|webp);base64,[a-z0-9+/=\s]+$/i.test(raw) || raw.length > 18e4)
    throw new Error("O favicon precisa ser PNG, JPG ou WebP de até 100 KB.");
  return raw;
}
const emptyEmpresa = () => ({
  nome: "Minha empresa",
  cnpj: "",
  telefone: "",
  email: "",
  local: "",
  ie: "",
  im: "",
  crt: "1",
  cep: "",
  logradouro: "",
  numeroEnd: "",
  bairro: "",
  municipio: "",
  uf: "",
  codigoMunicipio: "",
  ambiente: "homologacao",
  serieNfe: "1",
  codigoServico: "0107",
  aliquotaIss: 5,
  logo: "",
  logoClara: "",
  cor: "#0056b3",
  fundoModoLogin: "padrao",
  fundoModoSistema: "padrao",
  fundoLogin: "",
  fundoSistema: "",
  corFundoLogin: "#0a121c",
  corFundoSistema: "#0d1520",
  textoLogin: "",
  subtituloLogin: "",
  corTexto: "#e8eef3",
  corCard: "#15202b",
  corMenu: "#0d1520",
  logoPosicao: "lado",
  nomeRodape: "",
  loginLado: "centro",
  favicon: "",
  logoMenu: "",
  logoLogin: "",
  logoSistema: "",
  tituloAba: "",
});
function mapEmpresa(row) {
  if (!row) return emptyEmpresa();
  return {
    nome: String(row.nome ?? ""),
    cnpj: String(row.cnpj ?? ""),
    telefone: String(row.telefone ?? ""),
    email: String(row.email ?? ""),
    local: String(row.local ?? ""),
    ie: String(row.ie ?? ""),
    im: String(row.im ?? ""),
    crt: crtOf(row.crt),
    cep: String(row.cep ?? ""),
    logradouro: String(row.logradouro ?? ""),
    numeroEnd: String(row.numero_end ?? ""),
    bairro: String(row.bairro ?? ""),
    municipio: String(row.municipio ?? "ARAGUAINA"),
    uf: String(row.uf ?? "TO"),
    codigoMunicipio: String(row.codigo_municipio ?? "1702109"),
    ambiente: ambienteOf(row.ambiente),
    serieNfe: String(row.serie_nfe ?? "1") || "1",
    codigoServico: String(row.codigo_servico ?? "0107"),
    aliquotaIss: num(row.aliquota_iss) || 5,
    logo: String(row.logo ?? ""),
    logoClara: String(row.logo_clara ?? ""),
    cor: corOf(row.cor),
    fundoModoLogin: fundoModo(row.fundo_modo_login),
    fundoModoSistema: fundoModo(row.fundo_modo_sistema),
    fundoLogin: String(row.fundo_login ?? ""),
    fundoSistema: String(row.fundo_sistema ?? ""),
    corFundoLogin: corOpcional(row.cor_fundo_login, "#0a121c"),
    corFundoSistema: corOpcional(row.cor_fundo_sistema, "#0d1520"),
    textoLogin: String(row.texto_login ?? ""),
    subtituloLogin: String(row.subtitulo_login ?? ""),
    corTexto: corOpcional(row.cor_texto, "#e8eef3"),
    corCard: corOpcional(row.cor_card, "#15202b"),
    corMenu: corOpcional(row.cor_menu, "#0d1520"),
    logoPosicao: logoPosicaoOf(row.logo_posicao),
    nomeRodape: String(row.nome_rodape ?? ""),
    loginLado: loginLadoOf(row.login_lado),
    favicon: String(row.favicon ?? ""),
    logoMenu: String(row.logo_menu ?? ""),
    logoLogin: String(row.logo_login ?? ""),
    logoSistema: String(row.logo_sistema ?? ""),
    tituloAba: String(row.titulo_aba ?? ""),
  };
}
export const getEmpresa = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    await member(context.userId);
    return mapEmpresa((await (await getSql())`select * from empresa where id = 1`)[0]);
  });
const marcaVazia = () => ({
  nome: "",
  logo: "",
  logoClara: "",
  cor: "#0056b3",
  local: "",
  fundoModoLogin: "padrao",
  fundoModoSistema: "padrao",
  fundoLogin: "",
  fundoSistema: "",
  corFundoLogin: "#0a121c",
  corFundoSistema: "#0d1520",
  textoLogin: "",
  subtituloLogin: "",
  corTexto: "#e8eef3",
  corCard: "#15202b",
  corMenu: "#0d1520",
  logoPosicao: "lado",
  nomeRodape: "",
  loginLado: "centro",
  favicon: "",
  logoMenu: "",
  logoLogin: "",
  logoSistema: "",
  tituloAba: "",
});
export const getMarca = createServerFn({ method: "GET" }).handler(async () => {
  try {
    const row = (
      await (await getSql())`
      select nome, logo, logo_clara, cor, local, fundo_modo_login, fundo_modo_sistema,
             fundo_login, fundo_sistema, cor_fundo_login, cor_fundo_sistema,
             texto_login, subtitulo_login, cor_texto, cor_card, cor_menu, logo_posicao, nome_rodape, login_lado, favicon, logo_menu, logo_login, logo_sistema, titulo_aba
      from empresa where id = 1
    `
    )[0];
    return {
      nome: String(row?.nome ?? "").trim(),
      logo: String(row?.logo ?? ""),
      logoClara: String(row?.logo_clara ?? ""),
      cor: corOf(row?.cor),
      local: String(row?.local ?? ""),
      fundoModoLogin: fundoModo(row?.fundo_modo_login),
      fundoModoSistema: fundoModo(row?.fundo_modo_sistema),
      fundoLogin: String(row?.fundo_login ?? ""),
      fundoSistema: String(row?.fundo_sistema ?? ""),
      corFundoLogin: corOpcional(row?.cor_fundo_login, "#0a121c"),
      corFundoSistema: corOpcional(row?.cor_fundo_sistema, "#0d1520"),
      textoLogin: String(row?.texto_login ?? ""),
      subtituloLogin: String(row?.subtitulo_login ?? ""),
      corTexto: corOpcional(row?.cor_texto, "#e8eef3"),
      corCard: corOpcional(row?.cor_card, "#15202b"),
      corMenu: corOpcional(row?.cor_menu, "#0d1520"),
      logoPosicao: logoPosicaoOf(row?.logo_posicao),
      nomeRodape: String(row?.nome_rodape ?? ""),
      loginLado: loginLadoOf(row?.login_lado),
      favicon: String(row?.favicon ?? ""),
      logoMenu: String(row?.logo_menu ?? ""),
      logoLogin: String(row?.logo_login ?? ""),
      logoSistema: String(row?.logo_sistema ?? ""),
      tituloAba: String(row?.titulo_aba ?? ""),
    };
  } catch {
    return marcaVazia();
  }
});
export const saveEmpresa = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input) => {
    const row = input ?? {};
    const nome = clip(row.nome, 120);
    return {
      ...emptyEmpresa(),
      nome,
      cnpj: clip(row.cnpj, 24),
      telefone: clip(row.telefone, 32),
      email: clip(row.email, 120),
      local: clip(row.local, 160),
      ie: clip(row.ie, 20),
      im: clip(row.im, 20),
      crt: crtOf(row.crt),
      cep: clip(row.cep, 12),
      logradouro: clip(row.logradouro, 120),
      numeroEnd: clip(row.numeroEnd, 16),
      bairro: clip(row.bairro, 60),
      municipio: clip(row.municipio, 60),
      uf: clip(row.uf, 2).toUpperCase(),
      codigoMunicipio: clip(row.codigoMunicipio, 7),
      ambiente: ambienteOf(row.ambiente),
      serieNfe: clip(row.serieNfe, 3) || "1",
      codigoServico: clip(row.codigoServico, 10) || "0107",
      aliquotaIss: Math.min(100, Math.max(0, num(row.aliquotaIss))),
      logo: imageOf(row.logo),
      logoClara: imageOf(row.logoClara),
      cor: corOf(row.cor),
      fundoModoLogin: fundoModo(row.fundoModoLogin),
      fundoModoSistema: fundoModo(row.fundoModoSistema),
      fundoLogin: fundoOf(row.fundoLogin),
      fundoSistema: fundoOf(row.fundoSistema),
      corFundoLogin: corOpcional(row.corFundoLogin, "#0a121c"),
      corFundoSistema: corOpcional(row.corFundoSistema, "#0d1520"),
      textoLogin: clip(row.textoLogin, 80),
      subtituloLogin: clip(row.subtituloLogin, 240),
      corTexto: corOpcional(row.corTexto, "#e8eef3"),
      corCard: corOpcional(row.corCard, "#15202b"),
      corMenu: corOpcional(row.corMenu, "#0d1520"),
      logoPosicao: logoPosicaoOf(row.logoPosicao),
      nomeRodape: clip(row.nomeRodape, 80),
      loginLado: loginLadoOf(row.loginLado),
      favicon: faviconOf(row.favicon),
      logoMenu: imageOf(row.logoMenu),
      logoLogin: imageOf(row.logoLogin),
      logoSistema: imageOf(row.logoSistema),
      tituloAba: clip(row.tituloAba, 80),
    };
  })
  .handler(async ({ context, data }) => {
    await exigirSuper(context.userId);
    await (await getSql())`
      insert into empresa (
        id, nome, cnpj, telefone, email, local, ie, im, crt, cep, logradouro, numero_end,
        bairro, municipio, uf, codigo_municipio, ambiente, serie_nfe, codigo_servico, aliquota_iss,
        logo, logo_clara, cor, fundo_modo_login, fundo_modo_sistema, fundo_login, fundo_sistema,
        cor_fundo_login, cor_fundo_sistema, texto_login, subtitulo_login, cor_texto, cor_card, cor_menu, logo_posicao, nome_rodape, login_lado, favicon, logo_menu, logo_login, logo_sistema, titulo_aba
      ) values (
        1, ${data.nome}, ${data.cnpj}, ${data.telefone}, ${data.email}, ${data.local},
        ${data.ie}, ${data.im}, ${data.crt}, ${data.cep}, ${data.logradouro}, ${data.numeroEnd},
        ${data.bairro}, ${data.municipio}, ${data.uf}, ${data.codigoMunicipio}, ${data.ambiente},
        ${data.serieNfe}, ${data.codigoServico}, ${data.aliquotaIss},
        ${data.logo}, ${data.logoClara}, ${data.cor},
        ${data.fundoModoLogin}, ${data.fundoModoSistema}, ${data.fundoLogin}, ${data.fundoSistema},
        ${data.corFundoLogin}, ${data.corFundoSistema},
        ${data.textoLogin}, ${data.subtituloLogin}, ${data.corTexto}, ${data.corCard}, ${data.corMenu}, ${data.logoPosicao}, ${data.nomeRodape}, ${data.loginLado}, ${data.favicon}, ${data.logoMenu}, ${data.logoLogin}, ${data.logoSistema}, ${data.tituloAba}
      )
      on conflict (id) do update set
        nome = excluded.nome,
        cnpj = excluded.cnpj,
        telefone = excluded.telefone,
        email = excluded.email,
        local = excluded.local,
        ie = excluded.ie,
        im = excluded.im,
        crt = excluded.crt,
        cep = excluded.cep,
        logradouro = excluded.logradouro,
        numero_end = excluded.numero_end,
        bairro = excluded.bairro,
        municipio = excluded.municipio,
        uf = excluded.uf,
        codigo_municipio = excluded.codigo_municipio,
        ambiente = excluded.ambiente,
        serie_nfe = excluded.serie_nfe,
        codigo_servico = excluded.codigo_servico,
        aliquota_iss = excluded.aliquota_iss,
        logo = excluded.logo,
        logo_clara = excluded.logo_clara,
        cor = excluded.cor,
        fundo_modo_login = excluded.fundo_modo_login,
        fundo_modo_sistema = excluded.fundo_modo_sistema,
        fundo_login = excluded.fundo_login,
        fundo_sistema = excluded.fundo_sistema,
        cor_fundo_login = excluded.cor_fundo_login,
        cor_fundo_sistema = excluded.cor_fundo_sistema,
        texto_login = excluded.texto_login,
        subtitulo_login = excluded.subtitulo_login,
        cor_texto = excluded.cor_texto,
        cor_card = excluded.cor_card,
        cor_menu = excluded.cor_menu,
        logo_posicao = excluded.logo_posicao,
        nome_rodape = excluded.nome_rodape,
        login_lado = excluded.login_lado,
        favicon = excluded.favicon,
        logo_menu = excluded.logo_menu,
        logo_login = excluded.logo_login,
        logo_sistema = excluded.logo_sistema,
        titulo_aba = excluded.titulo_aba
    `;
    return data;
  });
export const listClientes = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    exigirAlgum(await member(context.userId), ["clientes", "orcamentos"]);
    return await (await getSql())`
      select id, nome, documento, telefone, email, endereco, cep, numero, bairro, municipio, uf
      from clientes order by nome
    `;
  });
async function exigirEmpresa(sql) {
  const rows = await sql`select nome from empresa where id = 1`;
  if (!String(rows[0]?.nome ?? "").trim())
    throw new Error("Cadastre a empresa em Minha empresa antes de continuar.");
}
export const saveCliente = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input) => {
    const row = input ?? {};
    const nome = clip(row.nome, 140);
    if (!nome) throw new Error("Informe o nome do cliente.");
    return {
      id: clip(row.id, 80),
      nome,
      documento: clip(row.documento, 32),
      telefone: clip(row.telefone, 32),
      email: clip(row.email, 120),
      endereco: clip(row.endereco, 200),
      cep: clip(row.cep, 12),
      numero: clip(row.numero, 16),
      bairro: clip(row.bairro, 60),
      municipio: clip(row.municipio, 60),
      uf: clip(row.uf, 2).toUpperCase(),
    };
  })
  .handler(async ({ context, data }) => {
    exigir(await member(context.userId), "clientes_editar");
    const sql = await getSql();
    await exigirEmpresa(sql);
    if (data.id) {
      await sql`
        update clientes set
          nome = ${data.nome},
          documento = ${data.documento},
          telefone = ${data.telefone},
          email = ${data.email},
          endereco = ${data.endereco},
          cep = ${data.cep},
          numero = ${data.numero},
          bairro = ${data.bairro},
          municipio = ${data.municipio},
          uf = ${data.uf}
        where id = ${data.id}
      `;
      return data;
    }
    const created = await sql`
      insert into clientes (nome, documento, telefone, email, endereco, cep, numero, bairro, municipio, uf, created_by)
      values (
        ${data.nome}, ${data.documento}, ${data.telefone}, ${data.email}, ${data.endereco},
        ${data.cep}, ${data.numero}, ${data.bairro}, ${data.municipio}, ${data.uf}, ${context.userId}
      )
      returning id
    `;
    return {
      ...data,
      id: String(created[0].id),
    };
  });
export const deleteCliente = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((id) => clip(id, 80))
  .handler(async ({ context, data: id }) => {
    exigir(await member(context.userId), "clientes_editar");
    if (!id) return { ok: false };
    await (await getSql())`delete from clientes where id = ${id}`;
    return { ok: true };
  });
export const listProdutos = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    exigirAlgum(await member(context.userId), ["produtos", "orcamentos"]);
    return (
      await (await getSql())`
      select id, descricao, valor, unidade, tipo, ncm, cfop, cst from produtos order by descricao
    `
    ).map((row) => ({
      id: String(row.id),
      descricao: String(row.descricao ?? ""),
      valor: num(row.valor),
      unidade: String(row.unidade || "un"),
      tipo: row.tipo === "produto" ? "produto" : "servico",
      ncm: String(row.ncm ?? ""),
      cfop: String(row.cfop ?? ""),
      cst: String(row.cst ?? ""),
    }));
  });
export const saveProduto = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input) => {
    const row = input ?? {};
    const descricao = clip(row.descricao, 180);
    if (!descricao) throw new Error("Informe a descrição.");
    return {
      id: clip(row.id, 80),
      descricao,
      valor: Math.max(0, num(row.valor)),
      unidade: clip(row.unidade, 16) || "un",
      tipo: row.tipo === "produto" ? "produto" : "servico",
      ncm: clip(row.ncm, 8),
      cfop: clip(row.cfop, 4),
      cst: clip(row.cst, 3),
    };
  })
  .handler(async ({ context, data }) => {
    exigir(await member(context.userId), "produtos_editar");
    const sql = await getSql();
    await exigirEmpresa(sql);
    if (data.id) {
      await sql`
        update produtos set
          descricao = ${data.descricao},
          valor = ${data.valor},
          unidade = ${data.unidade},
          tipo = ${data.tipo},
          ncm = ${data.ncm},
          cfop = ${data.cfop},
          cst = ${data.cst}
        where id = ${data.id}
      `;
      return data;
    }
    const created = await sql`
      insert into produtos (descricao, valor, unidade, tipo, ncm, cfop, cst, created_by)
      values (${data.descricao}, ${data.valor}, ${data.unidade}, ${data.tipo}, ${data.ncm}, ${data.cfop}, ${data.cst}, ${context.userId})
      returning id
    `;
    return {
      ...data,
      id: String(created[0].id),
    };
  });
export const deleteProduto = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((id) => clip(id, 80))
  .handler(async ({ context, data: id }) => {
    exigir(await member(context.userId), "produtos_editar");
    if (!id) return { ok: false };
    await (await getSql())`delete from produtos where id = ${id}`;
    return { ok: true };
  });
function readOrcInput(input, requireId) {
  const row = input ?? {};
  const itens = parseItens(row.itens);
  if (!itens.length) throw new Error("Adicione pelo menos um item.");
  const id = clip(row.id, 80);
  if (requireId && !id) throw new Error("Orçamento inválido.");
  const data = clip(row.data, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) throw new Error("Data inválida.");
  return {
    id,
    data,
    validade: Math.min(365, Math.max(1, Math.round(num(row.validade) || 15))),
    status: asStatus(row.status),
    clienteNome: clip(row.clienteNome, 140),
    clienteDoc: clip(row.clienteDoc, 32),
    clienteTelefone: clip(row.clienteTelefone, 32),
    clienteEmail: clip(row.clienteEmail, 120),
    clienteEndereco: clip(row.clienteEndereco, 200),
    itens,
    desconto: Math.max(0, num(row.desconto)),
    descontoPct: Math.min(100, Math.max(0, num(row.descontoPct))),
    imposto: Math.min(100, Math.max(0, num(row.imposto))),
    pagamento: asPay(row.pagamento),
    pagStatus: asPag(row.pagStatus),
    valorPago: Math.max(0, num(row.valorPago)),
    observacoes: clip(row.observacoes, 2e3),
    numero: clip(row.numero, 32),
  };
}
export const listOrcamentos = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const who = await member(context.userId);
    exigirAlgum(who, ["orcamentos", "painel"]);
    const sql = await getSql();
    return (
      ehDono(who.role)
        ? await sql`select * from orcamentos order by data desc, seq desc`
        : who.grupoId
          ? await sql`
            select o.* from orcamentos o
            join profiles p on p.user_id = o.created_by
            where p.grupo_id = ${who.grupoId}
            order by o.data desc, o.seq desc
          `
          : await sql`
            select * from orcamentos where created_by = ${who.userId} order by data desc, seq desc
          `
    ).map(mapOrc);
  });
// rev.38: dados para a tela Relatórios (mesma regra de visibilidade dos orçamentos)
export const dadosRelatorio = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const who = await member(context.userId);
    exigir(who, "relatorios");
    const sql = await getSql();
    const rows = await sql`
      select o.*, coalesce(p.name, '') as vendedor_nome, coalesce(g.nome, '') as grupo_nome,
             p.grupo_id as vendedor_grupo
      from orcamentos o
      left join profiles p on p.user_id = o.created_by
      left join grupos g on g.id = p.grupo_id
      order by o.data desc, o.seq desc
    `;
    const visiveis = ehDono(who.role)
      ? rows
      : who.grupoId
        ? rows.filter((row) => String(row.vendedor_grupo ?? "") === who.grupoId)
        : rows.filter((row) => String(row.created_by ?? "") === who.userId);
    return visiveis.map((row) => ({
      ...mapOrc(row),
      vendedorNome: String(row.vendedor_nome ?? ""),
      grupoNome: String(row.grupo_nome ?? ""),
    }));
  });
export const saveOrcamento = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input) => readOrcInput(input, false))
  .handler(async ({ context, data }) => {
    const who = await member(context.userId);
    exigir(who, "orcamentos_criar");
    const sql = await getSql();
    const totals = compute(data.itens, data.desconto, data.descontoPct, data.imposto);
    const itens = JSON.stringify(data.itens);
    if (data.id) {
      await exigirOrcamento(who, data.id);
      const current = await sql`select id, numero from orcamentos where id = ${data.id}`;
      if (!current[0]) throw new Error("Orçamento não encontrado.");
      await sql`
        update orcamentos set
          data = ${data.data},
          validade = ${data.validade},
          status = ${data.status},
          cliente_nome = ${data.clienteNome},
          cliente_doc = ${data.clienteDoc},
          cliente_telefone = ${data.clienteTelefone},
          cliente_email = ${data.clienteEmail},
          cliente_endereco = ${data.clienteEndereco},
          itens = ${itens},
          desconto = ${data.desconto},
          desconto_pct = ${data.descontoPct},
          imposto = ${data.imposto},
          pagamento = ${data.pagamento},
          pag_status = ${data.pagStatus},
          valor_pago = ${data.valorPago},
          observacoes = ${data.observacoes},
          subtotal = ${totals.subtotal},
          total = ${totals.total},
          updated_at = now()
        where id = ${data.id}
      `;
      return {
        id: data.id,
        numero: current[0].numero,
      };
    }
    const seqRow = await sql`select coalesce(max(seq), 0)::int + 1 as n from orcamentos`;
    const seq = num(seqRow[0]?.n) || 1;
    const year = data.data.slice(0, 4);
    const numero = `${String(seq).padStart(3, "0")}/${year}`;
    const created = await sql`
      insert into orcamentos (
        seq, numero, data, validade, status,
        cliente_nome, cliente_doc, cliente_telefone, cliente_email, cliente_endereco,
        itens, desconto, desconto_pct, imposto, pagamento, pag_status, valor_pago,
        observacoes, subtotal, total, created_by
      ) values (
        ${seq}, ${numero}, ${data.data}, ${data.validade}, ${data.status},
        ${data.clienteNome}, ${data.clienteDoc}, ${data.clienteTelefone}, ${data.clienteEmail}, ${data.clienteEndereco},
        ${itens}, ${data.desconto}, ${data.descontoPct}, ${data.imposto}, ${data.pagamento}, ${data.pagStatus}, ${data.valorPago},
        ${data.observacoes}, ${totals.subtotal}, ${totals.total}, ${context.userId}
      )
      returning id
    `;
    return {
      id: String(created[0].id),
      numero,
    };
  });
export const assignOsNumero = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((id) => clip(id, 80))
  .handler(async ({ context, data: id }) => {
    const who = await member(context.userId);
    exigir(who, "orcamentos_criar");
    if (!id) throw new Error("Salve o orçamento antes de gerar a ordem de serviço.");
    const sql = await getSql();
    await exigirOrcamento(who, id);
    const rows = await sql`
      select os_numero, os_seq, data::text as data from orcamentos where id = ${id}
    `;
    if (!rows[0]) throw new Error("Orçamento não encontrado.");
    if (rows[0].os_numero)
      return {
        osNumero: rows[0].os_numero,
        osSeq: num(rows[0].os_seq),
      };
    const seqRow = await sql`select coalesce(max(os_seq), 0)::int + 1 as n from orcamentos`;
    const osSeq = num(seqRow[0]?.n) || 1;
    const year = String(rows[0].data).slice(0, 4);
    const osNumero = `OS ${String(osSeq).padStart(3, "0")}/${year}`;
    await sql`
      update orcamentos
      set os_seq = ${osSeq}, os_numero = ${osNumero}, updated_at = now()
      where id = ${id} and coalesce(os_numero, '') = ''
    `;
    const again = await sql`
      select os_numero, os_seq from orcamentos where id = ${id}
    `;
    return {
      osNumero: again[0]?.os_numero || osNumero,
      osSeq: num(again[0]?.os_seq) || osSeq,
    };
  });
export const deleteOrcamento = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((id) => clip(id, 80))
  .handler(async ({ context, data: id }) => {
    const who = await member(context.userId);
    exigir(who, "orcamentos_excluir");
    if (!id) return { ok: false };
    const sql = await getSql();
    await exigirOrcamento(who, id);
    await sql`delete from orcamentos where id = ${id}`;
    return { ok: true };
  });
export const listEquipe = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    await exigirUsuarios(context.userId);
    return (
      await (await getSql())`
      select p.user_id, p.name, p.role, coalesce(p.username, split_part(u.email, '@', 1)) as username,
             p.ativo, p.trocar_senha, p.senha_expira, p.senha_em, p.grupo_id, g.nome as grupo_nome, coalesce(g.permissoes, '') as permissoes
      from profiles p
      join "user" u on u.id = p.user_id
      left join grupos g on g.id = p.grupo_id
      order by p.created_at
    `
    ).map((row) =>
      montarPerfil(
        {
          user_id: row.user_id,
          name: row.name,
          role: row.role,
          username: row.username,
          ativo: row.ativo,
          trocar_senha: row.trocar_senha,
          senha_expira: row.senha_expira,
          senha_em: row.senha_em,
          grupo_id: row.grupo_id,
          grupo_nome: row.grupo_nome,
          permissoes: row.permissoes,
        },
        String(row.user_id),
        row.name,
        row.username || "",
        papel(row.role, ""),
      ),
    );
  });
export const setRole = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input) => {
    const row = input ?? {};
    const userId = clip(row.userId, 80);
    const role = row.role === "admin" ? "admin" : "vendedor";
    if (!userId) throw new Error("Usuário inválido.");
    return {
      userId,
      role,
    };
  })
  .handler(async ({ context, data }) => {
    await exigirSuper(context.userId);
    const sql = await getSql();
    if ((await sql`select role from profiles where user_id = ${data.userId}`)[0]?.role === "superadmin")
      throw new Error("O administrador do sistema não muda de papel.");
    const adminId = await grupoAdminId(sql);
    if (data.role === "admin")
      await sql`update profiles set role = 'admin', grupo_id = ${adminId || null} where user_id = ${data.userId}`;
    else
      await sql`update profiles set role = 'vendedor', grupo_id = case when grupo_id::text = ${adminId} then null else grupo_id end where user_id = ${data.userId}`;
    return { ok: true };
  });
export const createVendedor = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input) => {
    const row = input ?? {};
    const name = clip(row.name, 80);
    const username = usernameOf(row.username);
    const password = String(row.password ?? "");
    const grupoId = clip(row.grupoId, 12);
    if (!name) throw new Error("Informe o nome do vendedor.");
    if (password.length < 8) throw new Error("A senha precisa ter pelo menos 8 caracteres.");
    return {
      name,
      username,
      password,
      trocarSenha: row.trocarSenha !== false,
      senhaExpira: row.senhaExpira === true,
      grupoId,
    };
  })
  .handler(async ({ context, data }) => {
    const who = await exigirUsuarios(context.userId);
    if (data.username === ADMIN_USERNAME) throw new Error("Esse usuário já está reservado.");
    const sql = await getSql();
    const adminId = await grupoAdminId(sql);
    const novoAdmin = Boolean(data.grupoId) && String(data.grupoId) === adminId;
    if (novoAdmin && who.role !== "superadmin")
      throw new Error("Só o administrador do sistema define quem é administrador.");
    if (
      (
        await sql`
      select user_id from profiles where lower(username) = ${data.username}
    `
      )[0]
    )
      throw new Error("Já existe uma conta com esse usuário.");
    const hash = await hashPassword(data.password);
    const now = new Date().toISOString();
    const email = `${data.username}@users.local`;
    const id = (
      await sql`
      insert into "user" ("name", "email", "emailVerified", "createdAt", "updatedAt")
      values (${data.name}, ${email}, true, ${now}, ${now})
      returning id
    `
    )[0].id;
    await sql`
      insert into "account" ("accountId", "providerId", "userId", "password", "createdAt", "updatedAt")
      values (${String(id)}, 'credential', ${id}, ${hash}, ${now}, ${now})
    `;
    await sql`
      insert into profiles (user_id, name, role, username, trocar_senha, senha_expira, senha_em, grupo_id)
      values (${id}, ${data.name}, ${novoAdmin ? "admin" : "vendedor"}, ${data.username}, ${data.trocarSenha}, ${data.senhaExpira}, now(), ${data.grupoId || null})
    `;
    return { userId: String(id) };
  });
export const setPermissoes = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input) => {
    const row = input ?? {};
    const grupoId = clip(row.grupoId, 12);
    if (!grupoId) throw new Error("Grupo inválido.");
    return {
      grupoId,
      permissoes: permissoesDe(row.permissoes),
    };
  })
  .handler(async ({ context, data }) => {
    await exigirSuper(context.userId);
    await (await getSql())`update grupos set permissoes = ${data.permissoes} where id = ${data.grupoId}`;
    return { ok: true };
  });
async function gravarSenha(userId, password, trocar, expira) {
  const sql = await getSql();
  await sql`update account set password = ${await hashPassword(password)}, "updatedAt" = now() where "userId" = ${userId} and "providerId" = 'credential'`;
  if (expira === undefined)
    await sql`update profiles set trocar_senha = ${trocar}, senha_em = now() where user_id = ${userId}`;
  else
    await sql`update profiles set trocar_senha = ${trocar}, senha_expira = ${expira}, senha_em = now() where user_id = ${userId}`;
}
export const definirSenha = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input) => {
    const row = input ?? {};
    const nova = String(row.nova ?? "");
    const atual = String(row.atual ?? "");
    if (nova.length < 8) throw new Error("A nova senha precisa ter pelo menos 8 caracteres.");
    return {
      atual,
      nova,
    };
  })
  .handler(async ({ context, data }) => {
    const who = await member(context.userId);
    const sql = await getSql();
    if (!who.trocarSenha) {
      const conta = await sql`
        select password from account where "userId" = ${who.userId} and "providerId" = 'credential'
      `;
      if (
        !(conta[0]?.password
          ? await verifyPassword({
              hash: conta[0].password,
              password: data.atual,
            })
          : false)
      )
        throw new Error("Senha atual incorreta.");
    }
    await gravarSenha(who.userId, data.nova, false);
    return { ok: true };
  });
export const redefinirSenha = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input) => {
    const row = input ?? {};
    const userId = clip(row.userId, 20);
    const password = String(row.password ?? "");
    if (!userId) throw new Error("Usuário inválido.");
    if (password.length < 8) throw new Error("A senha precisa ter pelo menos 8 caracteres.");
    return {
      userId,
      password,
      senhaExpira: row.senhaExpira === true,
    };
  })
  .handler(async ({ context, data }) => {
    await exigirUsuarios(context.userId);
    await gravarSenha(data.userId, data.password, true, data.senhaExpira);
    return { ok: true };
  });
export const listGrupos = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const who = await exigirUsuarios(context.userId);
    return (await (await getSql())`select id, nome, permissoes from grupos order by nome`)
      .filter((row) => who.role === "superadmin" || String(row.nome).trim().toLowerCase() !== GRUPO_ADMIN)
      .map((row) => ({
        id: String(row.id),
        nome: row.nome,
        permissoes: row.permissoes || "",
      }));
  });
export const saveGrupo = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input) => {
    const row = input ?? {};
    const nome = clip(row.nome, 40);
    if (nome.length < 2) throw new Error("Informe o nome do grupo.");
    if (["administradores", "administrador"].includes(nome.toLowerCase()))
      throw new Error("Esse nome é só do administrador.");
    return {
      nome,
      permissoes: permissoesDe(row.permissoes),
    };
  })
  .handler(async ({ context, data }) => {
    await exigirSuper(context.userId);
    const sql = await getSql();
    try {
      const created =
        await sql`insert into grupos (nome, permissoes) values (${data.nome}, ${data.permissoes}) returning id`;
      return {
        id: String(created[0].id),
        nome: data.nome,
        permissoes: data.permissoes,
      };
    } catch {
      throw new Error("Já existe um grupo com esse nome.");
    }
  });
export const setGrupo = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input) => {
    const row = input ?? {};
    const userId = clip(row.userId, 20);
    const grupoId = clip(row.grupoId, 12);
    if (!userId) throw new Error("Usuário inválido.");
    return {
      userId,
      grupoId,
    };
  })
  .handler(async ({ context, data }) => {
    const who = await exigirUsuarios(context.userId);
    const sql = await getSql();
    const alvo = await sql`select role from profiles where user_id = ${data.userId}`;
    if (!alvo[0]) throw new Error("Usuário não encontrado.");
    if (alvo[0].role === "superadmin") throw new Error("O administrador do sistema não entra em grupo.");
    if (data.grupoId) {
      const grupo = await sql`select nome from grupos where id = ${data.grupoId}`;
      if (!grupo[0]) throw new Error("Grupo não encontrado.");
      if (grupo[0].nome.trim().toLowerCase() === "administradores")
        throw new Error("Esse grupo é só do administrador.");
    }
    const adminId = await grupoAdminId(sql);
    const viraAdmin = Boolean(data.grupoId) && String(data.grupoId) === adminId;
    if ((viraAdmin || alvo[0].role === "admin") && who.role !== "superadmin")
      throw new Error("Só o administrador do sistema define quem é administrador.");
    await sql`update profiles set grupo_id = ${data.grupoId || null}, role = ${viraAdmin ? "admin" : "vendedor"} where user_id = ${data.userId}`;
    return { ok: true };
  });
async function protegerConta(actorId, userId) {
  if (actorId === userId) throw new Error("Você não pode alterar a própria conta por aqui.");
  const sql = await getSql();
  const ator = await sql`select role from profiles where user_id = ${actorId}`;
  const alvo = await sql`select role from profiles where user_id = ${userId}`;
  if (alvo[0]?.role === "superadmin")
    throw new Error("O administrador do sistema não pode ser alterado por aqui.");
  if (alvo[0]?.role === "admin" && ator[0]?.role !== "superadmin")
    throw new Error("Só o administrador do sistema altera outro administrador.");
  const donos =
    await sql`select count(*)::int as n from profiles where role = 'superadmin' and ativo = true and user_id <> ${userId}`;
  if (alvo[0]?.role === "superadmin" && num(donos[0]?.n) === 0)
    throw new Error("Deixe pelo menos um administrador do sistema ativo.");
}
export const setAtivo = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input) => {
    const row = input ?? {};
    const userId = clip(row.userId, 20);
    if (!userId) throw new Error("Usuário inválido.");
    return {
      userId,
      ativo: row.ativo !== false,
    };
  })
  .handler(async ({ context, data }) => {
    const who = await exigirUsuarios(context.userId);
    if (!data.ativo) await protegerConta(who.userId, data.userId);
    const sql = await getSql();
    await sql`update profiles set ativo = ${data.ativo} where user_id = ${data.userId}`;
    if (!data.ativo) await sql`delete from session where "userId" = ${data.userId}`;
    return { ok: true };
  });
export const deleteUsuario = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input) => {
    const userId = clip(input, 20);
    if (!userId) throw new Error("Usuário inválido.");
    return userId;
  })
  .handler(async ({ context, data: userId }) => {
    await protegerConta((await exigirUsuarios(context.userId)).userId, userId);
    const sql = await getSql();
    await sql`delete from session where "userId" = ${userId}`;
    await sql`delete from account where "userId" = ${userId}`;
    await sql`delete from profiles where user_id = ${userId}`;
    await sql`delete from "user" where id = ${userId}`;
    return { ok: true };
  });
export const findLoginEmail = createServerFn({ method: "POST" })
  .validator((input) => usernameOf(input?.username))
  .handler(async ({ data: username }) => {
    const sql = await getSql();
    const rows = await sql`
      select u.email
      from profiles p
      join "user" u on u.id = p.user_id
      where lower(p.username) = ${username}
    `;
    if (!rows[0]?.email) throw new Error("Usuário ou senha incorretos.");
    if (
      (
        await sql`
      select p.ativo from profiles p join "user" u on u.id = p.user_id where u.email = ${rows[0].email}
    `
      )[0]?.ativo === false
    )
      throw new Error("Usuário inativo.");
    return { email: rows[0].email };
  });
function temaVisual(value) {
  const row = value ?? {};
  const imagem = (campo) => {
    try {
      return imageOf(campo);
    } catch {
      return "";
    }
  };
  const fundo = (campo) => {
    try {
      return fundoOf(campo);
    } catch {
      return "";
    }
  };
  const icone = (campo) => {
    try {
      return faviconOf(campo);
    } catch {
      return "";
    }
  };
  return {
    cor: corOpcional(row.cor, "#0056b3"),
    corTexto: corOpcional(row.corTexto, "#e8eef3"),
    corCard: corOpcional(row.corCard, "#15202b"),
    corMenu: corOpcional(row.corMenu, "#0d1520"),
    corFundoLogin: corOpcional(row.corFundoLogin, "#0a121c"),
    corFundoSistema: corOpcional(row.corFundoSistema, "#0d1520"),
    fundoModoLogin: fundoModo(row.fundoModoLogin),
    fundoModoSistema: fundoModo(row.fundoModoSistema),
    fundoLogin: fundo(row.fundoLogin),
    fundoSistema: fundo(row.fundoSistema),
    logo: imagem(row.logo),
    logoClara: imagem(row.logoClara),
    favicon: icone(row.favicon),
    logoMenu: imagem(row.logoMenu),
    logoLogin: imagem(row.logoLogin),
    logoSistema: imagem(row.logoSistema),
    tituloAba: clip(row.tituloAba, 80),
    textoLogin: clip(row.textoLogin, 80),
    nomeRodape: clip(row.nomeRodape, 80),
    loginLado: loginLadoOf(row.loginLado),
  };
}
export const listTemas = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    if (!ehDono((await member(context.userId)).role))
      throw new Error("Seu usuário não tem acesso a esta ação.");
    return (await (await getSql())`select id, nome, dados from temas order by nome`).map((row) => ({
      id: String(row.id),
      nome: row.nome,
      dados: temaVisual(JSON.parse(row.dados || "{}")),
    }));
  });
export const saveTema = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input) => {
    const row = input ?? {};
    const nome = clip(row.nome, 40);
    if (nome.length < 2) throw new Error("Informe o nome do tema.");
    return {
      nome,
      dados: JSON.stringify(temaVisual(row.dados)),
    };
  })
  .handler(async ({ context, data }) => {
    await exigirSuper(context.userId);
    const rows = await (await getSql())`
      insert into temas (nome, dados) values (${data.nome}, ${data.dados})
      on conflict (nome) do update set dados = excluded.dados
      returning id
    `;
    return {
      id: String(rows[0].id),
      nome: data.nome,
    };
  });
export const deleteTema = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input) => {
    const id = clip(typeof input === "object" && input && "id" in input ? input.id : input, 12);
    if (!id) throw new Error("Tema inválido.");
    return { id };
  })
  .handler(async ({ context, data }) => {
    await exigirSuper(context.userId);
    await (await getSql())`delete from temas where id = ${data.id}`;
    return { ok: true };
  });
export const usarTema = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input) => {
    const id = clip(typeof input === "object" && input && "id" in input ? input.id : input, 12);
    if (!id) throw new Error("Tema inválido.");
    return { id };
  })
  .handler(async ({ context, data }) => {
    if (!ehDono((await member(context.userId)).role))
      throw new Error("Seu usuário não tem acesso a esta ação.");
    const sql = await getSql();
    const rows = await sql`select dados from temas where id = ${data.id}`;
    if (!rows[0]) throw new Error("Tema não encontrado.");
    const tema = temaVisual(JSON.parse(rows[0].dados || "{}"));
    await sql`
      update empresa set
        cor = ${tema.cor},
        cor_texto = ${tema.corTexto},
        cor_card = ${tema.corCard},
        cor_menu = ${tema.corMenu},
        cor_fundo_login = ${tema.corFundoLogin},
        cor_fundo_sistema = ${tema.corFundoSistema},
        fundo_modo_login = ${tema.fundoModoLogin},
        fundo_modo_sistema = ${tema.fundoModoSistema},
        fundo_login = ${tema.fundoLogin},
        fundo_sistema = ${tema.fundoSistema},
        logo = ${tema.logo},
        logo_clara = ${tema.logoClara},
        favicon = ${tema.favicon},
        logo_menu = ${tema.logoMenu},
        logo_login = ${tema.logoLogin},
        logo_sistema = ${tema.logoSistema},
        titulo_aba = ${tema.tituloAba},
        texto_login = ${tema.textoLogin},
        nome_rodape = ${tema.nomeRodape},
        login_lado = ${tema.loginLado}
      where id = 1
    `;
    return { ok: true };
  });
export const usarModelo = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input) => {
    const row = input ?? {};
    return {
      cor: corOf(row.cor),
      corTexto: corOpcional(row.corTexto, "#e8eef3"),
      corCard: corOpcional(row.corCard, "#15202b"),
      corMenu: corOpcional(row.corMenu, "#0d1520"),
      corFundoLogin: corOpcional(row.corFundoLogin, "#0a121c"),
      corFundoSistema: corOpcional(row.corFundoSistema, "#0d1520"),
      fundoModoLogin: fundoModo(row.fundoModoLogin),
      fundoModoSistema: fundoModo(row.fundoModoSistema),
    };
  })
  .handler(async ({ context, data }) => {
    if (!ehDono((await member(context.userId)).role))
      throw new Error("Seu usuário não tem acesso a esta ação.");
    await (await getSql())`
      update empresa set
        cor = ${data.cor},
        cor_texto = ${data.corTexto},
        cor_card = ${data.corCard},
        cor_menu = ${data.corMenu},
        cor_fundo_login = ${data.corFundoLogin},
        cor_fundo_sistema = ${data.corFundoSistema},
        fundo_modo_login = ${data.fundoModoLogin},
        fundo_modo_sistema = ${data.fundoModoSistema}
      where id = 1
    `;
    return { ok: true };
  });
