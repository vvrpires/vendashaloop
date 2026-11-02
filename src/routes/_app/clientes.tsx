import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Button, Card, Field, TextInput } from "@/components/ui";
import { deleteCliente, listClientes, saveCliente } from "@/lib/vendas.functions";

export const Route = createFileRoute("/_app/clientes")({ component: ClientesPage });

const empty = {
  id: "",
  nome: "",
  documento: "",
  telefone: "",
  email: "",
  endereco: "",
  cep: "",
  numero: "",
  bairro: "",
  municipio: "",
  uf: "",
};
export function ClientesPage() {
  const [rows, setRows] = useState([]);
  const [form, setForm] = useState(empty);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function reload() {
    setRows(await listClientes());
  }
  useEffect(() => {
    reload().catch((err) => setError(err instanceof Error ? err.message : "Falha ao carregar."));
  }, []);
  async function onSubmit(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await saveCliente({ data: form });
      setForm(empty);
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível salvar.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-medium tracking-tight">Clientes</h1>
        <p className="text-sm text-muted">
          Cadastro compartilhado da equipe. Use no orçamento para preencher os dados.
        </p>
      </div>
      <Card>
        <form className="grid gap-3 sm:grid-cols-2" onSubmit={onSubmit}>
          <Field label="Nome">
            <TextInput
              value={form.nome}
              onChange={(e) =>
                setForm({
                  ...form,
                  nome: e.target.value,
                })
              }
              required
            />
          </Field>
          <Field label="CPF / CNPJ">
            <TextInput
              value={form.documento}
              onChange={(e) =>
                setForm({
                  ...form,
                  documento: e.target.value,
                })
              }
            />
          </Field>
          <Field label="Telefone">
            <TextInput
              value={form.telefone}
              onChange={(e) =>
                setForm({
                  ...form,
                  telefone: e.target.value,
                })
              }
            />
          </Field>
          <Field label="E-mail">
            <TextInput
              type="email"
              value={form.email}
              onChange={(e) =>
                setForm({
                  ...form,
                  email: e.target.value,
                })
              }
            />
          </Field>
          <div className="sm:col-span-2">
            <Field label="Endereço">
              <TextInput
                value={form.endereco}
                onChange={(e) =>
                  setForm({
                    ...form,
                    endereco: e.target.value,
                  })
                }
              />
            </Field>
          </div>
          <Field label="Número">
            <TextInput
              value={form.numero}
              onChange={(e) =>
                setForm({
                  ...form,
                  numero: e.target.value,
                })
              }
            />
          </Field>
          <Field label="Bairro">
            <TextInput
              value={form.bairro}
              onChange={(e) =>
                setForm({
                  ...form,
                  bairro: e.target.value,
                })
              }
            />
          </Field>
          <Field label="CEP">
            <TextInput
              value={form.cep}
              onChange={(e) =>
                setForm({
                  ...form,
                  cep: e.target.value,
                })
              }
            />
          </Field>
          <Field label="Município">
            <TextInput
              value={form.municipio}
              onChange={(e) =>
                setForm({
                  ...form,
                  municipio: e.target.value,
                })
              }
            />
          </Field>
          <Field label="UF">
            <TextInput
              value={form.uf}
              onChange={(e) =>
                setForm({
                  ...form,
                  uf: e.target.value,
                })
              }
            />
          </Field>
          {error ? <p className="text-sm text-danger sm:col-span-2">{error}</p> : null}
          <div className="flex gap-2 sm:col-span-2">
            <Button type="submit" disabled={busy}>
              {form.id ? "Atualizar" : "Salvar cliente"}
            </Button>
            {form.id ? (
              <Button type="button" variant="quiet" onClick={() => setForm(empty)}>
                Cancelar
              </Button>
            ) : null}
          </div>
        </form>
      </Card>
      <Card>
        {rows.length === 0 ? <p className="text-sm text-muted">Nenhum cliente cadastrado.</p> : null}
        <ul className="divide-y divide-line">
          {rows.map((row) => (
            <li
              key={row.id}
              className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <p className="font-semibold">{row.nome}</p>
                <p className="text-sm text-muted">
                  {"C\u00F3digo "}
                  {row.id}
                  {[row.documento, row.telefone, row.email].filter(Boolean).length
                    ? ` · ${[row.documento, row.telefone, row.email].filter(Boolean).join(" · ")}`
                    : ""}
                </p>
              </div>
              <div className="flex gap-2">
                <Button variant="quiet" type="button" onClick={() => setForm(row)}>
                  Editar
                </Button>
                <Button
                  variant="danger"
                  type="button"
                  onClick={() => {
                    if (!confirm("Excluir este cliente?")) return;
                    deleteCliente({ data: row.id })
                      .then(reload)
                      .catch((err) => setError(err instanceof Error ? err.message : "Falha ao excluir."));
                  }}
                >
                  Excluir
                </Button>
              </div>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
