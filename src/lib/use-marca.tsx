import { useEffect } from "react";
import { Route as RootRoute } from "@/routes/__root";
import { imagemPadrao, type ChaveImagem } from "@/lib/imagens-padrao";

const fallback = {
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
};
function canal(hex) {
  const limpo = hex.replace("#", "");
  const cheio =
    limpo.length === 3
      ? limpo
          .split("")
          .map((c) => c + c)
          .join("")
      : limpo.padEnd(6, "0");
  const valor = Number.parseInt(cheio.slice(0, 6), 16);
  if (Number.isNaN(valor)) return [13, 21, 32];
  return [(valor >> 16) & 255, (valor >> 8) & 255, valor & 255];
}
function misturar(origem, destino, peso) {
  const a = canal(origem);
  const b = canal(destino);
  return `#${a
    .map((parte, indice) => Math.round(parte + (b[indice] - parte) * peso))
    .map((parte) => parte.toString(16).padStart(2, "0"))
    .join("")}`;
}
/** Imagem do campo ou, se estiver vazio, a imagem padrão do sistema (rev.38). */
export function imagemDe(marca, chave: ChaveImagem): string {
  return String(marca?.[chave] ?? "") || imagemPadrao(chave, marca);
}
const faviconVazio = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";
export function aplicarTema(marca) {
  const texto = marca.corTexto || "#e8eef3";
  const card = marca.corCard || "#15202b";
  const fundo = marca.corFundoSistema || "#0d1520";
  const root = document.documentElement;
  root.style.setProperty("--color-accent", marca.cor || "#0056b3");
  root.style.setProperty("--color-ink", texto);
  root.style.setProperty("--color-surface", card);
  root.style.setProperty("--color-bg", fundo);
  root.style.setProperty("--color-form", misturar(card, texto, 0.08));
  root.style.setProperty("--color-line", misturar(card, texto, 0.22));
  root.style.setProperty("--color-muted", misturar(texto, fundo, 0.45));
  document.title = marca.tituloAba?.trim() || "";
}
export function useMarca() {
  const marca = RootRoute.useLoaderData() ?? fallback;
  useEffect(() => {
    aplicarTema(marca);
    const href = imagemDe(marca, "favicon") || faviconVazio;
    for (const rel of ["icon", "apple-touch-icon"]) {
      let link = document.querySelector(`link[rel='${rel}']`);
      if (!link) {
        link = document.createElement("link");
        link.rel = rel;
        document.head.appendChild(link);
      }
      link.href = href;
    }
  }, [marca]);
  return marca;
}
export function fundoStyle(modo, cor, imagem) {
  if (modo === "imagem" && imagem)
    return {
      backgroundImage: `url("${imagem}")`,
      backgroundSize: "cover",
      backgroundPosition: "center",
    };
  if (modo === "cor") return { backgroundColor: cor || "#0d1520" };
}
export function BrandLogo({ marca, slot = "sistema", className = "h-9 w-auto" }) {
  const src = imagemDe(marca, slot === "login" ? "logoLogin" : slot === "pdf" ? "logo" : "logoSistema");
  if (!src) return null;
  return <img src={src} alt={marca.nome || ""} className={className} />;
}
