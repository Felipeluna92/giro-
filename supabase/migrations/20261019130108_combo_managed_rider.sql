-- One merchant + one separate managed rider. The first billing period is promotional.
alter table giro_private.billing_plans drop constraint billing_plans_portal_check;
alter table giro_private.billing_plans add constraint billing_plans_portal_check check(portal in ('rider','merchant','combo'));
alter table giro_private.billing_plans add column first_price_cents integer check(first_price_cents between 100 and 10000000);
alter table giro_private.billing_plans add column renewal_checkout_url text not null default '' check(renewal_checkout_url='' or renewal_checkout_url ~ '^https://pay[.]kirvano[.]com/[^[:space:]]+$');
alter table giro_private.billing_plans add column renewal_offer_id text not null default '';
insert into giro_private.billing_plans(portal,price_cents,first_price_cents) values('combo',8980,3990);
-- Business configuration chosen by the owner; other plan fields remain unchanged.
update giro_private.billing_plans set price_cents=5990 where portal='merchant' and price_cents is null;

create table giro_private.team_access (
 merchant_id uuid primary key references auth.users(id) on delete cascade,
 paid_until timestamptz, intro_used boolean not null default true
);
create table giro_private.managed_riders (
 merchant_id uuid primary key references auth.users(id) on delete cascade,
 rider_id uuid unique references auth.users(id) on delete restrict,
 username text not null unique check(username ~ '^[a-z0-9][a-z0-9_.-]{2,31}$'),
 display_name varchar(80) not null,
 login_email text not null unique,
 establishment_id uuid not null default gen_random_uuid(),
 state text not null default 'pending' check(state in ('pending','active')),
 reservation uuid not null default gen_random_uuid(), reserved_until timestamptz not null default now()+interval '5 minutes',
 created_at timestamptz not null default now(),
 check(state<>'active' or rider_id is not null)
);
create table giro_private.login_limits (
 key_hash text primary key check(key_hash ~ '^[0-9a-f]{64}$'),
 attempts integer not null default 1, started_at timestamptz not null default now()
);
create index login_limits_started_idx on giro_private.login_limits(started_at);
alter table giro_private.team_access enable row level security;
alter table giro_private.managed_riders enable row level security;
alter table giro_private.login_limits enable row level security;
revoke all on giro_private.team_access,giro_private.managed_riders,giro_private.login_limits from public,anon,authenticated;
grant all on giro_private.team_access,giro_private.managed_riders,giro_private.login_limits to service_role;
create policy login_limits_backend on giro_private.login_limits for all to service_role using(true) with check(true);
grant select on giro_private.team_access to authenticated;
grant select(merchant_id,rider_id,username,display_name,establishment_id,state,created_at) on giro_private.managed_riders to authenticated;
create policy managed_riders_participants on giro_private.managed_riders for select to authenticated using(merchant_id=(select auth.uid()) or rider_id=(select auth.uid()));
create policy team_access_participants on giro_private.team_access for select to authenticated using(merchant_id=(select auth.uid()) or exists(select 1 from giro_private.managed_riders r where r.merchant_id=team_access.merchant_id and r.rider_id=(select auth.uid()) and r.state='active'));

create function giro_private.refresh_team_access() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if new.portal='combo' and new.owner_id is not null then
  insert into giro_private.team_access(merchant_id,paid_until)
  select new.owner_id,max(paid_until) filter(where status in ('active','cancelled')) from giro_private.subscriptions where owner_id=new.owner_id and portal='combo'
  on conflict(merchant_id) do update set paid_until=excluded.paid_until;
 end if;
 return new;
end $$;
revoke all on function giro_private.refresh_team_access() from public,anon,authenticated;
grant execute on function giro_private.refresh_team_access() to service_role;
create trigger refresh_team_access after insert or update on giro_private.subscriptions for each row execute function giro_private.refresh_team_access();

