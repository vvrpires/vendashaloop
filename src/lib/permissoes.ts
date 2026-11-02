export type PermissaoId =
  | "painel"
  | "orcamentos"
  | "clientes"
  | "produtos"
  | "empresa"
  | "usuarios"
  | "relatorios"
  | "orcamentos_criar"
  | "orcamentos_excluir"
  | "orcamentos_venda"
  | "orcamentos_nota"
  | "clientes_editar"
  | "produtos_editar";

export const PERMISSOES: { id: PermissaoId; label: string; grupo: string }[] = [
  { id: "painel", label: "Painel", grupo: "Telas" },
  { id: "orcamentos", label: "Orçamentos", grupo: "Telas" },
  { id: "clientes", label: "Clientes", grupo: "Telas" },
  { id: "produtos", label: "Catálogo", grupo: "Telas" },
  { id: "empresa", label: "Minha empresa", grupo: "Telas" },
  { id: "usuarios", label: "Usuários", grupo: "Telas" },
  { id: "relatorios", label: "Relatórios", grupo: "Telas" },
  { id: "orcamentos_criar", label: "Criar e editar", grupo: "Orçamentos" },
  { id: "orcamentos_excluir", label: "Excluir", grupo: "Orçamentos" },
  { id: "orcamentos_venda", label: "Confirmar venda", grupo: "Orçamentos" },
  { id: "orcamentos_nota", label: "Emitir nota", grupo: "Orçamentos" },
  { id: "clientes_editar", label: "Cadastrar clientes", grupo: "Cadastros" },
  { id: "produtos_editar", label: "Cadastrar produtos", grupo: "Cadastros" },
];

export const PADRAO_NOVO: PermissaoId[] = [
  "painel",
  "orcamentos",
  "orcamentos_criar",
  "clientes",
  "clientes_editar",
  "produtos",
];

export function listaPermissoes(role: string, salvo: string): string[] {
  if (role === "superadmin") return PERMISSOES.map((item) => item.id);
  if (role === "admin") return PERMISSOES.map((item) => item.id).filter((item) => item !== "empresa");
  return salvo
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

export function pode(role: string, salvo: string, chave: string): boolean {
  return listaPermissoes(role, salvo).includes(chave);
}
