import { createServerFn } from "@tanstack/react-start";
import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { authMiddleware } from "@/lib/auth/middleware";
import { getSql } from "@/lib/db";

const scrypt$1 = promisify(scrypt);
async function exigirSuper(userId) {
  if ((await (await getSql())`select role from profiles where user_id = ${userId}`)[0]?.role !== "superadmin")
    throw new Error("Apenas o administrador do sistema entra em Configuração.");
}
async function hashSenha(senha) {
  const salt = randomBytes(16).toString("hex");
  return `${salt}:${(await scrypt$1(senha, salt, 32)).toString("hex")}`;
}
async function confere(senha, salvo) {
  const [salt, hex] = salvo.split(":");
  if (!salt || !hex) return false;
  const key = await scrypt$1(senha, salt, 32);
  const atual = Buffer.from(hex, "hex");
  if (atual.length !== key.length) return false;
  return timingSafeEqual(atual, key);
}
export const statusConfig = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    await exigirSuper(context.userId);
    const rows = await (await getSql())`select senha_config from empresa where id = 1`;
    return { definida: Boolean(rows[0]?.senha_config) };
  });
export const definirSenhaConfig = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input) => {
    const row = input ?? {};
    const senha = String(row.senha ?? "");
    const atual = String(row.atual ?? "");
    if (senha.length < 8) throw new Error("A senha precisa ter pelo menos 8 caracteres.");
    return {
      senha,
      atual,
    };
  })
  .handler(async ({ context, data }) => {
    await exigirSuper(context.userId);
    const sql = await getSql();
    const salva = (await sql`select senha_config from empresa where id = 1`)[0]?.senha_config ?? "";
    if (salva && !(await confere(data.atual, salva))) throw new Error("Senha atual incorreta.");
    await sql`update empresa set senha_config = ${await hashSenha(data.senha)} where id = 1`;
    return { ok: true };
  });
export const entrarConfig = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input) => {
    const senha = String((input ?? {}).senha ?? "");
    if (!senha) throw new Error("Informe a senha.");
    return { senha };
  })
  .handler(async ({ context, data }) => {
    await exigirSuper(context.userId);
    const salva =
      (await (await getSql())`select senha_config from empresa where id = 1`)[0]?.senha_config ?? "";
    if (!salva || !(await confere(data.senha, salva))) throw new Error("Senha incorreta.");
    return { ok: true };
  });
