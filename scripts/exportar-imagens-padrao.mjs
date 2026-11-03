// Transforma as imagens cadastradas no Tema em imagens padrão do sistema (rev.38/rev.40).
// Campo vazio no banco mantém o padrão que já existe em public/padrao/.
// Uso (na pasta do projeto, antes do build):  node --env-file=.env scripts/exportar-imagens-padrao.mjs
// Grava os arquivos em public/padrao/ e atualiza src/lib/imagens-padrao.ts.
import { mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import pg from "pg";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL não definido. Rode com: node --env-file=.env scripts/exportar-imagens-padrao.mjs");
  process.exit(1);
}

const campos = {
  logoLogin: "logo_login",
  logoSistema: "logo_sistema",
  logo: "logo",
  logoMenu: "logo_menu",
  fundoLogin: "fundo_login",
  favicon: "favicon",
};
const arquivos = {
  logoLogin: "logo-login",
  logoSistema: "logo-sistema",
  logo: "logo-pdf",
  logoMenu: "logo-menu",
  fundoLogin: "fundo-login",
  favicon: "favicon",
};
const extensoes = { "image/png": "png", "image/jpeg": "jpg", "image/jpg": "jpg", "image/webp": "webp" };

const pool = new pg.Pool({
  connectionString: url,
  ssl: url.includes("supabase") ? { rejectUnauthorized: false } : undefined,
});
const { rows } = await pool.query(`select ${Object.values(campos).join(", ")} from empresa where id = 1`);
await pool.end();
const linha = rows[0] ?? {};

await mkdir("public/padrao", { recursive: true });
const existentes = await readdir("public/padrao");
const mapa = {};
for (const [chave, coluna] of Object.entries(campos)) {
  const base = arquivos[chave];
  const atual = existentes.find((nome) => nome.replace(/\.[a-z]+$/, "") === base);
  const valor = String(linha[coluna] ?? "");
  const m = valor.match(/^data:(image\/[a-z]+);base64,(.+)$/i);
  if (!m) {
    if (atual) {
      mapa[chave] = `/padrao/${atual}`;
      console.log(`- ${chave}: vazio no banco, mantém o padrão public/padrao/${atual}`);
    } else {
      console.log(`- ${chave}: vazio, sem padrão`);
    }
    continue;
  }
  const ext = extensoes[m[1].toLowerCase()] ?? "png";
  const nome = `${base}.${ext}`;
  if (atual && atual !== nome) await rm(`public/padrao/${atual}`, { force: true });
  await writeFile(`public/padrao/${nome}`, Buffer.from(m[2].replace(/\s/g, ""), "base64"));
  mapa[chave] = `/padrao/${nome}`;
  console.log(`- ${chave}: public/padrao/${nome} (do Tema do banco)`);
}

// rev.46: troca só a lista IMAGENS_PADRAO e mantém o resto do arquivo
// (as imagens do tema claro e as funções). Antes o arquivo era recriado inteiro
// e as imagens padrão do tema claro deixavam de funcionar.
const arquivoTs = "src/lib/imagens-padrao.ts";
const atualTs = await readFile(arquivoTs, "utf8");
const listaNova = `export const IMAGENS_PADRAO: Partial<Record<ChaveImagem, string>> = ${JSON.stringify(mapa, null, 2)};`;
const ts = atualTs.replace(/export const IMAGENS_PADRAO: Partial<Record<ChaveImagem, string>> = \{[^}]*\};/, listaNova);
if (ts === atualTs && !atualTs.includes(listaNova)) {
  console.error("Não achei a lista IMAGENS_PADRAO em " + arquivoTs + "; arquivo mantido.");
  process.exit(1);
}
await writeFile(arquivoTs, ts);
console.log("Pronto: src/lib/imagens-padrao.ts atualizado.");
