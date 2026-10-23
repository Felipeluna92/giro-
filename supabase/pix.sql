-- Additive prepaid Pix accounting; existing recurring subscriptions are preserved.
create table giro_private.payment_options (
 id boolean primary key default true check(id),
 pix_configuration_id text check(pix_configuration_id is null or pix_configuration_id ~ '^pmc_[A-Za-z0-9]+$')
);
insert into giro_private.payment_options(id) values(true);
alter table giro_private.payment_options enable row level security;
revoke all on giro_private.payment_options from public,anon,authenticated;
grant select,update on giro_private.payment_options to service_role;
create policy payment_options_backend on giro_private.payment_options for all to service_role using(true) with check(true);
create function public.pix_configuration() returns text language sql stable security invoker set search_path='' as $$
 select pix_configuration_id from giro_private.payment_options where id
$$;
revoke all on function public.pix_configuration() from public,anon,authenticated;
grant execute on function public.pix_configuration() to service_role;

alter table giro_private.purchase_checkouts
 add column payment_method text not null default 'card' check(payment_method in ('card','pix')),
 add column payment_intent_id text unique check(payment_intent_id is null or payment_intent_id ~ '^pi_[A-Za-z0-9]+$'),
 add column pix_period_start timestamptz,
 add column pix_period_end timestamptz,
 add column pix_refunded boolean not null default false,
 add column pix_disputed boolean not null default false,
 add column pix_reversal_at timestamptz not null default '-infinity';
create index purchase_pix_user_idx on giro_private.purchase_checkouts(user_id,plan,pix_period_end) where payment_method='pix';

create function public.purchase_reserve_v2(p_visitor text,p_email text,p_plan text,p_method text) returns jsonb language plpgsql security invoker set search_path='' as $$
declare item giro_private.purchase_checkouts; price integer; token uuid:=gen_random_uuid();
begin
 p_email:=lower(btrim(p_email));
 if p_visitor is null or p_visitor !~ '^[0-9a-f]{64}$' or p_email is null or length(p_email)>254 or p_email !~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$' or p_email like '%.invalid' or p_plan is null or p_plan not in ('rider','merchant','combo') or p_method is null or p_method not in ('card','pix') then raise invalid_parameter_value;end if;
 perform pg_advisory_xact_lock(hashtextextended('purchase-visitor:'||p_visitor,0));
 perform pg_advisory_xact_lock(hashtextextended('purchase-email:'||p_email,0));
 select * into item from giro_private.purchase_checkouts where visitor_hash=p_visitor and email=p_email and plan=p_plan and payment_method=p_method and paid_at is null and expires_at>now()+interval '31 minutes' order by created_at desc limit 1 for update;
 if found then
  if item.lease_until>now() then raise lock_not_available;end if;
  update giro_private.purchase_checkouts set lease=token,lease_until=now()+interval '2 minutes' where id=item.id returning * into item;
  return to_jsonb(item);
 end if;
 price:=case p_plan when 'rider' then 2990 when 'merchant' then 5990 else 3990 end;
 if p_plan='combo' and (
  exists(select 1 from giro_private.team_access t join auth.users u on u.id=t.merchant_id where lower(u.email)=p_email and t.intro_used)
  or exists(select 1 from giro_private.purchase_checkouts where email=p_email and plan='combo' and first_price_cents=3990 and (paid_at is not null or expires_at>now()))
 ) then price:=8980;end if;
 insert into giro_private.purchase_checkouts(visitor_hash,email,plan,payment_method,first_price_cents,lease,lease_until)
 values(p_visitor,p_email,p_plan,p_method,price,token,now()+interval '2 minutes') returning * into item;
 return to_jsonb(item);
end $$;

