alter table profiles add column if not exists username text;

create unique index if not exists profiles_username_unique
  on profiles (lower(username))
  where username is not null and username <> '';

update profiles p
set username = 'admin'
from "user" u
where u.id = p.user_id
  and lower(u.email) = 'admin@haloop.com.br'
  and coalesce(p.username, '') = '';

update profiles p
set username = lower(split_part(u.email, '@', 1))
from "user" u
where u.id = p.user_id
  and coalesce(p.username, '') = ''
  and split_part(u.email, '@', 1) <> ''
  and not exists (
    select 1 from profiles other
    where lower(other.username) = lower(split_part(u.email, '@', 1))
  );