create or replace function giro_private.has_access(p_portal text) returns boolean language sql stable security invoker set search_path='' as $$
 select p_portal in ('rider','merchant','combo') and auth.uid() is not null and (
 giro_private.is_admin()
 or exists(select 1 from giro_private.subscriptions where owner_id=(select auth.uid()) and portal=p_portal and portal<>'combo' and status in ('active','cancelled') and paid_until>now())
 or (p_portal in ('merchant','combo') and exists(select 1 from giro_private.team_access where merchant_id=(select auth.uid()) and paid_until>now()))
 or (p_portal='rider' and exists(select 1 from giro_private.managed_riders r join giro_private.team_access t on t.merchant_id=r.merchant_id where r.rider_id=(select auth.uid()) and r.state='active' and t.paid_until>now()))
 )
$$;
create or replace function public.get_account_access() returns jsonb language sql stable security invoker set search_path='' as $$
 select jsonb_build_object('isAdmin',giro_private.is_admin(),'rider',giro_private.has_access('rider'),'merchant',giro_private.has_access('merchant'),'combo',giro_private.has_access('combo'),'managedRider',exists(select 1 from giro_private.managed_riders where rider_id=(select auth.uid()) and state='active'),'comboIntroUsed',exists(select 1 from giro_private.team_access where merchant_id=(select auth.uid()) and intro_used))
$$;
create or replace function public.get_giro_plans() returns jsonb language sql stable security invoker set search_path='' as $$
 select coalesce(jsonb_agg(jsonb_build_object('portal',portal,'priceCents',price_cents,'firstPriceCents',first_price_cents,'available',enabled and price_cents is not null and checkout_url<>'' and product_id<>'' and offer_id<>'' and (portal<>'combo' or (renewal_checkout_url<>'' and renewal_offer_id<>''))) order by portal),'[]'::jsonb) from giro_private.billing_plans
$$;
create or replace function public.get_giro_checkout(p_portal text) returns text language plpgsql security invoker set search_path='' as $$
declare result text; already_used boolean;
begin
 if auth.uid() is null then raise insufficient_privilege; end if;
 select exists(select 1 from giro_private.team_access where merchant_id=auth.uid() and intro_used) into already_used;
 select case when p_portal='combo' and already_used then renewal_checkout_url else checkout_url end into result from giro_private.billing_plans where portal=p_portal and enabled and price_cents is not null and checkout_url<>'' and product_id<>'' and offer_id<>'' and (portal<>'combo' or (renewal_checkout_url<>'' and renewal_offer_id<>''));
 if result is null or result='' then raise check_violation using message='Checkout not configured'; end if;
 return result;
end $$;
create or replace function public.get_giro_webhook_config() returns jsonb language sql stable security invoker set search_path='' as $$
 select jsonb_build_object('secretHash',w.secret_hash,'headerName',w.header_name,'plans',(select jsonb_agg(jsonb_build_object('portal',p.portal,'productId',p.product_id,'offerId',p.offer_id,'renewalOfferId',p.renewal_offer_id)) from giro_private.billing_plans p where p.product_id<>'' and p.offer_id<>'')) from giro_private.billing_webhook w where id
$$;

create function public.admin_save_giro_offer(p_portal text,p_price integer,p_first integer,p_checkout text,p_product text,p_offer text,p_enabled boolean,p_renewal_checkout text,p_renewal_offer text) returns void language plpgsql security invoker set search_path='' as $$
begin
 if not giro_private.is_admin() then raise insufficient_privilege; end if;
 if p_portal is null or p_portal not in ('rider','merchant','combo') or p_enabled is null or length(p_checkout)>500 or length(p_renewal_checkout)>500 or length(p_product)>100 or length(p_offer)>100 or length(p_renewal_offer)>100 then raise invalid_parameter_value; end if;
 if p_enabled and (p_price is null or p_checkout='' or p_product='' or p_offer='' or not exists(select 1 from giro_private.billing_webhook where verified_at is not null) or (p_portal='combo' and (p_first is null or p_renewal_checkout='' or p_renewal_offer=''))) then raise check_violation; end if;
 update giro_private.billing_plans set price_cents=p_price,first_price_cents=case when p_portal='combo' then p_first else null end,checkout_url=p_checkout,product_id=btrim(p_product),offer_id=btrim(p_offer),enabled=p_enabled,renewal_checkout_url=p_renewal_checkout,renewal_offer_id=btrim(p_renewal_offer) where portal=p_portal;
