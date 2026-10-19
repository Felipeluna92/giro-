-- No real users, passwords, sessions or emails: all fixtures are rolled back.
begin;
create temporary table combo_fixture as select gen_random_uuid() m1,gen_random_uuid() m2,gen_random_uuid() child,gen_random_uuid() unpaid,gen_random_uuid() standalone,gen_random_uuid() delivery,replace(gen_random_uuid()::text,'-','') sale,null::uuid reservation,null::text login_email;
insert into auth.users(id,aud,role,email,email_confirmed_at) select u,'authenticated','authenticated',u::text||'@giro-test.invalid',now() from combo_fixture cross join lateral unnest(array[m1,m2,unpaid,standalone]) u;
grant select,update on combo_fixture to service_role;
grant select on combo_fixture to authenticated;
set local role service_role;
do $test$
declare f record; result jsonb; denied boolean;
begin
 select * into f from combo_fixture;
 perform public.apply_giro_subscription(f.sale,'combo',f.m1::text||'@giro-test.invalid','SALE_APPROVED',now()-interval '1 minute',now()+interval '30 days');
 perform public.apply_giro_subscription('other-'||f.sale,'combo',f.m2::text||'@giro-test.invalid','SALE_APPROVED',now()-interval '1 minute',now()+interval '30 days');
 perform public.apply_giro_subscription('solo-'||f.sale,'rider',f.standalone::text||'@giro-test.invalid','SALE_APPROVED',now()-interval '1 minute',now()+interval '30 days');
 denied:=false;begin perform public.reserve_managed_rider(f.unpaid,'unpaid.fixture','Unpaid');exception when insufficient_privilege then denied:=true;end;if not denied then raise exception 'Unpaid provisioned rider';end if;
 result:=public.reserve_managed_rider(f.m1,'fixture.'||substr(f.sale,1,12),'Included rider');
 update combo_fixture set reservation=(result->>'reservation')::uuid,login_email=result->>'email';
 denied:=false;begin perform public.reserve_managed_rider(f.m1,'different.user','Second');exception when lock_not_available then denied:=true;end;if not denied then raise exception 'Parallel provisioning allowed';end if;
 denied:=false;begin perform public.reserve_managed_rider(f.m2,'fixture.'||substr(f.sale,1,12),'Duplicate username');exception when unique_violation then denied:=true;end;if not denied then raise exception 'Duplicate username allowed';end if;
end $test$;
reset role;
-- Simulates only the Auth API's resulting identity; no password or session exists.
insert into auth.users(id,aud,role,email,email_confirmed_at) select child,'authenticated','authenticated',login_email,now() from combo_fixture;
set local role service_role;
do $test$
declare f record; username text; denied boolean; key text;
begin
 select * into f from combo_fixture;
 denied:=false;begin perform public.finish_managed_rider(f.m2,f.reservation);exception when insufficient_privilege then denied:=true;end;if not denied then raise exception 'Other merchant finalized reservation';end if;
 username:=public.finish_managed_rider(f.m1,f.reservation);
 if public.finish_managed_rider(f.m1,f.reservation)<>username then raise exception 'Idempotent finalization failed';end if;
 if public.resolve_rider_login(username)<>f.login_email then raise exception 'Wrong username mapping';end if;
 if exists(select 1 from giro_private.merchant_links where rider_id=f.child) then raise exception 'Account creation linked a store without consent';end if;
 denied:=false;begin perform public.reserve_managed_rider(f.m1,'second.user','Second rider');exception when check_violation then denied:=true;end;if not denied then raise exception 'One-rider package limit bypassed';end if;
 key:=encode(sha256(convert_to(f.sale,'UTF8')),'hex');
 if not public.claim_login_attempt(key,2) or not public.claim_login_attempt(key,2) or public.claim_login_attempt(key,2) then raise exception 'Login attempt limit failed';end if;
 update giro_private.billing_plans set enabled=true,checkout_url='https://pay.kirvano.com/intro-fixture',renewal_checkout_url='https://pay.kirvano.com/normal-fixture',product_id='fixture-product',offer_id='fixture-intro',renewal_offer_id='fixture-normal' where portal='combo';
