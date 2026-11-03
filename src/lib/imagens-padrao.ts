// Imagens padrão do sistema (rev.40).
// Os arquivos ficam em public/padrao/. O script scripts/exportar-imagens-padrao.mjs
// pode trocar estes padrões pelas imagens cadastradas no Tema de um servidor.
// Quando um campo de imagem do Tema fica vazio, o sistema usa a imagem daqui.
export type ChaveImagem = "logoLogin" | "logoSistema" | "logo" | "logoMenu" | "fundoLogin" | "favicon";

export const IMAGENS_PADRAO: Partial<Record<ChaveImagem, string>> = {
  "logoLogin": "/padrao/logo-login.png",
  "logoSistema": "/padrao/logo-sistema.png",
  "logo": "/padrao/logo-pdf.png",
  "logoMenu": "/padrao/logo-menu.png",
  "favicon": "/padrao/favicon.png"
};

export function imagemPadrao(chave: ChaveImagem): string {
  return IMAGENS_PADRAO[chave] ?? "";
}
