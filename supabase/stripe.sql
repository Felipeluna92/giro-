-- Stripe ownership and invoice accounting. Browser roles cannot change billing data.
grant usage on schema giro_private to authenticated;
create table giro_private.stripe_customers (
 user_id uuid primary key references auth.users(id) on delete restrict,
 customer_id text not null unique check(customer_id ~ '^cus_[A-Za-z0-9]+$'),
 created_at timestamptz not null default now()
);
create table giro_private.stripe_checkouts (
 user_id uuid primary key references auth.users(id) on delete cascade,
 plan text not null check(plan in ('rider','merchant','combo')),
 attempt uuid not null default gen_random_uuid(), session_id text,
 lease uuid not null default gen_random_uuid(), lease_until timestamptz not null default now()
);
create table giro_private.stripe_subscription_state (
 subscription_id text primary key check(subscription_id ~ '^sub_[A-Za-z0-9]+$'),
 customer_id text not null references giro_private.stripe_customers(customer_id),
 plan text not null check(plan in ('rider','merchant','combo')),
 status text not null, ended_at timestamptz, cancel_at timestamptz,
 state_event_at timestamptz not null
);
create index stripe_sub_customer_idx on giro_private.stripe_subscription_state(customer_id);
create table giro_private.stripe_invoices (
 invoice_id text primary key,
 subscription_id text not null references giro_private.stripe_subscription_state(subscription_id),
 period_end timestamptz not null,
 paid boolean not null default false,
 refunded boolean not null default false,
 disputed boolean not null default false,
 dispute_event_at timestamptz not null default '-infinity',
 amount_paid integer not null default 0 check(amount_paid>=0)
);
create index stripe_invoice_subscription_idx on giro_private.stripe_invoices(subscription_id,period_end);
create table giro_private.stripe_events (
 event_key text primary key,
 received_at timestamptz not null default now()
);
alter table giro_private.stripe_customers enable row level security;
alter table giro_private.stripe_checkouts enable row level security;
alter table giro_private.stripe_subscription_state enable row level security;
alter table giro_private.stripe_invoices enable row level security;
alter table giro_private.stripe_events enable row level security;
revoke all on giro_private.stripe_customers,giro_private.stripe_checkouts,giro_private.stripe_subscription_state,giro_private.stripe_invoices,giro_private.stripe_events from public,anon,authenticated;
grant all on giro_private.stripe_customers,giro_private.stripe_checkouts,giro_private.stripe_subscription_state,giro_private.stripe_invoices,giro_private.stripe_events to service_role;
create policy stripe_customers_backend on giro_private.stripe_customers for all to service_role using(true) with check(true);
create policy stripe_checkouts_backend on giro_private.stripe_checkouts for all to service_role using(true) with check(true);
create policy stripe_state_backend on giro_private.stripe_subscription_state for all to service_role using(true) with check(true);
create policy stripe_invoices_backend on giro_private.stripe_invoices for all to service_role using(true) with check(true);
create policy stripe_events_backend on giro_private.stripe_events for all to service_role using(true) with check(true);

create function public.stripe_customer(p_user uuid) returns text language sql stable security invoker set search_path='' as $$
 select customer_id from giro_private.stripe_customers where user_id=p_user
$$;
create function public.stripe_bind_customer(p_user uuid,p_customer text) returns text language plpgsql security invoker set search_path='' as $$
begin
 if not exists(select 1 from auth.users where id=p_user and email_confirmed_at is not null) then raise insufficient_privilege;end if;
 insert into giro_private.stripe_customers(user_id,customer_id) values(p_user,p_customer) on conflict(user_id) do nothing;
 return (select customer_id from giro_private.stripe_customers where user_id=p_user);
end $$;
create function public.stripe_checkout_reserve(p_user uuid,p_plan text) returns jsonb language plpgsql security invoker set search_path='' as $$
declare item giro_private.stripe_checkouts; new_lease uuid:=gen_random_uuid();
begin
 perform pg_advisory_xact_lock(hashtextextended('stripe-checkout:'||p_user::text,0));
 insert into giro_private.stripe_checkouts(user_id,plan) values(p_user,p_plan) on conflict(user_id) do nothing;
 select * into item from giro_private.stripe_checkouts where user_id=p_user for update;
 if item.lease_until>now() then raise lock_not_available;end if;
 update giro_private.stripe_checkouts set lease=new_lease,lease_until=now()+interval '3 minutes' where user_id=p_user returning * into item;
 return to_jsonb(item)||jsonb_build_object('intro_used',exists(select 1 from giro_private.team_access where merchant_id=p_user and intro_used));
