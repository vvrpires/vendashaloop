import { createServerFn } from "@tanstack/react-start";
import { access, readFile, rename, writeFile } from "node:fs/promises";
import { authMiddleware } from "@/lib/auth/middleware";
import { getSql } from "@/lib/db";
import { pendingMigrations } from "../../scripts/migration-plan.mjs";

const migrations = import.meta.glob("/migrations/*.sql", {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>;
const ENV_FILE = "/opt/haloop-vendas/.env";
function destinoDe(url) {
  try {
    const parsed = new URL(url);
    const porta = parsed.port || "5432";
    const nome = parsed.pathname.replace(/^\//, "") || "postgres";
    return `${parsed.hostname}:${porta}/${nome}`;
  } catch {
    return "";
  }
}
function enderecoValido(url) {
  const limpo = url.trim();
  if (!/^postgres(ql)?:\/\//i.test(limpo))
    throw new Error("Cole o endereço do Supabase que começa com postgresql://");
  if (limpo.length > 2e3 || /\s/.test(limpo))
    throw new Error("O endereço do banco está incompleto ou tem espaço no meio.");
  let parsed;
  try {
    parsed = new URL(limpo);
  } catch {
    throw new Error("Esse endereço não é um link válido do Postgres.");
  }
  if (!parsed.hostname || !parsed.username || !parsed.password)
    throw new Error("O endereço precisa ter usuário e senha, como o URI do Supabase.");
  return limpo;
}
async function exigirAdmin(userId) {
  if ((await (await getSql())`select role from profiles where user_id = ${userId}`)[0]?.role !== "superadmin")
    throw new Error("Apenas o administrador do sistema pode alterar o banco.");
}
async function aplicarMigrations(url) {
  const { default: pg } = await import("pg");
  const pool = new pg.Pool({
    connectionString: url,
    max: 1,
    connectionTimeoutMillis: 12e3,
    ssl: url.includes("supabase") ? { rejectUnauthorized: false } : undefined,
  });
  const client = await pool.connect();
  try {
    await client.query("select 1");
    await client.query(
      "create table if not exists _migrations (name text primary key, applied_at timestamptz not null default now())",
    );
    const applied = (await client.query("select name from _migrations")).rows.map((row) => row.name);
    for (const { name, path } of pendingMigrations(Object.keys(migrations), applied)) {
      const text = migrations[path];
      try {
        await client.query("begin");
        await client.query(text);
        await client.query("insert into _migrations (name) values ($1)", [name]);
        await client.query("commit");
      } catch (err) {
        try {
          await client.query("rollback");
        } catch {}
        const detalhe = err instanceof Error ? err.message : "falha ao preparar as tabelas";
        throw new Error(`Conectou, mas não consegui preparar o banco: ${detalhe}`);
      }
    }
  } finally {
    client.release();
    await pool.end();
  }
}
function linhaEnv(url) {
  return `DATABASE_URL='${url.replace(/'/g, `'\\''`)}'`;
}
async function gravarEnv(url) {
  const atual = await readFile(ENV_FILE, "utf8").catch(() => "");
  if (!atual) throw new Error("Não encontrei a configuração do servidor para gravar o banco.");
  const linhas = atual.split("\n").filter((linha) => !linha.startsWith("DATABASE_URL="));
  while (linhas.length && linhas[linhas.length - 1] === "") linhas.pop();
  linhas.unshift(linhaEnv(url));
  const novo = `${linhas.join("\n")}\n`;
  const temporario = `${ENV_FILE}.tmp`;
  await writeFile(temporario, novo, { mode: 384 });
  await rename(temporario, ENV_FILE);
}
async function bancoAtualResponde() {
  const url = process.env.DATABASE_URL?.trim();
  if (!url) return false;
  const { default: pg } = await import("pg");
  const pool = new pg.Pool({
    connectionString: url,
    max: 1,
    connectionTimeoutMillis: 8e3,
    ssl: url.includes("supabase") ? { rejectUnauthorized: false } : undefined,
  });
  try {
    const client = await pool.connect();
    try {
      await client.query("select 1");
      return true;
    } finally {
      client.release();
    }
  } catch {
    return false;
  } finally {
    await pool.end().catch(() => undefined);
  }
}
export const statusBanco = createServerFn({ method: "GET" }).handler(async () => {
  return { conectado: await bancoAtualResponde() };
});
export const conectarBanco = createServerFn({ method: "POST" })
  .validator((input) => {
    return {
      url: enderecoValido(typeof input === "object" && input && "url" in input ? String(input.url) : ""),
    };
  })
  .handler(async ({ data }) => {
    if (await bancoAtualResponde()) throw new Error("O banco já está conectado.");
    await access(ENV_FILE).catch(() => {
      throw new Error("Abra o sistema no servidor da empresa para gravar o banco.");
    });
    await aplicarMigrations(data.url);
    await gravarEnv(data.url);
    setTimeout(() => {
      process.exit(0);
    }, 1200);
    return { ok: true };
  });
export const getBanco = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    await exigirAdmin(context.userId);
    const destino = destinoDe(process.env.DATABASE_URL?.trim() ?? "");
    return {
      destino,
      configurado: Boolean(destino),
    };
  });
export const saveBanco = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input) => {
    return {
      url: enderecoValido(typeof input === "object" && input && "url" in input ? String(input.url) : ""),
    };
  })
  .handler(async ({ context, data }) => {
    await exigirAdmin(context.userId);
    await access(ENV_FILE).catch(() => {
      throw new Error(
        "Abra o sistema no servidor da empresa para gravar o banco. Nesta prévia o arquivo de configuração não existe.",
      );
    });
    const atual = process.env.DATABASE_URL?.trim() ?? "";
    await aplicarMigrations(data.url);
    if (atual === data.url)
      return {
        destino: destinoDe(data.url),
        reiniciando: false,
      };
    await gravarEnv(data.url);
    setTimeout(() => {
      process.exit(0);
    }, 1200);
    return {
      destino: destinoDe(data.url),
      reiniciando: true,
    };
  });
