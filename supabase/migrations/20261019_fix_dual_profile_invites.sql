alter table giro_private.merchant_links drop constraint merchant_links_check;

create or replace function giro_private.rider_connect(p_code text,p_establishment uuid,p_name text) returns text
language plpgsql security invoker set search_path='' as $$
declare u uuid:=auth.uid(); m uuid; business text; changed integer; invite_used timestamptz; invite_expires timestamptz;
begin
 if u is null then raise insufficient_privilege; end if;
 p_code:=lower(regexp_replace(p_code,'[[:space:]]','','g'));
 if p_name is null or length(btrim(p_name)) not between 1 and 80 then raise invalid_parameter_value; end if;
 if p_code is null or p_code !~ '^[0-9a-f]{32}$' then raise exception using errcode='GRC01',message='Invite invalid'; end if;
 if not exists(select 1 from public.establishments where owner_id=u and id=p_establishment) then raise insufficient_privilege; end if;
 perform set_config('giro.invite_code',p_code,true);
 select merchant_id,used_at,expires_at into m,invite_used,invite_expires from giro_private.merchant_invites where token_hash=encode(sha256(convert_to(p_code,'UTF8')),'hex') for update;
 if m is null then raise exception using errcode='GRC01',message='Invite invalid'; end if;
 if invite_used is not null then raise exception using errcode='GRC03',message='Invite already used'; end if;
 if invite_expires<=now() then raise exception using errcode='GRC02',message='Invite expired'; end if;
 if exists(select 1 from giro_private.merchant_links where rider_id=u and establishment_id=p_establishment and active) then raise check_violation; end if;
 insert into giro_private.merchant_links(merchant_id,rider_id,establishment_id,rider_name) values(m,u,p_establishment,btrim(p_name))
 on conflict(rider_id,establishment_id) do update set merchant_id=excluded.merchant_id,rider_name=excluded.rider_name,active=true,linked_at=now() where not giro_private.merchant_links.active;
 get diagnostics changed=row_count;
 if changed<>1 then raise check_violation; end if;
 update giro_private.location_shares set expires_at=now() where rider_id=u and link_id in(select id from giro_private.merchant_links where rider_id=u and establishment_id=p_establishment);
 update giro_private.rider_locations set expires_at=now() where rider_id=u and link_id in(select id from giro_private.merchant_links where rider_id=u and establishment_id=p_establishment);
 update giro_private.merchant_invites set used_at=now() where token_hash=encode(sha256(convert_to(p_code,'UTF8')),'hex');
 select name into business from giro_private.merchants where owner_id=m;
 return business;
end $$;

