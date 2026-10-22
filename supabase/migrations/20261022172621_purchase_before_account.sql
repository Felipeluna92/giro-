-- Additive purchase ledger. Existing billing tables, keys and ownership records are preserved.
create table giro_private.purchase_checkouts (
 id uuid primary key default gen_random_uuid(),
 visitor_hash text not null check(visitor_hash ~ '^[0-9a-f]{64}$'),
 email text not null check(email=lower(btrim(email)) and length(email) between 3 and 254 and position('@' in email)>1),
 plan text not null check(plan in ('rider','merchant','combo')),
 first_price_cents integer not null check(first_price_cents in (2990,5990,3990,8980)),
 customer_id text unique check(customer_id is null or customer_id ~ '^cus_[A-Za-z0-9]+$'),
 session_id text unique check(session_id is null or session_id ~ '^cs_[A-Za-z0-9_]+$'),
 subscription_id text unique check(subscription_id is null or subscription_id ~ '^sub_[A-Za-z0-9]+$'),
 created_at timestamptz not null default now(),expires_at timestamptz not null default now()+interval '1 hour',
 lease uuid not null default gen_random_uuid(),lease_until timestamptz not null default now(),
 user_id uuid references auth.users(id) on delete restrict,
 paid_at timestamptz,email_sent_at timestamptz,
 fulfillment_lease uuid,fulfillment_until timestamptz
);
create index purchase_visitor_idx on giro_private.purchase_checkouts(visitor_hash,created_at);
create index purchase_email_idx on giro_private.purchase_checkouts(email,created_at);
alter table giro_private.purchase_checkouts enable row level security;
revoke all on giro_private.purchase_checkouts from public,anon,authenticated;
grant all on giro_private.purchase_checkouts to service_role;
create policy purchase_checkouts_backend on giro_private.purchase_checkouts for all to service_role using(true) with check(true);
create function public.purchase_reserve(p_visitor text,p_email text,p_plan text) returns jsonb language plpgsql security invoker set search_path='' as $$
declare item giro_private.purchase_checkouts; price integer; token uuid:=gen_random_uuid();
begin
 p_email:=lower(btrim(p_email));
 if p_visitor is null or p_visitor !~ '^[0-9a-f]{64}$' or p_email is null or length(p_email)>254 or p_email !~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$' or p_email like '%.invalid' or p_plan not in ('rider','merchant','combo') then raise invalid_parameter_value;end if;
 perform pg_advisory_xact_lock(hashtextextended('purchase-visitor:'||p_visitor,0));
 perform pg_advisory_xact_lock(hashtextextended('purchase-email:'||p_email,0));
 select * into item from giro_private.purchase_checkouts where visitor_hash=p_visitor and email=p_email and plan=p_plan and paid_at is null and expires_at>now()+interval '5 minutes' order by created_at desc limit 1 for update;
 if found then
  if item.lease_until>now() then raise lock_not_available;end if;
  update giro_private.purchase_checkouts set lease=token,lease_until=now()+interval '2 minutes' where id=item.id returning * into item;
  return to_jsonb(item);
 end if;
 price:=case p_plan when 'rider' then 2990 when 'merchant' then 5990 else 3990 end;
 -- The first-month discount is reserved once per buyer, including simultaneous guests.
 if p_plan='combo' and (
  exists(select 1 from giro_private.team_access t join auth.users u on u.id=t.merchant_id where lower(u.email)=p_email and t.intro_used)
  or exists(select 1 from giro_private.purchase_checkouts where email=p_email and plan='combo' and first_price_cents=3990 and (paid_at is not null or expires_at>now()))
 ) then price:=8980;end if;
 insert into giro_private.purchase_checkouts(visitor_hash,email,plan,first_price_cents,lease,lease_until)
 values(p_visitor,p_email,p_plan,price,token,now()+interval '2 minutes') returning * into item;
 return to_jsonb(item);
end $$;
create function public.purchase_finish(p_id uuid,p_lease uuid,p_customer text default null,p_session text default null) returns void language plpgsql security invoker set search_path='' as $$
begin
 update giro_private.purchase_checkouts set customer_id=coalesce(p_customer,customer_id),session_id=coalesce(p_session,session_id),lease_until=now()
 where id=p_id and lease=p_lease and (customer_id is null or p_customer is null or customer_id=p_customer) and (session_id is null or p_session is null or session_id=p_session);
 if not found then raise check_violation;end if;
end $$;
create function public.purchase_buyer(p_email text) returns jsonb language sql stable security invoker set search_path='' as $$
 select jsonb_build_object('id',u.id,'confirmed',u.email_confirmed_at is not null,'managed',exists(select 1 from giro_private.managed_riders m where m.rider_id=u.id))
 from auth.users u where lower(u.email)=lower(btrim(p_email)) and u.deleted_at is null limit 1
$$;
create function public.purchase_fulfill_begin(p_customer text,p_subscription text,p_session text) returns jsonb language plpgsql security invoker set search_path='' as $$
declare item giro_private.purchase_checkouts; token uuid:=gen_random_uuid();
begin
 select * into item from giro_private.purchase_checkouts where customer_id=p_customer for update;
 if not found then return null;end if;
 if item.session_id is distinct from p_session or (item.subscription_id is not null and item.subscription_id<>p_subscription) then raise check_violation;end if;
 if item.user_id is not null and item.email_sent_at is not null then return to_jsonb(item)||jsonb_build_object('done',true);end if;
 if item.fulfillment_until>now() then raise lock_not_available;end if;
 update giro_private.purchase_checkouts set subscription_id=p_subscription,paid_at=coalesce(paid_at,now()),fulfillment_lease=token,fulfillment_until=now()+interval '2 minutes' where id=item.id returning * into item;
 return to_jsonb(item)||jsonb_build_object('done',false);
