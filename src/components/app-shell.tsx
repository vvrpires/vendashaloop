import { Link, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { LoginPage } from "@/components/login-screen";
import { Button, Card, Field, TextInput } from "@/components/ui";
import { authClient } from "@/lib/auth/client";
import { UserButton } from "@/lib/auth/gates";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { pode } from "@/lib/permissoes";
import { BrandLogo, fundoStyle, imagemDe, useMarca } from "@/lib/use-marca";
import { definirSenha, ensureProfile } from "@/lib/vendas.functions";

const links = [
  {
    to: "/painel",
    label: "Painel",
    perm: "painel",
    icone: "painel",
  },
  {
    to: "/orcamentos",
    label: "Orçamentos",
    perm: "orcamentos",
    icone: "orcamentos",
  },
  {
    to: "/clientes",
    label: "Clientes",
    perm: "clientes",
    icone: "clientes",
  },
  {
    to: "/produtos",
    label: "Catálogo",
    perm: "produtos",
    icone: "produtos",
  },
  {
    to: "/relatorios",
    label: "Relatórios",
    perm: "relatorios",
    icone: "relatorios",
  },
  {
    to: "/conta",
    label: "Minha conta",
    perm: "",
    icone: "conta",
  },
  {
    to: "/equipe",
    label: "Usuários",
    perm: "usuarios",
    icone: "usuarios",
  },
];
function Icone({ nome }) {
  const comum = {
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.6,
    strokeLinecap: "round",
    strokeLinejoin: "round",
  };
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0" aria-hidden>
      {nome === "painel" ? (
        <>
          <rect x="3" y="3" width="7" height="7" rx="1" {...comum} />
          <rect x="14" y="3" width="7" height="7" rx="1" {...comum} />
          <rect x="3" y="14" width="7" height="7" rx="1" {...comum} />
          <rect x="14" y="14" width="7" height="7" rx="1" {...comum} />
        </>
      ) : null}
      {nome === "orcamentos" ? (
        <>
          <path d="M7 3h7l5 5v13a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z" {...comum} />
          <path d="M14 3v5h5M8 13h8M8 17h5" {...comum} />
        </>
      ) : null}
      {nome === "clientes" ? (
        <>
          <circle cx="12" cy="8" r="3" {...comum} />
          <path d="M5 19c1.5-3 3.8-4.5 7-4.5S17.5 16 19 19" {...comum} />
        </>
      ) : null}
      {nome === "produtos" ? (
        <>
          <path d="M3 7l9-4 9 4-9 4-9-4z" {...comum} />
          <path d="M3 7v10l9 4 9-4V7" {...comum} />
          <path d="M12 11v10" {...comum} />
        </>
      ) : null}
      {nome === "relatorios" ? (
        <>
          <path d="M4 20h16" {...comum} />
          <path d="M7 16v-5M12 16V7M17 16v-8" {...comum} />
        </>
      ) : null}
      {nome === "conta" ? (
        <>
          <circle cx="12" cy="12" r="8" {...comum} />
          <circle cx="12" cy="10" r="2.5" {...comum} />
          <path d="M8 17c.8-1.6 2.2-2.4 4-2.4s3.2.8 4 2.4" {...comum} />
        </>
      ) : null}
      {nome === "empresa" ? (
        <>
          <path d="M4 20V6l8-3 8 3v14" {...comum} />
          <path d="M9 20v-5h6v5M4 20h16" {...comum} />
        </>
      ) : null}
      {nome === "usuarios" ? (
        <>
          <circle cx="9" cy="9" r="2.5" {...comum} />
          <circle cx="16" cy="10" r="2" {...comum} />
          <path
            d="M4 18c.8-2.2 2.6-3.3 5-3.3s4.2 1.1 5 3.3M14 14.8c1.2-.4 2.4-.2 3.5.6 1 .7 1.6 1.7 1.8 2.6"
            {...comum}
          />
        </>
      ) : null}
      {nome === "tema" ? (
        <>
          <circle cx="12" cy="12" r="3" {...comum} />
          <path
            d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M18.4 5.6 17 7M7 17l-1.4 1.4"
            {...comum}
          />
        </>
      ) : null}
    </svg>
  );
}
function MenuLinhas() {
  return (
    <span className="flex w-4 flex-col gap-1" aria-hidden>
      <span className="h-0.5 w-full rounded bg-current" />
      <span className="h-0.5 w-full rounded bg-current" />
      <span className="h-0.5 w-full rounded bg-current" />
    </span>
  );
}
export function AppShell({ children }) {
  const { user, isPending } = useCurrentUserState();
  const [profile, setProfile] = useState(null);
  const [error, setError] = useState("");
  const path = useRouterState({ select: (s) => s.location.pathname });
  const marca = useMarca();
  const fundoSistema = fundoStyle(marca.fundoModoSistema, marca.corFundoSistema, marca.fundoSistema);
  const [novaSenha, setNovaSenha] = useState("");
  const [senhaErro, setSenhaErro] = useState("");
  const [senhaBusy, setSenhaBusy] = useState(false);
  const [menuAberto, setMenuAberto] = useState(false);
  const [recolhido, setRecolhido] = useState(false);
  useEffect(() => {
    setMenuAberto(false);
  }, [path]);
  useEffect(() => {
    setRecolhido(
      localStorage.getItem("menu-lateral") === "recolhido" ||
        localStorage.getItem("haloop-menu") === "recolhido",
    );
  }, []);
  function alternarMenu() {
    setRecolhido((atual) => {
      localStorage.setItem("menu-lateral", atual ? "aberto" : "recolhido");
      return !atual;
    });
  }
  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    ensureProfile()
      .then((row) => {
        if (!cancelled) setProfile(row);
      })
      .catch(async (err) => {
        const message = err instanceof Error ? err.message : "Não foi possível abrir a sessão.";
        if (message === "Usuário inativo.") await authClient.signOut();
        if (!cancelled) setError(message);
      });
    return () => {
      cancelled = true;
    };
  }, [user?.id]);
  if (isPending)
    return (
      <div className="min-h-screen bg-bg p-6">
        <div className="mx-auto h-10 max-w-5xl animate-pulse rounded-lg bg-line" />
      </div>
    );
  if (!user) return <LoginPage />;
  async function onNovaSenha(event) {
    event.preventDefault();
    setSenhaBusy(true);
    setSenhaErro("");
    try {
      await definirSenha({ data: { nova: novaSenha } });
      setNovaSenha("");
      setProfile(await ensureProfile());
    } catch (err) {
      setSenhaErro(err instanceof Error ? err.message : "Não foi possível salvar a senha.");
    } finally {
      setSenhaBusy(false);
    }
  }
  const visiveis = links.filter(
    (link) => !link.perm || (profile ? pode(profile.role, profile.permissoes, link.perm) : false),
  );
  const largo = menuAberto || !recolhido;
  return (
    <div className="min-h-screen bg-bg text-ink lg:flex" style={fundoSistema}>
      {menuAberto ? (
        <button
          type="button"
          className="no-print fixed inset-0 z-20 bg-black/50 lg:hidden"
          aria-label="Fechar menu"
          onClick={() => setMenuAberto(false)}
        />
      ) : null}
      <aside
        className={`no-print fixed inset-y-0 left-0 z-30 flex flex-col border-r border-line ${menuAberto ? "w-64" : "hidden"} lg:static lg:flex lg:shrink-0 ${recolhido ? "lg:w-16" : "lg:w-64"}`}
        style={{ backgroundColor: marca.corMenu || "#0d1520" }}
      >
        {largo ? (
          <>
            <div className="flex items-center justify-between border-b border-line px-4 py-4">
              <BrandLogo marca={marca} />
              <button
                type="button"
                className="hidden h-9 w-9 shrink-0 items-center justify-center rounded border border-line lg:inline-flex"
                aria-label="Recolher menu"
                onClick={alternarMenu}
              >
                <MenuLinhas />
              </button>
            </div>
            <nav className="flex flex-1 flex-col gap-1 overflow-y-auto p-3">
              {visiveis.map((link) => {
                const active = path === link.to || path.startsWith(`${link.to}/`);
                return (
                  <Link
                    key={link.to}
                    to={link.to}
                    className={`flex items-center gap-2 rounded px-3 py-2.5 text-sm font-semibold ${active ? "bg-accent text-accent-fg" : "text-muted hover:bg-white/5 hover:text-ink"}`}
                  >
                    <Icone nome={link.icone} />
                    {link.label}
                  </Link>
                );
              })}
            </nav>
            {profile?.role === "admin" || profile?.role === "superadmin" ? (
              <div className="space-y-2 px-3 pb-3">
                <Link
                  to="/tema"
                  className={`flex w-full items-center gap-2 rounded border border-line px-3 py-2.5 text-left text-sm font-semibold hover:border-accent ${path.startsWith("/tema") ? "bg-accent text-accent-fg" : ""}`}
                >
                  <Icone nome="tema" />
                  Tema
                </Link>
                {profile.role === "superadmin" ? (
                  <Link
                    to="/configuracao"
                    className={`flex w-full items-center gap-2 rounded border border-line px-3 py-2.5 text-left text-sm font-semibold hover:border-accent ${path.startsWith("/configuracao") ? "bg-accent text-accent-fg" : ""}`}
                  >
                    <Icone nome="empresa" />
                    Configuração
                  </Link>
                ) : null}
              </div>
            ) : null}
            <div className="border-t border-line px-4 py-3">
              <p className="truncate text-sm font-semibold">
                {profile?.name ?? user.displayName ?? user.primaryEmail}
              </p>
              <p className="mb-2 text-xs text-muted">
                {profile?.role === "superadmin"
                  ? "Superadmin"
                  : profile?.role === "admin"
                    ? "Administrador"
                    : profile?.grupoNome || "Usuário"}
              </p>
              <UserButton />
            </div>
          </>
        ) : (
          <div className="flex flex-1 flex-col items-center gap-2 px-2 py-4">
            <button
              type="button"
              className="inline-flex h-10 w-10 items-center justify-center rounded border border-line"
              aria-label="Expandir menu"
              onClick={alternarMenu}
            >
              <MenuLinhas />
            </button>
            {imagemDe(marca, "logoMenu") ? (
              <img src={imagemDe(marca, "logoMenu")} alt="" className="h-8 w-8 object-contain" />
            ) : null}
            <nav className="mt-2 flex w-full flex-col items-center gap-1">
              {visiveis.map((link) => {
                const active = path === link.to || path.startsWith(`${link.to}/`);
                return (
                  <Link
                    key={link.to}
                    to={link.to}
                    title={link.label}
                    aria-label={link.label}
                    className={`inline-flex h-10 w-10 items-center justify-center rounded ${active ? "bg-accent text-accent-fg" : "text-muted hover:bg-white/5 hover:text-ink"}`}
                  >
                    <Icone nome={link.icone} />
                  </Link>
                );
              })}
              {profile?.role === "admin" || profile?.role === "superadmin" ? (
                <Link
                  to="/tema"
                  title="Tema"
                  aria-label="Tema"
                  className={`inline-flex h-10 w-10 items-center justify-center rounded ${path.startsWith("/tema") ? "bg-accent text-accent-fg" : "text-muted hover:bg-white/5 hover:text-ink"}`}
                >
                  <Icone nome="tema" />
                </Link>
              ) : null}
              {profile?.role === "superadmin" ? (
                <Link
                  to="/configuracao"
                  title="Configuração"
                  aria-label="Configuração"
                  className="inline-flex h-10 w-10 items-center justify-center rounded text-muted hover:bg-white/5 hover:text-ink"
                >
                  <Icone nome="empresa" />
                </Link>
              ) : null}
            </nav>
          </div>
        )}
      </aside>
      <div className="min-w-0 flex-1">
        <header className="no-print sticky top-0 z-10 flex items-center gap-3 border-b border-line bg-bg/95 px-4 py-3 backdrop-blur lg:hidden">
          <button
            type="button"
            className="rounded border border-line px-3 py-2 text-sm font-semibold"
            onClick={() => setMenuAberto(true)}
          >
            Menu
          </button>
          <BrandLogo marca={marca} className="h-7 w-auto" />
        </header>
        <main className="mx-auto w-full max-w-6xl px-4 py-6">
          {error ? <p className="mb-4 text-sm text-danger">{error}</p> : null}
          {profile?.trocarSenha ? (
            <Card>
              <h1 className="font-display text-3xl font-medium tracking-tight">Defina uma nova senha</h1>
              <p className="mt-2 text-sm text-muted">
                Esta senha foi criada pelo administrador ou já passou de 30 dias. Escolha outra para
                continuar.
              </p>
              <form className="mt-4 max-w-sm space-y-3" onSubmit={onNovaSenha}>
                <Field label="Nova senha">
                  <TextInput
                    type="password"
                    minLength={8}
                    autoComplete="new-password"
                    value={novaSenha}
                    onChange={(e) => setNovaSenha(e.target.value)}
                    required
                  />
                </Field>
                {senhaErro ? <p className="text-sm text-danger">{senhaErro}</p> : null}
                <Button type="submit" disabled={senhaBusy}>
                  {senhaBusy ? "Salvando…" : "Salvar senha"}
                </Button>
              </form>
            </Card>
          ) : (
            children
          )}
        </main>
      </div>
    </div>
  );
}
