-- Troca os identificadores aleatórios por números sequenciais.
-- A senha continua armazenada só como hash. O token da sessão também
-- permanece aleatório, porque ele é a chave de acesso e não um cadastro.

alter table "user" add column if not exists id_novo integer;

update "user" u
set id_novo = n.rn
from (
  select id, row_number() over (order by "createdAt", id)::int as rn
  from "user"
) n
where u.id = n.id
  and u.id_novo is null;

delete from "session";
alter table "session" drop constraint if exists "session_userId_fkey";
alter table "account" drop constraint if exists "account_userId_fkey";

update "account" a
set "userId" = u.id_novo::text
from "user" u
where a."userId" = u.id;

update "account" a
set "accountId" = u.id_novo::text
from "user" u
where a."providerId" = 'credential'
  and a."accountId" = u.id;

update profiles p
set user_id = u.id_novo::text
from "user" u
where p.user_id = u.id;

update clientes c
set created_by = u.id_novo::text
from "user" u
where c.created_by = u.id;

update produtos p
set created_by = u.id_novo::text
from "user" u
where p.created_by = u.id;

update orcamentos o
set created_by = u.id_novo::text
from "user" u
where o.created_by = u.id;

update clientes set created_by = (select min(id_novo)::text from "user")
where created_by !~ '^[0-9]+$';

update produtos set created_by = (select min(id_novo)::text from "user")
where created_by !~ '^[0-9]+$';

update orcamentos set created_by = (select min(id_novo)::text from "user")
where created_by !~ '^[0-9]+$';

alter table "user" drop constraint if exists "user_pkey";
alter table "user" drop column id;
alter table "user" rename column id_novo to id;
alter table "user" alter column id set not null;
alter table "user" add primary key (id);

create sequence if not exists user_id_seq;
alter sequence user_id_seq owned by "user".id;
select setval('user_id_seq', coalesce((select max(id) from "user"), 1), (select exists (select 1 from "user")));
alter table "user" alter column id set default nextval('user_id_seq');

alter table "account" alter column "userId" type integer using "userId"::integer;
alter table profiles alter column user_id type integer using user_id::integer;
alter table clientes alter column created_by type integer using created_by::integer;
alter table produtos alter column created_by type integer using created_by::integer;
alter table orcamentos alter column created_by type integer using created_by::integer;

alter table "account" add constraint "account_userId_fkey"
  foreign key ("userId") references "user" (id) on delete cascade;

alter table "account" add column if not exists id_novo integer;
update "account" a
set id_novo = n.rn
from (
  select id, row_number() over (order by "createdAt", id)::int as rn
  from "account"
) n
where a.id = n.id
  and a.id_novo is null;
alter table "account" drop constraint if exists account_pkey;
alter table "account" drop column id;
alter table "account" rename column id_novo to id;
alter table "account" alter column id set not null;
alter table "account" add primary key (id);
create sequence if not exists account_id_seq;
alter sequence account_id_seq owned by "account".id;
select setval('account_id_seq', coalesce((select max(id) from "account"), 1), (select exists (select 1 from "account")));
alter table "account" alter column id set default nextval('account_id_seq');

alter table "session" drop constraint if exists session_pkey;
alter table "session" drop column id;
alter table "session" add column id integer;
alter table "session" alter column id set not null;
alter table "session" add primary key (id);
alter table "session" alter column "userId" type integer using nullif("userId", '')::integer;
alter table "session" alter column "userId" set not null;
alter table "session" add constraint "session_userId_fkey"
  foreign key ("userId") references "user" (id) on delete cascade;
create sequence if not exists session_id_seq;
alter sequence session_id_seq owned by "session".id;
select setval('session_id_seq', 1, false);
alter table "session" alter column id set default nextval('session_id_seq');

alter table "verification" add column if not exists id_novo integer;
update "verification" v
set id_novo = n.rn
from (
  select id, row_number() over (order by "createdAt", id)::int as rn
  from "verification"
) n
where v.id = n.id
  and v.id_novo is null;
alter table "verification" drop constraint if exists verification_pkey;
alter table "verification" drop column id;
alter table "verification" rename column id_novo to id;
alter table "verification" alter column id set not null;
alter table "verification" add primary key (id);
create sequence if not exists verification_id_seq;
alter sequence verification_id_seq owned by "verification".id;
select setval('verification_id_seq', coalesce((select max(id) from "verification"), 1), (select exists (select 1 from "verification")));
alter table "verification" alter column id set default nextval('verification_id_seq');

alter table clientes add column if not exists id_novo integer;
update clientes c
set id_novo = n.rn
from (
  select id, row_number() over (order by created_at, id)::int as rn
  from clientes
) n
where c.id = n.id
  and c.id_novo is null;
alter table clientes drop constraint if exists clientes_pkey;
alter table clientes drop column id;
alter table clientes rename column id_novo to id;
alter table clientes alter column id set not null;
alter table clientes add primary key (id);
create sequence if not exists clientes_id_seq;
alter sequence clientes_id_seq owned by clientes.id;
select setval('clientes_id_seq', coalesce((select max(id) from clientes), 1), (select exists (select 1 from clientes)));
alter table clientes alter column id set default nextval('clientes_id_seq');

alter table produtos add column if not exists id_novo integer;
update produtos p
set id_novo = n.rn
from (
  select id, row_number() over (order by created_at, id)::int as rn
  from produtos
) n
where p.id = n.id
  and p.id_novo is null;
alter table produtos drop constraint if exists produtos_pkey;
alter table produtos drop column id;
alter table produtos rename column id_novo to id;
alter table produtos alter column id set not null;
alter table produtos add primary key (id);
create sequence if not exists produtos_id_seq;
alter sequence produtos_id_seq owned by produtos.id;
select setval('produtos_id_seq', coalesce((select max(id) from produtos), 1), (select exists (select 1 from produtos)));
alter table produtos alter column id set default nextval('produtos_id_seq');

alter table orcamentos add column if not exists id_novo integer;
update orcamentos o
set id_novo = n.rn
from (
  select id, row_number() over (order by seq, id)::int as rn
  from orcamentos
) n
where o.id = n.id
  and o.id_novo is null;
alter table orcamentos drop constraint if exists orcamentos_pkey;
alter table orcamentos drop column id;
alter table orcamentos rename column id_novo to id;
alter table orcamentos alter column id set not null;
alter table orcamentos add primary key (id);
create sequence if not exists orcamentos_id_seq;
alter sequence orcamentos_id_seq owned by orcamentos.id;
select setval('orcamentos_id_seq', coalesce((select max(id) from orcamentos), 1), (select exists (select 1 from orcamentos)));
alter table orcamentos alter column id set default nextval('orcamentos_id_seq');
