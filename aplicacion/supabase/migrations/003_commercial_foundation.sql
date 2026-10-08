-- Control Emprende 2.0 · Migración aditiva. Aplicar ANTES de publicar el nuevo cliente.
-- No reinicia inventario, ni transforma ventas históricas, ni borra registros.
begin;
alter table public.business_members drop constraint if exists business_members_user_id_key;
alter table public.business_members drop constraint if exists business_members_role_check;
alter table public.business_members add constraint business_members_role_check check (role in ('owner', 'member', 'reader'));
alter table public.businesses add column if not exists join_code_expires_at timestamptz not null default (now() + interval '7 days');
alter table public.business_data add column if not exists profile jsonb not null default '{}'::jsonb;
alter table public.business_data add column if not exists version bigint not null default 0;

create table if not exists public.business_audit (
  id bigint generated always as identity primary key,
  business_id uuid not null references public.businesses(id) on delete cascade,
  actor_id uuid references auth.users(id) on delete set null,
  action text not null,
  changed_keys text[] not null,
  version bigint not null,
  operation_id uuid not null,
  request_hash text not null,
  created_at timestamptz not null default now(),
  unique (business_id, operation_id)
);
create index if not exists business_audit_recent_idx on public.business_audit(business_id, created_at desc);
alter table public.business_audit enable row level security;
alter table public.business_audit force row level security;
drop policy if exists "members read audit" on public.business_audit;
create policy "members read audit" on public.business_audit for select to authenticated using (public.is_business_member(business_id));
revoke all on public.business_audit from anon, authenticated;
grant select on public.business_audit to authenticated;

-- Se elimina la escritura directa: todas las colecciones de una operación se confirman juntas.
revoke update on public.business_data from authenticated;
drop policy if exists "members update business data" on public.business_data;
-- El código de invitación ya no está disponible en consultas comunes de los integrantes.
revoke select on public.businesses from authenticated;
grant select (id, name, owner_id, created_at) on public.businesses to authenticated;

create or replace function public.commit_business_data(p_business_id uuid, p_expected_version bigint, p_patch jsonb, p_operation_id uuid, p_action text default 'edit')
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := auth.uid(); v_role text; v_row public.business_data;
  v_key text; v_value jsonb; v_item jsonb; v_line jsonb; v_field text;
  v_keys text[]; v_hash text; v_prior_hash text; v_profile jsonb;
