-- Paid portal access. Authorization never uses cookies or user_metadata.
create table giro_private.administrators (
 user_id uuid primary key references auth.users(id) on delete cascade
);
create table giro_private.billing_plans (
 portal text primary key check(portal in ('rider','merchant')),
 price_cents integer check(price_cents between 100 and 10000000),
 checkout_url text not null default '' check(checkout_url='' or checkout_url ~ '^https://pay[.]kirvano[.]com/[^[:space:]]+$'),
 product_id text not null default '', offer_id text not null default '',
 enabled boolean not null default false
);
insert into giro_private.billing_plans(portal,price_cents) values('rider',2990),('merchant',null);
create table giro_private.billing_webhook (
 id boolean primary key default true check(id),
 secret_hash text not null check(secret_hash ~ '^[0-9a-f]{64}$'),
 header_name text not null default 'security-token' check(header_name ~ '^[a-z][a-z0-9-]{0,79}$'),
 verified_at timestamptz
);
create table giro_private.subscriptions (
 sale_id text not null, portal text not null references giro_private.billing_plans(portal),
 owner_id uuid references auth.users(id) on delete cascade,
 buyer_email text not null, status text not null check(status in ('active','cancelled','expired','refunded','chargeback')),
 paid_until timestamptz, last_event_at timestamptz not null,
 primary key(sale_id,portal)
);
create index subscriptions_owner_portal_idx on giro_private.subscriptions(owner_id,portal);
create index subscriptions_unclaimed_email_idx on giro_private.subscriptions(buyer_email) where owner_id is null;
alter table giro_private.administrators enable row level security;
alter table giro_private.billing_plans enable row level security;
alter table giro_private.billing_webhook enable row level security;
alter table giro_private.subscriptions enable row level security;
revoke all on giro_private.administrators,giro_private.billing_plans,giro_private.billing_webhook,giro_private.subscriptions from public,anon,authenticated;
grant select on giro_private.administrators,giro_private.subscriptions to authenticated;
grant select on giro_private.billing_plans to anon,authenticated;
grant usage on schema giro_private to anon;
grant usage on schema giro_private to authenticated;
grant select,insert,update on giro_private.billing_webhook to authenticated;
grant update on giro_private.billing_plans to authenticated;
grant usage on schema giro_private to service_role;
grant all on giro_private.administrators,giro_private.billing_plans,giro_private.billing_webhook,giro_private.subscriptions to service_role;
-- The server billing RPCs perform a bounded lookup of the verified buyer.
grant usage on schema auth to service_role;
grant select(id,email,email_confirmed_at) on auth.users to service_role;
create policy administrators_self on giro_private.administrators for select to authenticated using(user_id=(select auth.uid()));
create policy subscriptions_self on giro_private.subscriptions for select to authenticated using(owner_id=(select auth.uid()));
create policy plans_read on giro_private.billing_plans for select to anon,authenticated using(true);

create function giro_private.is_admin() returns boolean language sql stable security invoker set search_path='' as $$
 select auth.uid() is not null and exists(select 1 from giro_private.administrators where user_id=(select auth.uid()))
$$;
create function giro_private.has_access(p_portal text) returns boolean language sql stable security invoker set search_path='' as $$
 select p_portal in ('rider','merchant') and auth.uid() is not null and
 (giro_private.is_admin() or exists(select 1 from giro_private.subscriptions where owner_id=(select auth.uid()) and portal=p_portal and status in ('active','cancelled') and paid_until>now()))
$$;
revoke all on function giro_private.is_admin(),giro_private.has_access(text) from public,anon;
grant execute on function giro_private.is_admin(),giro_private.has_access(text) to authenticated;
create policy plans_admin_update on giro_private.billing_plans for update to authenticated using((select giro_private.is_admin())) with check((select giro_private.is_admin()));
create policy webhook_admin on giro_private.billing_webhook for all to authenticated using((select giro_private.is_admin())) with check((select giro_private.is_admin()));