-- A prepaid renewal may extend the same Pix plan, but cannot duplicate a card subscription or change an active prepaid tier.
create function public.pix_has_overlap(p_email text,p_plan text) returns boolean language sql stable security invoker set search_path='' as $$
 select exists(select 1 from giro_private.subscriptions s join auth.users u on u.id=s.owner_id
 where lower(u.email)=lower(btrim(p_email)) and s.status in ('active','cancelled') and s.paid_until>now()
 and (s.portal=p_plan or (s.portal<>'rider' and p_plan<>'rider'))
 and (s.sale_id not like 'pix:%' or s.portal<>p_plan))
$$;
create function public.pix_order(p_session text default null,p_intent text default null) returns jsonb language sql stable security invoker set search_path='' as $$
 select to_jsonb(p) from giro_private.purchase_checkouts p where payment_method='pix'
 and ((p_session is not null and session_id=p_session) or (p_intent is not null and payment_intent_id=p_intent)) limit 1
$$;

-- Rebuild the prepaid timeline from valid payments. Removing a refunded credit cannot leave its 30 days attached to a later renewal.
create function giro_private.recalculate_pix(p_email text,p_plan text) returns void language plpgsql security invoker set search_path='' as $$
declare item giro_private.purchase_checkouts; until_at timestamptz; starts timestamptz;
begin
 for item in select * from giro_private.purchase_checkouts where payment_method='pix' and email=p_email and plan=p_plan and paid_at is not null order by paid_at,id for update loop
  if item.pix_refunded or item.pix_disputed then
   update giro_private.subscriptions set status=case when item.pix_refunded then 'refunded' else 'chargeback' end,last_event_at=now() where sale_id='pix:'||item.id::text and portal=p_plan;
  else
   starts:=greatest(item.paid_at,coalesce(until_at,item.paid_at));until_at:=starts+interval '30 days';
   update giro_private.purchase_checkouts set pix_period_start=starts,pix_period_end=until_at where id=item.id;
   update giro_private.subscriptions set status='active',paid_until=until_at,last_event_at=now() where sale_id='pix:'||item.id::text and portal=p_plan;
  end if;
 end loop;
end $$;
revoke all on function giro_private.recalculate_pix(text,text) from public,anon,authenticated;
grant execute on function giro_private.recalculate_pix(text,text) to service_role;

create function public.pix_payment_begin(p_session text,p_customer text,p_intent text,p_paid_at timestamptz,p_refunded boolean,p_disputed boolean,p_event_at timestamptz) returns jsonb language plpgsql security invoker set search_path='' as $$
declare item giro_private.purchase_checkouts; buyer text; token uuid:=gen_random_uuid(); starts timestamptz;
begin
 if p_intent is null or p_intent !~ '^pi_[A-Za-z0-9]+$' or p_paid_at is null or not isfinite(p_paid_at) or p_paid_at>now()+interval '10 minutes' or p_event_at is null or not isfinite(p_event_at) or p_event_at>now()+interval '10 minutes' or p_refunded is null or p_disputed is null then raise invalid_parameter_value;end if;
 select email into buyer from giro_private.purchase_checkouts where session_id=p_session and payment_method='pix';
 if buyer is null then return null;end if;
 perform pg_advisory_xact_lock(hashtextextended('purchase-email:'||buyer,0));
 select * into item from giro_private.purchase_checkouts where session_id=p_session and payment_method='pix' for update;
 if item.customer_id is distinct from p_customer or (item.payment_intent_id is not null and item.payment_intent_id<>p_intent) then raise check_violation;end if;
 if item.pix_period_end is null then
  select greatest(p_paid_at,coalesce(max(pix_period_end),p_paid_at)) into starts from giro_private.purchase_checkouts where email=item.email and plan=item.plan and payment_method='pix' and paid_at is not null and not pix_refunded and not pix_disputed and id<>item.id;
 else starts:=item.pix_period_start;end if;
 update giro_private.purchase_checkouts set payment_intent_id=p_intent,paid_at=coalesce(paid_at,p_paid_at),pix_period_start=starts,pix_period_end=coalesce(pix_period_end,starts+interval '30 days'),
 pix_refunded=pix_refunded or p_refunded,pix_disputed=case when p_event_at>=pix_reversal_at then p_disputed else pix_disputed end,pix_reversal_at=greatest(pix_reversal_at,p_event_at)
 where id=item.id returning * into item;
 perform giro_private.recalculate_pix(item.email,item.plan);
 select * into item from giro_private.purchase_checkouts where id=item.id;
 if item.user_id is not null then
  update giro_private.subscriptions set status=case when item.pix_refunded then 'refunded' when item.pix_disputed then 'chargeback' else 'active' end,last_event_at=greatest(last_event_at,p_event_at)
  where sale_id='pix:'||item.id::text and portal=item.plan;
 end if;
 if item.pix_refunded or item.pix_disputed or item.email_sent_at is not null then return to_jsonb(item)||jsonb_build_object('done',true);end if;
 if item.fulfillment_until>now() then raise lock_not_available;end if;
 update giro_private.purchase_checkouts set fulfillment_lease=token,fulfillment_until=now()+interval '2 minutes' where id=item.id returning * into item;
 return to_jsonb(item)||jsonb_build_object('done',false);
