-- Haloop vendas: empresa compartilhada entre usuários autenticados.
-- created_by registra quem criou; o acesso é da equipe, não de um único user_id.

create table if not exists profiles (
  user_id text primary key,
  name text not null default '',
  role text not null default 'vendedor',
  created_at timestamptz not null default now()
);

create table if not exists empresa (
  id integer primary key,
  nome text not null,
  cnpj text not null default '',
  telefone text not null default '',
  email text not null default '',
  local text not null default ''
);

insert into empresa (id, nome, cnpj, telefone, email, local)
values (
  1,
  'Haloop - Soluções em T.I',
  '69.164.519/0001-01',
  '(99) 99119-9874',
  'administrativo@haloop.com.br',
  'Araguaína, Tocantins'
)
on conflict (id) do nothing;

create table if not exists clientes (
  id text primary key,
  nome text not null,
  documento text not null default '',
  telefone text not null default '',
  email text not null default '',
  endereco text not null default '',
  created_by text not null,
  created_at timestamptz not null default now()
);

create table if not exists produtos (
  id text primary key,
  descricao text not null,
  valor numeric(12,2) not null default 0,
  unidade text not null default 'un',
  created_by text not null,
  created_at timestamptz not null default now()
);

create table if not exists orcamentos (
  id text primary key,
  seq integer not null,
  numero text not null,
  data date not null,
  validade integer not null default 15,
  status text not null default 'pendente',
  cliente_nome text not null default '',
  cliente_doc text not null default '',
  cliente_telefone text not null default '',
  cliente_email text not null default '',
  cliente_endereco text not null default '',
  itens text not null default '[]',
  desconto numeric(12,2) not null default 0,
  desconto_pct numeric(8,2) not null default 0,
  imposto numeric(8,2) not null default 0,
  pagamento text not null default '',
  pag_status text not null default 'aberto',
  valor_pago numeric(12,2) not null default 0,
  observacoes text not null default '',
  subtotal numeric(12,2) not null default 0,
  total numeric(12,2) not null default 0,
  created_by text not null,
  updated_at timestamptz not null default now()
);

create index if not exists orcamentos_data_idx on orcamentos (data);
