-- Apply after setup.sql and 003. Additive, transactional, repeatable.
begin;
create table if not exists public.business_subscriptions (
 business_id uuid primary key references public.businesses(id) on delete cascade,
 plan text not null default 'gratis' check(plan in ('gratis','emprendedor','inteligente','negocio')),
 trial_ends_at timestamptz not null,
 paid_until timestamptz,
 updated_at timestamptz not null default now()
);
insert into public.business_subscriptions(business_id,trial_ends_at)
select id,created_at+interval '14 days' from public.businesses on conflict do nothing;
create or replace function public.init_business_subscription() returns trigger language plpgsql security definer set search_path='' as $$
begin
 insert into public.business_subscriptions(business_id,trial_ends_at) values(new.id,new.created_at+interval '14 days');
 return new;
end; $$;
drop trigger if exists business_subscription_init on public.businesses;
create trigger business_subscription_init after insert on public.businesses for each row execute function public.init_business_subscription();

create table if not exists public.billing_orders (
 id uuid primary key default gen_random_uuid(),business_id uuid not null references public.businesses(id) on delete cascade,
 user_id uuid not null references auth.users(id),request_id uuid not null,plan text not null check(plan in ('emprendedor','inteligente','negocio')),
 amount integer not null check(amount>0),currency text not null default 'CLP' check(currency='CLP'),
 buy_order text not null unique,token text unique,checkout_url text,
 status text not null default 'created' check(status in ('created','pending','paid','rejected','cancelled','review')),
 created_at timestamptz not null default now(),paid_at timestamptz,provider_code integer,
 unique(user_id,request_id)
);
create table if not exists public.support_tickets (
 id uuid primary key default gen_random_uuid(),business_id uuid not null references public.businesses(id) on delete cascade,
 user_id uuid not null default auth.uid() references auth.users(id),subject text not null check(length(subject) between 5 and 120),
 body text not null check(length(body) between 10 and 4000),category text not null default 'uso' check(category in ('uso','error','pago','idea')),
 status text not null default 'abierto' check(status in ('abierto','en_revision','resuelto')),reply text,
 created_at timestamptz not null default now(),updated_at timestamptz not null default now()
);
create table if not exists public.platform_admins(user_id uuid primary key references auth.users(id) on delete cascade);
create table if not exists public.service_usage (
 business_id uuid not null references public.businesses(id) on delete cascade,kind text not null,bucket text not null,
 used integer not null default 0 check(used>=0),primary key(business_id,kind,bucket)
);
create table if not exists public.automatic_reports (
 id uuid primary key default gen_random_uuid(),business_id uuid not null references public.businesses(id) on delete cascade,
 period_start date not null,period_end date not null,summary jsonb not null,created_at timestamptz not null default now(),
 unique(business_id,period_start,period_end)
);
create table if not exists public.error_events (
 id uuid primary key default gen_random_uuid(),business_id uuid not null references public.businesses(id) on delete cascade,
 user_id uuid not null default auth.uid() references auth.users(id),code text not null check(code in ('UI_RENDER','SAVE_FAILED','LOAD_FAILED')),
 app_version text not null default '3.0.0',created_at timestamptz not null default now()
);
create index if not exists tickets_by_business on public.support_tickets(business_id,created_at desc);
create index if not exists orders_by_business on public.billing_orders(business_id,created_at desc);
create index if not exists reports_by_business on public.automatic_reports(business_id,period_end desc);
do $$ declare t text; begin
 foreach t in array array['business_subscriptions','billing_orders','support_tickets','platform_admins','service_usage','automatic_reports','error_events'] loop
 execute format('alter table public.%I enable row level security',t);
 execute format('alter table public.%I force row level security',t);
 execute format('revoke all on public.%I from anon,authenticated',t);
 end loop;
