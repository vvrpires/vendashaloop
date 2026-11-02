import { createFileRoute } from "@tanstack/react-router";
import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui";
import { GraficosPainel } from "@/components/graficos-painel";
import { brl, formatDate } from "@/lib/money";
import { listOrcamentos } from "@/lib/vendas.functions";

export const Route = createFileRoute("/_app/painel")({ component: Painel });

export function Painel() {
  const [rows, setRows] = useState(null);
  const [error, setError] = useState("");
  useEffect(() => {
    listOrcamentos()
      .then(setRows)
      .catch((err) => setError(err instanceof Error ? err.message : "Falha ao carregar."));
  }, []);
  const list = rows ?? [];
  const now = new Date();
  const month = list.filter((row) => {
    const d = new Date(`${row.data}T12:00:00`);
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  });
  const vendasMes = month.filter((row) => row.status === "venda");
  const faturamento = vendasMes.reduce((sum, row) => sum + row.total, 0);
  const conversao = month.length ? Math.round((vendasMes.length / month.length) * 100) : 0;
  const receber = list
    .filter((row) => row.status === "venda" && row.pagStatus !== "pago")
    .reduce((sum, row) => sum + Math.max(0, row.total - row.valorPago), 0);
  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-medium tracking-tight">Painel</h1>
          <p className="text-sm text-muted">O que entrou neste mês e o que ainda está em aberto.</p>
        </div>
        <Link
          to="/orcamentos"
          className="hidden h-11 items-center rounded-lg bg-accent px-4 text-sm font-semibold text-accent-fg sm:inline-flex"
        >
          Novo orçamento
        </Link>
      </div>
      {error ? <p className="text-sm text-danger">{error}</p> : null}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Orçamentos no mês" value={rows ? String(month.length) : "—"} />
        <Stat label="Vendas no mês" value={rows ? String(vendasMes.length) : "—"} />
        <Stat label="Faturamento" value={rows ? brl(faturamento) : "—"} />
        <Stat
          label="Conversão"
          value={rows ? `${conversao}%` : "—"}
          hint={`A receber ${rows ? brl(receber) : ""}`}
        />
      </div>
      {rows && rows.length > 0 ? <GraficosPainel rows={rows} /> : null}
      <section className="rounded-2xl border border-line bg-surface p-4 sm:p-6">
        <h2 className="text-base font-semibold">Recentes</h2>
        {!rows ? <p className="mt-4 text-sm text-muted">Carregando…</p> : null}
        {rows && rows.length === 0 ? (
          <p className="mt-4 text-sm text-muted">
            Nenhum orçamento ainda. Comece pelo catálogo ou crie o primeiro direto.
          </p>
        ) : null}
        {rows && rows.length > 0 ? (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-xs font-semibold tracking-wide text-muted uppercase">
                <tr>
                  <th className="py-2 pr-3">Nº</th>
                  <th className="py-2 pr-3">Data</th>
                  <th className="py-2 pr-3">Cliente</th>
                  <th className="py-2 pr-3">Status</th>
                  <th className="py-2 text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {rows.slice(0, 8).map((row) => (
                  <tr key={row.id} className="border-t border-line">
                    <td className="py-3 pr-3 font-semibold tabular-nums">{row.numero}</td>
                    <td className="py-3 pr-3">{formatDate(row.data)}</td>
                    <td className="py-3 pr-3">{row.clienteNome || "—"}</td>
                    <td className="py-3 pr-3">
                      <Badge value={row.status} />
                    </td>
                    <td className="py-3 text-right font-semibold tabular-nums">{brl(row.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </section>
    </div>
  );
}
function Stat({ label, value, hint }) {
  return (
    <div className="rounded-2xl border border-line bg-surface p-4">
      <p className="text-xs font-semibold tracking-wide text-muted uppercase">{label}</p>
      <p className="mt-2 font-display text-2xl tabular-nums">{value}</p>
      {hint ? <p className="mt-1 text-xs text-muted">{hint}</p> : null}
    </div>
  );
}
