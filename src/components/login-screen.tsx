import { Link, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { authClient } from "@/lib/auth/client";
import { conectarBanco, statusBanco } from "@/lib/banco.functions";
import { BrandLogo, fundoStyle, imagemDe, useMarca } from "@/lib/use-marca";
import { bootstrapAdmin, findLoginEmail } from "@/lib/vendas.functions";
import { rememberSessionToken } from "@/lib/remember-session";
import { useCurrentUserState } from "@/lib/auth/use-current-user";

export function LoginPage() {
  const router = useRouter();
  const { user, isPending } = useCurrentUserState();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);
  const [fase, setFase] = useState("verificando");
  const [url, setUrl] = useState("");
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const marca = useMarca();
  const fundoLogin = fundoStyle(marca.fundoModoLogin, marca.corFundoLogin, imagemDe(marca, "fundoLogin"));
  function prepararLogin() {
    setFase("login");
    setUrl("");
    bootstrapAdmin()
      .then(() => setReady(true))
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Falha ao preparar o administrador.");
        setReady(true);
      });
  }
  useEffect(() => {
    statusBanco()
      .then((banco) => {
        if (banco.conectado) prepararLogin();
        else setFase("banco");
      })
      .catch(() => setFase("banco"));
  }, []);
  async function onConectar(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await conectarBanco({ data: { url } });
      setUrl("");
      setFase("login");
      setError("");
      for (let tentativa = 0; tentativa < 20; tentativa += 1) {
        await new Promise((resolve) => setTimeout(resolve, 1e3));
        try {
          if ((await statusBanco()).conectado) {
            prepararLogin();
            return;
          }
        } catch {}
      }
      setError("O banco foi gravado, mas o sistema ainda está reiniciando. Atualize a página.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível conectar o banco.");
    } finally {
      setBusy(false);
    }
  }
  async function onSubmit(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const found = await findLoginEmail({ data: { username: username.trim() } });
      const res = await authClient.signIn.email({
        email: found.email,
        password,
      });
      if (res.error) throw new Error("Usuário ou senha incorretos.");
      rememberSessionToken(res.data?.token);
      await authClient.getSession();
      await router.navigate({ to: "/painel" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Usuário ou senha incorretos.");
    } finally {
      setBusy(false);
    }
  }
  const ano = new Date().getFullYear();
  const nomeAcao = marca.textoLogin.trim();
  return (
    <main
      className={`relative flex min-h-screen items-center overflow-hidden bg-[#0a121c] py-8 text-ink ${marca.loginLado === "esquerda" ? "justify-start px-6 lg:px-16" : marca.loginLado === "direita" ? "justify-end px-6 lg:px-16" : "justify-center px-4"}`}
      style={fundoLogin}
    >
      {fundoLogin ? null : (
        <>
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                "radial-gradient(ellipse 80% 55% at 15% 40%, rgba(0,168,255,.14) 0%, transparent 55%), radial-gradient(ellipse 60% 50% at 85% 70%, rgba(0,86,179,.18) 0%, transparent 50%)",
            }}
          />
          <div
            className="pointer-events-none absolute inset-0 opacity-70"
            style={{
              backgroundImage:
                "linear-gradient(rgba(0,168,255,.06) 1px, transparent 1px), linear-gradient(90deg, rgba(0,168,255,.06) 1px, transparent 1px)",
              backgroundSize: "48px 48px",
            }}
          />
        </>
      )}
      <div className="relative w-full max-w-md rounded-lg border border-line bg-surface px-6 py-8">
        {fase === "login" ? (
          <div className="flex flex-col items-center gap-3">
            <BrandLogo marca={marca} slot="login" className="h-14 w-auto" />
            {nomeAcao ? (
              <h2 className="text-center font-display text-2xl font-medium tracking-[0.08em]">{nomeAcao}</h2>
            ) : null}
          </div>
        ) : (
          <h2 className="text-center font-display text-2xl font-medium tracking-[0.18em]">
            {fase === "banco" ? "CONECTAR" : "ENTRAR"}
          </h2>
        )}
        {fase === "verificando" ? (
          <p className="mt-6 text-center text-sm text-muted">Verificando a conexão…</p>
        ) : null}
        {fase === "banco" ? (
          <form className="mt-6 space-y-3" onSubmit={onConectar}>
            <p className="text-sm text-muted">
              Cole o endereço novo do Supabase. Ele não fica visível depois de conectar.
            </p>
            <label className="block text-sm">
              <span className="mb-1.5 block font-medium text-muted">Endereço do banco</span>
              <input
                type="password"
                autoComplete="off"
                className="h-11 w-full rounded border border-line bg-form px-3 text-ink outline-none focus:border-accent"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="postgresql://..."
                required
              />
            </label>
            {error ? <p className="text-sm text-danger">{error}</p> : null}
            <button
              type="submit"
              disabled={busy || !url.trim()}
              className="h-11 w-full rounded bg-accent text-sm font-semibold text-accent-fg disabled:opacity-50"
            >
              {busy ? "Conectando…" : "Conectar"}
            </button>
          </form>
        ) : null}
        {fase === "login" ? (
          <>
            {!isPending && user ? (
              <p className="mt-4 text-center text-sm">
                <Link to="/painel" className="font-semibold text-accent">
                  Continuar para o painel
                </Link>
              </p>
            ) : null}
            {!ready ? (
              <p className="mt-4 text-center text-sm text-muted">Preparando a conta de administrador…</p>
            ) : null}
            <form className="mt-6 space-y-3" onSubmit={onSubmit}>
              <label className="block text-sm">
                <span className="mb-1.5 block font-medium text-muted">Usuário</span>
                <input
                  autoComplete="username"
                  className="h-11 w-full rounded border border-line bg-form px-3 text-ink outline-none focus:border-accent"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                />
              </label>
              <label className="block text-sm">
                <span className="mb-1.5 block font-medium text-muted">Senha</span>
                <span className="flex gap-2">
                  <input
                    type={mostrarSenha ? "text" : "password"}
                    autoComplete="current-password"
                    className="h-11 w-full rounded border border-line bg-form px-3 text-ink outline-none focus:border-accent"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    minLength={1}
                    required
                  />
                  <button
                    type="button"
                    className="h-11 shrink-0 rounded border border-line px-3 text-sm font-semibold"
                    onClick={() => setMostrarSenha((atual) => !atual)}
                  >
                    {mostrarSenha ? "Ocultar" : "Mostrar"}
                  </button>
                </span>
              </label>
              {error ? <p className="text-sm text-danger">{error}</p> : null}
              <button
                type="submit"
                disabled={!ready || busy || false}
                className="h-11 w-full rounded bg-accent text-sm font-semibold text-accent-fg disabled:opacity-50"
              >
                {busy ? "Aguarde…" : "Entrar"}
              </button>
            </form>
          </>
        ) : null}
        <p className="mt-8 text-center text-xs text-muted">
          {`\u00A9 ${ano} Haloop - Todos os direitos reservados`}
        </p>
      </div>
    </main>
  );
}