end; $$;
grant select on public.business_subscriptions,public.support_tickets,public.automatic_reports to authenticated;
grant select(id,business_id,plan,amount,currency,status,created_at,paid_at) on public.billing_orders to authenticated;
drop policy if exists subscriptions_read on public.business_subscriptions;
create policy subscriptions_read on public.business_subscriptions for select to authenticated using(public.is_business_member(business_id));
drop policy if exists orders_read on public.billing_orders;
create policy orders_read on public.billing_orders for select to authenticated using(exists(select 1 from public.business_members bm where bm.business_id=billing_orders.business_id and bm.user_id=auth.uid() and bm.role='owner'));
drop policy if exists tickets_read on public.support_tickets;
create policy tickets_read on public.support_tickets for select to authenticated using(public.is_business_member(business_id));
drop policy if exists reports_read on public.automatic_reports;
create policy reports_read on public.automatic_reports for select to authenticated using(public.is_business_member(business_id));

create or replace function public.effective_business_plan(p_business_id uuid) returns text language sql stable security definer set search_path='' as $$
 select coalesce((select case when s.paid_until>now() then s.plan when s.trial_ends_at>now() then 'inteligente' else 'gratis' end from public.business_subscriptions s where s.business_id=p_business_id),'gratis');
$$;
revoke all on function public.effective_business_plan(uuid) from public,anon,authenticated;

