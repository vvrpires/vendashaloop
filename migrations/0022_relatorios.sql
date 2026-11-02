-- rev.38: permissão de Relatórios para os grupos que acompanham resultados
update grupos set permissoes = permissoes || ',relatorios'
where nome in ('Administrador', 'Gerente', 'Financeiro')
  and position('relatorios' in permissoes) = 0;