end $$;
create function public.stripe_checkout_rotate(p_user uuid,p_lease uuid,p_plan text) returns uuid language plpgsql security invoker set search_path='' as $$
declare result uuid;
begin
 update giro_private.stripe_checkouts set plan=p_plan,attempt=gen_random_uuid(),session_id=null where user_id=p_user and lease=p_lease and lease_until>now() returning attempt into result;
 if result is null then raise lock_not_available;end if;return result;
end $$;
create function public.stripe_checkout_finish(p_user uuid,p_lease uuid,p_session text) returns void language plpgsql security invoker set search_path='' as $$
begin
 update giro_private.stripe_checkouts set session_id=coalesce(p_session,session_id),lease_until=now() where user_id=p_user and lease=p_lease;
end $$;

-- One transaction per event/object: duplicates and financial reversals cannot extend access.
create function public.stripe_apply_event(p_event text,p_customer text,p_subscription text,p_plan text,p_status text,p_ended_at timestamptz,p_cancel_at timestamptz,p_event_at timestamptz,p_invoice jsonb default null) returns boolean language plpgsql security invoker set search_path='' as $$
declare owner uuid; buyer text; state giro_private.stripe_subscription_state; v_invoice_id text; until_at timestamptz; access_status text; is_paid boolean; is_refunded boolean; has_dispute boolean; existing_invoice giro_private.stripe_invoices;
begin
 if p_event is null or length(p_event)>250 or p_event_at is null or not isfinite(p_event_at) or p_event_at>now()+interval '10 minutes' or p_plan not in ('rider','merchant','combo') or p_status not in ('active','past_due','unpaid','canceled','incomplete','incomplete_expired','trialing','paused') then raise invalid_parameter_value;end if;
 select c.user_id,u.email into owner,buyer from giro_private.stripe_customers c join auth.users u on u.id=c.user_id where c.customer_id=p_customer;
 if owner is null then return false;end if;
 perform pg_advisory_xact_lock(hashtextextended('stripe-sub:'||p_subscription,0));
 if exists(select 1 from giro_private.stripe_events where event_key=p_event) then return false;end if;
 select * into state from giro_private.stripe_subscription_state where subscription_id=p_subscription;
 if found and (state.customer_id<>p_customer or state.plan<>p_plan) then raise check_violation;end if;
 insert into giro_private.stripe_subscription_state(subscription_id,customer_id,plan,status,ended_at,cancel_at,state_event_at)
 values(p_subscription,p_customer,p_plan,p_status,p_ended_at,p_cancel_at,p_event_at)
 on conflict(subscription_id) do update set status=excluded.status,ended_at=excluded.ended_at,cancel_at=excluded.cancel_at,state_event_at=excluded.state_event_at
 where excluded.state_event_at>=stripe_subscription_state.state_event_at
 and (stripe_subscription_state.status<>'canceled' or excluded.status='canceled')
 and not (stripe_subscription_state.status in ('active','past_due','unpaid','canceled') and excluded.status in ('incomplete','incomplete_expired','trialing'));
 select * into state from giro_private.stripe_subscription_state where subscription_id=p_subscription;
 if p_invoice is not null then
  v_invoice_id:=p_invoice->>'id';
  if v_invoice_id is null or v_invoice_id !~ '^in_[A-Za-z0-9]+$' or (p_invoice->>'period_end')::timestamptz is null or not isfinite((p_invoice->>'period_end')::timestamptz) or (p_invoice->>'period_end')::timestamptz>now()+interval '35 days' then raise invalid_parameter_value;end if;
  select * into existing_invoice from giro_private.stripe_invoices where invoice_id=v_invoice_id;
  if found and existing_invoice.subscription_id<>p_subscription then raise check_violation;end if;
  insert into giro_private.stripe_invoices(invoice_id,subscription_id,period_end,paid,refunded,disputed,dispute_event_at,amount_paid)
  values(v_invoice_id,p_subscription,(p_invoice->>'period_end')::timestamptz,coalesce((p_invoice->>'paid')::boolean,false),coalesce((p_invoice->>'refunded')::boolean,false),coalesce((p_invoice->>'disputed')::boolean,false),case when p_invoice ? 'disputed' then p_event_at else '-infinity'::timestamptz end,coalesce((p_invoice->>'amount_paid')::integer,0))
  on conflict on constraint stripe_invoices_pkey do update set
   paid=stripe_invoices.paid or excluded.paid,
   refunded=stripe_invoices.refunded or excluded.refunded,
   disputed=case when excluded.dispute_event_at>=stripe_invoices.dispute_event_at then excluded.disputed else stripe_invoices.disputed end,
   dispute_event_at=greatest(excluded.dispute_event_at,stripe_invoices.dispute_event_at),
   period_end=greatest(excluded.period_end,stripe_invoices.period_end),amount_paid=greatest(excluded.amount_paid,stripe_invoices.amount_paid);
 end if;
 select max(period_end) filter(where paid and not refunded and not disputed),coalesce(bool_or(paid),false),coalesce(bool_or(refunded),false),coalesce(bool_or(disputed),false)
 into until_at,is_paid,is_refunded,has_dispute from giro_private.stripe_invoices where subscription_id=p_subscription;
 if until_at is not null and state.status='canceled' and state.ended_at is not null then until_at:=least(until_at,state.ended_at);end if;
 if state.status in ('unpaid','incomplete_expired','paused','incomplete','trialing') then until_at:=null;end if;
 access_status:=case when until_at>now() then case when state.cancel_at is not null or state.status='canceled' then 'cancelled' else 'active' end when has_dispute then 'chargeback' when is_refunded then 'refunded' else 'expired' end;
 -- A pending subscription must not consume the once-per-account introduction.
 if is_paid then
  insert into giro_private.subscriptions(sale_id,portal,owner_id,buyer_email,status,paid_until,last_event_at)
  values(p_subscription,p_plan,owner,lower(buyer),access_status,until_at,p_event_at)
  on conflict(sale_id,portal) do update set status=excluded.status,paid_until=excluded.paid_until,last_event_at=greatest(subscriptions.last_event_at,excluded.last_event_at);
 end if;
 insert into giro_private.stripe_events(event_key) values(p_event);
 return true;
