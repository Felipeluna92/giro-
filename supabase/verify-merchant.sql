-- Transactional fixtures only: no sessions, messages or real user changes.
begin;
create temporary table merchant_fixture as select gen_random_uuid() m1,gen_random_uuid() m2,gen_random_uuid() r1,gen_random_uuid() r2,gen_random_uuid() p1,gen_random_uuid() p2,gen_random_uuid() other_place,gen_random_uuid() d1,gen_random_uuid() d2,gen_random_uuid() other_delivery;
insert into auth.users(id,aud,role,email) select u,'authenticated','authenticated',u::text||'@giro-test.invalid' from merchant_fixture cross join lateral unnest(array[m1,m2,r1,r2]) u;
insert into public.rider_accounts(owner_id,display_name,active_since) select r1,'Rider A',now() from merchant_fixture union all select r2,'Rider B',now() from merchant_fixture;
insert into public.establishments(id,owner_id,name,rate_rule,rate_value) select p1,r1,'Linked place','full',0 from merchant_fixture union all select other_place,r1,'Private place','full',0 from merchant_fixture union all select p2,r2,'Other merchant place','full',0 from merchant_fixture;
insert into public.deliveries(id,owner_id,establishment_id,order_number,address,customer_fee_cents,earnings_cents,order_total_cents,cash_collected_cents,retained_cents,tip_cents,payment,status,work_day,created_at,completed_at,departed_at)
select d1,r1,p1,'A-1','Rua Teste, 100',1200,800,5000,5000,200,300,'cash','delivered',(now() at time zone 'America/Sao_Paulo')::date,now(),now(),now() from merchant_fixture
union all select d2,r1,p1,'A-2','Rua Teste, 200',1200,800,5000,0,0,0,'paid','pending',(now() at time zone 'America/Sao_Paulo')::date,now(),null,now() from merchant_fixture
union all select other_delivery,r1,other_place,'PRIVATE','Rua Privada, 300',9000,9000,9000,0,0,0,'paid','delivered',(now() at time zone 'America/Sao_Paulo')::date,now(),now(),null from merchant_fixture;
insert into public.financial_entries(id,owner_id,establishment_id,work_day,kind,amount_cents,description)
select gen_random_uuid(),r1,p1,current_date,'payout',300,'Payment' from merchant_fixture
union all select gen_random_uuid(),r1,p1,current_date,'remittance',1000,'Cash returned' from merchant_fixture
union all select gen_random_uuid(),r1,p1,current_date,'expense',500,'Private fuel expense' from merchant_fixture;
insert into giro_private.administrators(user_id) select u from merchant_fixture cross join lateral unnest(array[m1,m2,r1,r2]) u;
grant select on merchant_fixture to authenticated;
set local role authenticated;
do $test$
declare f record; code text; code2 text; result jsonb; link1 uuid; link2 uuid; token uuid; denied boolean; changed integer; selected_day date:=(now() at time zone 'America/Sao_Paulo')::date;
begin
 select * into f from merchant_fixture;
 perform set_config('request.jwt.claim.sub',f.m1::text,true);
 perform public.merchant_setup('Merchant A','Test address');
 if jsonb_array_length(public.merchant_dashboard(selected_day)->'deliveries')<>0 then raise exception 'Unlinked deliveries exposed'; end if;
 code:=public.merchant_invite();
 perform set_config('request.jwt.claim.sub',f.m2::text,true);
 perform public.merchant_setup('Merchant B','Other address'); code2:=public.merchant_invite();
 perform set_config('request.jwt.claim.sub',f.r2::text,true);
 denied:=false;begin perform public.rider_connect(code,f.p1,'Intruder');exception when insufficient_privilege then denied:=true;end;
 if not denied then raise exception 'Another rider establishment was accepted'; end if;
 perform public.rider_connect(code2,f.p2,'Rider B');
 link2:=(public.rider_network()->0->>'id')::uuid;
 perform set_config('request.jwt.claim.sub',f.r1::text,true);
 if public.rider_connect(code,f.p1,'Rider A')<>'Merchant A' then raise exception 'Wrong merchant linked'; end if;
 link1:=(public.rider_network()->0->>'id')::uuid;
 denied:=false;begin perform public.rider_connect(code,f.other_place,'Reuse');exception when sqlstate 'GRC03' then denied:=true;end;
 if not denied then raise exception 'Single-use invite reused'; end if;
 denied:=false;begin update giro_private.merchant_links set merchant_id=f.m2 where id=link1;exception when insufficient_privilege then denied:=true;end;
 if not denied then raise exception 'Merchant identity reassignment accepted'; end if;
 token:=public.start_rider_location(link1);
 perform public.share_rider_location(link1,token,-22.7,-47.6,12,now());
 perform set_config('request.jwt.claim.sub',f.m1::text,true);
 result:=public.merchant_dashboard(selected_day);
 if jsonb_array_length(result->'riders')<>1 or jsonb_array_length(result->'deliveries')<>2 then raise exception 'Wrong merchant dataset: %',result;end if;
 if (result->'riders'->0->>'due')::integer<>300 then raise exception 'Incorrect fee balance: %',result;end if;
 if (result->'riders'->0->>'cashDue')::integer<>3800 then raise exception 'Customer cash was mixed with earnings';end if;
 if (result->'riders'->0->>'feesToday')::integer<>800 then raise exception 'Tips, personal expenses or pending fees included';end if;
 if result->'riders'->0->'location'='null'::jsonb then raise exception 'Active GPS missing';end if;
 if exists(select 1 from public.deliveries where id=f.other_delivery) then raise exception 'Other business delivery leaked through RLS';end if;
 if exists(select 1 from public.financial_entries where owner_id=f.r1 and kind='expense') then raise exception 'Personal expense leaked';end if;
 update public.deliveries set earnings_cents=1 where id=f.d1;get diagnostics changed=row_count;
 if changed<>0 then raise exception 'Merchant altered rider earnings';end if;
 perform set_config('request.jwt.claim.sub',f.m2::text,true);
 if jsonb_array_length(public.merchant_dashboard(selected_day)->'deliveries')<>0 then raise exception 'Cross-merchant read';end if;
 if exists(select 1 from giro_private.rider_locations where rider_id=f.r1) then raise exception 'Cross-merchant GPS leak';end if;
 perform set_config('request.jwt.claim.sub',f.r2::text,true);
 denied:=false;begin perform public.share_rider_location(link1,token,-20,-45,1,now());exception when insufficient_privilege then denied:=true;end;
 if not denied then raise exception 'Another rider sent GPS';end if;
 denied:=false;begin perform public.disconnect_merchant(link1);exception when insufficient_privilege then denied:=true;end;
 if not denied then raise exception 'Another rider revoked link';end if;
 perform set_config('request.jwt.claim.sub',f.r1::text,true);
 perform public.stop_rider_location();
 denied:=false;begin perform public.share_rider_location(link1,token,-20,-45,1,now());exception when insufficient_privilege then denied:=true;end;
 if not denied then raise exception 'A late GPS request revived a stopped session';end if;
 token:=public.start_rider_location(link1);perform public.share_rider_location(link1,token,-22.7,-47.6,12,now());
 update public.rider_accounts set active_since=null where owner_id=f.r1;
 if exists(select 1 from giro_private.rider_locations where rider_id=f.r1) then raise exception 'Ending shift kept GPS visible';end if;
 denied:=false;begin perform public.start_rider_location(link1);exception when check_violation then denied:=true;end;
 if not denied then raise exception 'GPS started without shift';end if;
 perform set_config('request.jwt.claim.sub',f.m1::text,true);
 perform public.disconnect_merchant(link1);
 if jsonb_array_length(public.merchant_dashboard(selected_day)->'deliveries')<>0 then raise exception 'Revoked link kept deliveries visible';end if;
 perform set_config('request.jwt.claim.sub',f.r1::text,true);
 if jsonb_array_length(public.rider_network())<>0 then raise exception 'Revoked link still in network';end if;
end $test$;
reset role;
rollback;
select 'PASS: merchant isolation, invite ownership and single use, immutable links, balances, no merchant edits, GPS ownership, late update rejection, stop on shift end and revocation. Fixtures rolled back.' as result;
