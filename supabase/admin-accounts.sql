-- Internal account management: trial access never modifies paid billing records.
create table giro_private.account_trials (
 user_id uuid primary key references auth.users(id) on delete cascade,
 portal text not null check(portal in ('rider','merchant')),
 expires_at timestamptz not null,
 created_by uuid not null references auth.users(id),
 updated_at timestamptz not null default now(),
 revoked_at timestamptz
);
create table giro_private.admin_account_events (
 id uuid primary key default gen_random_uuid(),
 actor_id uuid not null references auth.users(id),
 target_id uuid references auth.users(id) on delete set null,
 action text not null check(action in ('trial_granted','trial_revoked','recovery_requested','recovery_sent','recovery_failed')),
 created_at timestamptz not null default now()
);
create index admin_events_actor_time on giro_private.admin_account_events(actor_id,created_at desc);
alter table giro_private.account_trials enable row level security;
alter table giro_private.admin_account_events enable row level security;
revoke all on giro_private.account_trials,giro_private.admin_account_events from public,anon,authenticated;
grant select on giro_private.account_trials to authenticated;
create policy account_trials_self on giro_private.account_trials for select to authenticated using(user_id=(select auth.uid()));
grant all on giro_private.account_trials,giro_private.admin_account_events to service_role;
create policy trials_backend on giro_private.account_trials for all to service_role using(true) with check(true);
create policy admin_events_backend on giro_private.admin_account_events for all to service_role using(true) with check(true);
grant select(id,email,email_confirmed_at,created_at,last_sign_in_at,raw_user_meta_data) on auth.users to service_role;

create or replace function giro_private.has_access(p_portal text) returns boolean language sql stable security invoker set search_path='' as $$
 select p_portal in ('rider','merchant','combo') and auth.uid() is not null and (
 giro_private.is_admin()
 or exists(select 1 from giro_private.subscriptions where owner_id=(select auth.uid()) and portal=p_portal and portal<>'combo' and status in ('active','cancelled') and paid_until>now())
 or (p_portal in ('merchant','combo') and exists(select 1 from giro_private.team_access where merchant_id=(select auth.uid()) and paid_until>now()))
 or (p_portal='rider' and exists(select 1 from giro_private.managed_riders r join giro_private.team_access t on t.merchant_id=r.merchant_id where r.rider_id=(select auth.uid()) and r.state='active' and t.paid_until>now()))
 or exists(select 1 from giro_private.account_trials t where t.user_id=(select auth.uid()) and t.portal=p_portal and t.revoked_at is null and t.expires_at>now())
 )
$$;

-- All management RPCs require service_role plus a currently registered administrator.
create function public.admin_accounts(p_actor uuid,p_search text default '',p_filter text default 'all',p_page integer default 1) returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare result jsonb;
begin
 if not exists(select 1 from giro_private.administrators where user_id=p_actor) then raise insufficient_privilege;end if;
 if p_search is null or length(p_search)>120 or p_page is null or p_page not between 1 and 100000 or p_filter not in ('all','paid','trial','inactive','managed','admin') then raise invalid_parameter_value;end if;
 with accounts as (
 select u.id,u.email,left(coalesce(u.raw_user_meta_data->>'full_name',''),100) name,u.created_at,u.last_sign_in_at,u.email_confirmed_at is not null confirmed,
 exists(select 1 from giro_private.administrators a where a.user_id=u.id) admin,
 exists(select 1 from giro_private.managed_riders r where r.rider_id=u.id) managed,
 (select coalesce(jsonb_agg(jsonb_build_object('plan',s.portal,'until',s.paid_until,'renewalCancelled',s.status='cancelled','method',case when s.sale_id like 'pix:%' then 'pix' when s.sale_id like 'sub_%' then 'card' else 'legacy' end) order by s.paid_until desc),'[]'::jsonb) from giro_private.subscriptions s where s.owner_id=u.id and s.status in ('active','cancelled') and s.paid_until>now()) plans,
 (select jsonb_build_object('plan',t.portal,'until',t.expires_at,'active',t.revoked_at is null and t.expires_at>now()) from giro_private.account_trials t where t.user_id=u.id) trial,
 exists(select 1 from giro_private.managed_riders r join giro_private.team_access t on t.merchant_id=r.merchant_id where r.rider_id=u.id and r.state='active' and t.paid_until>now()) team_access
 from auth.users u
 ), filtered as (
 select * from accounts a where (p_search='' or strpos(lower(coalesce(a.email,'')||' '||a.name),lower(btrim(p_search)))>0) and
 case p_filter when 'paid' then jsonb_array_length(plans)>0 when 'trial' then coalesce((trial->>'active')::boolean,false) when 'inactive' then not admin and not team_access and jsonb_array_length(plans)=0 and not coalesce((trial->>'active')::boolean,false) when 'managed' then managed when 'admin' then admin else true end
 )
 select jsonb_build_object('summary',(select jsonb_build_object(
 'accounts',count(*),'emails',count(*) filter(where coalesce(email,'')<>'' and email not ilike '%.invalid'),
 'paid',count(*) filter(where jsonb_array_length(plans)>0),'trials',count(*) filter(where coalesce((trial->>'active')::boolean,false)),
 'managed',count(*) filter(where managed),'admins',count(*) filter(where admin)) from accounts),
 'total',(select count(*) from filtered),'page',p_page,
 'users',(select coalesce(jsonb_agg(to_jsonb(x) order by x.created_at desc,x.id),'[]'::jsonb) from (select * from filtered order by created_at desc,id offset (p_page-1)*25 limit 25) x),
 'events',(select coalesce(jsonb_agg(to_jsonb(x) order by x.created_at desc),'[]'::jsonb) from (select e.id,e.action,e.created_at,u.email from giro_private.admin_account_events e left join auth.users u on u.id=e.target_id order by e.created_at desc,e.id limit 12) x)) into result;
 return result;