end $$;
create function public.get_managed_rider() returns jsonb language sql stable security invoker set search_path='' as $$
 select jsonb_build_object('canCreate',exists(select 1 from giro_private.team_access where merchant_id=(select auth.uid()) and paid_until>now()),'account',(select jsonb_build_object('name',display_name,'username',username,'state',state) from giro_private.managed_riders where merchant_id=(select auth.uid())))
$$;

-- Provisioning and alias resolution are callable only by the backend.
create function public.reserve_managed_rider(p_merchant uuid,p_username text,p_name text) returns jsonb language plpgsql security invoker set search_path='' as $$
declare existing giro_private.managed_riders; token uuid:=gen_random_uuid();
begin
 if not exists(select 1 from giro_private.team_access where merchant_id=p_merchant and paid_until>now()) then raise insufficient_privilege;end if;
 if p_username is null or p_username !~ '^[a-z0-9][a-z0-9_.-]{2,31}$' or p_name is null or length(btrim(p_name)) not between 1 and 80 then raise invalid_parameter_value;end if;
 perform pg_advisory_xact_lock(hashtextextended(p_merchant::text,0));
 select * into existing from giro_private.managed_riders where merchant_id=p_merchant for update;
 if found then
  if existing.state='active' then raise check_violation using message='Managed rider already created';end if;
  if existing.reserved_until>now() then raise lock_not_available;end if;
  if existing.username<>p_username then raise check_violation using message='Resume pending username';end if;
  update giro_private.managed_riders set reservation=token,reserved_until=now()+interval '5 minutes',display_name=btrim(p_name) where merchant_id=p_merchant returning * into existing;
 else
  insert into giro_private.managed_riders(merchant_id,username,display_name,login_email,reservation) values(p_merchant,p_username,btrim(p_name),gen_random_uuid()::text||'@motoboy.giro.invalid',token) returning * into existing;
 end if;
 return jsonb_build_object('email',existing.login_email,'reservation',token);
end $$;
create function public.release_managed_reservation(p_merchant uuid,p_reservation uuid) returns void language sql security invoker set search_path='' as $$
 update giro_private.managed_riders set reserved_until=now() where merchant_id=p_merchant and reservation=p_reservation and state='pending'
$$;
create function public.managed_rider_backend(p_merchant uuid) returns jsonb language sql stable security invoker set search_path='' as $$
 select jsonb_build_object('riderId',r.rider_id,'email',r.login_email,'username',r.username,'state',r.state,'reservation',r.reservation,'existingAuthId',(select u.id from auth.users u where u.email=r.login_email)) from giro_private.managed_riders r where merchant_id=p_merchant
$$;
grant select on giro_private.merchants to service_role;
grant select,insert on public.rider_accounts,public.establishments,giro_private.merchant_links to service_role;
create function public.finish_managed_rider(p_merchant uuid,p_reservation uuid) returns text language plpgsql security invoker set search_path='' as $$
declare r giro_private.managed_riders; child uuid;
begin
 select * into r from giro_private.managed_riders where merchant_id=p_merchant and reservation=p_reservation for update;
 if not found then raise insufficient_privilege;end if;
 if r.state='active' then return r.username;end if;
 if r.reserved_until<=now() then raise insufficient_privilege;end if;
 if not exists(select 1 from giro_private.team_access where merchant_id=p_merchant and paid_until>now()) then raise insufficient_privilege;end if;
 select id into child from auth.users where email=r.login_email and email_confirmed_at is not null;
 if child is null then raise check_violation using message='Auth account not ready';end if;
 insert into public.rider_accounts(owner_id,display_name) values(child,r.display_name);
 insert into public.establishments(id,owner_id,name,rate_rule,rate_value) values(r.establishment_id,child,'Entregas avulsas','full',0);
 update giro_private.managed_riders set state='active',rider_id=child where merchant_id=p_merchant;
 return r.username;