create or replace function public.get_business_plan(p_business_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare p text;s public.business_subscriptions;u integer;
begin
 if not public.is_business_member(p_business_id) then raise exception 'Acceso denegado.' using errcode='42501';end if;
 p:=public.effective_business_plan(p_business_id);select * into s from public.business_subscriptions where business_id=p_business_id;
 select used into u from public.service_usage where business_id=p_business_id and kind='sales' and bucket=to_char(now() at time zone 'UTC','YYYY-MM');
 return jsonb_build_object('plan',p,'trial',s.trial_ends_at>now() and (s.paid_until is null or s.paid_until<=now()),'trial_ends_at',s.trial_ends_at,'paid_until',s.paid_until,'sales_used',coalesce(u,0),'sales_limit',case p when 'gratis' then 50 when 'emprendedor' then 500 when 'inteligente' then 2000 else 10000 end,'member_limit',case p when 'negocio' then 5 else 1 end);
end; $$;

-- Wrap the existing atomic commit. A raised exception rolls back the data and its audit.
do $$ begin
 if to_regprocedure('public.commit_business_data_core(uuid,bigint,jsonb,uuid,text)') is null then
 alter function public.commit_business_data(uuid,bigint,jsonb,uuid,text) rename to commit_business_data_core;
 end if;
end; $$;
revoke all on function public.commit_business_data_core(uuid,bigint,jsonb,uuid,text) from public,anon,authenticated;
-- Extend the previous profile validator for existing installations, preserving its other checks.
do $$ declare definition text;begin
 select pg_get_functiondef('public.commit_business_data_core(uuid,bigint,jsonb,uuid,text)'::regprocedure)into definition;
 execute replace(definition, '(''CLP'',''PEN'',''USD'')', '(''CLP'',''PEN'',''USD'',''MXN'',''COP'',''ARS'')');
end; $$;
create or replace function public.commit_business_data(p_business_id uuid,p_expected_version bigint,p_patch jsonb,p_operation_id uuid,p_action text default 'edit') returns jsonb language plpgsql security definer set search_path='' as $$
declare old public.business_data;result jsonb;p text;added integer;maxsales integer;maxproducts integer;used integer;replayed boolean;item jsonb;line jsonb;paid numeric;calculated numeric;prof jsonb;tz text;
begin
 if not public.is_business_member(p_business_id) then raise exception 'Acceso denegado.' using errcode='42501';end if;
 select * into old from public.business_data where business_id=p_business_id for update;
 p:=public.effective_business_plan(p_business_id);
 if p<>'negocio' and not exists(select 1 from public.business_members where business_id=p_business_id and user_id=auth.uid() and role='owner') then raise exception 'El trabajo en equipo requiere un plan Negocio activo. Puedes seguir consultando los datos.' using errcode='42501';end if;
 select exists(select 1 from public.business_audit where business_id=p_business_id and operation_id=p_operation_id) into replayed;
 result:=public.commit_business_data_core(p_business_id,p_expected_version,p_patch,p_operation_id,p_action);
 if replayed then return result;end if;
 maxsales:=case p when 'gratis' then 50 when 'emprendedor' then 500 when 'inteligente' then 2000 else 10000 end;
 maxproducts:=case p when 'gratis' then 30 when 'emprendedor' then 500 when 'inteligente' then 2000 else 5000 end;
 if p_patch ? 'products' and jsonb_array_length(p_patch->'products')>greatest(maxproducts,jsonb_array_length(coalesce(old.products,'[]'))) then raise exception 'Alcanzaste el límite de productos de tu plan. Revisa Plan y pagos.' using errcode='P0001';end if;
 if p_patch ? 'sales' then
  select count(*) into added from jsonb_array_elements(p_patch->'sales') n where not exists(select 1 from jsonb_array_elements(old.sales) o where o->>'id'=n->>'id');
  if added>0 then
   insert into public.service_usage(business_id,kind,bucket,used) values(p_business_id,'sales',to_char(now() at time zone 'UTC','YYYY-MM'),added)
   on conflict(business_id,kind,bucket) do update set used=public.service_usage.used+excluded.used returning service_usage.used into used;
   if used>maxsales then raise exception 'Alcanzaste las ventas mensuales de tu plan. Puedes seguir consultando y registrar pagos.' using errcode='P0001';end if;
  end if;
  for item in select value from jsonb_array_elements(p_patch->'sales') loop
   -- Apply stronger validation to new/changed sales; do not rewrite legacy data.
   if exists(select 1 from jsonb_array_elements(old.sales) o where o=item) then continue;end if;
   if coalesce(item->>'dateISO','') !~ '^\d{4}-\d{2}-\d{2}T' then raise exception 'Fecha de venta inválida.';end if;
   if item ? 'paymentDueDate' and coalesce(item->>'paymentDueDate','')<>'' then perform (item->>'paymentDueDate')::date;end if;
   calculated:=0;
   for line in select value from jsonb_array_elements(item->'items') loop calculated:=calculated+(line->>'qty')::numeric*(line->>'price')::numeric;end loop;
   calculated:=greatest(0,calculated-coalesce((item->>'discount')::numeric,0)+coalesce((item->>'delivery')::numeric,0));
   if abs(calculated-(item->>'total')::numeric)>.02 then raise exception 'El total no coincide con el detalle de venta.';end if;
   if item ? 'payments' then
    paid:=coalesce((item->>'legacyPaidAmount')::numeric,0);
    for line in select value from jsonb_array_elements(item->'payments') loop
     if coalesce(line->>'amount','') !~ '^-?[0-9]+(\.[0-9]+)?$' or coalesce(line->>'dateISO','') !~ '^\d{4}-\d{2}-\d{2}T' then raise exception 'Pago inválido.';end if;
     paid:=paid+(line->>'amount')::numeric;
     if paid<0 then raise exception 'Los abonos no pueden dejar un saldo pagado negativo.';end if;
    end loop;
    if abs(paid-coalesce((item->>'paidAmount')::numeric,0))>.02 then raise exception 'Los abonos no coinciden con el monto pagado.';end if;
   end if;
  end loop;
 end if;
 if p_patch ? 'profile' then
  prof:=p_patch->'profile';tz:=coalesce(prof->>'timezone','America/Santiago');
  if not exists(select 1 from pg_timezone_names where name=tz) then raise exception 'Zona horaria no válida.';end if;
  if prof ? 'monthlyGoal' and (coalesce(prof->>'monthlyGoal','') !~ '^[0-9]+(\.[0-9]+)?$' or (prof->>'monthlyGoal')::numeric>1e12) then raise exception 'Meta mensual inválida.';end if;
  if prof ? 'leadTimeDays' and (coalesce(prof->>'leadTimeDays','') !~ '^[0-9]+$' or (prof->>'leadTimeDays')::numeric>365) then raise exception 'Plazo de reposición inválido.';end if;
 end if;
 return result;
end; $$;

create or replace function public.join_business_by_code(p_code text) returns uuid language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid();bid uuid;n integer;p text;
begin
 if uid is null then raise exception 'Inicia sesión.' using errcode='42501';end if;
 select id into bid from public.businesses where upper(join_code)=upper(trim(p_code)) and join_code_expires_at>now() for update;
 if bid is null then raise exception 'La invitación no existe o venció.';end if;
 if exists(select 1 from public.business_members where business_id=bid and user_id=uid)then return bid;end if;
 p:=public.effective_business_plan(bid);select count(*) into n from public.business_members where business_id=bid;
 if n >= (case p when 'negocio' then 5 else 1 end) then raise exception 'El negocio necesita el plan Negocio o liberar un lugar en el equipo.';end if;
 insert into public.business_members(business_id,user_id,role)values(bid,uid,'member');return bid;
end; $$;

create or replace function public.create_support_ticket(p_business_id uuid,p_subject text,p_body text,p_category text) returns uuid language plpgsql security definer set search_path='' as $$
declare result uuid;
begin
 if not public.is_business_member(p_business_id)then raise exception 'Acceso denegado.' using errcode='42501';end if;
 perform 1 from public.businesses where id=p_business_id for update;
 if (select count(*) from public.support_tickets where user_id=auth.uid() and created_at>now()-interval '1 hour')>=10 then raise exception 'Ya enviaste varios tickets. Espera una hora.';end if;
 insert into public.support_tickets(business_id,user_id,subject,body,category)values(p_business_id,auth.uid(),trim(p_subject),trim(p_body),p_category) returning id into result;return result;
end; $$;
create or replace function public.log_app_error(p_business_id uuid,p_code text) returns void language plpgsql security definer set search_path='' as $$
begin
 if not public.is_business_member(p_business_id)then raise exception 'Acceso denegado.' using errcode='42501';end if;
 if not exists(select 1 from public.business_data where business_id=p_business_id and profile->>'diagnosticsEnabled'='true')then return;end if;
 perform 1 from public.businesses where id=p_business_id for update;
 if (select count(*) from public.error_events where business_id=p_business_id and created_at>now()-interval '1 hour')<30 then insert into public.error_events(business_id,user_id,code)values(p_business_id,auth.uid(),p_code);end if;
end; $$;

create or replace function public.platform_dashboard() returns jsonb language plpgsql security definer set search_path='' as $$
begin
 if not exists(select 1 from public.platform_admins where user_id=auth.uid())then raise exception 'Acceso de operador requerido.' using errcode='42501';end if;
 return jsonb_build_object('users',(select count(*) from auth.users),'businesses',(select count(*) from public.businesses),'active_30d',(select count(*) from public.business_data where updated_at>now()-interval '30 days'),'paid_businesses',(select count(*) from public.business_subscriptions where paid_until>now()),'revenue_30d',(select coalesce(sum(amount),0)from public.billing_orders where status='paid' and paid_at>now()-interval '30 days'),'tickets',(select coalesce(jsonb_agg(t),'[]')from(select s.id,b.name as business,s.subject,s.body,s.status,s.category,s.reply,s.created_at from public.support_tickets s join public.businesses b on b.id=s.business_id order by s.created_at desc limit 100)t),'errors',(select coalesce(jsonb_agg(e),'[]')from(select code,count(*) as count from public.error_events where created_at>now()-interval '7 days' group by code)e),'plans',(select coalesce(jsonb_agg(p),'[]')from(select public.effective_business_plan(b.id)as plan,count(*)as count from public.businesses b group by public.effective_business_plan(b.id))p));
end; $$;
create or replace function public.resolve_support_ticket(p_id uuid,p_status text,p_reply text) returns void language plpgsql security definer set search_path='' as $$
begin
 if not exists(select 1 from public.platform_admins where user_id=auth.uid())then raise exception 'Acceso de operador requerido.' using errcode='42501';end if;
 if length(p_reply)>4000 then raise exception 'Respuesta demasiado larga.';end if;
 update public.support_tickets set status=p_status,reply=p_reply,updated_at=now()where id=p_id;
end; $$;

-- Service-only operations: no browser can confirm a purchase or bypass AI limits.
create or replace function public.apply_verified_payment(p_order_id uuid,p_code integer) returns boolean language plpgsql security definer set search_path='' as $$
declare o public.billing_orders;s public.business_subscriptions;
begin
 select * into o from public.billing_orders where id=p_order_id for update;
 if o.id is null then raise exception 'Orden desconocida.';end if;
 if o.status='paid' then return false;end if;
 if p_code<>0 then raise exception 'El pago no fue autorizado.';end if;
 select * into s from public.business_subscriptions where business_id=o.business_id for update;
 update public.business_subscriptions set plan=o.plan,paid_until=(case when s.plan=o.plan then greatest(now(),coalesce(s.paid_until,now()))else now()end)+interval '30 days',updated_at=now()where business_id=o.business_id;
 update public.billing_orders set status='paid',paid_at=now(),provider_code=p_code where id=o.id;return true;
end; $$;
create or replace function public.reserve_ai_request(p_business_id uuid,p_user_id uuid) returns void language plpgsql security definer set search_path='' as $$
declare amount integer;
begin
 if not exists(select 1 from public.business_members where business_id=p_business_id and user_id=p_user_id)then raise exception 'Acceso denegado.' using errcode='42501';end if;
 if public.effective_business_plan(p_business_id) not in ('inteligente','negocio')then raise exception 'El asesor en línea requiere un plan Inteligente o Negocio.';end if;
 if not exists(select 1 from public.business_data where business_id=p_business_id and profile->>'aiEnabled'='true')then raise exception 'El propietario debe activar el asesor en línea.';end if;
 insert into public.service_usage(business_id,kind,bucket,used)values(p_business_id,'ai',to_char(now() at time zone 'UTC','YYYY-MM-DD'),1)
 on conflict(business_id,kind,bucket)do update set used=public.service_usage.used+1 returning used into amount;
 if amount>50 then raise exception 'Límite diario de 50 consultas alcanzado. El análisis local sigue disponible.';end if;
end; $$;

revoke all on function public.init_business_subscription() from public,anon,authenticated;
revoke all on function public.apply_verified_payment(uuid,integer),public.reserve_ai_request(uuid,uuid) from public,anon,authenticated;
do $$ begin
 if exists(select 1 from pg_roles where rolname='service_role')then
 grant execute on function public.apply_verified_payment(uuid,integer),public.reserve_ai_request(uuid,uuid),public.effective_business_plan(uuid) to service_role;
 grant all on public.billing_orders,public.business_subscriptions,public.automatic_reports,public.service_usage to service_role;
 end if;
end; $$;
revoke all on function public.get_business_plan(uuid),public.commit_business_data(uuid,bigint,jsonb,uuid,text),public.join_business_by_code(text),public.create_support_ticket(uuid,text,text,text),public.log_app_error(uuid,text),public.platform_dashboard(),public.resolve_support_ticket(uuid,text,text) from public;
grant execute on function public.get_business_plan(uuid),public.commit_business_data(uuid,bigint,jsonb,uuid,text),public.join_business_by_code(text),public.create_support_ticket(uuid,text,text,text),public.log_app_error(uuid,text),public.platform_dashboard(),public.resolve_support_ticket(uuid,text,text) to authenticated;
commit;
