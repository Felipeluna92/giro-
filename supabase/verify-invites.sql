-- Fictitious accounts only. All fixtures and links are rolled back.
begin;
create temporary table invite_fixture as select gen_random_uuid() dual_user,gen_random_uuid() merchant_user,gen_random_uuid() place,gen_random_uuid() other_place,replace(gen_random_uuid()::text,'-','') expired_code;
insert into auth.users(id,aud,role,email) select u,'authenticated','authenticated',u::text||'@giro-test.invalid' from invite_fixture cross join lateral unnest(array[dual_user,merchant_user]) u;
insert into public.establishments(id,owner_id,name,rate_rule,rate_value) select place,dual_user,'Shared place','full',0 from invite_fixture union all select other_place,dual_user,'Private place','full',0 from invite_fixture;
insert into giro_private.merchants(owner_id,name) select merchant_user,'Other merchant' from invite_fixture;
insert into giro_private.merchant_invites(token_hash,merchant_id,expires_at) select encode(sha256(convert_to(expired_code,'UTF8')),'hex'),merchant_user,now()-interval '1 second' from invite_fixture;
insert into giro_private.administrators(user_id) select dual_user from invite_fixture union all select merchant_user from invite_fixture;
grant select on invite_fixture to authenticated;
set local role authenticated;
do $test$
declare f record; code text; spare_code text; denied boolean; link uuid; result jsonb;
begin
 select * into f from invite_fixture;
 perform set_config('request.jwt.claim.sub',f.dual_user::text,true);
 perform public.merchant_setup('Dual profile merchant','Test address');
 code:=public.merchant_invite();
 -- A new RPC request must establish its own invite context.
 perform set_config('giro.invite_code','',true);
 if public.rider_connect(E' \n'||upper(substr(code,1,16))||' '||upper(substr(code,17))||E'\t',f.place,'Dual profile rider')<>'Dual profile merchant' then raise exception 'Same-account connection failed'; end if;
 result:=public.rider_network();
 if jsonb_array_length(result)<>1 or result->0->>'placeId'<>f.place::text then raise exception 'Self-link not in rider network'; end if;
 link:=(result->0->>'id')::uuid;
 result:=public.merchant_dashboard(current_date);
 if jsonb_array_length(result->'riders')<>1 then raise exception 'Self-link not in merchant dashboard'; end if;
 if exists(select 1 from giro_private.merchant_invites where token_hash=encode(sha256(convert_to(code,'UTF8')),'hex') and used_at is null) then raise exception 'Invite not consumed'; end if;
 denied:=false;begin perform public.rider_connect(code,f.other_place,'Reuse');exception when sqlstate 'GRC03' then denied:=true;end;
 if not denied then raise exception 'Used code was accepted'; end if;
 denied:=false;begin perform public.rider_connect('invalid',f.other_place,'Invalid');exception when sqlstate 'GRC01' then denied:=true;end;
 if not denied then raise exception 'Malformed code not identified'; end if;
 denied:=false;begin perform public.rider_connect(replace(gen_random_uuid()::text,'-',''),f.other_place,'Unknown');exception when sqlstate 'GRC01' then denied:=true;end;
 if not denied then raise exception 'Unknown code not identified'; end if;
 denied:=false;begin perform public.rider_connect(f.expired_code,f.other_place,'Expired');exception when sqlstate 'GRC02' then denied:=true;end;
 if not denied then raise exception 'Expired code not identified'; end if;
 spare_code:=public.merchant_invite();
 denied:=false;begin perform public.rider_connect(spare_code,f.place,'Conflict');exception when check_violation then denied:=true;end;
 if not denied then raise exception 'Active establishment relinked'; end if;
 if not exists(select 1 from giro_private.merchant_invites where token_hash=encode(sha256(convert_to(spare_code,'UTF8')),'hex') and used_at is null) then raise exception 'Rejected operation consumed code'; end if;
 perform public.disconnect_merchant(link);
 if public.rider_connect(spare_code,f.place,'Reconnected')<>'Dual profile merchant' then raise exception 'Same-account reconnection failed'; end if;
 -- A fresh invite is still usable by a different rider account.
 spare_code:=public.merchant_invite();
 perform set_config('request.jwt.claim.sub',f.merchant_user::text,true);
 denied:=false;begin perform public.rider_connect(spare_code,f.other_place,'Intruder');exception when insufficient_privilege then denied:=true;end;
 if not denied then raise exception 'Another account claimed a place'; end if;
end $test$;
reset role;
rollback;
select 'PASS: dual-profile connection and reconnection, copy normalization, invalid/expired/used errors, failed operation preserves invite and place ownership. Fixtures rolled back.' as result;
