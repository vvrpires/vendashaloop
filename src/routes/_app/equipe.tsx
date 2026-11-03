import { createFileRoute } from "@tanstack/react-router";
import { caixaAlta } from "@/lib/mascaras";
import { useEffect, useState } from "react";
import { Badge, Button, Card, Field, TextInput } from "@/components/ui";
import {
  createVendedor,
  deleteUsuario,
  ensureProfile,
  listEquipe,
  listGrupos,
  redefinirSenha,
  setAtivo,
  setGrupo,
} from "@/lib/vendas.functions";
import { PADRAO_NOVO } from "@/lib/permissoes";

export const Route = createFileRoute("/_app/equipe")({ component: EquipePage });

const abas = [
  {
    id: "lista",
    label: "Usuários",
  },
  {
    id: "novo",
    label: "Novo usuário",
  },
];
export function EquipePage() {
  const [aba, setAba] = useState("lista");
  const [rows, setRows] = useState([]);
  const [grupos, setGrupos] = useState([]);
  const [busca, setBusca] = useState("");
  const [aberto, setAberto] = useState("");
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [trocarSenha, setTrocarSenha] = useState(true);
  const [senhaExpira, setSenhaExpira] = useState(false);
  const [grupoId, setGrupoId] = useState("");
  const [grupoNome, setGrupoNome] = useState("");
  const [grupoPermissoes, setGrupoPermissoes] = useState([...PADRAO_NOVO]);
  const [grupoAberto, setGrupoAberto] = useState("");
  const [resetId, setResetId] = useState("");
  const [resetPassword, setResetPassword] = useState("");
  const [resetExpira, setResetExpira] = useState(false);
  const [euSuper, setEuSuper] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function reload() {
    const [equipe, lista] = await Promise.all([listEquipe(), listGrupos()]);
    setRows(equipe);
    setGrupos(lista);
  }
  useEffect(() => {
    ensureProfile()
      .then((profile) => setEuSuper(profile.role === "superadmin"))
      .catch(() => undefined);
    reload().catch((err) =>
      setError(err instanceof Error ? err.message : "Acesso restrito ao administrador."),
    );
  }, []);
  async function onSubmit(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await createVendedor({
        data: {
          name,
          username,
          password,
          trocarSenha,
          senhaExpira,
          grupoId,
        },
      });
      setName("");
      setUsername("");
      setPassword("");
      setTrocarSenha(true);
      setSenhaExpira(false);
      setAba("lista");
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível cadastrar.");
    } finally {
      setBusy(false);
    }
  }
  function falha(err) {
    setError(err instanceof Error ? err.message : "Não foi possível concluir.");
  }
  const termo = busca.trim().toLowerCase();
  grupos.filter(
    (grupo) =>
      grupo.nome.trim().toLowerCase() !== "administradores" &&
      (!termo || grupo.nome.toLowerCase().includes(termo)),
  );
  const visiveis = rows.filter((row) => {
    if (!termo) return true;
    return `${row.name} ${row.username} ${row.grupoNome}`.toLowerCase().includes(termo);
  });
  return (
    <div className="space-y-6">
      <h1 className="font-display text-3xl font-medium tracking-tight">Usuários</h1>
      {error ? <p className="text-sm text-danger">{error}</p> : null}
      <div className="flex flex-wrap gap-2">
        {abas.map((item) => (
          <button
            key={item.id}
            type="button"
            className={`rounded px-3 py-2 text-sm font-semibold ${aba === item.id ? "bg-accent text-accent-fg" : "text-muted hover:text-ink"}`}
            onClick={() => setAba(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>
      {null}
      {aba === "novo" ? (
        <Card>
          <form className="grid gap-3 sm:grid-cols-2" onSubmit={onSubmit}>
            <Field label="Nome">
              <TextInput
                value={name}
                onChange={(e) => setName(caixaAlta(e.target.value))}
                required
                autoComplete="off"
              />
            </Field>
            <Field label="Usuário">
              <TextInput
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                autoComplete="off"
                minLength={3}
              />
            </Field>
            <Field label="Senha inicial">
              <TextInput
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                minLength={8}
                required
                autoComplete="new-password"
              />
            </Field>
            <Field label="Grupo">
              <select
                className="h-11 w-full rounded border border-line bg-form px-3"
                value={grupoId}
                onChange={(e) => setGrupoId(e.target.value)}
              >
                <option value="">Sem grupo</option>
                {grupos
                  .filter((grupo) => grupo.nome.trim().toLowerCase() !== "administradores")
                  .map((grupo) => (
                    <option key={grupo.id} value={grupo.id}>
                      {grupo.nome}
                    </option>
                  ))}
              </select>
            </Field>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={trocarSenha}
                onChange={(e) => setTrocarSenha(e.target.checked)}
              />
              Pedir nova senha no primeiro acesso
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={senhaExpira}
                onChange={(e) => setSenhaExpira(e.target.checked)}
              />
              Senha expira em 30 dias
            </label>
            <div>
              <Button type="submit" disabled={busy}>
                {busy ? "Salvando…" : "Cadastrar usuário"}
              </Button>
            </div>
          </form>
        </Card>
      ) : null}
      {aba === "lista" ? (
        <Card>
          <TextInput value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar" />
          {visiveis.length === 0 ? <p className="mt-4 text-sm text-muted">Nenhum usuário.</p> : null}
          <ul className="mt-2 divide-y divide-line">
            {visiveis.map((row) => {
              const abertoAgora = aberto === row.userId;
              return (
                <li key={row.userId} className="py-3">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="font-semibold">{row.name}</p>
                      <p className="text-sm text-muted">
                        {row.username}
                        {row.role === "superadmin"
                          ? " · Superadmin"
                          : row.role === "admin"
                            ? " · Administrador"
                            : row.grupoNome
                              ? ` · ${row.grupoNome}`
                              : ""}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge value={row.role} />
                      {row.ativo ? null : <span className="text-xs font-semibold text-muted">Inativo</span>}
                      <Button
                        variant="quiet"
                        type="button"
                        onClick={() => setAberto(abertoAgora ? "" : row.userId)}
                      >
                        {abertoAgora ? "Fechar" : "Abrir"}
                      </Button>
                    </div>
                  </div>
                  {abertoAgora ? (
                    <div className="mt-4 space-y-4 border-t border-line pt-4">
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                        {row.role === "superadmin" || (row.role === "admin" && !euSuper) ? (
                          <p className="text-sm text-muted">
                            {row.role === "superadmin" ? "Superadmin" : "Administrador"}
                          </p>
                        ) : (
                          <label className="flex items-center gap-2 text-sm text-muted">
                            Grupo
                            <select
                              className="h-11 rounded border border-line bg-form px-3 text-sm text-ink"
                              value={row.grupoId}
                              onChange={(e) =>
                                setGrupo({
                                  data: {
                                    userId: row.userId,
                                    grupoId: e.target.value,
                                  },
                                })
                                  .then(reload)
                                  .catch(falha)
                              }
                            >
                              <option value="">Sem grupo</option>
                              {grupos
                                .filter((grupo) => grupo.nome.trim().toLowerCase() !== "administradores")
                                .map((grupo) => (
                                  <option key={grupo.id} value={grupo.id}>
                                    {grupo.nome}
                                  </option>
                                ))}
                            </select>
                          </label>
                        )}
                        <Button
                          variant="quiet"
                          type="button"
                          onClick={() =>
                            setAtivo({
                              data: {
                                userId: row.userId,
                                ativo: !row.ativo,
                              },
                            })
                              .then(reload)
                              .catch(falha)
                          }
                        >
                          {row.ativo ? "Inativar" : "Reativar"}
                        </Button>
                        <Button
                          variant="danger"
                          type="button"
                          onClick={() => {
                            if (confirm(`Excluir o usuário ${row.username}?`))
                              deleteUsuario({ data: row.userId }).then(reload).catch(falha);
                          }}
                        >
                          Excluir
                        </Button>
                      </div>
                      {resetId === row.userId ? (
                        <form
                          className="flex flex-col gap-2 sm:flex-row sm:items-center"
                          onSubmit={(event) => {
                            event.preventDefault();
                            redefinirSenha({
                              data: {
                                userId: row.userId,
                                password: resetPassword,
                                senhaExpira: resetExpira,
                              },
                            })
                              .then(() => {
                                setResetId("");
                                setResetPassword("");
                                setResetExpira(false);
                                return reload();
                              })
                              .catch(falha);
                          }}
                        >
                          <TextInput
                            type="password"
                            minLength={8}
                            required
                            value={resetPassword}
                            onChange={(e) => setResetPassword(e.target.value)}
                            placeholder="Senha temporária"
                          />
                          <label className="flex items-center gap-2 text-sm">
                            <input
                              type="checkbox"
                              checked={resetExpira}
                              onChange={(e) => setResetExpira(e.target.checked)}
                            />
                            Expira em 30 dias
                          </label>
                          <Button type="submit">Salvar senha</Button>
                        </form>
                      ) : (
                        <Button
                          variant="quiet"
                          type="button"
                          onClick={() => {
                            setResetId(row.userId);
                            setResetPassword("");
                          }}
                        >
                          Redefinir senha
                        </Button>
                      )}
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </Card>
      ) : null}
    </div>
  );
}
