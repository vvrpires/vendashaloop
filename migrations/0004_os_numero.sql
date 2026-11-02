alter table orcamentos add column if not exists os_seq integer;
alter table orcamentos add column if not exists os_numero text not null default '';
