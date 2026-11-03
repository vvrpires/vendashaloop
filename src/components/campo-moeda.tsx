import type { ClipboardEvent, InputHTMLAttributes, KeyboardEvent } from "react";
import { TextInput } from "@/components/ui";

/**
 * Campo de dinheiro (rev.43): mostra e digita no formato brasileiro, 1.234,56.
 * A digitação preenche pelos centavos, sempre pelo final, não importa onde está o cursor:
 *   1 -> 0,01 · 12 -> 0,12 · 1234 -> 12,34 · 123456 -> 1.234,56 · Backspace apaga o último dígito.
 * Colar "1.234,56", "1234,56" ou "1234.56" também funciona.
 * Devolve o número em `e.target.value` (ex.: "1234.56"), igual a um input numérico.
 */
type Props = Omit<InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "type"> & {
  value: number | string;
  onChange: (e: { target: { value: string } }) => void;
};

const MAX_CENTAVOS = 9_999_999_999_99; // até R$ 9.999.999.999,99

export function formatarMoeda(valor: number | string): string {
  const n = Number(valor) || 0;
  return n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** Converte texto colado em número: aceita 1.234,56 · 1234,56 · 1234.56 · 1234 */
export function lerMoeda(texto: string): number {
  const limpo = String(texto ?? "").replace(/[^\d.,]/g, "");
  if (!limpo) return 0;
  const virgula = limpo.lastIndexOf(",");
  const ponto = limpo.lastIndexOf(".");
  let normal = limpo;
  if (virgula > ponto) normal = limpo.replace(/\./g, "").replace(",", ".");
  else if (ponto > virgula && limpo.length - ponto - 1 !== 3) normal = limpo.replace(/,/g, "");
  else normal = limpo.replace(/[.,]/g, "");
  const n = Number(normal);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : 0;
}

export function CampoMoeda({ value, onChange, className = "", ...props }: Props) {
  const centavos = Math.round((Number(value) || 0) * 100);
  const enviar = (novo: number) => {
    const limitado = Math.max(0, Math.min(MAX_CENTAVOS, novo));
    onChange({ target: { value: String(limitado / 100) } });
  };
  const fimDoCampo = (alvo: HTMLInputElement) =>
    requestAnimationFrame(() => alvo.setSelectionRange(alvo.value.length, alvo.value.length));

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (/^\d$/.test(e.key)) {
      e.preventDefault();
      enviar(centavos * 10 + Number(e.key));
      fimDoCampo(e.currentTarget);
    } else if (e.key === "Backspace" || e.key === "Delete") {
      e.preventDefault();
      enviar(Math.floor(centavos / 10));
      fimDoCampo(e.currentTarget);
    }
  }
  function onPaste(e: ClipboardEvent<HTMLInputElement>) {
    e.preventDefault();
    enviar(Math.round(lerMoeda(e.clipboardData.getData("text")) * 100));
  }

  return (
    <div className={`relative ${className}`}>
      <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm text-muted">
        R$
      </span>
      <TextInput
        {...props}
        type="text"
        inputMode="numeric"
        className="pl-10 text-right tabular-nums"
        value={formatarMoeda(centavos / 100)}
        onKeyDown={onKeyDown}
        onPaste={onPaste}
        onChange={(e) => {
          // celulares que não informam a tecla: usa os dígitos do texto
          const digitos = e.target.value.replace(/\D/g, "").slice(0, 12);
          enviar(Number(digitos || "0"));
        }}
        onFocus={(e) => fimDoCampo(e.target)}
        onClick={(e) => fimDoCampo(e.currentTarget)}
      />
    </div>
  );
}