end $test$;
reset role;
do $$ begin if exists(select 1 from giro_private.rider_locations where rider_id=(select child from combo_fixture)) then raise exception 'Account creation enabled location';end if;end $$;
set local role authenticated;
do $test$
declare f record; a jsonb; denied boolean; place uuid; code text;
begin
 select * into f from combo_fixture;
 perform set_config('request.jwt.claim.sub',f.unpaid::text,true);
 if public.get_giro_checkout('combo')<>'https://pay.kirvano.com/intro-fixture' then raise exception 'First purchase missed introductory offer';end if;
 denied:=false;begin perform public.resolve_rider_login('fixture.test');exception when insufficient_privilege then denied:=true;end;if not denied then raise exception 'Alias directory exposed';end if;
 denied:=false;begin perform public.reserve_managed_rider(f.unpaid,'forged.user','Forged');exception when insufficient_privilege then denied:=true;end;if not denied then raise exception 'Client invoked privileged provisioning';end if;
 perform set_config('request.jwt.claim.sub',f.m1::text,true);
 a:=public.get_account_access();if not (a->>'merchant')::boolean or not (a->>'combo')::boolean or (a->>'rider')::boolean then raise exception 'Buyer gained rider portal instead of a separate seat';end if;
 if public.get_giro_checkout('combo')<>'https://pay.kirvano.com/normal-fixture' then raise exception 'Introductory price reused';end if;
 if public.get_managed_rider()->'account'->>'username'<>'fixture.'||substr(f.sale,1,12) then raise exception 'Merchant could not see own rider username';end if;
 perform public.merchant_setup('Merchant fixture','');
 if jsonb_array_length(public.merchant_dashboard(current_date)->'riders')<>0 then raise exception 'Unlinked rider data exposed';end if;
 code:=public.merchant_invite();
 perform set_config('request.jwt.claim.sub',f.child::text,true);
 a:=public.get_account_access();if not (a->>'rider')::boolean or not (a->>'managedRider')::boolean or (a->>'merchant')::boolean or (a->>'combo')::boolean then raise exception 'Managed rider permissions incorrect';end if;
 if exists(select 1 from giro_private.subscriptions where owner_id=f.m1) then raise exception 'Merchant billing data leaked to child';end if;
 denied:=false;begin perform public.managed_rider_backend(f.m1);exception when insufficient_privilege then denied:=true;end;if not denied then raise exception 'Backend provisioning data leaked';end if;
 select establishment_id into place from giro_private.managed_riders where rider_id=f.child;
 insert into public.deliveries(id,owner_id,establishment_id,address,customer_fee_cents,earnings_cents,order_total_cents,payment,status,work_day,created_at) values(f.delivery,f.child,place,'Independent address',800,800,0,'paid','pending',current_date,now());
 if jsonb_array_length(public.rider_network())<>0 then raise exception 'Independent rider unexpectedly linked';end if;
 -- Explicit acceptance remains possible, but is not required to use the app.
 perform public.rider_connect(code,place,'Included rider');
 perform set_config('request.jwt.claim.sub',f.m1::text,true);
 if jsonb_array_length(public.merchant_dashboard(current_date)->'deliveries')<>1 then raise exception 'Optional link did not authorize selected deliveries';end if;
 perform set_config('request.jwt.claim.sub',f.m2::text,true);
 if public.get_managed_rider()->'account'<>'null'::jsonb then raise exception 'Another merchant saw rider account';end if;
end $test$;
reset role;
set local role service_role;
do $test$
declare f record;
begin
 select * into f from combo_fixture;
 perform public.apply_giro_subscription(f.sale,'combo',f.m1::text||'@giro-test.invalid','SALE_REFUNDED',now(),null);
end $test$;
reset role;
set local role authenticated;
do $test$
declare f record;
begin
 select * into f from combo_fixture;
 perform set_config('request.jwt.claim.sub',f.m1::text,true);
 if (public.get_account_access()->>'merchant')::boolean or (public.get_account_access()->>'combo')::boolean then raise exception 'Refund kept merchant package active';end if;
 if not (public.get_account_access()->>'comboIntroUsed')::boolean then raise exception 'Refund reset introductory eligibility';end if;
 perform set_config('request.jwt.claim.sub',f.child::text,true);
 if (public.get_account_access()->>'rider')::boolean or exists(select 1 from public.deliveries where id=f.delivery) then raise exception 'Refund kept child rider active';end if;
 perform set_config('request.jwt.claim.sub',f.standalone::text,true);
 if not (public.get_account_access()->>'rider')::boolean then raise exception 'Package refund affected independent subscription';end if;
end $test$;
reset role;
rollback;
select 'PASS: package portal separation, one managed rider, username uniqueness, provisioning lease, private alias mapping, rate limits, independent deliveries, optional sharing, one-time introductory eligibility and refund of both seats. Fixtures rolled back.' as result;