begin
  select bm.role into v_role from public.business_members bm where bm.business_id = p_business_id and bm.user_id = v_user for share;
  if v_user is null or v_role is null or v_role = 'reader' then raise exception 'No tienes permiso para modificar este negocio.' using errcode = '42501'; end if;
  if p_operation_id is null or p_expected_version is null or p_expected_version < 0 then raise exception 'La operación necesita identificador y versión.' using errcode = '22023'; end if;
  if p_patch is null or jsonb_typeof(p_patch) <> 'object' or p_patch = '{}'::jsonb or octet_length(p_patch::text) > 20971520 then raise exception 'El contenido no es válido o supera 20 MB.' using errcode = '22023'; end if;
  select * into v_row from public.business_data bd where bd.business_id = p_business_id for update;
  if not found then raise exception 'No se encontró el negocio.' using errcode = '42501'; end if;
  v_hash := md5(p_patch::text);
  select a.request_hash into v_prior_hash from public.business_audit a where a.business_id = p_business_id and a.operation_id = p_operation_id;
  if v_prior_hash is not null then
    if v_prior_hash <> v_hash then raise exception 'Identificador de operación reutilizado con otro contenido.' using errcode = '22023'; end if;
    return to_jsonb(v_row);
  end if;
  if v_row.version <> p_expected_version then raise exception 'El negocio cambió. Actualiza antes de guardar.' using errcode = '40001'; end if;
  for v_key, v_value in select key, value from jsonb_each(p_patch) loop
    if v_key not in ('products','insumos','customers','sales','quotes','expenses','suppliers','productions','movements','budgets','profile') then raise exception 'Campo no permitido: %', v_key using errcode = '22023'; end if;
    if v_key in ('budgets','profile') then
      if jsonb_typeof(v_value) <> 'object' then raise exception 'Formato inválido: %', v_key using errcode = '22023'; end if;
    else
      if jsonb_typeof(v_value) <> 'array' or jsonb_array_length(v_value) > 50000 then raise exception 'Lista inválida o demasiado grande: %', v_key using errcode = '22023'; end if;
      if exists (select 1 from jsonb_array_elements(v_value) r where jsonb_typeof(r) <> 'object' or jsonb_typeof(r->'id') is distinct from 'string' or coalesce(trim(r->>'id'),'') = '') then raise exception 'Registro sin identificador en %', v_key using errcode = '22023'; end if;
      if exists (select r->>'id' from jsonb_array_elements(v_value) r group by r->>'id' having count(*) > 1) then raise exception 'Identificador duplicado en %', v_key using errcode = '22023'; end if;
      for v_item in select value from jsonb_array_elements(v_value) loop
        foreach v_field in array array['stock','minStock','price','total','paidAmount','costPerUnit'] loop
          if v_item ? v_field then
            if coalesce(v_item->>v_field,'') !~ '^[0-9]+(\.[0-9]+)?([eE][+-]?[0-9]+)?$' or (v_item->>v_field)::numeric < 0 then raise exception 'Número inválido: % · %', v_key, v_field using errcode = '22023'; end if;
          end if;
        end loop;
        if v_key in ('sales','quotes') then
          if jsonb_typeof(v_item->'items') is distinct from 'array' then raise exception 'Falta el detalle del registro.' using errcode = '22023'; end if;
          if jsonb_array_length(v_item->'items') = 0 then raise exception 'El detalle está vacío.' using errcode = '22023'; end if;
          for v_line in select value from jsonb_array_elements(v_item->'items') loop
            if coalesce(v_line->>'qty','') !~ '^[0-9]+(\.[0-9]+)?$' or (v_line->>'qty')::numeric <= 0 or coalesce(v_line->>'price','') !~ '^[0-9]+(\.[0-9]+)?$' then raise exception 'Cantidad o precio inválido.' using errcode = '22023'; end if;
          end loop;
          if (v_item->>'paidAmount')::numeric > (v_item->>'total')::numeric then raise exception 'El pago supera el total.' using errcode = '22023'; end if;
        end if;
      end loop;
    end if;
  end loop;
  if p_patch ? 'profile' then
    if v_role <> 'owner' then raise exception 'Solo el propietario puede configurar el negocio.' using errcode = '42501'; end if;
    v_profile := p_patch->'profile';
    if char_length(trim(coalesce(v_profile->>'name',''))) not between 2 and 100 or coalesce(v_profile->>'currency','') not in ('CLP','PEN','USD') or coalesce(v_profile->>'inventoryMode','') not in ('manual','automatic') or coalesce(v_profile->>'countryCode','') !~ '^[0-9]{1,4}$' then raise exception 'Revisa los datos del negocio.' using errcode = '22023'; end if;
    if coalesce(v_row.profile->>'currency','CLP') <> v_profile->>'currency' and (jsonb_array_length(coalesce(v_row.sales,'[]')) > 0 or jsonb_array_length(coalesce(v_row.expenses,'[]')) > 0 or jsonb_array_length(coalesce(v_row.products,'[]')) > 0) then raise exception 'No se puede cambiar la moneda de un negocio con precios o movimientos.' using errcode = '22023'; end if;
  end if;
  select array_agg(key order by key) into v_keys from jsonb_object_keys(p_patch) key;
  update public.business_data bd set
    products = case when p_patch ? 'products' then p_patch->'products' else bd.products end,
    insumos = case when p_patch ? 'insumos' then p_patch->'insumos' else bd.insumos end,
    customers = case when p_patch ? 'customers' then p_patch->'customers' else bd.customers end,
    sales = case when p_patch ? 'sales' then p_patch->'sales' else bd.sales end,
    quotes = case when p_patch ? 'quotes' then p_patch->'quotes' else bd.quotes end,
    expenses = case when p_patch ? 'expenses' then p_patch->'expenses' else bd.expenses end,
    suppliers = case when p_patch ? 'suppliers' then p_patch->'suppliers' else bd.suppliers end,
    productions = case when p_patch ? 'productions' then p_patch->'productions' else bd.productions end,
    movements = case when p_patch ? 'movements' then p_patch->'movements' else bd.movements end,
    budgets = case when p_patch ? 'budgets' then p_patch->'budgets' else bd.budgets end,
    profile = case when p_patch ? 'profile' then p_patch->'profile' else bd.profile end,
    version = bd.version + 1, updated_at = now(), updated_by = v_user
    where bd.business_id = p_business_id returning * into v_row;
  if p_patch ? 'profile' then update public.businesses set name = trim(v_profile->>'name') where id = p_business_id; end if;
  insert into public.business_audit(business_id,actor_id,action,changed_keys,version,operation_id,request_hash) values (p_business_id,v_user,left(coalesce(p_action,'edit'),80),v_keys,v_row.version,p_operation_id,v_hash);
  return to_jsonb(v_row);
