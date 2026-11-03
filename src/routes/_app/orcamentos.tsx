import { createFileRoute } from "@tanstack/react-router";
import { CampoMoeda } from "@/components/campo-moeda";
import { caixaAlta, mascaraDocumento, mascaraTelefone } from "@/lib/mascaras";
import { useEffect, useMemo, useState } from "react";
import { Badge, Button, Card, Field, SelectInput, TextArea, TextInput } from "@/components/ui";
import { addDays, brl, formatDate, todayIso } from "@/lib/money";
import { flushSync } from "react-dom";
import { imagemPadrao } from "@/lib/imagens-padrao";
import { emitirNota } from "@/lib/nfe.functions";
import { pode } from "@/lib/permissoes";
import {
  assignOsNumero,
  deleteOrcamento,
  ensureProfile,
  getEmpresa,
  listClientes,
  listOrcamentos,
  listProdutos,
  saveOrcamento,
} from "@/lib/vendas.functions";

// rev.44: monta o endereço do cliente cadastrado numa linha só (rua, número, bairro, cidade/UF e CEP)
function enderecoCompleto(cliente) {
  const rua = [cliente.endereco, cliente.numero].filter((parte) => String(parte ?? "").trim()).join(", ");
  const cidade = [cliente.municipio, cliente.uf].filter((parte) => String(parte ?? "").trim()).join("/");
  return [rua, cliente.bairro, cidade, cliente.cep ? `CEP ${cliente.cep}` : ""]
    .filter((parte) => String(parte ?? "").trim())
    .join(" - ");
}

export const Route = createFileRoute("/_app/orcamentos")({ component: OrcamentosPage });

