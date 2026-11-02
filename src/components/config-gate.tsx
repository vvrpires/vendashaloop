import { useEffect, useState, type ReactNode } from "react";
import { ensureProfile } from "@/lib/vendas.functions";

/**
 * Acesso à área Configuração (rev.38): só o superadmin entra, direto, sem senha extra.
 * As funções do servidor continuam exigindo o papel de superadmin.
 */
export function ConfigGate({ children }: { children: ReactNode }) {
  const [perfil, setPerfil] = useState("");
  const [erro, setErro] = useState("");
  const [pronta, setPronta] = useState(false);
  useEffect(() => {
    ensureProfile()
      .then((profile) => setPerfil(profile.role))
      .catch((err) => setErro(err instanceof Error ? err.message : "Não foi possível abrir."))
      .finally(() => setPronta(true));
  }, []);
  if (!pronta) return <p className="text-sm text-muted">Carregando…</p>;
  if (erro) return <p className="text-sm text-danger">{erro}</p>;
  if (perfil !== "superadmin") return <p className="text-sm text-muted">Você não tem acesso.</p>;
  return <>{children}</>;
}
