update profiles set role = 'superadmin' where role = 'admin';
alter table empresa add column if not exists senha_config text not null default '';