end $$;

create function public.admin_trial_change(p_actor uuid,p_target uuid,p_portal text,p_days integer,p_revoke boolean default false) returns void language plpgsql security invoker set search_path='' as $$
begin
 if not exists(select 1 from giro_private.administrators where user_id=p_actor) then raise insufficient_privilege;end if;
 if p_revoke is null or p_target is null then raise invalid_parameter_value;end if;
 perform pg_advisory_xact_lock(hashtextextended('admin-trial:'||p_target::text,0));
 if p_revoke then
  update giro_private.account_trials set revoked_at=now(),updated_at=now() where user_id=p_target and revoked_at is null;
  if found then insert into giro_private.admin_account_events(actor_id,target_id,action) values(p_actor,p_target,'trial_revoked');end if;
  return;
 end if;
 if p_portal is null or p_portal not in ('rider','merchant') or p_days is null or p_days not between 1 and 30 then raise invalid_parameter_value;end if;
 if exists(select 1 from giro_private.administrators where user_id=p_target) or exists(select 1 from giro_private.managed_riders where rider_id=p_target) or exists(select 1 from giro_private.subscriptions where owner_id=p_target and status in ('active','cancelled') and paid_until>now()) then raise check_violation using message='ACCOUNT_HAS_ACCESS';end if;
 insert into giro_private.account_trials(user_id,portal,expires_at,created_by) values(p_target,p_portal,now()+make_interval(days=>p_days),p_actor)
 on conflict(user_id) do update set portal=excluded.portal,expires_at=excluded.expires_at,created_by=excluded.created_by,updated_at=now(),revoked_at=null;
 insert into giro_private.admin_account_events(actor_id,target_id,action) values(p_actor,p_target,'trial_granted');
end $$;

create function public.admin_recovery_event(p_actor uuid,p_target uuid,p_action text) returns void language plpgsql security invoker set search_path='' as $$
begin
 if not exists(select 1 from giro_private.administrators where user_id=p_actor) then raise insufficient_privilege;end if;
 if p_target is null or p_action is null or p_action not in ('recovery_requested','recovery_sent','recovery_failed') then raise invalid_parameter_value;end if;
 perform pg_advisory_xact_lock(hashtextextended('admin-email:'||p_target::text,0));
 if p_action='recovery_requested' and exists(select 1 from giro_private.admin_account_events where target_id=p_target and action='recovery_requested' and created_at>now()-interval '1 minute') then raise lock_not_available;end if;
 insert into giro_private.admin_account_events(actor_id,target_id,action) values(p_actor,p_target,p_action);
end $$;
revoke all on function public.admin_accounts(uuid,text,text,integer),public.admin_trial_change(uuid,uuid,text,integer,boolean),public.admin_recovery_event(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.admin_accounts(uuid,text,text,integer),public.admin_trial_change(uuid,uuid,text,integer,boolean),public.admin_recovery_event(uuid,uuid,text) to service_role;
create function public.admin_trial_eligible(p_actor uuid,p_target uuid) returns boolean language plpgsql stable security invoker set search_path='' as $$
begin
 if not exists(select 1 from giro_private.administrators where user_id=p_actor) then raise insufficient_privilege;end if;
 return not exists(select 1 from giro_private.administrators where user_id=p_target)
 and not exists(select 1 from giro_private.managed_riders where rider_id=p_target)
 and not exists(select 1 from giro_private.subscriptions where owner_id=p_target and status in ('active','cancelled') and paid_until>now());
end $$;
revoke all on function public.admin_trial_eligible(uuid,uuid) from public,anon,authenticated;
grant execute on function public.admin_trial_eligible(uuid,uuid) to service_role;