function blank() {
  return {
    id: "",
    data: todayIso(),
    validade: 15,
    status: "pendente",
    clienteNome: "",
    clienteDoc: "",
    clienteTelefone: "",
    clienteEmail: "",
    clienteEndereco: "",
    itens: [
      {
        desc: "",
        qtd: 1,
        unit: 0,
      },
    ],
    desconto: 0,
    descontoPct: 0,
    imposto: 0,
    pagamento: "",
    pagStatus: "aberto",
    valorPago: 0,
    observacoes: "",
  };
}
function fromRow(row) {
  const {
    seq: _seq,
    numero: _numero,
    osSeq: _osSeq,
    osNumero: _osNumero,
    subtotal: _sub,
    total: _total,
    createdBy: _by,
    nfeChave: _nfeChave,
    nfeProtocolo: _nfeProtocolo,
    nfeNumero: _nfeNumero,
    nfseNumero: _nfseNumero,
    nfseProtocolo: _nfseProtocolo,
    ...rest
  } = row;
  return {
    ...rest,
    itens: row.itens.length
      ? row.itens
      : [
          {
            desc: "",
            qtd: 1,
            unit: 0,
          },
        ],
  };
}
function lineTotal(itens) {
  return itens.reduce((sum, item) => sum + (Number(item.qtd) || 0) * (Number(item.unit) || 0), 0);
}
export function OrcamentosPage() {
  const [rows, setRows] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [produtos, setProdutos] = useState([]);
  const [empresa, setEmpresa] = useState(null);
  const [draft, setDraft] = useState(null);
  const [numero, setNumero] = useState("");
  const [osNumero, setOsNumero] = useState("");
  const [nfeNumero, setNfeNumero] = useState("");
  const [nfseNumero, setNfseNumero] = useState("");
  const [emitindo, setEmitindo] = useState("");
  const [aviso, setAviso] = useState("");
  const [filter, setFilter] = useState("");
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [doc, setDoc] = useState("orcamento");
  const [acesso, setAcesso] = useState({
    criar: true,
    excluir: true,
    venda: true,
    nota: true,
  });
  async function reload() {
    const [list, people, catalog, company] = await Promise.all([
      listOrcamentos(),
      listClientes(),
      listProdutos(),
      getEmpresa(),
    ]);
    setRows(list);
    setClientes(people);
    setProdutos(catalog);
    setEmpresa(company);
    const profile = await ensureProfile();
    setAcesso({
      criar: pode(profile.role, profile.permissoes, "orcamentos_criar"),
      excluir: pode(profile.role, profile.permissoes, "orcamentos_excluir"),
      venda: pode(profile.role, profile.permissoes, "orcamentos_venda"),
      nota: pode(profile.role, profile.permissoes, "orcamentos_nota"),
    });
  }
  useEffect(() => {
    reload().catch((err) => setError(err instanceof Error ? err.message : "Falha ao carregar."));
  }, []);
  const visible = rows.filter((row) => {
    if (status && row.status !== status) return false;
    const q = filter.trim().toLowerCase();
    if (!q) return true;
    return row.numero.toLowerCase().includes(q) || row.clienteNome.toLowerCase().includes(q);
  });
  const totals = useMemo(() => {
    if (!draft)
      return {
        subtotal: 0,
        desconto: 0,
        imposto: 0,
        total: 0,
      };
    const subtotal = lineTotal(draft.itens);
    const desconto = Math.min(subtotal, draft.desconto + (subtotal * draft.descontoPct) / 100);
    const base = Math.max(0, subtotal - desconto);
    const imposto = (base * draft.imposto) / 100;
    return {
      subtotal,
      desconto,
      imposto,
      total: base + imposto,
    };
  }, [draft]);
  async function persist(next) {
    setError("");
    const saved = await saveOrcamento({ data: next });
    await reload();
    setDraft(null);
    return saved;
  }
  function printDocument(kind) {
    flushSync(() => setDoc(kind));
    const previous = document.title;
    document.title = kind === "os" ? "Ordem de serviço" : "Orçamento";
    window.print();
    document.title = previous;
  }
  async function confirmVenda() {
    if (!draft || draft.status === "venda") return;
    setError("");
    const next = {
      ...draft,
      status: "venda",
    };
    const saved = await saveOrcamento({ data: next });
    setNumero(saved.numero);
    setDraft({
      ...next,
      id: saved.id,
    });
    await reload();
  }
  async function printOs() {
    if (!draft) return;
    setError("");
    const saved = await saveOrcamento({ data: draft });
    const assigned = await assignOsNumero({ data: saved.id });
    flushSync(() => {
      setNumero(saved.numero);
      setOsNumero(assigned.osNumero);
      setDraft({
        ...draft,
        id: saved.id,
      });
    });
    await reload();
    printDocument("os");
  }
  async function emitir(tipo) {
    if (!draft || emitindo) return;
    setError("");
    setAviso("");
    setEmitindo(tipo);
    try {
      let id = draft.id;
      if (!id) {
        const saved = await saveOrcamento({ data: draft });
        id = saved.id;
        setNumero(saved.numero);
        setDraft({
          ...draft,
          id,
        });
      }
      const nota = await emitirNota({
        data: {
          id,
          tipo,
        },
      });
      if (tipo === "nfe") setNfeNumero(nota.numero);
      else setNfseNumero(nota.numero);
      setAviso(`${tipo === "nfe" ? "NF-e" : "NFS-e"} autorizada. Número ${nota.numero}.`);
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : "A emissão falhou. Veja os dados da empresa, do cliente e do produto.";
      setError(message);
      setAviso(message);
    } finally {
      setEmitindo("");
    }
  }
  function whatsapp() {
    if (!draft || !empresa) return;
    let msg = `*ORÇAMENTO* — ${empresa.nome}\n`;
    msg += `Cliente: ${draft.clienteNome || "—"}\nData: ${formatDate(draft.data)}\n\n`;
    draft.itens
      .filter((item) => item.desc)
      .forEach((item) => {
        msg += `• ${item.desc} — ${item.qtd} x ${brl(item.unit)}\n`;
      });
    msg += `\n*Total: ${brl(totals.total)}*`;
    if (draft.observacoes) msg += `\n\n${draft.observacoes}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, "_blank", "noopener,noreferrer");
  }
  function exportCsv() {
    const header = "Numero,Data,Cliente,Status,Pagamento,Total\n";
    const body = rows
      .map((row) =>
        [
          row.numero,
          row.data,
          `"${row.clienteNome.replaceAll('"', '""')}"`,
          row.status,
          row.pagStatus,
          row.total.toFixed(2),
        ].join(","),
      )
      .join("\n");
    const blob = new Blob([header + body], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "orcamentos.csv";
    a.click();
    URL.revokeObjectURL(url);
  }
  return (
    <div className="space-y-6">
      <div className="no-print flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-3xl font-medium tracking-tight">Orçamentos</h1>
          <p className="text-sm text-muted">Do rascunho até a venda, com pagamento e impressão.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="quiet" type="button" onClick={exportCsv}>
            CSV
          </Button>
          {acesso.criar ? (
            <Button
              type="button"
              onClick={() => {
                setNumero("");
                setOsNumero("");
                setDraft(blank());
              }}
            >
              Novo
            </Button>
          ) : null}
        </div>
      </div>
      {error ? <p className="no-print text-sm text-danger">{error}</p> : null}
      {!draft ? (
        <Card className="no-print">
          <div className="mb-4 grid gap-3 sm:grid-cols-2">
            <TextInput
              placeholder="Buscar cliente ou número"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            />
            <SelectInput value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="">Todos os status</option>
              <option value="pendente">Pendente</option>
              <option value="aprovado">Aprovado</option>
              <option value="rejeitado">Rejeitado</option>
              <option value="venda">Venda</option>
              <option value="cancelado">Cancelado</option>
            </SelectInput>
          </div>
          {visible.length === 0 ? <p className="text-sm text-muted">Nenhum orçamento nesta busca.</p> : null}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-xs font-semibold tracking-wide text-muted uppercase">
                <tr>
                  <th className="py-2 pr-3">Nº</th>
                  <th className="py-2 pr-3">OS</th>
                  <th className="py-2 pr-3">Cliente</th>
                  <th className="py-2 pr-3">Status</th>
                  <th className="py-2 pr-3">Pagamento</th>
                  <th className="py-2 pr-3 text-right">Total</th>
                  <th className="py-2" />
                </tr>
              </thead>
              <tbody>
                {visible.map((row) => (
                  <tr key={row.id} className="border-t border-line">
                    <td className="py-3 pr-3 font-semibold tabular-nums">{row.numero}</td>
                    <td className="py-3 pr-3 tabular-nums">{row.osNumero || "—"}</td>
                    <td className="py-3 pr-3">{row.clienteNome || "—"}</td>
                    <td className="py-3 pr-3">
                      <Badge value={row.status} />
                    </td>
                    <td className="py-3 pr-3">
                      <Badge value={row.pagStatus} />
                    </td>
                    <td className="py-3 pr-3 text-right tabular-nums">{brl(row.total)}</td>
                    <td className="py-3">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="quiet"
                          type="button"
                          onClick={() => {
                            setNumero(row.numero);
                            setOsNumero(row.osNumero);
                            setNfeNumero(row.nfeNumero);
                            setNfseNumero(row.nfseNumero);
                            setDraft(fromRow(row));
                          }}
                        >
                          Abrir
                        </Button>
                        {acesso.criar ? (
                          <Button
                            variant="quiet"
                            type="button"
                            onClick={() => {
                              const copy = fromRow(row);
                              copy.id = "";
                              copy.status = "pendente";
                              copy.data = todayIso();
                              setNumero("");
                              setOsNumero("");
                              setDraft(copy);
                            }}
                          >
                            Duplicar
                          </Button>
                        ) : null}
                        {acesso.excluir ? (
                          <Button
                            variant="danger"
                            type="button"
                            onClick={() => {
                              if (!confirm("Excluir este orçamento?")) return;
                              deleteOrcamento({ data: row.id })
                                .then(reload)
                                .catch((err) => {
                                  setError(err instanceof Error ? err.message : "Falha ao excluir.");
                                });
                            }}
                          >
                            Excluir
                          </Button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      ) : (
        <>
          <Card className="no-print">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Field label="Nº do orçamento">
                <TextInput value={numero || "Novo"} disabled />
              </Field>
              <Field label="Nº da ordem de serviço">
                <TextInput value={osNumero || "Ainda não gerada"} disabled />
              </Field>
              <Field label="Data">
                <TextInput
                  type="date"
                  value={draft.data}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      data: e.target.value,
                    })
                  }
                />
              </Field>
              <Field label="Validade (dias)">
                <TextInput
                  type="number"
                  min={1}
                  value={draft.validade}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      validade: Number(e.target.value),
                    })
                  }
                />
              </Field>
              <Field label="Status">
                <SelectInput
                  value={draft.status}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      status: e.target.value,
                    })
                  }
                >
                  <option value="pendente">Pendente</option>
                  <option value="aprovado">Aprovado</option>
                  <option value="rejeitado">Rejeitado</option>
                  <option value="venda">Venda</option>
                  <option value="cancelado">Cancelado</option>
                </SelectInput>
              </Field>
              <Field label="Cliente cadastrado">
                <SelectInput
                  value=""
                  onChange={(e) => {
                    const found = clientes.find((item) => item.id === e.target.value);
                    if (!found) return;
                    setDraft({
                      ...draft,
                      clienteNome: found.nome,
                      clienteDoc: found.documento,
                      clienteTelefone: found.telefone,
                      clienteEmail: found.email,
                      clienteEndereco: enderecoCompleto(found),
                    });
                  }}
                >
                  <option value="">Selecionar…</option>
                  {clientes.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.nome}
                    </option>
                  ))}
                </SelectInput>
              </Field>
              <Field label="Nome do cliente">
                <TextInput
                  value={draft.clienteNome}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      clienteNome: caixaAlta(e.target.value),
                    })
                  }
                />
              </Field>
              <Field label="Documento">
                <TextInput
                  value={draft.clienteDoc}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      clienteDoc: mascaraDocumento(e.target.value),
                    })
                  }
                />
              </Field>
              <Field label="Telefone">
                <TextInput
                  value={draft.clienteTelefone}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      clienteTelefone: mascaraTelefone(e.target.value),
                    })
                  }
                />
              </Field>
              <div className="sm:col-span-2">
                <Field label="E-mail">
                  <TextInput
                    value={draft.clienteEmail}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        clienteEmail: e.target.value,
                      })
                    }
                  />
                </Field>
              </div>
              <div className="sm:col-span-2">
                <Field label="Endereço">
                  <TextInput
                    value={draft.clienteEndereco}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        clienteEndereco: caixaAlta(e.target.value),
                      })
                    }
                  />
                </Field>
              </div>
            </div>
          </Card>
          <Card className="no-print">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-semibold">Itens</h2>
              <div className="flex gap-2">
                <SelectInput
                  className="w-56"
                  value=""
                  onChange={(e) => {
                    const product = produtos.find((item) => item.id === e.target.value);
                    if (!product) return;
                    setDraft({
                      ...draft,
                      itens: [
                        ...draft.itens,
                        {
                          desc: product.descricao,
                          qtd: 1,
                          unit: product.valor,
                        },
                      ],
                    });
                  }}
                >
                  <option value="">Do catálogo…</option>
                  {produtos.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.descricao}
                    </option>
                  ))}
                </SelectInput>
                <Button
                  variant="quiet"
                  type="button"
                  onClick={() =>
                    setDraft({
                      ...draft,
                      itens: [
                        ...draft.itens,
                        {
                          desc: "",
                          qtd: 1,
                          unit: 0,
                        },
                      ],
                    })
                  }
                >
                  Linha
                </Button>
              </div>
            </div>
            <div className="space-y-2">
              {draft.itens.map((item, index) => (
                <div key={index} className="grid grid-cols-12 gap-2">
                  <TextInput
                    className="col-span-12 sm:col-span-6"
                    placeholder="Descrição"
                    value={item.desc}
                    onChange={(e) => {
                      const itens = draft.itens.slice();
                      itens[index] = {
                        ...item,
                        desc: caixaAlta(e.target.value),
                      };
                      setDraft({
                        ...draft,
                        itens,
                      });
                    }}
                  />
                  <TextInput
                    className="col-span-4 sm:col-span-2"
                    type="number"
                    min={0}
                    step="0.01"
                    value={item.qtd}
                    onChange={(e) => {
                      const itens = draft.itens.slice();
                      itens[index] = {
                        ...item,
                        qtd: Number(e.target.value),
                      };
                      setDraft({
                        ...draft,
                        itens,
                      });
                    }}
                  />
                  <CampoMoeda
                    className="col-span-5 sm:col-span-2"
                    value={item.unit}
                    onChange={(e) => {
                      const itens = draft.itens.slice();
                      itens[index] = {
                        ...item,
                        unit: Number(e.target.value),
                      };
                      setDraft({
                        ...draft,
                        itens,
                      });
                    }}
                  />
                  <div className="col-span-3 flex items-center justify-end text-sm font-semibold tabular-nums sm:col-span-2">
                    {brl(item.qtd * item.unit)}
                    <button
                      type="button"
                      className="ml-2 text-danger"
                      onClick={() =>
                        setDraft({
                          ...draft,
                          itens: draft.itens.filter((_, i) => i !== index),
                        })
                      }
                      aria-label="Remover item"
                    >
                      ×
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </Card>
          <Card className="no-print">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <Field label="Desconto (R$)">
                <CampoMoeda
                  value={draft.desconto}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      desconto: Number(e.target.value),
                    })
                  }
                />
              </Field>
              <Field label="Desconto (%)">
                <TextInput
                  type="number"
                  min={0}
                  max={100}
                  step="0.1"
                  value={draft.descontoPct}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      descontoPct: Number(e.target.value),
                    })
                  }
                />
              </Field>
              <Field label="Imposto (%)">
                <TextInput
                  type="number"
                  min={0}
                  step="0.1"
                  value={draft.imposto}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      imposto: Number(e.target.value),
                    })
                  }
                />
              </Field>
              <Field label="Forma">
                <SelectInput
                  value={draft.pagamento}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      pagamento: e.target.value,
                    })
                  }
                >
                  <option value="">Selecione…</option>
                  <option>PIX</option>
                  <option>Boleto</option>
                  <option>Cartão de Crédito</option>
                  <option>Dinheiro</option>
                  <option>Transferência</option>
                </SelectInput>
              </Field>
              <Field label="Pagamento">
                <SelectInput
                  value={draft.pagStatus}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      pagStatus: e.target.value,
                    })
                  }
                >
                  <option value="aberto">Em aberto</option>
                  <option value="parcial">Parcial</option>
                  <option value="pago">Pago</option>
                </SelectInput>
              </Field>
              <Field label="Valor pago">
                <CampoMoeda
                  value={draft.valorPago}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      valorPago: Number(e.target.value),
                    })
                  }
                />
              </Field>
              <div className="sm:col-span-2 lg:col-span-3">
                <Field label="Observações">
                  <TextArea
                    value={draft.observacoes}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        observacoes: caixaAlta(e.target.value),
                      })
                    }
                  />
                </Field>
              </div>
            </div>
            <div className="mt-4 text-right text-sm">
              <p>
                {"Subtotal "}
                {brl(totals.subtotal)}
              </p>
              <p>
                {"Desconto "}
                {brl(totals.desconto)}
              </p>
              <p>
                {"Impostos "}
                {brl(totals.imposto)}
              </p>
              <p className="font-display mt-1 text-2xl tabular-nums">{brl(totals.total)}</p>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {acesso.criar ? (
                <Button
                  type="button"
                  onClick={() => {
                    persist(draft).catch((err) =>
                      setError(err instanceof Error ? err.message : "Falha ao salvar."),
                    );
                  }}
                >
                  Salvar
                </Button>
              ) : null}
              {acesso.venda ? (
                draft.status === "venda" ? (
                  <Button variant="quiet" type="button" disabled>
                    Venda confirmada
                  </Button>
                ) : (
                  <Button
                    type="button"
                    onClick={() => {
                      confirmVenda().catch((err) =>
                        setError(err instanceof Error ? err.message : "Falha ao confirmar a venda."),
                      );
                    }}
                  >
                    Confirmar venda
                  </Button>
                )
              ) : null}
              <Button variant="quiet" type="button" onClick={() => printDocument("orcamento")}>
                Imprimir
              </Button>
              <Button
                variant="quiet"
                type="button"
                onClick={() => {
                  printOs().catch((err) =>
                    setError(err instanceof Error ? err.message : "Falha ao gerar a ordem de serviço."),
                  );
                }}
              >
                Ordem de serviço
              </Button>
              <Button variant="quiet" type="button" onClick={whatsapp}>
                WhatsApp
              </Button>
              <Button variant="ghost" type="button" onClick={() => setDraft(null)}>
                Voltar
              </Button>
              {acesso.nota && draft.status === "venda" ? (
                <Button
                  type="button"
                  disabled={emitindo !== ""}
                  onClick={() => {
                    emitir("nfse");
                  }}
                >
                  {emitindo === "nfse"
                    ? "Emitindo NFS-e..."
                    : nfseNumero
                      ? `NFS-e ${nfseNumero}`
                      : "Emitir NFS-e"}
                </Button>
              ) : null}
              {acesso.nota && draft.status === "venda" ? (
                <Button
                  type="button"
                  disabled={emitindo !== ""}
                  onClick={() => {
                    emitir("nfe");
                  }}
                >
                  {emitindo === "nfe" ? "Emitindo NF-e..." : nfeNumero ? `NF-e ${nfeNumero}` : "Emitir NF-e"}
                </Button>
              ) : null}
            </div>
            {aviso ? <p className="mt-3 text-sm text-[#00a8ff]">{aviso}</p> : null}
          </Card>
          {empresa ? (
            <article className="print-only mx-auto max-w-3xl bg-white font-sans text-[13px] text-[#1a1a1a]">
              <header className="flex items-start justify-between gap-6">
                <div className="flex items-center gap-4">
                  {empresa.logo || imagemPadrao("logo") ? (
                    <img src={empresa.logo || imagemPadrao("logo")} alt="" className="h-16 w-auto" />
                  ) : null}
                  <div>
                    <h2
                      className="text-[20px] leading-tight font-bold"
                      style={{ color: empresa.cor || "#0056b3" }}
                    >
                      {empresa.nome}
                    </h2>
                    <p className="mt-1 text-[12px] leading-snug text-neutral-700">
                      {empresa.cnpj ? (
                        <>
                          {"CNPJ: "}
                          {empresa.cnpj}
                          <br />
                        </>
                      ) : null}
                      {empresa.local ? (
                        <>
                          {empresa.local}
                          <br />
                        </>
                      ) : null}
                      {[empresa.telefone ? `Tel: ${empresa.telefone}` : "", empresa.email]
                        .filter(Boolean)
                        .join(" | ")}
                    </p>
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-[22px] font-bold tracking-wide">
                    {doc === "os" ? "ORDEM DE SERVIÇO" : "ORÇAMENTO"}
                  </p>
                  <p className="mt-1">
                    {"N\u00BA "}
                    {doc === "os" ? osNumero || "Novo" : numero || "Novo"}
                  </p>
                  <p>
                    {"Data: "}
                    {formatDate(draft.data)}
                  </p>
                </div>
              </header>
              <div className="mt-3 border-b-[3px]" style={{ borderColor: empresa.cor || "#0056b3" }} />
              <div className="mt-4 grid grid-cols-2 gap-8">
                <div>
                  <p className="text-[11px] font-semibold tracking-wider text-neutral-500">CLIENTE</p>
                  <p className="mt-1 text-[15px] font-bold uppercase">{draft.clienteNome || "—"}</p>
                  {draft.clienteDoc ? (
                    <p className="mt-1">
                      {"Doc: "}
                      {draft.clienteDoc}
                    </p>
                  ) : null}
                  {draft.clienteEndereco ? <p>{draft.clienteEndereco}</p> : null}
                  {draft.clienteTelefone || draft.clienteEmail ? (
                    <p>
                      {[draft.clienteTelefone ? `Tel: ${draft.clienteTelefone}` : "", draft.clienteEmail]
                        .filter(Boolean)
                        .join(" | ")}
                    </p>
                  ) : null}
                </div>
                <div>
                  <p className="text-[11px] font-semibold tracking-wider text-neutral-500">INFORMAÇÕES</p>
                  <p className="mt-2">
                    <span className="font-bold">Validade:</span>{" "}
                    {formatDate(addDays(draft.data, draft.validade))}
                  </p>
                  {draft.pagamento ? (
                    <p>
                      <span className="font-bold">Pagamento:</span> {draft.pagamento}
                    </p>
                  ) : null}
                </div>
              </div>
              <table className="mt-6 w-full">
                <thead>
                  <tr className="border-b border-neutral-300 text-left text-[11px] tracking-wide text-neutral-500">
                    <th className="py-2 font-semibold">DESCRIÇÃO</th>
                    <th className="w-16 py-2 text-center font-semibold">QTD</th>
                    <th className="w-32 py-2 text-right font-semibold">VALOR UNIT.</th>
                    <th className="w-32 py-2 text-right font-semibold">TOTAL</th>
                  </tr>
                </thead>
                <tbody>
                  {draft.itens
                    .filter((item) => item.desc)
                    .map((item, index) => (
                      <tr key={index} className="border-b border-neutral-200">
                        <td className="py-2 pr-3">
                          {index + 1}
                          {". "}
                          {item.desc}
                        </td>
                        <td className="py-2 text-center">{item.qtd}</td>
                        <td className="py-2 text-right tabular-nums">{brl(item.unit)}</td>
                        <td className="py-2 text-right tabular-nums">{brl(item.qtd * item.unit)}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
              <div className="mt-3 ml-auto w-64 text-[13px]">
                <div className="flex justify-between py-1">
                  <span>Subtotal</span>
                  <span className="tabular-nums">{brl(totals.subtotal)}</span>
                </div>
                {totals.desconto > 0 ? (
                  <div
                    className="flex justify-between border-b-2 py-1"
                    style={{ borderColor: empresa.cor || "#0056b3" }}
                  >
                    <span>Desconto</span>
                    <span className="tabular-nums">
                      {"- "}
                      {brl(totals.desconto)}
                    </span>
                  </div>
                ) : null}
                {totals.imposto > 0 ? (
                  <div className="flex justify-between py-1">
                    <span>Imposto</span>
                    <span className="tabular-nums">{brl(totals.imposto)}</span>
                  </div>
                ) : null}
                <div
                  className="flex justify-between py-1 text-[16px] font-bold"
                  style={{ color: empresa.cor || "#0056b3" }}
                >
                  <span>TOTAL</span>
                  <span className="tabular-nums">{brl(totals.total)}</span>
                </div>
              </div>
              <section className="mt-8 rounded-md border border-neutral-300 px-4 py-3">
                <p className="text-[12px] font-bold tracking-wide">OBSERVAÇÕES E CONDIÇÕES</p>
                {draft.pagamento ? (
                  <p className="mt-2">
                    {"Pagamento: "}
                    {draft.pagamento}
                  </p>
                ) : null}
                {draft.observacoes ? <p className="mt-1 whitespace-pre-wrap">{draft.observacoes}</p> : null}
              </section>
              <footer className="mt-14">
                <div className="flex items-end justify-between gap-8">
                  <p className="text-[13px]">
                    <span className="font-bold">{empresa.nome}</span>
                    <br />
                    {empresa.cnpj ? `CNPJ: ${empresa.cnpj}` : ""}
                  </p>
                  <div className="w-56 text-center">
                    <div className="border-b border-neutral-700" />
                    <p className="mt-1 text-[12px] text-neutral-600">Assinatura / Carimbo</p>
                  </div>
                </div>
                <p className="mt-8 text-center text-[12px] text-neutral-700">
                  {"Este "}
                  {doc === "os" ? "documento" : "orçamento"}
                  {" \u00E9 v\u00E1lido at\u00E9 "}
                  {formatDate(addDays(draft.data, draft.validade))}.
                </p>
              </footer>
            </article>
          ) : null}
        </>
      )}
    </div>
  );
}