create function public.get_account_access() returns jsonb language sql stable security invoker set search_path='' as $$
 select jsonb_build_object('isAdmin',giro_private.is_admin(),'rider',giro_private.has_access('rider'),'merchant',giro_private.has_access('merchant'))
$$;
create function public.get_giro_plans() returns jsonb language sql stable security invoker set search_path='' as $$
 select coalesce(jsonb_agg(jsonb_build_object('portal',portal,'priceCents',price_cents,'available',enabled and price_cents is not null and checkout_url<>'' and product_id<>'' and offer_id<>'') order by portal),'[]'::jsonb) from giro_private.billing_plans
$$;
create function public.get_giro_checkout(p_portal text) returns text language plpgsql security invoker set search_path='' as $$
declare result text;
begin
 if auth.uid() is null then raise insufficient_privilege; end if;
 select checkout_url into result from giro_private.billing_plans where portal=p_portal and enabled and price_cents is not null and checkout_url<>'' and product_id<>'' and offer_id<>'';
 if result is null then raise check_violation using message='Checkout not configured'; end if;
 return result;
end $$;
create function public.admin_billing_settings() returns jsonb language plpgsql security invoker set search_path='' as $$
begin
 if not giro_private.is_admin() then raise insufficient_privilege; end if;
 return jsonb_build_object('plans',(select jsonb_agg(to_jsonb(p) order by portal) from giro_private.billing_plans p),'webhookConfigured',exists(select 1 from giro_private.billing_webhook),'webhookVerified',exists(select 1 from giro_private.billing_webhook where verified_at is not null),'headerName',coalesce((select header_name from giro_private.billing_webhook),'security-token'));
end $$;
create function public.admin_save_giro_plan(p_portal text,p_price integer,p_checkout text,p_product text,p_offer text,p_enabled boolean) returns void language plpgsql security invoker set search_path='' as $$
begin
 if not giro_private.is_admin() then raise insufficient_privilege; end if;
 if p_portal not in ('rider','merchant') or p_enabled is null or length(p_checkout)>500 or length(p_product)>100 or length(p_offer)>100 then raise invalid_parameter_value; end if;
 if p_enabled and (p_price is null or p_checkout='' or p_product='' or p_offer='' or not exists(select 1 from giro_private.billing_webhook where verified_at is not null)) then raise check_violation using message='Complete billing setup first'; end if;
 update giro_private.billing_plans set price_cents=p_price,checkout_url=p_checkout,product_id=btrim(p_product),offer_id=btrim(p_offer),enabled=p_enabled where portal=p_portal;
end $$;
create function public.admin_configure_giro_webhook(p_hash text,p_header text) returns void language plpgsql security invoker set search_path='' as $$
begin
 if not giro_private.is_admin() then raise insufficient_privilege; end if;
 insert into giro_private.billing_webhook(id,secret_hash,header_name) values(true,p_hash,p_header)
 on conflict(id) do update set secret_hash=excluded.secret_hash,header_name=excluded.header_name,verified_at=null;
 update giro_private.billing_plans set enabled=false;
end $$;

-- These RPCs are server-only. A user cannot grant themselves a plan.
create function public.get_giro_webhook_config() returns jsonb language sql stable security invoker set search_path='' as $$
 select jsonb_build_object('secretHash',w.secret_hash,'headerName',w.header_name,'plans',(select jsonb_agg(jsonb_build_object('portal',p.portal,'productId',p.product_id,'offerId',p.offer_id)) from giro_private.billing_plans p where p.product_id<>'' and p.offer_id<>'')) from giro_private.billing_webhook w where id
$$;
create function public.claim_giro_purchases(p_user uuid) returns void language plpgsql security invoker set search_path='' as $$
declare buyer text;
begin
 select lower(btrim(email)) into buyer from auth.users where id=p_user and email_confirmed_at is not null;
 if buyer is null then return; end if;
 update giro_private.subscriptions set owner_id=p_user where owner_id is null and buyer_email=buyer;
end $$;
create function public.verify_giro_webhook() returns void language sql security invoker set search_path='' as $$
 update giro_private.billing_webhook set verified_at=now() where id
