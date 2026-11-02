// rev.38: transforma as imagens cadastradas hoje no Tema em imagens padrão do sistema.
// Uso (na pasta do projeto, antes do build):  node --env-file=.env scripts/exportar-imagens-padrao.mjs
// Grava os arquivos em public/padrao/ e atualiza src/lib/imagens-padrao.ts.
import { mkdir, writeFile } from "node:fs/promises";
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
const mapa = {};
for (const [chave, coluna] of Object.entries(campos)) {
  const valor = String(linha[coluna] ?? "");
  const m = valor.match(/^data:(image\/[a-z]+);base64,(.+)$/i);
  if (!m) {
    console.log(`- ${chave}: vazio, sem padrão`);
    continue;
  }
  const ext = extensoes[m[1].toLowerCase()] ?? "png";
  const nome = `${arquivos[chave]}.${ext}`;
  await writeFile(`public/padrao/${nome}`, Buffer.from(m[2].replace(/\s/g, ""), "base64"));
  mapa[chave] = `/padrao/${nome}`;
  console.log(`- ${chave}: public/padrao/${nome}`);
}

const ts = `// Imagens padrão do sistema (rev.38).
// Este arquivo é gerado por \`node --env-file=.env scripts/exportar-imagens-padrao.mjs\`,
// que copia as imagens cadastradas no banco para public/padrao/.
// Quando um campo de imagem do Tema fica vazio, o sistema usa a imagem daqui.
export type ChaveImagem = "logoLogin" | "logoSistema" | "logo" | "logoMenu" | "fundoLogin" | "favicon";

export const IMAGENS_PADRAO: Partial<Record<ChaveImagem, string>> = ${JSON.stringify(mapa, null, 2)};

export function imagemPadrao(chave: ChaveImagem): string {
  return IMAGENS_PADRAO[chave] ?? "";
}
`;
await writeFile("src/lib/imagens-padrao.ts", ts);
console.log("Pronto: src/lib/imagens-padrao.ts atualizado.");