end $$;
create function public.resolve_rider_login(p_username text) returns text language sql stable security invoker set search_path='' as $$
 select login_email from giro_private.managed_riders where username=p_username and state='active'
$$;
create function public.claim_login_attempt(p_key text,p_limit integer) returns boolean language plpgsql security invoker set search_path='' as $$
declare used integer;
begin
 if p_key is null or p_key !~ '^[0-9a-f]{64}$' or p_limit not between 1 and 100 then raise invalid_parameter_value;end if;
 delete from giro_private.login_limits where started_at<now()-interval '1 day';
 insert into giro_private.login_limits(key_hash) values(p_key)
 on conflict(key_hash) do update set attempts=case when giro_private.login_limits.started_at<now()-interval '15 minutes' then 1 else giro_private.login_limits.attempts+1 end,started_at=case when giro_private.login_limits.started_at<now()-interval '15 minutes' then now() else giro_private.login_limits.started_at end returning attempts into used;
 return used<=p_limit;
end $$;
revoke all on function public.admin_save_giro_offer(text,integer,integer,text,text,text,boolean,text,text),public.get_managed_rider(),public.reserve_managed_rider(uuid,text,text),public.release_managed_reservation(uuid,uuid),public.managed_rider_backend(uuid),public.finish_managed_rider(uuid,uuid),public.resolve_rider_login(text),public.claim_login_attempt(text,integer) from public,anon,authenticated;
grant execute on function public.admin_save_giro_offer(text,integer,integer,text,text,text,boolean,text,text),public.get_managed_rider() to authenticated;
grant execute on function public.reserve_managed_rider(uuid,text,text),public.release_managed_reservation(uuid,uuid),public.managed_rider_backend(uuid),public.finish_managed_rider(uuid,uuid),public.resolve_rider_login(text),public.claim_login_attempt(text,integer) to service_role;

create or replace function public.apply_giro_subscription(p_sale text,p_portal text,p_email text,p_event text,p_occurred timestamptz,p_until timestamptz) returns void language plpgsql security invoker set search_path='' as $$
declare buyer uuid; new_status text; existing giro_private.subscriptions;
begin
 if p_sale is null or length(p_sale) not between 1 and 100 or p_portal not in ('rider','merchant','combo') or p_email is null or length(p_email) not between 3 and 254 or p_occurred is null or not isfinite(p_occurred) or p_occurred>now()+interval '10 minutes' then raise invalid_parameter_value; end if;
 new_status:=case p_event when 'SALE_APPROVED' then 'active' when 'SUBSCRIPTION_RENEWED' then 'active' when 'SUBSCRIPTION_CANCELED' then 'cancelled' when 'SUBSCRIPTION_EXPIRED' then 'expired' when 'SALE_REFUNDED' then 'refunded' when 'SALE_CHARGEBACK' then 'chargeback' else null end;
 if new_status is null then raise invalid_parameter_value; end if;
 if new_status='active' and (p_until is null or not isfinite(p_until) or p_until<=p_occurred or p_until>p_occurred+interval '35 days') then raise invalid_parameter_value; end if;
 p_email:=lower(btrim(p_email));
 select id into buyer from auth.users where lower(btrim(email))=p_email and email_confirmed_at is not null;
 insert into giro_private.subscriptions(sale_id,portal,owner_id,buyer_email,status,paid_until,last_event_at)
 values(p_sale,p_portal,buyer,p_email,new_status,case when new_status='active' then p_until else null end,p_occurred)
 on conflict(sale_id,portal) do nothing;
 select * into existing from giro_private.subscriptions where sale_id=p_sale and portal=p_portal for update;
 if existing.buyer_email<>p_email then raise invalid_parameter_value using message='Sale identity mismatch'; end if;
 if existing.status in ('refunded','chargeback') then return; end if;
 if p_occurred<existing.last_event_at or (p_occurred=existing.last_event_at and new_status='active') then return; end if;
 update giro_private.subscriptions set status=new_status,last_event_at=p_occurred,
 paid_until=case when new_status='active' then p_until else existing.paid_until end
 where sale_id=p_sale and portal=p_portal;
end $$;
