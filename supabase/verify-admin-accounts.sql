begin;
create temporary table admin_fixture as select gen_random_uuid() admin,gen_random_uuid() rider,gen_random_uuid() other,gen_random_uuid() paid,gen_random_uuid() managed;
grant select on admin_fixture to authenticated,service_role;
insert into auth.users(id,aud,role,email,email_confirmed_at,created_at) select u,'authenticated','authenticated',u::text||'@admin-fixture.invalid',now(),now() from admin_fixture cross join lateral unnest(array[admin,rider,other,paid,managed]) u;
insert into giro_private.administrators select admin from admin_fixture;
insert into giro_private.subscriptions(sale_id,portal,owner_id,buyer_email,status,paid_until,last_event_at) select 'admin-fixture-'||paid,'rider',paid,paid::text||'@admin-fixture.invalid','active',now()+interval '30 days',now() from admin_fixture;
set local role service_role;
do $$
declare f admin_fixture; d jsonb; denied boolean;
begin
 select * into f from admin_fixture;
 denied:=false;begin perform public.admin_accounts(f.other);exception when insufficient_privilege then denied:=true;end;if not denied then raise exception 'Non-admin could list accounts';end if;
 perform public.admin_trial_change(f.admin,f.rider,'rider',7);
 if not exists(select 1 from giro_private.account_trials where user_id=f.rider and expires_at=now()+interval '7 days') then raise exception 'Trial not created with correct duration';end if;
 denied:=false;begin perform public.admin_trial_change(f.admin,f.other,'rider',31);exception when invalid_parameter_value then denied:=true;end;if not denied then raise exception 'Unlimited trial accepted';end if;
 denied:=false;begin perform public.admin_trial_change(f.admin,f.paid,'merchant',7);exception when check_violation then denied:=true;end;if not denied then raise exception 'Paid account received trial';end if;
 if public.admin_trial_eligible(f.admin,f.admin) then raise exception 'Administrator eligible for trial';end if;
 d:=public.admin_accounts(f.admin,f.rider::text,'trial',1);
 if (d->>'total')::integer<>1 or jsonb_array_length(d->'users')<>1 then raise exception 'Trial search failed';end if;
 d:=public.admin_accounts(f.admin,f.paid::text,'paid',1);
 if (d->>'total')::integer<>1 then raise exception 'Paid classification failed';end if;
 perform public.admin_recovery_event(f.admin,f.rider,'recovery_requested');
 denied:=false;begin perform public.admin_recovery_event(f.admin,f.rider,'recovery_requested');exception when lock_not_available then denied:=true;end;if not denied then raise exception 'Recovery throttle failed';end if;
end $$;
set local role authenticated;
select set_config('request.jwt.claim.sub',(select rider::text from admin_fixture),true);
do $$
declare f admin_fixture; denied boolean;
begin
 select * into f from admin_fixture;
 if not giro_private.has_access('rider') or giro_private.has_access('merchant') or giro_private.has_access('combo') then raise exception 'Trial portal isolation failed';end if;
 if exists(select 1 from giro_private.account_trials where user_id<>f.rider) then raise exception 'Trial RLS leak';end if;
 denied:=false;begin perform public.admin_accounts(f.admin);exception when insufficient_privilege then denied:=true;end;if not denied then raise exception 'RPC exposed to browser';end if;
 denied:=false;begin perform public.admin_trial_change(f.admin,f.other,'merchant',7);exception when insufficient_privilege then denied:=true;end;if not denied then raise exception 'Trial grant exposed to browser';end if;
end $$;
set local role service_role;
select public.admin_trial_change(admin,rider,null,null,true) from admin_fixture;
set local role authenticated;
do $$begin if giro_private.has_access('rider') then raise exception 'Revoked trial still works';end if;end $$;
set local role service_role;
select public.admin_trial_change(admin,rider,'merchant',1) from admin_fixture;
update giro_private.account_trials set expires_at=now()-interval '1 second' where user_id=(select rider from admin_fixture);
set local role authenticated;
do $$begin if giro_private.has_access('merchant') then raise exception 'Expired trial still works';end if;end $$;
reset role;
do $$begin if not exists(select 1 from giro_private.subscriptions where owner_id=(select paid from admin_fixture) and status='active' and paid_until>now()) then raise exception 'Paid subscription changed';end if;end $$;
select 'PASS: admin gate, service-only RPCs, search, plan classification, bounded trial, portal isolation, RLS, recovery throttle, expiry, revoke and paid preservation; all fixtures rolled back.' result;
rollback;