end $$;

create function public.pix_payment_finish(p_id uuid,p_lease uuid,p_user uuid) returns void language plpgsql security invoker set search_path='' as $$
declare item giro_private.purchase_checkouts;
begin
 select * into item from giro_private.purchase_checkouts where id=p_id for update;
 if item.payment_method is distinct from 'pix' or item.pix_period_end is null or item.pix_refunded or item.pix_disputed then raise check_violation;end if;
 perform public.purchase_fulfill_finish(p_id,p_lease,p_user,true);
 insert into giro_private.subscriptions(sale_id,portal,owner_id,buyer_email,status,paid_until,last_event_at)
 values('pix:'||item.id::text,item.plan,p_user,item.email,'active',item.pix_period_end,now())
 on conflict(sale_id,portal) do nothing;
end $$;

create function public.pix_access_summary(p_user uuid) returns jsonb language sql stable security invoker set search_path='' as $$
 select coalesce(jsonb_agg(jsonb_build_object('plan',plan,'paidUntil',until_at)),'[]'::jsonb) from (
 select plan,max(pix_period_end) as until_at from giro_private.purchase_checkouts where user_id=p_user and payment_method='pix' and email_sent_at is not null and not pix_refunded and not pix_disputed group by plan) q
$$;

create or replace function public.purchase_status(p_visitor text,p_session text) returns jsonb language sql stable security invoker set search_path='' as $$
 select jsonb_build_object('paid',paid_at is not null and not pix_refunded and not pix_disputed,'emailSent',email_sent_at is not null and not pix_refunded and not pix_disputed,'plan',plan,'method',payment_method,'paidUntil',pix_period_end,'revoked',pix_refunded or pix_disputed)
 from giro_private.purchase_checkouts where visitor_hash=p_visitor and session_id=p_session
$$;

revoke all on function public.purchase_reserve_v2(text,text,text,text),public.pix_has_overlap(text,text),public.pix_order(text,text),public.pix_payment_begin(text,text,text,timestamptz,boolean,boolean,timestamptz),public.pix_payment_finish(uuid,uuid,uuid),public.pix_access_summary(uuid) from public,anon,authenticated;
grant execute on function public.purchase_reserve_v2(text,text,text,text),public.pix_has_overlap(text,text),public.pix_order(text,text),public.pix_payment_begin(text,text,text,timestamptz,boolean,boolean,timestamptz),public.pix_payment_finish(uuid,uuid,uuid),public.pix_access_summary(uuid) to service_role;

-- Compatibility for older card callers during an atomic deployment.
create or replace function public.purchase_reserve(p_visitor text,p_email text,p_plan text) returns jsonb language sql security invoker set search_path='' as $$
 select public.purchase_reserve_v2(p_visitor,p_email,p_plan,'card')
$$;
