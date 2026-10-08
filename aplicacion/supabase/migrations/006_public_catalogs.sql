-- Catálogos por negocio. Ejecutar después de 005_reporting.sql.
begin;
create table if not exists public.business_catalogs (
 business_id uuid primary key references public.businesses(id) on delete cascade,
 slug text not null unique check (slug ~ '^[a-z0-9][a-z0-9-]{1,58}[a-z0-9]$'),
 settings jsonb not null,
 product_ids jsonb not null default '[]' check (jsonb_typeof(product_ids)='array'),
 published boolean not null default false,
 version bigint not null default 1,
 updated_at timestamptz not null default now()
);
alter table public.business_catalogs enable row level security;
revoke all on public.business_catalogs from public,anon,authenticated;

create or replace function public.get_business_catalog_settings(p_business_id uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if not exists(select 1 from public.businesses where id=p_business_id and owner_id=auth.uid()) then
  raise exception 'Solo el propietario puede administrar la página.' using errcode='42501';
 end if;
 return (select to_jsonb(c)-'business_id' from public.business_catalogs c where business_id=p_business_id);
end; $$;

create or replace function public.save_business_catalog(p_business_id uuid,p_expected_version bigint,p_settings jsonb,p_published boolean)
returns jsonb language plpgsql security definer set search_path='' as $$
declare c public.business_catalogs; s jsonb; ids jsonb; k text; slug_value text; name_value text;
begin
 -- Serialize initial creation, concurrent edits and product commits on the same business data row.
 if not exists(select 1 from public.businesses where id=p_business_id and owner_id=auth.uid()) then
  raise exception 'Solo el propietario puede administrar la página.' using errcode='42501';
 end if;
 perform 1 from public.business_data where business_id=p_business_id for update;
 select * into c from public.business_catalogs where business_id=p_business_id for update;
 if p_expected_version is null or p_expected_version<>coalesce(c.version,0) then
  raise exception 'La página cambió en otra sesión. Recarga antes de guardar.' using errcode='40001';
 end if;
 if p_settings is null or jsonb_typeof(p_settings)<>'object' or octet_length(p_settings::text)>65536 or p_published is null then
  raise exception 'Configuración de página inválida.' using errcode='22023';
 end if;
 foreach k in array array['slug','name','headline','description','location','hours','whatsapp','theme','layout'] loop
  if jsonb_typeof(p_settings->k) is distinct from 'string' then raise exception 'Campo inválido: %',k using errcode='22023';end if;
 end loop;
 slug_value:=p_settings->>'slug';name_value:=trim(p_settings->>'name');
 if slug_value !~ '^[a-z0-9][a-z0-9-]{1,58}[a-z0-9]$' or length(name_value) not between 2 and 100
 or length(p_settings->>'headline')>120 or length(p_settings->>'description')>800
 or length(p_settings->>'location')>160 or length(p_settings->>'hours')>160
 or (p_settings->>'whatsapp'<>'' and p_settings->>'whatsapp' !~ '^[1-9][0-9]{7,14}$')
 or p_settings->>'theme' not in ('bosque','terracota','oceano','uva')
 or p_settings->>'layout' not in ('editorial','simple')
 or jsonb_typeof(p_settings->'showPrices') is distinct from 'boolean' then
  raise exception 'Revisa la dirección, los textos y el teléfono de tu página.' using errcode='22023';
 end if;
 ids:=p_settings->'productIds';
 if jsonb_typeof(ids) is distinct from 'array' then raise exception 'Selecciona los productos de la página.' using errcode='22023';end if;
 if jsonb_array_length(ids)>500 or exists(select 1 from jsonb_array_elements(ids) i where jsonb_typeof(i)<>'string')
 or (select count(*) from jsonb_array_elements(ids))<>(select count(distinct value) from jsonb_array_elements(ids)) then
  raise exception 'La selección admite hasta 500 productos diferentes.' using errcode='22023';
 end if;
 if exists(select 1 from jsonb_array_elements_text(ids) i where not exists(
  select 1 from public.business_data d,jsonb_array_elements(coalesce(d.products,'[]')) p
  where d.business_id=p_business_id and p->>'id'=i and coalesce(p->>'active','true')<>'false')) then
  raise exception 'Un producto seleccionado fue eliminado o archivado. Recarga la página.' using errcode='22023';
 end if;
 if p_published and jsonb_array_length(ids)=0 then raise exception 'Selecciona al menos un producto para publicar.' using errcode='22023';end if;
 -- Explicit allowlist: never store arbitrary profile fields in the public configuration.
 s:=jsonb_build_object('name',name_value,'headline',trim(p_settings->>'headline'),'description',trim(p_settings->>'description'),
 'location',trim(p_settings->>'location'),'hours',trim(p_settings->>'hours'),'whatsapp',p_settings->>'whatsapp',
 'theme',p_settings->>'theme','layout',p_settings->>'layout','showPrices',p_settings->'showPrices');
 insert into public.business_catalogs(business_id,slug,settings,product_ids,published,version)
 values(p_business_id,slug_value,s,ids,p_published,coalesce(c.version,0)+1)
 on conflict(business_id)do update set slug=excluded.slug,settings=excluded.settings,product_ids=excluded.product_ids,
 published=excluded.published,version=excluded.version,updated_at=now();
 return public.get_business_catalog_settings(p_business_id);
exception when unique_violation then raise exception 'Esa dirección ya está ocupada. Elige otra.' using errcode='23505';
end; $$;

create or replace function public.get_public_business_catalog(p_slug text)
returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('slug',c.slug,'settings',c.settings,
 'currency',case when d.profile->>'currency' in ('CLP','PEN','USD','MXN','COP','ARS') then d.profile->>'currency' else 'CLP' end,
 'products',coalesce((select jsonb_agg(jsonb_build_object(
  'id',p->>'id','name',left(p->>'name',160),'category',left(coalesce(p->>'category','Otros'),80),
  'description',left(coalesce(p->>'publicDescription',''),800),
  'price',case when c.settings->>'showPrices'='true' then p->'price' else 'null'::jsonb end,
  'image',case when length(p->>'image')<=500000 and
   (p->>'image' ~ '^https://[^[:space:]]+$' or p->>'image' ~ '^data:image/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$') then p->>'image' else '' end
 ) order by ordinal) from jsonb_array_elements(coalesce(d.products,'[]')) with ordinality as products(p,ordinal)
 where c.product_ids ? (p->>'id') and coalesce(p->>'active','true')<>'false'),'[]'::jsonb))
 from public.business_catalogs c join public.business_data d on d.business_id=c.business_id
 where c.slug=p_slug and c.published=true;
$$;
revoke all on function public.get_business_catalog_settings(uuid),public.save_business_catalog(uuid,bigint,jsonb,boolean),public.get_public_business_catalog(text) from public,anon,authenticated;
grant execute on function public.get_business_catalog_settings(uuid),public.save_business_catalog(uuid,bigint,jsonb,boolean) to authenticated;
grant execute on function public.get_public_business_catalog(text) to anon,authenticated;
commit;
