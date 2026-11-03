import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Button, Card, Field, SelectInput, TextInput } from "@/components/ui";
import { caixaAlta } from "@/lib/mascaras";
import { brl } from "@/lib/money";
import { deleteProduto, listProdutos, saveProduto } from "@/lib/vendas.functions";

export const Route = createFileRoute("/_app/produtos")({ component: ProdutosPage });

const empty = {
  id: "",
  descricao: "",
  valor: 0,
  unidade: "un",
  tipo: "servico",
  ncm: "",
  cfop: "5102",
  cst: "102",
};
const ncms = [
  ["84713012", "84713012 — Notebook"],
  ["84713019", "84713019 — Outro computador portátil"],
  ["84715010", "84715010 — Computador de mesa"],
  ["84716052", "84716052 — Teclado"],
  ["84716053", "84716053 — Mouse"],
  ["84717010", "84717010 — HD ou SSD"],
  ["84733049", "84733049 — Peça ou acessório de computador"],
  ["85044010", "85044010 — Fonte ou carregador"],
  ["85171300", "85171300 — Celular"],
  ["85176259", "85176259 — Roteador ou switch"],
  ["85235110", "85235110 — Cartão de memória"],
  ["85235190", "85235190 — Pen drive"],
  ["85285200", "85285200 — Monitor"],
  ["84433299", "84433299 — Impressora"],
  ["85444200", "85444200 — Cabo"],
];
export function ProdutosPage() {
  const [rows, setRows] = useState([]);
  const [form, setForm] = useState(empty);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function reload() {
    setRows(await listProdutos());
  }
  useEffect(() => {
    reload().catch((err) => setError(err instanceof Error ? err.message : "Falha ao carregar."));
  }, []);
  async function onSubmit(event) {
    event.preventDefault();
    if (form.tipo === "produto" && form.ncm.length !== 8) {
      setError("Selecione o NCM do produto.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await saveProduto({ data: form });
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
        <h1 className="font-display text-3xl font-medium tracking-tight">Catálogo</h1>
        <p className="text-sm text-muted">
          Serviços e produtos com valor padrão para montar orçamentos mais rápido.
        </p>
      </div>
      <Card>
        <form className="grid gap-3 sm:grid-cols-3" onSubmit={onSubmit}>
          <div className="sm:col-span-3">
            <Field label="Descrição">
              <TextInput
                value={form.descricao}
                onChange={(e) =>
                  setForm({
                    ...form,
                    descricao: caixaAlta(e.target.value),
                  })
                }
                required
              />
            </Field>
          </div>
          <Field label="Valor">
            <TextInput
              type="number"
              min={0}
              step="0.01"
              value={form.valor}
              onChange={(e) =>
                setForm({
                  ...form,
                  valor: Number(e.target.value),
                })
              }
            />
          </Field>
          <Field label="Unidade">
            <TextInput
              value={form.unidade}
              onChange={(e) =>
                setForm({
                  ...form,
                  unidade: e.target.value,
                })
              }
            />
          </Field>
          <Field label="Tipo">
            <SelectInput
              value={form.tipo}
              onChange={(e) => {
                const tipo = e.target.value === "produto" ? "produto" : "servico";
                setForm({
                  ...form,
                  tipo,
                  ncm: tipo === "servico" ? "" : form.ncm,
                });
              }}
            >
              <option value="servico">Serviço</option>
              <option value="produto">Produto</option>
            </SelectInput>
          </Field>
          <Field label="NCM">
            <SelectInput
              value={form.tipo === "servico" ? "" : form.ncm}
              disabled={form.tipo === "servico"}
              onChange={(e) =>
                setForm({
                  ...form,
                  ncm: e.target.value,
                })
              }
            >
              <option value="">
                {form.tipo === "servico" ? "Não se aplica a serviço" : "Selecione o NCM"}
              </option>
              {ncms.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
              {form.ncm && !ncms.some(([value]) => value === form.ncm) ? (
                <option value={form.ncm}>{form.ncm}</option>
              ) : null}
            </SelectInput>
          </Field>
          <Field label="CFOP">
            <TextInput
              value={form.cfop}
              onChange={(e) =>
                setForm({
                  ...form,
                  cfop: e.target.value,
                })
              }
            />
          </Field>
          <div className="flex items-end gap-2">
            <Button type="submit" disabled={busy}>
              {form.id ? "Atualizar" : "Adicionar"}
            </Button>
          </div>
          {error ? <p className="text-sm text-danger sm:col-span-3">{error}</p> : null}
        </form>
      </Card>
      <Card>
        {rows.length === 0 ? <p className="text-sm text-muted">Catálogo vazio.</p> : null}
        <ul className="divide-y divide-line">
          {rows.map((row) => (
            <li
              key={row.id}
              className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <p className="font-semibold">{row.descricao}</p>
                <p className="text-sm text-muted tabular-nums">
                  {"C\u00F3digo "}
                  {row.id}
                  {" \u00B7 "}
                  {brl(row.valor)}
                  {" / "}
                  {row.unidade}
                  {" \u00B7 "}
                  {row.tipo === "produto" ? "Produto" : "Serviço"}
                  {row.ncm ? ` · NCM ${row.ncm}` : ""}
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
                    if (!confirm("Excluir este item?")) return;
                    deleteProduto({ data: row.id })
                      .then(reload)
                      .catch((err) => {
                        setError(err instanceof Error ? err.message : "Falha ao excluir.");
                      });
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
