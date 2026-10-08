-- ============================================================
-- CONTROL DEL NEGOCIO · SUPABASE
-- Ejecutar completo una sola vez en Supabase > SQL Editor.
-- ============================================================

create extension if not exists pgcrypto;

create table if not exists public.businesses (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 2 and 100),
  join_code text not null unique,
  owner_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.business_members (
  business_id uuid not null references public.businesses(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'member')),
  joined_at timestamptz not null default now(),
  primary key (business_id, user_id),
  unique (user_id)
);

create table if not exists public.business_data (
  business_id uuid primary key references public.businesses(id) on delete cascade,
  products jsonb,
  insumos jsonb,
  customers jsonb not null default '[]'::jsonb,
  sales jsonb not null default '[]'::jsonb,
  quotes jsonb not null default '[]'::jsonb,
  expenses jsonb not null default '[]'::jsonb,
  suppliers jsonb not null default '[]'::jsonb,
  productions jsonb not null default '[]'::jsonb,
  movements jsonb not null default '[]'::jsonb,
  budgets jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null
);

create index if not exists business_members_user_idx on public.business_members(user_id);
create index if not exists business_members_business_idx on public.business_members(business_id);

-- Evita recursión de políticas al comprobar membresía.
create or replace function public.is_business_member(p_business_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.business_members bm
    where bm.business_id = p_business_id
      and bm.user_id = auth.uid()
  );
$$;

revoke all on function public.is_business_member(uuid) from public;
grant execute on function public.is_business_member(uuid) to authenticated;

create or replace function public.touch_business_data()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists business_data_touch on public.business_data;
create trigger business_data_touch
before update on public.business_data
for each row execute function public.touch_business_data();

-- Crea un negocio, agrega al creador como propietario y genera el contenedor de datos.
create or replace function public.create_business(p_name text)
returns table (business_id uuid, join_code text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_business uuid;
  v_code text;
begin
  if v_user is null then
    raise exception 'Debes iniciar sesión.';
  end if;

  if exists (select 1 from public.business_members where user_id = v_user) then
    raise exception 'Esta cuenta ya pertenece a un negocio.';
  end if;

  if char_length(trim(coalesce(p_name, ''))) < 2 then
    raise exception 'Ingresa un nombre válido para el negocio.';
  end if;

  loop
    v_code := upper(substr(encode(gen_random_bytes(8), 'hex'), 1, 10));
    exit when not exists (select 1 from public.businesses where join_code = v_code);
  end loop;

  insert into public.businesses(name, join_code, owner_id)
  values (trim(p_name), v_code, v_user)
  returning id into v_business;

  insert into public.business_members(business_id, user_id, role)
  values (v_business, v_user, 'owner');

  insert into public.business_data(business_id, updated_by)
  values (v_business, v_user);

  return query select v_business, v_code;
end;
$$;

revoke all on function public.create_business(text) from public;
grant execute on function public.create_business(text) to authenticated;

-- Permite que una segunda cuenta se una usando el código visible dentro de la app.
create or replace function public.join_business_by_code(p_code text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_business uuid;
begin
  if v_user is null then
    raise exception 'Debes iniciar sesión.';
  end if;

  if exists (select 1 from public.business_members where user_id = v_user) then
    raise exception 'Esta cuenta ya pertenece a un negocio.';
  end if;

  select id into v_business
  from public.businesses
  where join_code = upper(trim(coalesce(p_code, '')));

  if v_business is null then
    raise exception 'El código no existe o fue reemplazado.';
  end if;

  insert into public.business_members(business_id, user_id, role)
  values (v_business, v_user, 'member');

  return v_business;
end;
$$;

revoke all on function public.join_business_by_code(text) from public;
grant execute on function public.join_business_by_code(text) to authenticated;

-- El propietario puede invalidar el código anterior y generar uno nuevo.
create or replace function public.rotate_business_code(p_business_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_code text;
begin
  if not exists (
    select 1 from public.businesses
    where id = p_business_id and owner_id = v_user
  ) then
    raise exception 'Solo el propietario puede cambiar el código.';
  end if;

  loop
    v_code := upper(substr(encode(gen_random_bytes(8), 'hex'), 1, 10));
    exit when not exists (select 1 from public.businesses where join_code = v_code);
  end loop;

  update public.businesses
  set join_code = v_code
  where id = p_business_id;

  return v_code;
end;
$$;

revoke all on function public.rotate_business_code(uuid) from public;
grant execute on function public.rotate_business_code(uuid) to authenticated;

-- Seguridad por fila: cada usuario ve y modifica únicamente su negocio.
alter table public.businesses enable row level security;
alter table public.business_members enable row level security;
alter table public.business_data enable row level security;

-- Fuerza RLS incluso para propietarios normales de tabla cuando corresponda.
alter table public.businesses force row level security;
alter table public.business_members force row level security;
alter table public.business_data force row level security;

drop policy if exists "members read business" on public.businesses;
create policy "members read business"
on public.businesses for select
to authenticated
using (public.is_business_member(id));

drop policy if exists "members read team" on public.business_members;
create policy "members read team"
on public.business_members for select
to authenticated
using (public.is_business_member(business_id));

drop policy if exists "members read business data" on public.business_data;
create policy "members read business data"
on public.business_data for select
to authenticated
using (public.is_business_member(business_id));

drop policy if exists "members update business data" on public.business_data;
create policy "members update business data"
on public.business_data for update
to authenticated
using (public.is_business_member(business_id))
with check (public.is_business_member(business_id));

revoke all on public.businesses from anon, authenticated;
revoke all on public.business_members from anon, authenticated;
revoke all on public.business_data from anon, authenticated;

grant select on public.businesses to authenticated;
grant select on public.business_members to authenticated;
grant select, update on public.business_data to authenticated;

-- Activa cambios en tiempo real para sincronizar los celulares.
alter table public.business_data replica identity full;
do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'business_data'
  ) then
    execute 'alter publication supabase_realtime add table public.business_data';
  end if;
end $$;
