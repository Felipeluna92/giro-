begin;
create temporary table stripe_fixture as select gen_random_uuid() owner,gen_random_uuid() stranger;
insert into auth.users(id,aud,role,email,email_confirmed_at) select id,'authenticated','authenticated',id::text||'@giro-stripe.invalid',now() from stripe_fixture cross join lateral unnest(array[owner,stranger]) id;
grant select on stripe_fixture to service_role,authenticated;
set local role service_role;
do $test$
declare f record; lease jsonb; denied boolean; period_end timestamptz:=now()+interval '30 days';
begin
 select * into f from stripe_fixture;
 perform public.stripe_bind_customer(f.owner,'cus_giroFixture');
 if public.stripe_bind_customer(f.owner,'cus_giroOther')<>'cus_giroFixture' then raise exception 'Customer mapping overwritten';end if;
 lease:=public.stripe_checkout_reserve(f.owner,'combo');
 denied:=false;begin perform public.stripe_checkout_reserve(f.owner,'merchant');exception when lock_not_available then denied:=true;end;if not denied then raise exception 'Concurrent checkout accepted';end if;
 perform public.stripe_checkout_finish(f.owner,(lease->>'lease')::uuid,'cs_fixture');
 lease:=public.stripe_checkout_reserve(f.owner,'combo');if lease->>'session_id'<>'cs_fixture' then raise exception 'Checkout not reused';end if;
 perform public.stripe_checkout_finish(f.owner,(lease->>'lease')::uuid,null);
 perform public.stripe_apply_event('evt_pending','cus_giroFixture','sub_giroFixture','combo','incomplete',null,null,now(),jsonb_build_object('id','in_giroFixture','period_end',period_end,'paid',false));
 if exists(select 1 from giro_private.team_access where merchant_id=f.owner) then raise exception 'Pending invoice consumed promotion';end if;
 perform public.stripe_apply_event('evt_paid','cus_giroFixture','sub_giroFixture','combo','active',null,null,now(),jsonb_build_object('id','in_giroFixture','period_end',period_end,'paid',true,'amount_paid',3990));
 if not exists(select 1 from giro_private.team_access where merchant_id=f.owner and paid_until=period_end and intro_used) then raise exception 'Paid combo missing entitlement';end if;
 if public.stripe_apply_event('evt_paid','cus_giroFixture','sub_giroFixture','combo','active',null,null,now(),jsonb_build_object('id','in_giroFixture','period_end',period_end+interval '1 day','paid',true)) then raise exception 'Duplicate accepted';end if;
 perform public.stripe_apply_event('evt_old_pending','cus_giroFixture','sub_giroFixture','combo','incomplete',null,null,now(),null);
 if (select status from giro_private.subscriptions where sale_id='sub_giroFixture')<>'active' then raise exception 'Same-second pending regressed paid subscription';end if;
 perform public.stripe_apply_event('evt_cancel','cus_giroFixture','sub_giroFixture','combo','active',null,period_end,now()+interval '1 second',null);
 if not exists(select 1 from giro_private.subscriptions where sale_id='sub_giroFixture' and status='cancelled' and paid_until=period_end) then raise exception 'Cancel removed paid period';end if;
 perform public.stripe_apply_event('evt_refund','cus_giroFixture','sub_giroFixture','combo','active',null,period_end,now()+interval '2 seconds',jsonb_build_object('id','in_giroFixture','period_end',period_end,'paid',true,'refunded',true));
 perform public.stripe_apply_event('evt_paid_late','cus_giroFixture','sub_giroFixture','combo','active',null,null,now(),jsonb_build_object('id','in_giroFixture','period_end',period_end,'paid',true));
 if exists(select 1 from giro_private.team_access where merchant_id=f.owner and paid_until>now()) then raise exception 'Refunded period resurrected';end if;
 if not exists(select 1 from giro_private.team_access where merchant_id=f.owner and intro_used) then raise exception 'Refund reset promotion';end if;
 -- A newer, separately paid period may restore access; refunding the old invoice must not revoke it.
 perform public.stripe_apply_event('evt_renew','cus_giroFixture','sub_giroFixture','combo','active',null,null,now()+interval '3 seconds',jsonb_build_object('id','in_giroRenewal','period_end',period_end+interval '1 day','paid',true,'amount_paid',8980));
 perform public.stripe_apply_event('evt_old_refund','cus_giroFixture','sub_giroFixture','combo','active',null,null,now()+interval '4 seconds',jsonb_build_object('id','in_giroFixture','period_end',period_end,'refunded',true));
 if not exists(select 1 from giro_private.team_access where merchant_id=f.owner and paid_until=period_end+interval '1 day') then raise exception 'Old refund revoked newer payment';end if;
 perform public.stripe_apply_event('evt_dispute','cus_giroFixture','sub_giroFixture','combo','active',null,null,now()+interval '5 seconds',jsonb_build_object('id','in_giroRenewal','period_end',period_end+interval '1 day','disputed',true));
 if exists(select 1 from giro_private.team_access where merchant_id=f.owner and paid_until>now()) then raise exception 'Disputed period remained active';end if;
 perform public.stripe_apply_event('evt_won','cus_giroFixture','sub_giroFixture','combo','active',null,null,now()+interval '6 seconds',jsonb_build_object('id','in_giroRenewal','period_end',period_end+interval '1 day','disputed',false));
 if not exists(select 1 from giro_private.team_access where merchant_id=f.owner and paid_until>now()) then raise exception 'Won dispute did not restore paid period';end if;
 if public.stripe_apply_event('evt_unknown','cus_unknown','sub_unknown','combo','active',null,null,now(),null) then raise exception 'Unmapped customer accepted';end if;
end $test$;
reset role;
set local role authenticated;
do $test$
declare f record; denied boolean;
begin
 select * into f from stripe_fixture;perform set_config('request.jwt.claim.sub',f.owner::text,true);
 if not (public.get_account_access()->>'combo')::boolean then raise exception 'Owner missing combo access';end if;
 perform set_config('request.jwt.claim.sub',f.stranger::text,true);
 if (public.get_account_access()->>'combo')::boolean then raise exception 'Another user received access';end if;
 denied:=false;begin perform public.stripe_bind_customer(f.stranger,'cus_stolen');exception when insufficient_privilege then denied:=true;end;if not denied then raise exception 'User changed Stripe ownership';end if;
 denied:=false;begin perform public.stripe_apply_event('forged','cus_giroFixture','sub_giroFixture','combo','active',null,null,now(),null);exception when insufficient_privilege then denied:=true;end;if not denied then raise exception 'User forged webhook';end if;
 denied:=false;begin perform public.stripe_billing_status();exception when insufficient_privilege then denied:=true;end;if not denied then raise exception 'User read billing counters';end if;
end $test$;
reset role;
rollback;
select 'PASS: Stripe ownership, checkout locking, paid access, duplicates, event order, refunds, disputes, promotion and role restrictions. Fixtures rolled back.' as result;
