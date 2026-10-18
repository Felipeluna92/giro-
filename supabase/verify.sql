-- Run only against the dedicated Giro database after schema.sql.
-- All fixtures and test users are rolled back; no email or session is created.
begin;
create temporary table giro_test_fixture as select gen_random_uuid() a,gen_random_uuid() b,gen_random_uuid() place_a,gen_random_uuid() place_b,gen_random_uuid() delivery_a,gen_random_uuid() entry_a;
insert into auth.users(id,aud,role,email)
 select a,'authenticated','authenticated',a::text||'@giro-test.invalid' from giro_test_fixture
 union all select b,'authenticated','authenticated',b::text||'@giro-test.invalid' from giro_test_fixture;
grant select on giro_test_fixture to authenticated;
set local role authenticated;
do $test$
declare f record; payload jsonb; result jsonb; changed integer; rev integer; rejected boolean;
begin
 select * into f from giro_test_fixture;
 perform set_config('request.jwt.claim.sub',f.a::text,true);
 if (public.get_rider_workspace()->>'revision')::integer<>0 then raise exception 'Initial revision is not zero'; end if;
 payload:=jsonb_build_object(
  'preferences',jsonb_build_object('name','Teste A','city','Campinas, SP','goal',15000,'activeSince','2026-10-18T12:00:00.000Z'),
  'places',jsonb_build_array(jsonb_build_object('id',f.place_a,'name','Estabelecimento de teste','address','Rua Teste, 100','rule','percent','rate',8000)),
  'deliveries',jsonb_build_array(jsonb_build_object('id',f.delivery_a,'placeId',f.place_a,'order','TESTE-1','customer','Cliente fictício','phone','','address','Rua Teste, 100, Campinas, SP','complement','','notes','','customerFee',1000,'earnings',800,'orderTotal',5000,'cashCollected',5000,'retained',800,'tip',200,'payment','cash','status','delivered','createdAt','2026-10-18T12:00:00.000Z','completedAt','2026-10-18T13:00:00.000Z','day','2026-10-18','point',jsonb_build_object('lat',-22.9,'lon',-47.05,'label','Campinas'),'priority',false)),
  'movements',jsonb_build_array(jsonb_build_object('id',f.entry_a,'placeId',null,'day','2026-10-18','kind','expense','amount',300,'description','Combustível de teste'))
 );
 rev:=public.save_rider_workspace(payload,0);
 if rev<>1 then raise exception 'First save did not return revision 1'; end if;
 result:=public.get_rider_workspace();
 if result->'state'<>payload then raise exception 'Round-trip data mismatch: %',result->'state'; end if;
 if (select count(*) from public.deliveries)<>1 or (select count(*) from public.financial_entries)<>1 then raise exception 'Relational rows were not saved'; end if;
 -- A stale save must not overwrite a newer version.
 rejected:=false;
 begin perform public.save_rider_workspace(payload,0); exception when serialization_failure then rejected:=true; end;
 if not rejected then raise exception 'Stale revision was accepted'; end if;
 if (public.get_rider_workspace()->>'revision')::integer<>1 then raise exception 'Conflict changed revision'; end if;
 -- A failed child record must roll back the profile/revision as well.
 rejected:=false;
 begin perform public.save_rider_workspace(jsonb_set(payload,'{deliveries,0,retained}','900'::jsonb),1); exception when check_violation then rejected:=true; end;
 if not rejected then raise exception 'Invalid retained money was accepted'; end if;
 if (public.get_rider_workspace()->>'revision')::integer<>1 then raise exception 'Failed transaction advanced revision'; end if;
 -- UPDATE WITH CHECK must prevent assigning an account to another user.
 rejected:=false;
 begin update public.rider_accounts set owner_id=f.b where owner_id=f.a; exception when insufficient_privilege then rejected:=true; end;
 if not rejected then raise exception 'Account ownership reassignment was accepted'; end if;
 -- Switch identity with the same database role to test cross-user RLS.
 perform set_config('request.jwt.claim.sub',f.b::text,true);
 if (select count(*) from public.rider_accounts)<>0 or (select count(*) from public.establishments)<>0 or (select count(*) from public.deliveries)<>0 or (select count(*) from public.financial_entries)<>0 then raise exception 'User B could read user A records'; end if;
 if jsonb_array_length(public.get_rider_workspace()->'state'->'deliveries')<>0 then raise exception 'Read RPC leaked another user deliveries'; end if;
 update public.establishments set name='Not allowed' where id=f.place_a;
 get diagnostics changed=row_count;
 if changed<>0 then raise exception 'User B modified user A establishment'; end if;
 rejected:=false;
 begin insert into public.rider_accounts(owner_id) values(f.a); exception when insufficient_privilege then rejected:=true; end;
 if not rejected then raise exception 'Insert allowed a different owner'; end if;
 -- A delivery cannot reference another user's establishment, even with a known ID.
 rejected:=false;
 begin
  perform public.save_rider_workspace(jsonb_set(jsonb_set(jsonb_set(payload,'{places}',jsonb_build_array(jsonb_build_object('id',f.place_b,'name','Teste B','address','','rule','full','rate',0))),'{movements}','[]'::jsonb),'{deliveries,0,id}',to_jsonb(gen_random_uuid())),0);
 exception when foreign_key_violation then rejected:=true;
 end;
 if not rejected then raise exception 'Cross-owner establishment reference was accepted'; end if;
 if (public.get_rider_workspace()->>'revision')::integer<>0 then raise exception 'Failed user B write was not rolled back'; end if;
 -- Restoring a smaller backup deletes only the caller's omitted rows.
 perform set_config('request.jwt.claim.sub',f.a::text,true);
 payload:=jsonb_set(jsonb_set(payload,'{deliveries}','[]'::jsonb),'{movements}','[]'::jsonb);
 rev:=public.save_rider_workspace(payload,1);
 if rev<>2 or (select count(*) from public.deliveries)<>0 or (select count(*) from public.financial_entries)<>0 then raise exception 'Backup replacement failed'; end if;
 if (select count(*) from public.establishments)<>1 then raise exception 'Unchanged establishment was removed'; end if;
end;
$test$;
rollback;
select 'PASS: round trip, normalized rows, stale revision, atomic rollback, ownership checks, cross-user RLS, foreign keys and backup replacement. Fixtures rolled back.' as result;