$$;
create function public.apply_giro_subscription(p_sale text,p_portal text,p_email text,p_event text,p_occurred timestamptz,p_until timestamptz) returns void language plpgsql security invoker set search_path='' as $$
declare buyer uuid; new_status text; existing giro_private.subscriptions;
begin
 if p_sale is null or length(p_sale) not between 1 and 100 or p_portal not in ('rider','merchant') or p_email is null or length(p_email) not between 3 and 254 or p_occurred is null or not isfinite(p_occurred) or p_occurred>now()+interval '10 minutes' then raise invalid_parameter_value; end if;
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

revoke all on function public.get_account_access(),public.get_giro_plans(),public.get_giro_checkout(text),public.admin_billing_settings(),public.admin_save_giro_plan(text,integer,text,text,text,boolean),public.admin_configure_giro_webhook(text,text),public.get_giro_webhook_config(),public.claim_giro_purchases(uuid),public.verify_giro_webhook(),public.apply_giro_subscription(text,text,text,text,timestamptz,timestamptz) from public,anon,authenticated;
grant execute on function public.get_account_access(),public.get_giro_checkout(text),public.admin_billing_settings(),public.admin_save_giro_plan(text,integer,text,text,text,boolean),public.admin_configure_giro_webhook(text,text) to authenticated;
grant execute on function public.get_giro_plans() to anon,authenticated;
grant execute on function public.get_giro_webhook_config(),public.claim_giro_purchases(uuid),public.verify_giro_webhook(),public.apply_giro_subscription(text,text,text,text,timestamptz,timestamptz) to service_role;

-- Restrictive policies are ANDed with the existing ownership/link policies.
create policy paid_rider_accounts on public.rider_accounts as restrictive for all to authenticated using((select giro_private.has_access('rider'))) with check((select giro_private.has_access('rider')));
create policy paid_establishments on public.establishments as restrictive for all to authenticated using((select giro_private.has_access('rider'))) with check((select giro_private.has_access('rider')));
create policy paid_deliveries_read on public.deliveries as restrictive for select to authenticated using((select giro_private.has_access('rider') or giro_private.has_access('merchant')));
create policy paid_finances_read on public.financial_entries as restrictive for select to authenticated using((select giro_private.has_access('rider') or giro_private.has_access('merchant')));
do $$
declare t text; op text;
begin
 foreach t in array array['deliveries','financial_entries'] loop
  foreach op in array array['insert','update','delete'] loop
   if op='insert' then execute format('create policy paid_%s_%s on public.%I as restrictive for insert to authenticated with check((select giro_private.has_access(''rider'')))',t,op,t);
   elsif op='update' then execute format('create policy paid_%s_%s on public.%I as restrictive for update to authenticated using((select giro_private.has_access(''rider''))) with check((select giro_private.has_access(''rider'')))',t,op,t);
   else execute format('create policy paid_%s_%s on public.%I as restrictive for delete to authenticated using((select giro_private.has_access(''rider'')))',t,op,t);end if;
  end loop;
 end loop;
 foreach t in array array['merchants','merchant_invites','merchant_links','rider_locations','location_shares'] loop
  execute format('create policy paid_%s_read on giro_private.%I as restrictive for select to authenticated using((select giro_private.has_access(''rider'') or giro_private.has_access(''merchant'')))',t,t);
  execute format('create policy paid_%s_insert on giro_private.%I as restrictive for insert to authenticated with check((select giro_private.has_access(%L)))',t,t,case when t in ('merchants','merchant_invites') then 'merchant' else 'rider' end);
  if t not in ('merchant_links') then
   execute format('create policy paid_%s_update on giro_private.%I as restrictive for update to authenticated using((select giro_private.has_access(%L))) with check((select giro_private.has_access(%L)))',t,t,case when t='merchants' then 'merchant' else 'rider' end,case when t='merchants' then 'merchant' else 'rider' end);
  end if;
 end loop;
end $$;
create policy paid_ai_scans on public.ai_scan_usage as restrictive for all to authenticated using((select giro_private.has_access('rider'))) with check((select giro_private.has_access('rider')));
