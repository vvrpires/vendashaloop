// Imagens padrão do sistema (rev.40).
// Os arquivos ficam em public/padrao/. O script scripts/exportar-imagens-padrao.mjs
// pode trocar estes padrões pelas imagens cadastradas no Tema de um servidor.
// Quando um campo de imagem do Tema fica vazio, o sistema usa a imagem daqui.
export type ChaveImagem = "logoLogin" | "logoSistema" | "logo" | "logoMenu" | "fundoLogin" | "favicon";

export const IMAGENS_PADRAO: Partial<Record<ChaveImagem, string>> = {
  logoLogin: "/padrao/logo-login.png",
  logoSistema: "/padrao/logo-sistema.png",
  logo: "/padrao/logo-pdf.png",
  logoMenu: "/padrao/logo-menu.png",
  favicon: "/padrao/favicon.png",
};

// rev.46: imagens padrão para temas claros (texto escuro sobre fundo claro), em public/padrao/claro/.
// Se faltar alguma, usa a imagem padrão normal.
export const IMAGENS_PADRAO_CLARO: Partial<Record<ChaveImagem, string>> = {
  logoLogin: "/padrao/claro/logo-login.png",
  logoSistema: "/padrao/claro/logo-sistema.png",
};

function luz(hex: string): number {
  const limpo = String(hex ?? "").replace("#", "");
  const cheio =
    limpo.length === 3
      ? limpo
          .split("")
          .map((c) => c + c)
          .join("")
      : limpo.padEnd(6, "0");
  const valor = Number.parseInt(cheio.slice(0, 6), 16);
  if (Number.isNaN(valor)) return 1;
  const [r, g, b] = [(valor >> 16) & 255, (valor >> 8) & 255, valor & 255];
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}

/** Tema claro = cor do texto escura (ex.: CLARO, AREIA ou um tema criado com fundo claro). */
export function temaClaro(marca?: { corTexto?: string } | null): boolean {
  return Boolean(marca?.corTexto) && luz(String(marca?.corTexto)) < 0.45;
}

export function imagemPadrao(chave: ChaveImagem, marca?: { corTexto?: string } | null): string {
  if (chave !== "logo" && temaClaro(marca) && IMAGENS_PADRAO_CLARO[chave])
    return IMAGENS_PADRAO_CLARO[chave] ?? "";
  return IMAGENS_PADRAO[chave] ?? "";
}
