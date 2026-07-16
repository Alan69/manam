-- Схема шежіре: persons / profiles / submissions / site_content + RLS + RPC.
-- Запустить целиком в Supabase SQL Editor (Dashboard → SQL Editor → New query).

-- ===== Таблицы =====

create table public.persons (
  id bigint generated always as identity primary key,
  full_name text not null,
  father_id bigint references public.persons(id) on delete restrict,
  generation int,
  birth_year int,
  death_year int,
  is_alive boolean default true,
  bio text,
  photo_url text,
  residence text,
  created_by uuid,
  is_verified boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table public.profiles (
  id uuid primary key references auth.users on delete cascade,
  full_name text not null,
  phone text,
  role text not null default 'user' check (role in ('user','moderator','admin')),
  person_id bigint references public.persons(id),
  created_at timestamptz default now()
);

alter table public.persons
  add constraint persons_created_by_fkey foreign key (created_by) references public.profiles(id);

create table public.submissions (
  id bigint generated always as identity primary key,
  submitted_by uuid not null references public.profiles(id),
  type text not null check (type in ('add_person','edit_person','link_self')),
  target_person_id bigint references public.persons(id),
  payload jsonb not null,
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  moderator_comment text,
  reviewed_by uuid references public.profiles(id),
  reviewed_at timestamptz,
  created_at timestamptz default now()
);

create table public.site_content (
  key text primary key,
  ru text not null default '',
  kk text not null default '',
  updated_at timestamptz default now()
);

-- ===== Индексы =====

create index persons_father_id_idx on public.persons(father_id);
create index submissions_status_idx on public.submissions(status);
create index persons_full_name_fts_idx on public.persons using gin (to_tsvector('simple', full_name));

-- ===== Триггеры =====

-- generation = поколение отца + 1; updated_at обновляется всегда
-- ponytail: при смене father_id у узла generation его потомков не пересчитывается каскадно;
-- если начнёте переносить целые ветки — добавьте рекурсивный пересчёт.
create or replace function public.persons_before_write()
returns trigger language plpgsql as $$
begin
  if new.father_id is null then
    new.generation := 1;
  else
    select generation + 1 into new.generation from public.persons where id = new.father_id;
  end if;
  new.updated_at := now();
  return new;
end $$;

create trigger persons_before_write before insert or update on public.persons
for each row execute function public.persons_before_write();

-- профиль создаётся автоматически при регистрации
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', new.email, 'Без имени'));
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
for each row execute function public.handle_new_user();

-- ===== Хелперы ролей (security definer — без рекурсии в RLS) =====

create or replace function public.is_moderator()
returns boolean language sql security definer set search_path = public stable as $$
  select exists (select 1 from profiles where id = auth.uid() and role in ('moderator','admin'));
$$;

create or replace function public.is_admin()
returns boolean language sql security definer set search_path = public stable as $$
  select exists (select 1 from profiles where id = auth.uid() and role = 'admin');
$$;

create or replace function public.pending_submission_count()
returns int language sql security definer set search_path = public stable as $$
  select count(*)::int from submissions where submitted_by = auth.uid() and status = 'pending';
$$;

-- ===== RLS =====

alter table public.persons enable row level security;
alter table public.profiles enable row level security;
alter table public.submissions enable row level security;
alter table public.site_content enable row level security;

create policy "persons_select_all" on public.persons
  for select using (true);
create policy "persons_insert_moderators" on public.persons
  for insert with check (public.is_moderator());
create policy "persons_update_moderators" on public.persons
  for update using (public.is_moderator());
create policy "persons_delete_moderators" on public.persons
  for delete using (public.is_moderator());

create policy "profiles_select_own_or_mod" on public.profiles
  for select using (id = auth.uid() or public.is_moderator());
create policy "profiles_update_own" on public.profiles
  for update using (id = auth.uid()) with check (id = auth.uid());

-- поле role менять нельзя даже в своём профиле — только через set_user_role (админ)
revoke update on public.profiles from authenticated;
grant update (full_name, phone, person_id) on public.profiles to authenticated;

-- антиспам: не более 10 pending-заявок на пользователя
create policy "submissions_insert_own" on public.submissions
  for insert with check (submitted_by = auth.uid() and public.pending_submission_count() < 10);
create policy "submissions_select_own_or_mod" on public.submissions
  for select using (submitted_by = auth.uid() or public.is_moderator());
create policy "submissions_update_moderators" on public.submissions
  for update using (public.is_moderator());

create policy "site_content_select_all" on public.site_content
  for select using (true);
create policy "site_content_write_moderators" on public.site_content
  for insert with check (public.is_moderator());
create policy "site_content_update_moderators" on public.site_content
  for update using (public.is_moderator());

-- ===== RPC =====

-- одобрение заявки одной транзакцией
create or replace function public.approve_submission(submission_id bigint)
returns bigint language plpgsql security definer set search_path = public as $$
declare
  sub record;
  result_person_id bigint;
begin
  if not public.is_moderator() then
    raise exception 'forbidden';
  end if;

  select * into sub from submissions where id = submission_id and status = 'pending' for update;
  if not found then
    raise exception 'submission not found or already reviewed';
  end if;

  if sub.type = 'add_person' then
    insert into persons (full_name, father_id, birth_year, death_year, is_alive, bio, residence, photo_url, created_by, is_verified)
    values (
      sub.payload->>'full_name',
      nullif(sub.payload->>'father_id','')::bigint,
      nullif(sub.payload->>'birth_year','')::int,
      nullif(sub.payload->>'death_year','')::int,
      coalesce((sub.payload->>'is_alive')::boolean, true),
      nullif(sub.payload->>'bio',''),
      nullif(sub.payload->>'residence',''),
      nullif(sub.payload->>'photo_url',''),
      sub.submitted_by,
      true
    ) returning id into result_person_id;
  elsif sub.type = 'edit_person' then
    update persons set
      full_name  = coalesce(nullif(sub.payload->>'full_name',''), full_name),
      father_id  = coalesce(nullif(sub.payload->>'father_id','')::bigint, father_id),
      birth_year = nullif(sub.payload->>'birth_year','')::int,
      death_year = nullif(sub.payload->>'death_year','')::int,
      is_alive   = coalesce((sub.payload->>'is_alive')::boolean, is_alive),
      bio        = coalesce(nullif(sub.payload->>'bio',''), bio),
      residence  = coalesce(nullif(sub.payload->>'residence',''), residence),
      photo_url  = coalesce(nullif(sub.payload->>'photo_url',''), photo_url),
      is_verified = true
    where id = sub.target_person_id;
    result_person_id := sub.target_person_id;
  elsif sub.type = 'link_self' then
    update profiles set person_id = sub.target_person_id where id = sub.submitted_by;
    result_person_id := sub.target_person_id;
  end if;

  update submissions
  set status = 'approved', reviewed_by = auth.uid(), reviewed_at = now()
  where id = submission_id;

  return result_person_id;
end $$;

-- назначение ролей — только админ
create or replace function public.set_user_role(target uuid, new_role text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then
    raise exception 'forbidden';
  end if;
  if new_role not in ('user','moderator','admin') then
    raise exception 'invalid role';
  end if;
  update profiles set role = new_role where id = target;
end $$;

-- ===== Storage: bucket photos =====
-- Если политики на storage.objects выдадут ошибку "must be owner of table objects",
-- создайте их через Dashboard → Storage → photos → Policies (public read + authenticated insert).

insert into storage.buckets (id, name, public, file_size_limit)
values ('photos', 'photos', true, 2097152)
on conflict (id) do nothing;

create policy "photos_public_read" on storage.objects
  for select using (bucket_id = 'photos');
create policy "photos_auth_upload" on storage.objects
  for insert to authenticated with check (bucket_id = 'photos');
