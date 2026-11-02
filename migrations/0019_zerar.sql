delete from orcamentos;
delete from clientes;
delete from produtos;
delete from temas;
update profiles set grupo_id = null;
delete from grupos;

delete from profiles where role <> 'admin';
delete from "user" where id not in (select user_id from profiles);

update empresa set
  logo = '',
  logo_clara = '',
  logo_login = '',
  logo_sistema = '',
  logo_menu = '',
  favicon = '',
  fundo_login = '',
  fundo_sistema = '',
  fundo_modo_login = 'padrao',
  fundo_modo_sistema = 'padrao',
  texto_login = '',
  subtitulo_login = '',
  nome_rodape = '',
  titulo_aba = ''
where id = 1;
