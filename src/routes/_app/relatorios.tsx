import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Badge, Button, Card, Field, SelectInput, TextInput } from "@/components/ui";
import { brl, formatDate, num, todayIso } from "@/lib/money";
import { dadosRelatorio } from "@/lib/vendas.functions";

export const Route = createFileRoute("/_app/relatorios")({ component: RelatoriosPage });

// rev.38: relatórios administrativos com filtros, impressão/PDF e exportação para Excel (CSV).

type Linha = {
  id: string;
  numero: string;
  data: string;
  status: string;
  clienteNome: string;
  clienteDoc: string;
  itens: { desc: string; qtd: number; unit: number }[];
  pagamento: string;
  pagStatus: string;
  valorPago: number;
  total: number;
  nfeNumero: string;
  nfseNumero: string;
  createdBy: string;
  vendedorNome: string;
  grupoNome: string;
};

type Tabela = {
  titulo: string;
  colunas: string[];
  linhas: (string | number)[][];
  numericas: number[];
  rodape?: (string | number)[];
};

const TIPOS = [
  { id: "vendas", label: "Vendas e orçamentos" },
  { id: "equipe", label: "Por vendedor / grupo" },
  { id: "produtos", label: "Produtos e clientes" },
  { id: "financeiro", label: "Financeiro e notas" },
];

const STATUS = [
  { id: "", label: "Todos" },
  { id: "pendente", label: "Pendente" },
  { id: "aprovado", label: "Aprovado" },
  { id: "venda", label: "Venda" },
  { id: "rejeitado", label: "Rejeitado" },
  { id: "cancelado", label: "Cancelado" },
];

const PAG: Record<string, string> = { aberto: "Em aberto", parcial: "Parcial", pago: "Pago" };

function inicioDoMes() {
  return `${todayIso().slice(0, 8)}01`;
}

function porcentagem(parte: number, total: number) {
  return total ? `${Math.round((parte / total) * 100)}%` : "0%";
}

function montar(tipo: string, agrupar: string, rows: Linha[]): Tabela[] {
  const vendas = rows.filter((row) => row.status === "venda");
  if (tipo === "vendas") {
    return [
      {
        titulo: "Vendas e orçamentos",
        colunas: ["Nº", "Data", "Cliente", "Vendedor", "Status", "Pagamento", "Total"],
        numericas: [6],
        linhas: rows.map((row) => [
          row.numero,
          formatDate(row.data),
          row.clienteNome || "—",
          row.vendedorNome || "—",
          row.status,
          row.pagamento || "—",
          num(row.total),
        ]),
        rodape: [
          `${rows.length} orçamento(s)`,
          "",
          "",
          "",
          `${vendas.length} venda(s)`,
          "Vendido",
          vendas.reduce((soma, row) => soma + num(row.total), 0),
        ],
      },
    ];
  }
  if (tipo === "equipe") {
    const mapa = new Map<string, { orc: number; vendas: number; orcado: number; vendido: number }>();
    for (const row of rows) {
      const chave = agrupar === "grupo" ? row.grupoNome || "Sem grupo" : row.vendedorNome || "Sem vendedor";
      const atual = mapa.get(chave) ?? { orc: 0, vendas: 0, orcado: 0, vendido: 0 };
      atual.orc += 1;
      atual.orcado += num(row.total);
      if (row.status === "venda") {
        atual.vendas += 1;
        atual.vendido += num(row.total);
      }
      mapa.set(chave, atual);
    }
    const linhas = [...mapa.entries()]
      .sort((a, b) => b[1].vendido - a[1].vendido)
      .map(([nome, v]) => [
        nome,
        v.orc,
        v.vendas,
        porcentagem(v.vendas, v.orc),
        v.orcado,
        v.vendido,
        v.vendas ? v.vendido / v.vendas : 0,
      ]);
    return [
      {
        titulo: agrupar === "grupo" ? "Resultado por grupo" : "Resultado por vendedor",
        colunas: [
          agrupar === "grupo" ? "Grupo" : "Vendedor",
          "Orçamentos",
          "Vendas",
          "Conversão",
          "Valor orçado",
          "Valor vendido",
          "Ticket médio",
        ],
        numericas: [4, 5, 6],
        linhas,
        rodape: [
          "Total",
          rows.length,
          vendas.length,
          porcentagem(vendas.length, rows.length),
          rows.reduce((s, r) => s + num(r.total), 0),
          vendas.reduce((s, r) => s + num(r.total), 0),
          vendas.length ? vendas.reduce((s, r) => s + num(r.total), 0) / vendas.length : 0,
        ],
      },
    ];
  }
  if (tipo === "produtos") {
    const produtos = new Map<string, { qtd: number; valor: number }>();
    const clientes = new Map<string, { doc: string; compras: number; valor: number }>();
    for (const row of vendas) {
      for (const item of row.itens ?? []) {
        const chave = item.desc.trim() || "Sem descrição";
        const atual = produtos.get(chave) ?? { qtd: 0, valor: 0 };
        atual.qtd += num(item.qtd);
        atual.valor += num(item.qtd) * num(item.unit);
        produtos.set(chave, atual);
      }
      const nome = row.clienteNome.trim() || "Sem nome";
      const cli = clientes.get(nome) ?? { doc: row.clienteDoc, compras: 0, valor: 0 };
      cli.compras += 1;
      cli.valor += num(row.total);
      clientes.set(nome, cli);
    }
    return [
      {
        titulo: "Produtos e serviços vendidos",
        colunas: ["Produto / serviço", "Quantidade", "Valor vendido"],
        numericas: [2],
        linhas: [...produtos.entries()]
          .sort((a, b) => b[1].valor - a[1].valor)
          .map(([nome, v]) => [nome, v.qtd, v.valor]),
      },
      {
        titulo: "Clientes",
        colunas: ["Cliente", "CPF / CNPJ", "Compras", "Valor comprado"],
        numericas: [3],
        linhas: [...clientes.entries()]
          .sort((a, b) => b[1].valor - a[1].valor)
          .map(([nome, v]) => [nome, v.doc || "—", v.compras, v.valor]),
      },
    ];
  }
  // financeiro
  const receber = (row: Linha) =>
    row.pagStatus === "pago" ? 0 : Math.max(0, num(row.total) - num(row.valorPago));
  const pago = (row: Linha) =>
    row.pagStatus === "pago" ? num(row.total) : Math.min(num(row.total), num(row.valorPago));
  return [
    {
      titulo: "Financeiro e notas",
      colunas: [
        "Nº",
        "Data",
        "Cliente",
        "Forma",
        "Situação",
        "Total",
        "Recebido",
        "A receber",
        "NF-e",
        "NFS-e",
      ],
      numericas: [5, 6, 7],
      linhas: vendas.map((row) => [
        row.numero,
        formatDate(row.data),
        row.clienteNome || "—",
        row.pagamento || "—",
        PAG[row.pagStatus] ?? row.pagStatus,
        num(row.total),
        pago(row),
        receber(row),
        row.nfeNumero || "—",
        row.nfseNumero || "—",
      ]),
      rodape: [
        `${vendas.length} venda(s)`,
        "",
        "",
        "",
        "",
        vendas.reduce((s, r) => s + num(r.total), 0),
        vendas.reduce((s, r) => s + pago(r), 0),
        vendas.reduce((s, r) => s + receber(r), 0),
        `${vendas.filter((r) => r.nfeNumero).length} emitida(s)`,
        `${vendas.filter((r) => r.nfseNumero).length} emitida(s)`,
      ],
    },
  ];
}

