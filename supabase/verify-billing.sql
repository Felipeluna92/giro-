begin;
create temporary table billing_fixture as select gen_random_uuid() admin,gen_random_uuid() rider,gen_random_uuid() merchant,gen_random_uuid() unpaid,gen_random_uuid() expired,gen_random_uuid() unconfirmed,gen_random_uuid() place,gen_random_uuid() delivery,replace(gen_random_uuid()::text,'-','') sale;
insert into auth.users(id,aud,role,email,email_confirmed_at) select u,'authenticated','authenticated',u::text||'@giro-test.invalid',now() from billing_fixture cross join lateral unnest(array[admin,rider,merchant,unpaid,expired]) u;
insert into auth.users(id,aud,role,email) select unconfirmed,'authenticated','authenticated',unconfirmed::text||'@giro-test.invalid' from billing_fixture;
insert into giro_private.administrators select admin from billing_fixture;
insert into public.establishments(id,owner_id,name,rate_rule,rate_value) select place,rider,'Paid fixture','full',0 from billing_fixture;
insert into public.deliveries(id,owner_id,establishment_id,address,customer_fee_cents,earnings_cents,order_total_cents,payment,status,work_day,created_at) select delivery,rider,place,'Test address',1000,1000,0,'paid','delivered',current_date,now() from billing_fixture;
insert into giro_private.subscriptions(sale_id,portal,owner_id,buyer_email,status,paid_until,last_event_at) select 'expired-'||sale,'rider',expired,expired::text||'@giro-test.invalid','active',now()-interval '1 second',now()-interval '32 days' from billing_fixture;
grant select on billing_fixture to authenticated,service_role;
set local role service_role;
do $test$
declare f record;
begin
 select * into f from billing_fixture;
 perform public.apply_giro_subscription(f.sale,'rider',f.rider::text||'@giro-test.invalid','SALE_APPROVED',now()-interval '1 minute',now()+interval '30 days');
 perform public.apply_giro_subscription('merchant-'||f.sale,'merchant',f.merchant::text||'@giro-test.invalid','SALE_APPROVED',now()-interval '1 minute',now()+interval '30 days');
 perform public.apply_giro_subscription('unconfirmed-'||f.sale,'rider',f.unconfirmed::text||'@giro-test.invalid','SALE_APPROVED',now()-interval '1 minute',now()+interval '30 days');