end $$;
create function public.purchase_fulfill_finish(p_id uuid,p_lease uuid,p_user uuid,p_sent boolean) returns void language plpgsql security invoker set search_path='' as $$
declare item giro_private.purchase_checkouts; owner uuid;
begin
 select * into item from giro_private.purchase_checkouts where id=p_id for update;
 if item.id is null or item.fulfillment_lease is distinct from p_lease or item.paid_at is null or (item.user_id is not null and item.user_id<>p_user) then raise insufficient_privilege;end if;
 if not exists(select 1 from auth.users where id=p_user and lower(email)=item.email and deleted_at is null) then raise insufficient_privilege;end if;
 perform pg_advisory_xact_lock(hashtextextended('purchase-bind:'||p_user::text,0));
 insert into giro_private.stripe_customers(user_id,customer_id) values(p_user,item.customer_id) on conflict(user_id) do nothing;
 select user_id into owner from giro_private.stripe_customers where user_id=p_user;
 if owner is distinct from p_user then raise check_violation;end if;
 update giro_private.purchase_checkouts set user_id=p_user,email_sent_at=case when p_sent then coalesce(email_sent_at,now()) else email_sent_at end,fulfillment_until=now() where id=item.id;
end $$;
create function public.purchase_fulfill_release(p_id uuid,p_lease uuid) returns void language sql security invoker set search_path='' as $$
 update giro_private.purchase_checkouts set fulfillment_until=now() where id=p_id and fulfillment_lease=p_lease
$$;
create function public.purchase_status(p_visitor text,p_session text) returns jsonb language sql stable security invoker set search_path='' as $$
 select jsonb_build_object('paid',paid_at is not null,'emailSent',email_sent_at is not null,'plan',plan)
 from giro_private.purchase_checkouts where visitor_hash=p_visitor and session_id=p_session
$$;
create function public.stripe_owned_customers(p_user uuid) returns jsonb language sql stable security invoker set search_path='' as $$
 select coalesce(jsonb_agg(jsonb_build_object('id',id,'plans',plans) order by created_at),'[]'::jsonb) from (
  select c.customer_id as id,c.created_at,coalesce((select jsonb_agg(distinct s.plan) from giro_private.stripe_subscription_state s where s.customer_id=c.customer_id and not exists(select 1 from giro_private.purchase_checkouts p where p.subscription_id=s.subscription_id and p.customer_id<>c.customer_id)),'[]'::jsonb) as plans
  from giro_private.stripe_customers c where c.user_id=p_user
  union all
  select p.customer_id,p.created_at,jsonb_build_array(p.plan) from giro_private.purchase_checkouts p
  where p.user_id=p_user and p.paid_at is not null and p.customer_id is not null and not exists(select 1 from giro_private.stripe_customers c where c.customer_id=p.customer_id)
 ) q
$$;
revoke all on function public.purchase_reserve(text,text,text),public.purchase_finish(uuid,uuid,text,text),public.purchase_buyer(text),public.purchase_fulfill_begin(text,text,text),public.purchase_fulfill_finish(uuid,uuid,uuid,boolean),public.purchase_fulfill_release(uuid,uuid),public.purchase_status(text,text),public.stripe_owned_customers(uuid) from public,anon,authenticated;
grant execute on function public.purchase_reserve(text,text,text),public.purchase_finish(uuid,uuid,text,text),public.purchase_buyer(text),public.purchase_fulfill_begin(text,text,text),public.purchase_fulfill_finish(uuid,uuid,uuid,boolean),public.purchase_fulfill_release(uuid,uuid),public.purchase_status(text,text),public.stripe_owned_customers(uuid) to service_role;
create function public.purchase_session(p_customer text) returns text language sql stable security invoker set search_path='' as $$
 select session_id from giro_private.purchase_checkouts where customer_id=p_customer
$$;
revoke all on function public.purchase_session(text) from public,anon,authenticated;
grant execute on function public.purchase_session(text) to service_role;
create function public.purchase_has_overlap(p_email text,p_plan text) returns boolean language sql stable security invoker set search_path='' as $$
 select exists(select 1 from giro_private.subscriptions s join auth.users u on u.id=s.owner_id where lower(u.email)=lower(btrim(p_email)) and s.status in ('active','cancelled') and s.paid_until>now() and (s.portal=p_plan or (s.portal<>'rider' and p_plan<>'rider')))
$$;
revoke all on function public.purchase_has_overlap(text,text) from public,anon,authenticated;
grant execute on function public.purchase_has_overlap(text,text) to service_role;

create function public.purchase_canonical_customer(p_customer text) returns text language sql stable security invoker set search_path='' as $$
 select c.customer_id from giro_private.stripe_customers c where c.customer_id=p_customer
 union all
 select c.customer_id from giro_private.purchase_checkouts p join giro_private.stripe_customers c on c.user_id=p.user_id where p.customer_id=p_customer and p.paid_at is not null
 limit 1
$$;
revoke all on function public.purchase_canonical_customer(text) from public,anon,authenticated;
grant execute on function public.purchase_canonical_customer(text) to service_role;
