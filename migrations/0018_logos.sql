alter table empresa add column if not exists logo_login text not null default '';
alter table empresa add column if not exists logo_sistema text not null default '';
update empresa set logo_login = logo_clara where id = 1 and logo_login = '' and coalesce(logo_clara, '') <> '';
update empresa set logo_sistema = logo_clara where id = 1 and logo_sistema = '' and coalesce(logo_clara, '') <> '';
