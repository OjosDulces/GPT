begin;
alter table public.automatic_reports add column if not exists email_status text not null default 'pending' check(email_status in ('pending','sending','sent','review'));
alter table public.automatic_reports add column if not exists email_attempted_at timestamptz;
alter table public.automatic_reports add column if not exists email_id text;
-- Selected report fields are already read-only for members. Sending is service-only.
create or replace function public.claim_report_email(p_id uuid) returns boolean language plpgsql security definer set search_path='' as $$
declare claimed uuid;
begin
 update public.automatic_reports set email_status='sending',email_attempted_at=now() where id=p_id and email_status='pending' returning id into claimed;
 return claimed is not null;
end; $$;
revoke all on function public.claim_report_email(uuid) from public,anon,authenticated;
do $$ begin if exists(select 1 from pg_roles where rolname='service_role')then grant execute on function public.claim_report_email(uuid)to service_role;end if;end; $$;
commit;
