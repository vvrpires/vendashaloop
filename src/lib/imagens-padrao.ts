// Imagens padrão do sistema (rev.38).
// Este arquivo é gerado por `node --env-file=.env scripts/exportar-imagens-padrao.mjs`,
// que copia as imagens cadastradas no banco para public/padrao/.
// Quando um campo de imagem do Tema fica vazio, o sistema usa a imagem daqui.
export type ChaveImagem = "logoLogin" | "logoSistema" | "logo" | "logoMenu" | "fundoLogin" | "favicon";

export const IMAGENS_PADRAO: Partial<Record<ChaveImagem, string>> = {};

export function imagemPadrao(chave: ChaveImagem): string {
  return IMAGENS_PADRAO[chave] ?? "";
}