end $test$;
reset role;
set local role authenticated;
do $test$
declare f record; a jsonb; denied boolean; code text;
begin
 select * into f from billing_fixture;
 perform set_config('request.jwt.claim.sub',f.unpaid::text,true);
 a:=public.get_account_access();
 if (a->>'isAdmin')::boolean or (a->>'rider')::boolean or (a->>'merchant')::boolean then raise exception 'Unpaid access granted'; end if;
 denied:=false;begin insert into giro_private.administrators values(f.unpaid);exception when insufficient_privilege then denied:=true;end;if not denied then raise exception 'Self promotion accepted';end if;
 denied:=false;begin perform public.apply_giro_subscription('forged','rider',f.unpaid::text||'@giro-test.invalid','SALE_APPROVED',now(),now()+interval '30 days');exception when insufficient_privilege then denied:=true;end;if not denied then raise exception 'User forged billing event';end if;
 denied:=false;begin perform public.admin_billing_settings();exception when insufficient_privilege then denied:=true;end;if not denied then raise exception 'User read billing settings';end if;
 denied:=false;begin insert into public.establishments(id,owner_id,name,rate_rule,rate_value) values(gen_random_uuid(),f.unpaid,'Bypass','full',0);exception when insufficient_privilege then denied:=true;end;if not denied then raise exception 'Unpaid direct write accepted';end if;
 denied:=false;begin perform public.claim_ai_scan();exception when insufficient_privilege then denied:=true;end;if not denied then raise exception 'Unpaid AI scan accepted';end if;
 perform set_config('request.jwt.claim.sub',f.expired::text,true);
 if (public.get_account_access()->>'rider')::boolean then raise exception 'Expired subscription accepted'; end if;
 perform set_config('request.jwt.claim.sub',f.unconfirmed::text,true);
 if (public.get_account_access()->>'rider')::boolean then raise exception 'Unverified buyer accepted'; end if;
 perform set_config('request.jwt.claim.sub',f.rider::text,true);
 a:=public.get_account_access();if not (a->>'rider')::boolean or (a->>'merchant')::boolean or (a->>'isAdmin')::boolean then raise exception 'Rider plan crossed portals';end if;
 if not exists(select 1 from public.deliveries where id=f.delivery) then raise exception 'Paid rider lost own data';end if;
 denied:=false;begin perform public.merchant_setup('Wrong portal','');exception when insufficient_privilege then denied:=true;end;if not denied then raise exception 'Rider created merchant without plan';end if;
 perform set_config('request.jwt.claim.sub',f.merchant::text,true);
 a:=public.get_account_access();if not (a->>'merchant')::boolean or (a->>'rider')::boolean then raise exception 'Merchant plan crossed portals';end if;
 perform public.merchant_setup('Paid merchant','');
 if exists(select 1 from public.deliveries where id=f.delivery) then raise exception 'Subscription bypassed link isolation';end if;
 code:=public.merchant_invite();
 perform set_config('request.jwt.claim.sub',f.rider::text,true);
 if public.rider_connect(code,f.place,'Paid rider')<>'Paid merchant' then raise exception 'Paid accounts could not connect';end if;
 perform set_config('request.jwt.claim.sub',f.merchant::text,true);
 a:=public.merchant_dashboard(current_date);
 if jsonb_array_length(a->'deliveries')<>1 or (a->'riders'->0->>'due')::integer<>1000 then raise exception 'Paid merchant lost linked deliveries or balance';end if;
 denied:=false;begin insert into public.establishments(id,owner_id,name,rate_rule,rate_value) values(gen_random_uuid(),f.merchant,'Wrong portal','full',0);exception when insufficient_privilege then denied:=true;end;if not denied then raise exception 'Merchant plan allowed rider write';end if;
 perform set_config('request.jwt.claim.sub',f.admin::text,true);
 a:=public.get_account_access();if not (a->>'isAdmin')::boolean or not (a->>'rider')::boolean or not (a->>'merchant')::boolean then raise exception 'Admin lost portal access';end if;
 perform public.admin_configure_giro_webhook(repeat('0',64),'security-token');
 denied:=false;begin perform public.admin_save_giro_plan('rider',2990,'https://pay.kirvano.com/test','test-product','test-offer',true);exception when check_violation then denied:=true;end;if not denied then raise exception 'Sales opened before webhook test';end if;
end $test$;
reset role;
set local role service_role;
do $test$
declare f record;
begin
 select * into f from billing_fixture;
 -- Duplicate approval must not extend the paid period.
 perform public.apply_giro_subscription(f.sale,'rider',f.rider::text||'@giro-test.invalid','SALE_APPROVED',now()-interval '1 minute',now()+interval '31 days');
 if (select paid_until from giro_private.subscriptions where sale_id=f.sale and portal='rider')<>now()+interval '30 days' then raise exception 'Duplicate extended access';end if;
 perform public.apply_giro_subscription(f.sale,'rider',f.rider::text||'@giro-test.invalid','SUBSCRIPTION_CANCELED',now()-interval '30 seconds',null);
 if not exists(select 1 from giro_private.subscriptions where sale_id=f.sale and status='cancelled' and paid_until=now()+interval '30 days') then raise exception 'Cancellation removed paid period';end if;
 perform public.apply_giro_subscription(f.sale,'rider',f.rider::text||'@giro-test.invalid','SALE_REFUNDED',now(),null);
 -- Even a late/out-of-order approval cannot resurrect a refunded sale.
 perform public.apply_giro_subscription(f.sale,'rider',f.rider::text||'@giro-test.invalid','SALE_APPROVED',now()+interval '1 minute',now()+interval '30 days');
 if (select status from giro_private.subscriptions where sale_id=f.sale)<>'refunded' then raise exception 'Refunded sale resurrected';end if;
end $test$;
reset role;
set local role authenticated;
do $test$
declare f record;
begin
 select * into f from billing_fixture;perform set_config('request.jwt.claim.sub',f.rider::text,true);
 if (public.get_account_access()->>'rider')::boolean then raise exception 'Refund kept access';end if;
 if exists(select 1 from public.deliveries where id=f.delivery) then raise exception 'Refund bypassed direct RLS read';end if;
end $test$;
reset role;
rollback;
select 'PASS: unpaid/expired/unverified blocking, portal separation, admin exemption, no self promotion, server-only billing, ownership, duplicate delivery, cancellation and irreversible refund. Fixtures rolled back.' as result;
