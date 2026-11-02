import { createServerFn } from "@tanstack/react-start";
import forge from "node-forge";
import { existsSync } from "node:fs";
import { dirname } from "node:path";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { authMiddleware } from "@/lib/auth/middleware";
import { getSql } from "@/lib/db";

const ENV_FILE = "/opt/haloop-vendas/.env";
export function caminhoCertificado() {
  return process.env.NFE_CERT_PATH || "/opt/haloop-vendas/certificado.pfx";
}
export function certificadoAusente() {
  return "Envie o certificado A1 em Minha empresa.";
}
async function exigirAdmin(userId) {
  if ((await (await getSql())`select role from profiles where user_id = ${userId}`)[0]?.role !== "superadmin")
    throw new Error("Apenas o administrador do sistema envia o certificado.");
}
function abrirPfx(pfx, senha) {
  try {
    const asn1 = forge.asn1.fromDer(forge.util.createBuffer(pfx.toString("binary")));
    const p12 = forge.pkcs12.pkcs12FromAsn1(asn1, senha);
    const chave = p12.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag })[
      forge.pki.oids.pkcs8ShroudedKeyBag
    ]?.[0];
    const cert = p12.getBags({ bagType: forge.pki.oids.certBag })[forge.pki.oids.certBag]?.[0];
    if (!chave?.key || !cert?.cert) throw new Error("vazio");
    return cert.cert.subject.getField("CN")?.value || "";
  } catch {
    throw new Error("Não foi possível abrir o certificado. Confira o arquivo e a senha.");
  }
}
async function gravarEnv(chave, valor) {
  const atual = await readFile(ENV_FILE, "utf8").catch(() => "");
  if (!atual) throw new Error("Abra o sistema no servidor para gravar o certificado.");
  const linhas = atual.split("\n").filter((linha) => !linha.startsWith(`${chave}=`));
  while (linhas.length && linhas[linhas.length - 1] === "") linhas.pop();
  const seguro = valor.replace(/'/g, "'\\''");
  linhas.push(`${chave}='${seguro}'`);
  const temporario = `${ENV_FILE}.tmp`;
  await writeFile(temporario, `${linhas.join("\n")}\n`, { mode: 384 });
  await rename(temporario, ENV_FILE);
}
export const statusCertificado = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    await exigirAdmin(context.userId);
    const arquivo = caminhoCertificado();
    return { instalado: Boolean(process.env.NFE_CERT_PASSWORD) && existsSync(arquivo) };
  });
export const salvarCertificado = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input) => {
    const row = input ?? {};
    const arquivo = String(row.arquivo ?? "").replace(/\s/g, "");
    const senha = String(row.senha ?? "");
    if (!arquivo || !senha) throw new Error("Envie o arquivo .pfx e a senha.");
    if (arquivo.length > 3e5) throw new Error("O certificado é grande demais.");
    return {
      arquivo,
      senha,
    };
  })
  .handler(async ({ context, data }) => {
    await exigirAdmin(context.userId);
    const pfx = Buffer.from(data.arquivo, "base64");
    const titular = abrirPfx(pfx, data.senha);
    const destino = caminhoCertificado();
    await mkdir(dirname(destino), { recursive: true });
    await writeFile(destino, pfx, { mode: 384 });
    await gravarEnv("NFE_CERT_PATH", destino);
    await gravarEnv("NFE_CERT_PASSWORD", data.senha);
    process.env.NFE_CERT_PATH = destino;
    process.env.NFE_CERT_PASSWORD = data.senha;
    return {
      ok: true,
      titular: String(titular),
    };
  });