function exportarCsv(nome: string, tabelas: Tabela[]) {
  const celula = (v: string | number) => {
    const texto = typeof v === "number" ? v.toFixed(2).replace(".", ",") : String(v ?? "");
    return /[";\n]/.test(texto) ? `"${texto.replace(/"/g, '""')}"` : texto;
  };
  const partes: string[] = [];
  for (const t of tabelas) {
    partes.push(celula(t.titulo));
    partes.push(t.colunas.map(celula).join(";"));
    for (const linha of t.linhas) partes.push(linha.map(celula).join(";"));
    if (t.rodape) partes.push(t.rodape.map(celula).join(";"));
    partes.push("");
  }
  const blob = new Blob(["﻿" + partes.join("\r\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${nome}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function Valor({ v, moeda }: { v: string | number; moeda: boolean }) {
  if (typeof v === "number") return <>{moeda ? brl(v) : v.toLocaleString("pt-BR")}</>;
  return <>{v}</>;
}

export function RelatoriosPage() {
  const [rows, setRows] = useState<Linha[] | null>(null);
  const [erro, setErro] = useState("");
  const [tipo, setTipo] = useState("vendas");
  const [agrupar, setAgrupar] = useState("vendedor");
  const [de, setDe] = useState(inicioDoMes());
  const [ate, setAte] = useState(todayIso());
  const [status, setStatus] = useState("");
  const [vendedor, setVendedor] = useState("");
  const [grupo, setGrupo] = useState("");
  const [cliente, setCliente] = useState("");

  useEffect(() => {
    dadosRelatorio()
      .then((dados) => setRows(dados as Linha[]))
      .catch((err) => setErro(err instanceof Error ? err.message : "Não foi possível carregar os dados."));
  }, []);

  const vendedores = useMemo(
    () => [...new Set((rows ?? []).map((r) => r.vendedorNome).filter(Boolean))].sort(),
    [rows],
  );
  const grupos = useMemo(
    () => [...new Set((rows ?? []).map((r) => r.grupoNome).filter(Boolean))].sort(),
    [rows],
  );

  const filtradas = useMemo(() => {
    const termo = cliente.trim().toLowerCase();
    return (rows ?? []).filter((row) => {
      if (de && row.data < de) return false;
      if (ate && row.data > ate) return false;
      if (status && row.status !== status) return false;
      if (vendedor && row.vendedorNome !== vendedor) return false;
      if (grupo && row.grupoNome !== grupo) return false;
      if (termo && !`${row.clienteNome} ${row.clienteDoc}`.toLowerCase().includes(termo)) return false;
      return true;
    });
  }, [rows, de, ate, status, vendedor, grupo, cliente]);

  const tabelas = useMemo(() => montar(tipo, agrupar, filtradas), [tipo, agrupar, filtradas]);
  const tipoLabel = TIPOS.find((t) => t.id === tipo)?.label ?? "";
  const periodo = `${formatDate(de)} a ${formatDate(ate)}`;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-medium tracking-tight">Relatórios</h1>
          <p className="text-sm text-muted">
            Escolha o relatório e os filtros. O resultado atualiza na hora.
          </p>
        </div>
        <div className="no-print flex gap-2">
          <Button type="button" variant="quiet" disabled={!rows} onClick={() => window.print()}>
            Imprimir / PDF
          </Button>
          <Button
            type="button"
            disabled={!rows}
            onClick={() => exportarCsv(`relatorio-${tipo}-${de}-a-${ate}`, tabelas)}
          >
            Exportar Excel
          </Button>
        </div>
      </div>

      <Card className="no-print">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Relatório">
            <SelectInput value={tipo} onChange={(e) => setTipo(e.target.value)}>
              {TIPOS.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </SelectInput>
          </Field>
          <Field label="De">
            <TextInput type="date" value={de} onChange={(e) => setDe(e.target.value)} />
          </Field>
          <Field label="Até">
            <TextInput type="date" value={ate} onChange={(e) => setAte(e.target.value)} />
          </Field>
          <Field label="Status">
            <SelectInput value={status} onChange={(e) => setStatus(e.target.value)}>
              {STATUS.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </SelectInput>
          </Field>
          <Field label="Vendedor">
            <SelectInput value={vendedor} onChange={(e) => setVendedor(e.target.value)}>
              <option value="">Todos</option>
              {vendedores.map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </SelectInput>
          </Field>
          <Field label="Grupo">
            <SelectInput value={grupo} onChange={(e) => setGrupo(e.target.value)}>
              <option value="">Todos</option>
              {grupos.map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </SelectInput>
          </Field>
          <Field label="Cliente">
            <TextInput
              value={cliente}
              placeholder="Nome ou documento"
              onChange={(e) => setCliente(e.target.value)}
            />
          </Field>
          {tipo === "equipe" ? (
            <Field label="Agrupar por">
              <SelectInput value={agrupar} onChange={(e) => setAgrupar(e.target.value)}>
                <option value="vendedor">Vendedor</option>
                <option value="grupo">Grupo</option>
              </SelectInput>
            </Field>
          ) : null}
        </div>
      </Card>

      {erro ? <p className="text-sm text-danger">{erro}</p> : null}
      {!rows && !erro ? <p className="text-sm text-muted">Carregando…</p> : null}

      {rows ? (
        <div className="space-y-4">
          <div className="print-only">
            <h2 className="text-xl font-semibold">{tipoLabel}</h2>
            <p className="text-sm">Período: {periodo}</p>
          </div>
          {tabelas.map((t) => (
            <Card key={t.titulo}>
              <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="text-base font-semibold">{t.titulo}</h2>
                <p className="text-xs text-muted">
                  {periodo} · {t.linhas.length} linha(s)
                </p>
              </div>
              {t.linhas.length === 0 ? (
                <p className="text-sm text-muted">Nada encontrado com esses filtros.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="text-xs font-semibold tracking-wide text-muted uppercase">
                      <tr>
                        {t.colunas.map((c, i) => (
                          <th
                            key={c}
                            className={`py-2 pr-3 ${typeof t.linhas[0]?.[i] === "number" ? "text-right" : ""}`}
                          >
                            {c}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {t.linhas.map((linha, n) => (
                        <tr key={n} className="border-t border-line">
                          {linha.map((v, i) => (
                            <td
                              key={i}
                              className={`py-2 pr-3 ${typeof v === "number" ? "text-right tabular-nums" : ""}`}
                            >
                              {t.colunas[i] === "Status" ? (
                                <Badge value={String(v)} />
                              ) : (
                                <Valor v={v} moeda={t.numericas.includes(i)} />
                              )}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                    {t.rodape ? (
                      <tfoot>
                        <tr className="border-t-2 border-line font-semibold">
                          {t.rodape.map((v, i) => (
                            <td
                              key={i}
                              className={`py-2 pr-3 ${typeof v === "number" ? "text-right tabular-nums" : ""}`}
                            >
                              <Valor v={v} moeda={t.numericas.includes(i)} />
                            </td>
                          ))}
                        </tr>
                      </tfoot>
                    ) : null}
                  </table>
                </div>
              )}
            </Card>
          ))}
        </div>
      ) : null}
    </div>
  );
}
