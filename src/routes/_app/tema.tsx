import { createFileRoute } from "@tanstack/react-router";
import { useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Button, Card } from "@/components/ui";
import { MODELOS_TEMA } from "@/lib/modelos-tema";
import { ensureProfile, listTemas, usarModelo, usarTema } from "@/lib/vendas.functions";

export const Route = createFileRoute("/_app/tema")({ component: TemaPage });

export function TemaPage() {
  const router = useRouter();
  const [linhas, setLinhas] = useState([]);
  const [erro, setErro] = useState("");
  const [acesso, setAcesso] = useState(false);
  const [pronto, setPronto] = useState(false);
  useEffect(() => {
    ensureProfile()
      .then(async (profile) => {
        if (profile.role !== "admin" && profile.role !== "superadmin") return;
        setAcesso(true);
        setLinhas(await listTemas());
      })
      .catch((err) => setErro(err instanceof Error ? err.message : "Não foi possível carregar."))
      .finally(() => setPronto(true));
  }, []);
  if (!pronto) return <p className="text-sm text-muted">Carregando…</p>;
  if (!acesso) return <p className="text-sm text-muted">Você não tem acesso.</p>;
  const nomesPadrao = new Set(MODELOS_TEMA.map((modelo) => modelo.nome));
  // rev.45: nomes dos temas em CAIXA ALTA (os antigos "Padrão", "Noite"... continuam reconhecidos)
  const personalizados = linhas.filter(
    (tema) => !nomesPadrao.has(String(tema.nome).toLocaleUpperCase("pt-BR")),
  );
  return (
    <div className="space-y-4">
      <h1 className="font-display text-3xl font-medium tracking-tight">Tema</h1>
      {erro ? <p className="text-sm text-danger">{erro}</p> : null}
      <div className="grid gap-3">
        {MODELOS_TEMA.map((modelo) => (
          <Card key={modelo.nome}>
            <div className="flex items-center justify-between gap-3">
              <p className="font-semibold">{modelo.nome}</p>
              <Button
                type="button"
                onClick={() =>
                  usarModelo({ data: modelo.valores })
                    .then(() => router.invalidate())
                    .catch((err) =>
                      setErro(err instanceof Error ? err.message : "Não foi possível usar o tema."),
                    )
                }
              >
                Usar
              </Button>
            </div>
          </Card>
        ))}
        {personalizados.map((tema) => (
          <Card key={tema.id}>
            <div className="flex items-center justify-between gap-3">
              <p className="font-semibold">{String(tema.nome).toLocaleUpperCase("pt-BR")}</p>
              <Button
                type="button"
                onClick={() =>
                  usarTema({ data: { id: tema.id } })
                    .then(() => router.invalidate())
                    .catch((err) =>
                      setErro(err instanceof Error ? err.message : "Não foi possível usar o tema."),
                    )
                }
              >
                Usar
              </Button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
