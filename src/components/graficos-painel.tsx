import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { brl, num } from "@/lib/money";

/** Gráficos do Painel (rev.38). Uma série por gráfico, na cor de destaque do tema. */
type Orc = {
  data: string;
  status: string;
  total: number;
  clienteNome: string;
  itens: { desc: string; qtd: number; unit: number }[];
};

const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const STATUS = [
  ["pendente", "Pendente"],
  ["aprovado", "Aprovado"],
  ["venda", "Venda"],
  ["rejeitado", "Rejeitado"],
  ["cancelado", "Cancelado"],
] as const;

function compacto(valor: number) {
  if (valor >= 1_000_000)
    return `${(valor / 1_000_000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mi`;
  if (valor >= 1_000) return `${(valor / 1_000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mil`;
  return valor.toLocaleString("pt-BR", { maximumFractionDigits: 0 });
}

function faturamentoPorMes(rows: Orc[]) {
  const hoje = new Date();
  const meses = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(hoje.getFullYear(), hoje.getMonth() - 5 + i, 1);
    return {
      chave: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
      nome: MESES[d.getMonth()],
      valor: 0,
    };
  });
  for (const row of rows) {
    if (row.status !== "venda") continue;
    const mes = meses.find((m) => row.data.startsWith(m.chave));
    if (mes) mes.valor += num(row.total);
  }
  return meses;
}

function porStatus(rows: Orc[]) {
  return STATUS.map(([id, nome]) => ({ nome, valor: rows.filter((row) => row.status === id).length }));
}

function ranking(pares: [string, number][], limite = 5) {
  const mapa = new Map<string, number>();
  for (const [nome, valor] of pares) {
    const chave = nome.trim() || "Sem nome";
    mapa.set(chave, (mapa.get(chave) ?? 0) + valor);
  }
  return [...mapa.entries()]
    .map(([nome, valor]) => ({ nome, valor }))
    .sort((a, b) => b.valor - a.valor)
    .slice(0, limite);
}

const eixo = { fill: "var(--color-muted)", fontSize: 12 };

function Dica({ active, payload, label, moeda }: any) {
  if (!active || !payload?.length) return null;
  const valor = Number(payload[0].value ?? 0);
  return (
    <div className="rounded border border-line bg-bg px-3 py-2 text-xs shadow-lg">
      <p className="font-semibold text-ink">{label ?? payload[0].payload?.nome}</p>
      <p className="text-muted">{moeda ? brl(valor) : `${valor} orçamento(s)`}</p>
    </div>
  );
}

function Quadro({
  titulo,
  subtitulo,
  vazio,
  children,
}: {
  titulo: string;
  subtitulo: string;
  vazio: boolean;
  children: any;
}) {
  return (
    <section className="rounded-2xl border border-line bg-surface p-4">
      <h2 className="text-base font-semibold">{titulo}</h2>
      <p className="text-xs text-muted">{subtitulo}</p>
      <div className="mt-3 h-56">
        {vazio ? <p className="pt-16 text-center text-sm text-muted">Sem dados ainda.</p> : children}
      </div>
    </section>
  );
}

function Barras({
  dados,
  moeda,
  horizontal = false,
}: {
  dados: { nome: string; valor: number }[];
  moeda: boolean;
  horizontal?: boolean;
}) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      {horizontal ? (
        <BarChart data={dados} layout="vertical" margin={{ top: 4, right: 16, bottom: 4, left: 8 }}>
          <CartesianGrid horizontal={false} stroke="var(--color-line)" strokeOpacity={0.5} />
          <XAxis
            type="number"
            tick={eixo}
            axisLine={false}
            tickLine={false}
            tickFormatter={moeda ? compacto : undefined}
            allowDecimals={false}
          />
          <YAxis type="category" dataKey="nome" tick={eixo} axisLine={false} tickLine={false} width={110} />
          <Tooltip cursor={{ fill: "var(--color-form)" }} content={<Dica moeda={moeda} />} />
          <Bar dataKey="valor" fill="var(--color-accent)" radius={[0, 4, 4, 0]} maxBarSize={22} />
        </BarChart>
      ) : (
        <BarChart data={dados} margin={{ top: 4, right: 8, bottom: 4, left: 0 }}>
          <CartesianGrid vertical={false} stroke="var(--color-line)" strokeOpacity={0.5} />
          <XAxis dataKey="nome" tick={eixo} axisLine={false} tickLine={false} />
          <YAxis
            tick={eixo}
            axisLine={false}
            tickLine={false}
            tickFormatter={moeda ? compacto : undefined}
            width={56}
            allowDecimals={false}
          />
          <Tooltip cursor={{ fill: "var(--color-form)" }} content={<Dica moeda={moeda} />} />
          <Bar dataKey="valor" fill="var(--color-accent)" radius={[4, 4, 0, 0]} maxBarSize={36} />
        </BarChart>
      )}
    </ResponsiveContainer>
  );
}

export function GraficosPainel({ rows }: { rows: Orc[] }) {
  const meses = faturamentoPorMes(rows);
  const status = porStatus(rows);
  const vendas = rows.filter((row) => row.status === "venda");
  const produtos = ranking(
    vendas.flatMap((row) =>
      (row.itens ?? []).map((item) => [item.desc, num(item.qtd) * num(item.unit)] as [string, number]),
    ),
  );
  const clientes = ranking(vendas.map((row) => [row.clienteNome, num(row.total)] as [string, number]));
  return (
    <div className="grid gap-3 lg:grid-cols-2">
      <Quadro
        titulo="Faturamento por mês"
        subtitulo="Vendas confirmadas nos últimos 6 meses"
        vazio={meses.every((m) => m.valor === 0)}
      >
        <Barras dados={meses} moeda />
      </Quadro>
      <Quadro titulo="Orçamentos por status" subtitulo="Todos os orçamentos" vazio={rows.length === 0}>
        <Barras dados={status} moeda={false} horizontal />
      </Quadro>
      <Quadro titulo="Produtos mais vendidos" subtitulo="Valor vendido, top 5" vazio={produtos.length === 0}>
        <Barras dados={produtos} moeda horizontal />
      </Quadro>
      <Quadro
        titulo="Clientes que mais compram"
        subtitulo="Valor vendido, top 5"
        vazio={clientes.length === 0}
      >
        <Barras dados={clientes} moeda horizontal />
      </Quadro>
    </div>
  );
}
