alter table grupos add column if not exists permissoes text not null default '';
update grupos
set permissoes = 'painel,orcamentos,orcamentos_criar,orcamentos_excluir,orcamentos_venda,orcamentos_nota,clientes,clientes_editar,produtos,produtos_editar'
where permissoes = '';
alter table empresa add column if not exists logo_posicao text not null default 'lado';