end; $$;
revoke all on function public.commit_business_data(uuid,bigint,jsonb,uuid,text) from public;
grant execute on function public.commit_business_data(uuid,bigint,jsonb,uuid,text) to authenticated;

create or replace function public.create_business(p_name text)
returns table (business_id uuid, join_code text) language plpgsql security definer set search_path = '' as $$
declare v_user uuid := auth.uid(); v_business uuid; v_code text := replace(gen_random_uuid()::text,'-','');
begin
  if v_user is null then raise exception 'Debes iniciar sesión.' using errcode = '42501'; end if;
  if char_length(trim(coalesce(p_name,''))) not between 2 and 100 then raise exception 'Usa un nombre de 2 a 100 caracteres.'; end if;
  insert into public.businesses(name,join_code,owner_id) values(trim(p_name),v_code,v_user) returning id into v_business;
  insert into public.business_members(business_id,user_id,role) values(v_business,v_user,'owner');
  insert into public.business_data(business_id,updated_by,products,insumos) values(v_business,v_user,'[]','[]');
  return query select v_business,v_code;
end; $$;

create or replace function public.join_business_by_code(p_code text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_user uuid := auth.uid(); v_business uuid;
begin
  if v_user is null then raise exception 'Debes iniciar sesión.' using errcode = '42501'; end if;
  select b.id into v_business from public.businesses b where upper(b.join_code) = upper(trim(coalesce(p_code,''))) and b.join_code_expires_at > now();
  if v_business is null then raise exception 'La invitación no existe, venció o fue reemplazada.'; end if;
  insert into public.business_members(business_id,user_id,role) values(v_business,v_user,'member') on conflict on constraint business_members_pkey do nothing;
  return v_business;
end; $$;

create or replace function public.rotate_business_code(p_business_id uuid)
returns text language plpgsql security definer set search_path = '' as $$
declare v_code text := replace(gen_random_uuid()::text,'-','');
begin
  if not exists(select 1 from public.businesses where id=p_business_id and owner_id=auth.uid()) then raise exception 'Solo el propietario puede renovar la invitación.' using errcode = '42501'; end if;
  update public.businesses set join_code=v_code, join_code_expires_at=now()+interval '7 days' where id=p_business_id;
  return v_code;
end; $$;

create or replace function public.get_business_invite(p_business_id uuid)
returns table (join_code text, expires_at timestamptz) language plpgsql security definer set search_path = '' as $$
begin
  if not exists(select 1 from public.businesses where id=p_business_id and owner_id=auth.uid()) then raise exception 'Solo el propietario puede invitar.' using errcode = '42501'; end if;
  return query select b.join_code,b.join_code_expires_at from public.businesses b where b.id=p_business_id;
end; $$;

create or replace function public.list_business_team(p_business_id uuid)
returns table (user_id uuid, email text, role text, joined_at timestamptz) language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_business_member(p_business_id) then raise exception 'Acceso denegado.' using errcode = '42501'; end if;
  return query select bm.user_id,u.email::text,bm.role,bm.joined_at from public.business_members bm join auth.users u on u.id=bm.user_id where bm.business_id=p_business_id order by bm.joined_at;
end; $$;

create or replace function public.set_business_member_role(p_business_id uuid,p_user_id uuid,p_role text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not exists(select 1 from public.businesses where id=p_business_id and owner_id=auth.uid()) then raise exception 'Solo el propietario puede administrar el equipo.' using errcode = '42501'; end if;
  if exists(select 1 from public.businesses where id=p_business_id and owner_id=p_user_id) then raise exception 'No puedes retirar ni cambiar el rol del propietario.'; end if;
  if p_role='remove' then delete from public.business_members where business_id=p_business_id and user_id=p_user_id;
  elsif p_role in ('member','reader') then update public.business_members set role=p_role where business_id=p_business_id and user_id=p_user_id;
  else raise exception 'Rol inválido.'; end if;
end; $$;
revoke all on function public.get_business_invite(uuid) from public;
revoke all on function public.list_business_team(uuid) from public;
revoke all on function public.set_business_member_role(uuid,uuid,text) from public;
grant execute on function public.get_business_invite(uuid) to authenticated;
grant execute on function public.list_business_team(uuid) to authenticated;
grant execute on function public.set_business_member_role(uuid,uuid,text) to authenticated;
commit;
