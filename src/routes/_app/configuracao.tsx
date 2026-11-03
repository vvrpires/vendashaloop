import { createFileRoute } from "@tanstack/react-router";
import { caixaAlta } from "@/lib/mascaras";
import { useRouter } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { CampoImagem } from "@/components/campo-imagem";
import { ConfigGate } from "@/components/config-gate";
import { EmpresaPage } from "@/components/empresa-page";
import { Button, Card, Field, TextInput } from "@/components/ui";
import { imagemPadrao } from "@/lib/imagens-padrao";
import { MODELOS_TEMA } from "@/lib/modelos-tema";
import { PADRAO_NOVO, PERMISSOES } from "@/lib/permissoes";
import { BrandLogo, aplicarTema, fundoStyle, useMarca } from "@/lib/use-marca";
import {
  deleteTema,
  getEmpresa,
  listGrupos,
  listTemas,
  saveEmpresa,
  saveGrupo,
  saveTema,
  setPermissoes,
} from "@/lib/vendas.functions";

export const Route = createFileRoute("/_app/configuracao")({ component: ConfigPage });

function lerImagem(file, limite, aviso) {
  if (!file) return Promise.resolve("");
  if (!["image/png", "image/jpeg", "image/webp"].includes(file.type) || file.size > limite)
    return Promise.reject(new Error(aviso));
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(new Error(aviso));
    reader.readAsDataURL(file);
  });
}
function TemaPainel({ marca, onClose, embutido = false }) {
  const router = useRouter();
  const inicial = useRef(marca);
  const [form, setForm] = useState(null);
  const [vista, setVista] = useState("entrada");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [temas, setTemas] = useState([]);
  const [nomeTema, setNomeTema] = useState("");
  // rev.46: tema criado que está sendo editado (null = criando um tema novo)
  const [editando, setEditando] = useState(null);
  useEffect(() => {
    getEmpresa()
      .then(setForm)
      .catch((err) => setError(err instanceof Error ? err.message : "Não foi possível abrir o tema."));
    listTemas()
      .then(setTemas)
      .catch(() => setTemas([]));
  }, []);
  useEffect(() => {
    if (form) aplicarTema(form);
  }, [form]);
  useEffect(() => () => aplicarTema(inicial.current), []);
  async function onImagem(file, key) {
    if (!form) return;
    setError("");
    try {
      const valor = await lerImagem(
        file,
        key === "favicon" ? 1e5 : key.startsWith("fundo") ? 6e5 : 4e5,
        key === "favicon"
          ? "O favicon precisa ser PNG, JPG ou WebP de até 100 KB."
          : key.startsWith("fundo")
            ? "O fundo precisa ser PNG, JPG ou WebP de até 600 KB."
            : "A logo precisa ser PNG, JPG ou WebP de até 400 KB.",
      );
      if (valor)
        setForm({
          ...form,
          [key]: valor,
        });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Imagem inválida.");
    }
  }
  async function onSubmit(event) {
    event.preventDefault();
    if (!form) return;
    setBusy(true);
    setError("");
    try {
      const salvo = await saveEmpresa({ data: form });
      inicial.current = {
        ...inicial.current,
        ...salvo,
        nome: salvo.nome,
        local: salvo.local,
      };
      aplicarTema(salvo);
      await router.invalidate();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível salvar o tema.");
    } finally {
      setBusy(false);
    }
  }
  function dadosDoForm() {
    return {
      cor: form.cor,
      corTexto: form.corTexto,
      corCard: form.corCard,
      corMenu: form.corMenu,
      corFundoLogin: form.corFundoLogin,
      corFundoSistema: form.corFundoSistema,
      fundoModoLogin: form.fundoModoLogin,
      fundoModoSistema: form.fundoModoSistema,
      fundoLogin: form.fundoLogin,
      fundoSistema: form.fundoSistema,
      logo: form.logo,
      logoClara: form.logoClara,
      favicon: form.favicon,
      logoMenu: form.logoMenu,
      logoLogin: form.logoLogin,
      logoSistema: form.logoSistema,
      tituloAba: form.tituloAba,
      textoLogin: form.textoLogin,
      nomeRodape: form.nomeRodape,
      loginLado: form.loginLado,
    };
  }
  async function criarTema() {
    if (!form || nomeTema.trim().length < 2) {
      setError("Informe o nome do tema.");
      return;
    }
    setError("");
    try {
      await saveTema({ data: { id: editando?.id ?? "", nome: nomeTema, dados: dadosDoForm() } });
      setNomeTema("");
      setEditando(null);
      setTemas(await listTemas());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível salvar o tema.");
    }
  }
  function editarTema(tema) {
    setError("");
    setForm({ ...form, ...tema.dados });
    setNomeTema(String(tema.nome).toLocaleUpperCase("pt-BR"));
    setEditando(tema);
  }
  function cancelarEdicao() {
    setNomeTema("");
    setEditando(null);
  }
  async function duplicarTema(tema) {
    setError("");
    const base = String(tema.nome).toLocaleUpperCase("pt-BR").slice(0, 30);
    const usados = new Set(temas.map((t) => String(t.nome).toLocaleUpperCase("pt-BR")));
    let nome = `${base} - CÓPIA`;
    for (let n = 2; usados.has(nome); n++) nome = `${base} - CÓPIA ${n}`;
    try {
      await saveTema({ data: { nome, dados: tema.dados } });
      setTemas(await listTemas());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível duplicar o tema.");
    }
  }
  const previa = form
    ? fundoStyle(
        vista === "entrada" ? form.fundoModoLogin : form.fundoModoSistema,
        vista === "entrada" ? form.corFundoLogin : form.corFundoSistema,
        vista === "entrada" ? form.fundoLogin || imagemPadrao("fundoLogin", form) : form.fundoSistema,
      )
    : undefined;
  const formulario = (
    <form
      onSubmit={onSubmit}
      className={
        embutido
          ? "flex max-h-[80vh] w-full flex-col overflow-hidden rounded-lg border border-line bg-bg"
          : "flex max-h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-lg border border-line bg-bg shadow-2xl"
      }
    >
      <div className="flex items-center justify-between border-b border-line px-4 py-3">
        <h2 className="font-display text-2xl">Tema</h2>
        <div className="flex gap-2">
          <Button type="button" variant="quiet" onClick={onClose}>
            Fechar
          </Button>
          <Button type="submit" disabled={busy || !form}>
            {busy ? "Salvando…" : "Salvar tema"}
          </Button>
        </div>
      </div>
      {error ? <p className="px-4 pt-3 text-sm text-danger">{error}</p> : null}
      {!form ? (
        <p className="p-4 text-sm text-muted">Carregando…</p>
      ) : (
        <div className="grid min-h-0 flex-1 gap-0 lg:grid-cols-[minmax(0,1fr)_340px]">
          <div className="space-y-5 overflow-y-auto p-4">
            <div>
              <p className="mb-2 text-sm font-semibold">Modelos</p>
              <div className="flex flex-wrap gap-2">
                {MODELOS_TEMA.map((modelo) => (
                  <button
                    key={modelo.nome}
                    type="button"
                    className="rounded border border-line px-3 py-2 text-sm font-semibold hover:border-accent"
                    onClick={() =>
                      setForm({
                        ...form,
                        ...modelo.valores,
                      })
                    }
                  >
                    {modelo.nome}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <p className="mb-2 text-sm font-semibold">Tema personalizado</p>
              <div className="flex flex-col gap-2 sm:flex-row">
                <TextInput
                  value={nomeTema}
                  maxLength={40}
                  onChange={(e) => setNomeTema(caixaAlta(e.target.value))}
                  placeholder="Nome do tema"
                />
                <Button type="button" onClick={() => void criarTema()}>
                  {editando ? "Salvar alterações" : "Criar tema"}
                </Button>
                {editando ? (
                  <Button type="button" variant="quiet" onClick={cancelarEdicao}>
                    Cancelar
                  </Button>
                ) : null}
              </div>
              {editando ? (
                <p className="mt-2 text-xs text-muted">
                  Editando o tema {String(editando.nome).toLocaleUpperCase("pt-BR")}: ajuste as cores e as
                  imagens abaixo e clique em Salvar alterações.
                </p>
              ) : (
                <p className="mt-2 text-xs text-muted">
                  Os temas padrão não podem ser alterados. Para criar um parecido, escolha o modelo, ajuste e
                  crie um tema com outro nome.
                </p>
              )}
              <ul className="mt-3 divide-y divide-line">
                {temas.map((tema) => (
                  <li key={tema.id} className="flex items-center justify-between gap-2 py-2">
                    <span className="text-sm font-semibold">
                      {String(tema.nome).toLocaleUpperCase("pt-BR")}
                    </span>
                    <span className="flex gap-2">
                      <Button
                        type="button"
                        variant="quiet"
                        onClick={() =>
                          setForm({
                            ...form,
                            ...tema.dados,
                          })
                        }
                      >
                        Usar
                      </Button>
                      <Button type="button" variant="quiet" onClick={() => editarTema(tema)}>
                        Editar
                      </Button>
                      <Button type="button" variant="quiet" onClick={() => void duplicarTema(tema)}>
                        Duplicar
                      </Button>
                      <Button
                        type="button"
                        variant="danger"
                        onClick={() =>
                          deleteTema({ data: { id: tema.id } })
                            .then(() => listTemas())
                            .then(setTemas)
                            .catch((err) =>
                              setError(err instanceof Error ? err.message : "Não foi possível excluir."),
                            )
                        }
                      >
                        Excluir
                      </Button>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <p className="mb-2 text-sm font-semibold">Imagens</p>
              <div className="grid gap-3 sm:grid-cols-2">
                <CampoImagem
                  titulo="Logo da tela de login"
                  ajuda="Tamanho ideal: 320 × 80 px. PNG, JPG ou WebP de até 400 KB."
                  valor={form.logoLogin}
                  padrao={imagemPadrao("logoLogin", form)}
                  onArquivo={(file) => void onImagem(file, "logoLogin")}
                  onLimpar={() => setForm({ ...form, logoLogin: "" })}
                />
                <CampoImagem
                  titulo="Logo interna do sistema"
                  ajuda="Tamanho ideal: 320 × 80 px. PNG, JPG ou WebP de até 400 KB."
                  valor={form.logoSistema}
                  padrao={imagemPadrao("logoSistema", form)}
                  onArquivo={(file) => void onImagem(file, "logoSistema")}
                  onLimpar={() => setForm({ ...form, logoSistema: "" })}
                />
                <CampoImagem
                  titulo="Logo do PDF"
                  ajuda="Tamanho ideal: 320 × 80 px. PNG, JPG ou WebP de até 400 KB."
                  valor={form.logo}
                  padrao={imagemPadrao("logo", form)}
                  fundoClaro
                  onArquivo={(file) => void onImagem(file, "logo")}
                  onLimpar={() => setForm({ ...form, logo: "" })}
                />
                <CampoImagem
                  titulo="Logo menor do menu"
                  ajuda="Aparece com o menu recolhido. Tamanho ideal: 64 × 64 px. Até 400 KB."
                  valor={form.logoMenu}
                  padrao={imagemPadrao("logoMenu", form)}
                  quadrado
                  onArquivo={(file) => void onImagem(file, "logoMenu")}
                  onLimpar={() => setForm({ ...form, logoMenu: "" })}
                />
                <CampoImagem
                  titulo="Tela de login"
                  ajuda="Fundo da tela de login. Tamanho ideal: 1920 × 1080 px. Até 600 KB."
                  valor={form.fundoLogin}
                  padrao={imagemPadrao("fundoLogin", form)}
                  onArquivo={(file) =>
                    void onImagem(file, "fundoLogin").then(() =>
                      setForm((atual) => (atual ? { ...atual, fundoModoLogin: "imagem" } : atual)),
                    )
                  }
                  onLimpar={() =>
                    setForm({
                      ...form,
                      fundoLogin: "",
                      fundoModoLogin: imagemPadrao("fundoLogin") ? form.fundoModoLogin : "padrao",
                    })
                  }
                />
                <CampoImagem
                  titulo="Favicon"
                  ajuda="Ícone da aba do navegador. Tamanho ideal: 32 × 32 ou 64 × 64 px. Até 100 KB."
                  valor={form.favicon}
                  padrao={imagemPadrao("favicon", form)}
                  quadrado
                  onArquivo={(file) => void onImagem(file, "favicon")}
                  onLimpar={() => setForm({ ...form, favicon: "" })}
                />
              </div>
            </div>
            <div>
              <p className="mb-2 text-sm font-semibold">Textos e posição</p>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Título da aba">
                  <TextInput
                    value={form.tituloAba}
                    maxLength={80}
                    onChange={(e) => setForm({ ...form, tituloAba: e.target.value })}
                  />
                </Field>
                <Field label="Posição da tela de login">
                  <select
                    className="h-11 w-full rounded border border-line bg-form px-3"
                    value={form.loginLado}
                    onChange={(e) => setForm({ ...form, loginLado: e.target.value })}
                  >
                    <option value="centro">Centralizada</option>
                    <option value="esquerda">Esquerda</option>
                    <option value="direita">Direita</option>
                  </select>
                </Field>
              </div>
            </div>
            <div>
              <p className="mb-2 text-sm font-semibold">Cores</p>
              <div className="grid gap-3 sm:grid-cols-3">
                <Cor label="Cor de destaque" value={form.cor} onChange={(cor) => setForm({ ...form, cor })} />
                <Cor
                  label="Cor do texto"
                  value={form.corTexto}
                  onChange={(corTexto) => setForm({ ...form, corTexto })}
                />
                <Cor
                  label="Cor dos cartões"
                  value={form.corCard}
                  onChange={(corCard) => setForm({ ...form, corCard })}
                />
                <Cor
                  label="Cor do menu"
                  value={form.corMenu}
                  onChange={(corMenu) => setForm({ ...form, corMenu })}
                />
                <Field label="Fundo da tela de login">
                  <select
                    className="h-11 w-full rounded border border-line bg-form px-3"
                    value={form.fundoModoLogin}
                    onChange={(e) => setForm({ ...form, fundoModoLogin: e.target.value })}
                  >
                    <option value="padrao">Padrão</option>
                    <option value="cor">Cor sólida</option>
                    <option value="imagem">Imagem</option>
                  </select>
                </Field>
                {form.fundoModoLogin === "cor" ? (
                  <Cor
                    label="Cor do fundo do login"
                    value={form.corFundoLogin}
                    onChange={(corFundoLogin) => setForm({ ...form, corFundoLogin })}
                  />
                ) : null}
              </div>
            </div>
          </div>
          <aside className="border-t border-line p-4 lg:border-t-0 lg:border-l">
            <div className="mb-3 flex gap-2">
              <button
                type="button"
                className={`rounded px-3 py-1.5 text-sm font-semibold ${vista === "entrada" ? "bg-accent text-accent-fg" : "text-muted"}`}
                onClick={() => setVista("entrada")}
              >
                Login
              </button>
              <button
                type="button"
                className={`rounded px-3 py-1.5 text-sm font-semibold ${vista === "sistema" ? "bg-accent text-accent-fg" : "text-muted"}`}
                onClick={() => setVista("sistema")}
              >
                Sistema
              </button>
            </div>
            <div
              className="overflow-hidden rounded border border-line"
              style={{
                background: form.corFundoSistema,
                color: form.corTexto,
                ...previa,
              }}
            >
              {vista === "entrada" ? (
                <div className="space-y-4 p-4 text-center">
                  <div className="flex justify-center">
                    <BrandLogo
                      marca={{
                        ...marca,
                        ...form,
                      }}
                      slot="login"
                      className="h-10 w-auto"
                    />
                  </div>
                  {form.textoLogin.trim() ? (
                    <p className="text-sm font-semibold tracking-[0.08em]">{form.textoLogin.trim()}</p>
                  ) : null}
                  <div className="mx-auto h-8 max-w-40 rounded" style={{ background: form.cor }} />
                  <p className="text-[11px] opacity-70">
                    {`\u00A9 ${new Date().getFullYear()} Haloop - Todos os direitos reservados`}
                  </p>
                </div>
              ) : (
                <div className="flex min-h-56">
                  <div className="w-28 space-y-2 p-3 text-xs" style={{ background: form.corMenu }}>
                    <BrandLogo
                      marca={{
                        ...marca,
                        ...form,
                      }}
                      slot="sistema"
                      className="h-6 w-auto"
                    />
                    <p style={{ color: form.cor }}>Painel</p>
                    <p className="opacity-70">Orçamentos</p>
                    <p className="opacity-70">Clientes</p>
                  </div>
                  <div className="flex-1 p-3">
                    <div className="rounded p-3" style={{ background: form.corCard }}>
                      <p className="text-sm font-semibold">Painel</p>
                      <p className="mt-2 h-2 w-16 rounded" style={{ background: form.cor }} />
                    </div>
                  </div>
                </div>
              )}
            </div>
          </aside>
        </div>
      )}
    </form>
  );
  if (embutido) return formulario;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-3">{formulario}</div>
  );
}
function Cor({ label, value, onChange }) {
  return (
    <Field label={label}>
      <input
        type="color"
        value={value || "#000000"}
        className="h-11 w-full rounded border border-line bg-form px-2"
        onChange={(e) => onChange(e.target.value)}
      />
    </Field>
  );
}
const abas = ["Temas", "Minha empresa", "Grupos"];
export function ConfigPage() {
  const [aba, setAba] = useState("Temas");
  const marca = useMarca();
  return (
    <ConfigGate>
      <div className="space-y-4">
        <div className="flex flex-wrap gap-2">
          {abas.map((item) => (
            <button
              key={item}
              type="button"
              className={`rounded px-3 py-1.5 text-sm font-semibold ${aba === item ? "bg-accent text-accent-fg" : "text-muted"}`}
              onClick={() => setAba(item)}
            >
              {item}
            </button>
          ))}
        </div>
        {aba === "Temas" ? <TemaPainel marca={marca} embutido onClose={() => undefined} /> : null}
        {aba === "Minha empresa" ? <EmpresaPage /> : null}
        {aba === "Grupos" ? <GruposPainel /> : null}
      </div>
    </ConfigGate>
  );
}
function GruposPainel() {
  const [grupos, setGrupos] = useState([]);
  const [nome, setNome] = useState("");
  const [permissoes, setMarcadas] = useState([...PADRAO_NOVO]);
  const [aberto, setAberto] = useState("");
  const [erro, setErro] = useState("");
  function carregar() {
    listGrupos()
      .then(setGrupos)
      .catch((err) => setErro(err instanceof Error ? err.message : "Não foi possível carregar."));
  }
  useEffect(() => {
    carregar();
  }, []);
  async function criar(event) {
    event.preventDefault();
    setErro("");
    try {
      await saveGrupo({
        data: {
          nome,
          permissoes: permissoes.join(","),
        },
      });
      setNome("");
      setMarcadas([...PADRAO_NOVO]);
      carregar();
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Não foi possível criar o grupo.");
    }
  }
  const blocos = [...new Set(PERMISSOES.map((item) => item.grupo))];
  return (
    <div className="space-y-4">
      {erro ? <p className="text-sm text-danger">{erro}</p> : null}
      <Card>
        <form className="grid gap-3" onSubmit={criar}>
          <Field label="Novo grupo">
            <TextInput value={nome} minLength={2} required onChange={(e) => setNome(e.target.value)} />
          </Field>
          {blocos.map((bloco) => (
            <div key={bloco}>
              <p className="mb-2 text-sm font-semibold">{bloco}</p>
              <div className="grid gap-2 sm:grid-cols-2">
                {PERMISSOES.filter((item) => item.grupo === bloco).map((item) => (
                  <label key={item.id} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={permissoes.includes(item.id)}
                      onChange={(e) =>
                        setMarcadas(
                          e.target.checked
                            ? [...permissoes, item.id]
                            : permissoes.filter((id) => id !== item.id),
                        )
                      }
                    />
                    {item.label}
                  </label>
                ))}
              </div>
            </div>
          ))}
          <Button type="submit" className="w-fit">
            Adicionar grupo
          </Button>
        </form>
      </Card>
      <Card>
        <ul className="divide-y divide-line">
          {grupos
            .filter((grupo) => grupo.nome.trim().toLowerCase() !== "administradores")
            .map((grupo) => (
              <li key={grupo.id} className="py-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-semibold">{grupo.nome}</p>
                  <Button
                    variant="quiet"
                    type="button"
                    onClick={() => setAberto(aberto === grupo.id ? "" : grupo.id)}
                  >
                    {aberto === grupo.id ? "Fechar" : "Abrir"}
                  </Button>
                </div>
                {aberto === grupo.id ? (
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    {PERMISSOES.map((item) => {
                      const atual = grupo.permissoes.split(",").filter(Boolean);
                      const marcado = atual.includes(item.id);
                      return (
                        <label key={item.id} className="flex items-center gap-2 text-sm">
                          <input
                            type="checkbox"
                            checked={marcado}
                            onChange={() => {
                              const next = marcado
                                ? atual.filter((id) => id !== item.id)
                                : [...atual, item.id];
                              setPermissoes({
                                data: {
                                  grupoId: grupo.id,
                                  permissoes: next.join(","),
                                },
                              })
                                .then(carregar)
                                .catch((err) =>
                                  setErro(err instanceof Error ? err.message : "Não foi possível salvar."),
                                );
                            }}
                          />
                          {item.label}
                        </label>
                      );
                    })}
                  </div>
                ) : null}
              </li>
            ))}
        </ul>
      </Card>
    </div>
  );
}
