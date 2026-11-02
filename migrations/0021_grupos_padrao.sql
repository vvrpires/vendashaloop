-- rev.37: grupos padrão do sistema e grupo Administrador
update profiles set role = 'superadmin'
where user_id in (select id from "user" where email = 'admin@haloop.com.br');

update grupos set nome = 'Vendedor'
where nome = 'Vendores' and not exists (select 1 from grupos where nome = 'Vendedor');

insert into grupos (nome, permissoes) values
  ('Administrador', 'painel,orcamentos,clientes,produtos,usuarios,orcamentos_criar,orcamentos_excluir,orcamentos_venda,orcamentos_nota,clientes_editar,produtos_editar'),
  ('Vendedor', 'painel,orcamentos,orcamentos_criar,orcamentos_venda,clientes,clientes_editar,produtos'),
  ('Gerente', 'painel,orcamentos,orcamentos_criar,orcamentos_excluir,orcamentos_venda,orcamentos_nota,clientes,clientes_editar,produtos,produtos_editar'),
  ('Financeiro', 'painel,orcamentos,orcamentos_venda,orcamentos_nota,clientes'),
  ('Técnico', 'painel,orcamentos,orcamentos_criar,clientes')
on conflict (nome) do nothing;

update profiles set grupo_id = (select id from grupos where nome = 'Administrador')
where role = 'admin';
