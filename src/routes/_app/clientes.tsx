import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Button, Card, Field, TextInput } from "@/components/ui";
import {
  buscarCep,
  caixaAlta,
  mascaraCep,
  mascaraDocumento,
  mascaraTelefone,
  soDigitos,
} from "@/lib/mascaras";
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
  const [cepAviso, setCepAviso] = useState("");
  function alterar(campo, valor) {
    setForm((atual) => ({ ...atual, [campo]: valor }));
  }
  async function onCep(valor) {
    const cep = mascaraCep(valor);
    alterar("cep", cep);
    setCepAviso("");
    if (soDigitos(cep).length !== 8) return;
    setCepAviso("Buscando endereço…");
    const endereco = await buscarCep(cep);
    if (!endereco) {
      setCepAviso("CEP não encontrado. Preencha o endereço à mão.");
      return;
    }
    setCepAviso("");
    setForm((atual) => ({
      ...atual,
      endereco: endereco.logradouro || atual.endereco,
      bairro: endereco.bairro || atual.bairro,
      municipio: endereco.municipio || atual.municipio,
      uf: endereco.uf || atual.uf,
    }));
  }
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
              onChange={(e) => alterar("nome", caixaAlta(e.target.value))}
              required
            />
          </Field>
          <Field label="CPF / CNPJ">
            <TextInput
              value={form.documento}
              inputMode="numeric"
              placeholder="000.000.000-00 ou 00.000.000/0000-00"
              onChange={(e) => alterar("documento", mascaraDocumento(e.target.value))}
            />
          </Field>
          <Field label="Telefone">
            <TextInput
              value={form.telefone}
              inputMode="tel"
              placeholder="(00) 00000-0000"
              onChange={(e) => alterar("telefone", mascaraTelefone(e.target.value))}
            />
          </Field>
          <Field label="E-mail">
            <TextInput type="email" value={form.email} onChange={(e) => alterar("email", e.target.value)} />
          </Field>
          <Field label="CEP">
            <TextInput
              value={form.cep}
              inputMode="numeric"
              placeholder="00000-000"
              onChange={(e) => void onCep(e.target.value)}
            />
            {cepAviso ? <span className="text-xs text-muted">{cepAviso}</span> : null}
          </Field>
          <Field label="Endereço">
            <TextInput
              value={form.endereco}
              onChange={(e) => alterar("endereco", caixaAlta(e.target.value))}
            />
          </Field>
          <Field label="Número">
            <TextInput value={form.numero} onChange={(e) => alterar("numero", caixaAlta(e.target.value))} />
          </Field>
          <Field label="Bairro">
            <TextInput value={form.bairro} onChange={(e) => alterar("bairro", caixaAlta(e.target.value))} />
          </Field>
          <Field label="Município">
            <TextInput
              value={form.municipio}
              onChange={(e) => alterar("municipio", caixaAlta(e.target.value))}
            />
          </Field>
          <Field label="UF">
            <TextInput
              value={form.uf}
              maxLength={2}
              onChange={(e) => alterar("uf", caixaAlta(e.target.value))}
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
