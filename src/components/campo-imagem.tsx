import { useRef, useState } from "react";

/**
 * Campo de imagem do Tema (rev.38): área destacada para clicar ou arrastar o arquivo,
 * prévia da imagem atual e indicação se é a imagem padrão do sistema.
 */
export function CampoImagem({
  titulo,
  ajuda,
  valor,
  padrao = "",
  onArquivo,
  onLimpar,
  quadrado = false,
  fundoClaro = false,
}: {
  titulo: string;
  ajuda: string;
  valor: string;
  padrao?: string;
  onArquivo: (file: File) => void;
  onLimpar: () => void;
  quadrado?: boolean;
  fundoClaro?: boolean;
}) {
  const entrada = useRef<HTMLInputElement>(null);
  const [arrastando, setArrastando] = useState(false);
  const mostrar = valor || padrao;
  return (
    <div className="flex flex-col gap-2 rounded-lg border border-line bg-surface p-3">
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-sm font-semibold">{titulo}</p>
        {valor ? (
          <span className="text-[11px] font-semibold text-accent">Personalizada</span>
        ) : padrao ? (
          <span className="text-[11px] text-muted">Padrão do sistema</span>
        ) : null}
      </div>
      <p className="text-xs text-muted">{ajuda}</p>
      <button
        type="button"
        onClick={() => entrada.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setArrastando(true);
        }}
        onDragLeave={() => setArrastando(false)}
        onDrop={(e) => {
          e.preventDefault();
          setArrastando(false);
          const file = e.dataTransfer.files?.[0];
          if (file) onArquivo(file);
        }}
        className={`flex min-h-28 flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-3 text-center transition-colors duration-150 ${
          arrastando
            ? "border-accent bg-accent/15"
            : "border-accent/50 bg-form hover:border-accent hover:bg-accent/5"
        }`}
      >
        {mostrar ? (
          <img
            src={mostrar}
            alt=""
            className={quadrado ? "h-12 w-12 object-contain" : "max-h-16 max-w-full object-contain"}
            style={fundoClaro ? { background: "#fff", padding: 4, borderRadius: 4 } : undefined}
          />
        ) : null}
        <span className="text-xs font-semibold text-accent">
          {mostrar ? "Clique ou arraste para trocar" : "Clique ou arraste a imagem aqui"}
        </span>
      </button>
      {valor ? (
        <button
          type="button"
          className="self-start text-xs text-muted underline-offset-4 hover:text-ink hover:underline"
          onClick={onLimpar}
        >
          {padrao ? "Voltar ao padrão" : "Remover"}
        </button>
      ) : null}
      <input
        ref={entrada}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onArquivo(file);
          e.target.value = "";
        }}
      />
    </div>
  );
}