end $$;

create function public.stripe_billing_status() returns jsonb language plpgsql security invoker set search_path='' as $$
begin
 return jsonb_build_object('lastEventAt',(select max(received_at) from giro_private.stripe_events),'subscriptions',(select count(*) from giro_private.stripe_subscription_state),'customers',(select count(*) from giro_private.stripe_customers));
end $$;
create function public.stripe_record_health(p_event text) returns void language sql security invoker set search_path='' as $$
 insert into giro_private.stripe_events(event_key) values('health:'||p_event) on conflict(event_key) do nothing
$$;
revoke all on function public.stripe_record_health(text) from public,anon,authenticated;
grant execute on function public.stripe_record_health(text) to service_role;
-- Admin receives only counters/timestamps through a backend call after server-side authorization.
revoke all on function public.stripe_customer(uuid),public.stripe_bind_customer(uuid,text),public.stripe_checkout_reserve(uuid,text),public.stripe_checkout_rotate(uuid,uuid,text),public.stripe_checkout_finish(uuid,uuid,text),public.stripe_apply_event(text,text,text,text,text,timestamptz,timestamptz,timestamptz,jsonb),public.stripe_billing_status() from public,anon,authenticated;
grant execute on function public.stripe_customer(uuid),public.stripe_bind_customer(uuid,text),public.stripe_checkout_reserve(uuid,text),public.stripe_checkout_rotate(uuid,uuid,text),public.stripe_checkout_finish(uuid,uuid,text),public.stripe_apply_event(text,text,text,text,text,timestamptz,timestamptz,timestamptz,jsonb),public.stripe_billing_status() to service_role;
-- The old checkout and token forms are retired; historic records remain for audit.
revoke execute on function public.get_giro_checkout(text),public.admin_save_giro_plan(text,integer,text,text,text,boolean),public.admin_save_giro_offer(text,integer,integer,text,text,text,boolean,text,text),public.admin_configure_giro_webhook(text,text) from authenticated;
