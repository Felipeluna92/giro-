-- Giro merchant portal. Cross-account access is restricted to explicit accepted links.
-- All functions are SECURITY INVOKER and cross-account reads obey accepted-link RLS. No administrative API key is needed by the application.
create schema if not exists giro_private;
revoke all on schema giro_private from public,anon;
grant usage on schema giro_private to authenticated;

create table giro_private.merchants (
 owner_id uuid primary key references auth.users(id) on delete cascade,
 name varchar(100) not null check(length(btrim(name))>0),
 address varchar(300) not null default '', updated_at timestamptz not null default now()
);
create table giro_private.merchant_links (
 id uuid primary key default gen_random_uuid(),
 merchant_id uuid not null references giro_private.merchants(owner_id) on delete cascade,
 rider_id uuid not null references auth.users(id) on delete cascade,
 establishment_id uuid not null,
 rider_name varchar(80) not null check(length(btrim(rider_name))>0),
 active boolean not null default true, linked_at timestamptz not null default now(),
 unique(rider_id,establishment_id),
 foreign key(rider_id,establishment_id) references public.establishments(owner_id,id) on delete cascade,
 check(merchant_id<>rider_id)
);
create index merchant_links_merchant_idx on giro_private.merchant_links(merchant_id) where active;
create table giro_private.merchant_invites (
 token_hash text primary key,
 merchant_id uuid not null references giro_private.merchants(owner_id) on delete cascade,
 expires_at timestamptz not null default now()+interval '7 days',
 used_at timestamptz, created_at timestamptz not null default now()
);
create index merchant_invites_merchant_idx on giro_private.merchant_invites(merchant_id);
create table giro_private.rider_locations (
 rider_id uuid primary key references auth.users(id) on delete cascade,
 link_id uuid not null references giro_private.merchant_links(id) on delete cascade,
 latitude double precision not null check(latitude between -90 and 90),
 longitude double precision not null check(longitude between -180 and 180),
 accuracy double precision not null check(accuracy between 0 and 50000),
 captured_at timestamptz not null, updated_at timestamptz not null default now(),
 expires_at timestamptz not null default now()+interval '90 seconds'
);
create index rider_locations_link_idx on giro_private.rider_locations(link_id);
create table giro_private.location_shares (
 rider_id uuid primary key references auth.users(id) on delete cascade,
 link_id uuid not null references giro_private.merchant_links(id) on delete cascade,
 session_id uuid not null default gen_random_uuid(),
 expires_at timestamptz not null default now()+interval '12 hours'
);
create index location_shares_link_idx on giro_private.location_shares(link_id);
alter table giro_private.location_shares enable row level security;
alter table giro_private.merchants enable row level security;
alter table giro_private.merchant_links enable row level security;
alter table giro_private.merchant_invites enable row level security;
alter table giro_private.rider_locations enable row level security;
revoke all on all tables in schema giro_private from public,anon,authenticated;


-- RLS is the authorization boundary even when functions are called directly.
grant select,insert,update on giro_private.merchants to authenticated;
grant select,insert on giro_private.merchant_invites to authenticated;
grant update(used_at) on giro_private.merchant_invites to authenticated;
grant select,insert,update on giro_private.merchant_links to authenticated;
grant select,insert,update,delete on giro_private.rider_locations,giro_private.location_shares to authenticated;
create policy merchant_links_read on giro_private.merchant_links for select to authenticated using(rider_id=(select auth.uid()) or merchant_id=(select auth.uid()));
create policy invites_read on giro_private.merchant_invites for select to authenticated using(merchant_id=(select auth.uid()) or token_hash=encode(sha256(convert_to(coalesce(current_setting('giro.invite_code',true),''),'UTF8')),'hex'));
create policy invites_insert on giro_private.merchant_invites for insert to authenticated with check(merchant_id=(select auth.uid()));
create policy invites_use on giro_private.merchant_invites for update to authenticated using(token_hash=encode(sha256(convert_to(coalesce(current_setting('giro.invite_code',true),''),'UTF8')),'hex')) with check(token_hash=encode(sha256(convert_to(coalesce(current_setting('giro.invite_code',true),''),'UTF8')),'hex'));
create policy merchants_read on giro_private.merchants for select to authenticated using(owner_id=(select auth.uid()) or exists(select 1 from giro_private.merchant_links l where l.merchant_id=owner_id and l.rider_id=(select auth.uid()) and l.active));
create policy merchants_insert on giro_private.merchants for insert to authenticated with check(owner_id=(select auth.uid()));
create policy merchants_update on giro_private.merchants for update to authenticated using(owner_id=(select auth.uid())) with check(owner_id=(select auth.uid()));
create policy links_insert on giro_private.merchant_links for insert to authenticated with check(rider_id=(select auth.uid()) and exists(select 1 from public.establishments e where e.owner_id=(select auth.uid()) and e.id=establishment_id) and exists(select 1 from giro_private.merchant_invites i where i.merchant_id=merchant_links.merchant_id and i.token_hash=encode(sha256(convert_to(coalesce(current_setting('giro.invite_code',true),''),'UTF8')),'hex') and i.expires_at>now() and i.used_at is null));
create policy links_update on giro_private.merchant_links for update to authenticated using(rider_id=(select auth.uid()) or merchant_id=(select auth.uid())) with check(rider_id=(select auth.uid()) or merchant_id=(select auth.uid()));
create policy shares_read on giro_private.location_shares for select to authenticated using(rider_id=(select auth.uid()) or exists(select 1 from giro_private.merchant_links l where l.id=link_id and l.merchant_id=(select auth.uid()) and l.active));
create policy shares_insert on giro_private.location_shares for insert to authenticated with check(rider_id=(select auth.uid()) and exists(select 1 from giro_private.merchant_links l where l.id=link_id and l.rider_id=(select auth.uid()) and l.active));
create policy shares_update on giro_private.location_shares for update to authenticated using(rider_id=(select auth.uid())) with check(rider_id=(select auth.uid()) and exists(select 1 from giro_private.merchant_links l where l.id=link_id and l.rider_id=(select auth.uid()) and l.active));
create policy shares_delete on giro_private.location_shares for delete to authenticated using(rider_id=(select auth.uid()));
create policy locations_read on giro_private.rider_locations for select to authenticated using(rider_id=(select auth.uid()) or exists(select 1 from giro_private.merchant_links l where l.id=link_id and l.merchant_id=(select auth.uid()) and l.active));
create policy locations_insert on giro_private.rider_locations for insert to authenticated with check(rider_id=(select auth.uid()) and exists(select 1 from giro_private.merchant_links l where l.id=link_id and l.rider_id=(select auth.uid()) and l.active));
create policy locations_update on giro_private.rider_locations for update to authenticated using(rider_id=(select auth.uid())) with check(rider_id=(select auth.uid()) and exists(select 1 from giro_private.merchant_links l where l.id=link_id and l.rider_id=(select auth.uid()) and l.active));
create policy locations_delete on giro_private.rider_locations for delete to authenticated using(rider_id=(select auth.uid()));
create policy merchant_deliveries_read on public.deliveries for select to authenticated using(exists(select 1 from giro_private.merchant_links l where l.merchant_id=(select auth.uid()) and l.rider_id=owner_id and l.establishment_id=deliveries.establishment_id and l.active));
create policy merchant_settlements_read on public.financial_entries for select to authenticated using(kind in ('payout','remittance') and exists(select 1 from giro_private.merchant_links l where l.merchant_id=(select auth.uid()) and l.rider_id=owner_id and l.establishment_id=financial_entries.establishment_id and l.active));

create function giro_private.guard_link_update() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if new.rider_id<>old.rider_id or new.establishment_id<>old.establishment_id or new.id<>old.id then raise insufficient_privilege; end if;
 if new.merchant_id<>old.merchant_id or new.rider_name<>old.rider_name or new.linked_at<>old.linked_at or (new.active and not old.active) then
  if new.rider_id<>auth.uid() or old.active or not exists(select 1 from giro_private.merchant_invites i where i.merchant_id=new.merchant_id and i.token_hash=encode(sha256(convert_to(coalesce(current_setting('giro.invite_code',true),''),'UTF8')),'hex') and i.expires_at>now() and i.used_at is null) then raise insufficient_privilege; end if;
 end if;
 return new;
end $$;
create trigger guard_link_update before update on giro_private.merchant_links for each row execute function giro_private.guard_link_update();

create function giro_private.stop_sharing_on_shift_end() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if new.active_since is null then
  delete from giro_private.location_shares where rider_id=new.owner_id;
  delete from giro_private.rider_locations where rider_id=new.owner_id;
 end if;
 return new;
end $$;
create trigger stop_sharing_on_shift_end after update of active_since on public.rider_accounts for each row execute function giro_private.stop_sharing_on_shift_end();


alter table public.deliveries add column if not exists departed_at timestamptz;

create function giro_private.merchant_setup(p_name text,p_address text) returns void
language plpgsql security invoker set search_path='' as $$
declare u uuid:=auth.uid();
begin
 if u is null then raise insufficient_privilege; end if;
 if p_name is null or length(btrim(p_name)) not between 1 and 100 or p_address is null or length(p_address)>300 then raise invalid_parameter_value; end if;
 insert into giro_private.merchants(owner_id,name,address) values(u,btrim(p_name),btrim(p_address))
 on conflict(owner_id) do update set name=excluded.name,address=excluded.address,updated_at=now();
end $$;

create function giro_private.merchant_invite() returns text
language plpgsql security invoker set search_path='' as $$
declare u uuid:=auth.uid(); token text:=replace(gen_random_uuid()::text,'-','');
begin
 if u is null or not exists(select 1 from giro_private.merchants where owner_id=u) then raise insufficient_privilege; end if;
 if (select count(*) from giro_private.merchant_invites where merchant_id=u and created_at>now()-interval '1 hour')>=50 then raise check_violation using message='Invite rate limit'; end if;
 insert into giro_private.merchant_invites(token_hash,merchant_id) values(encode(sha256(convert_to(token,'UTF8')),'hex'),u);
 return token;
end $$;

create function giro_private.rider_connect(p_code text,p_establishment uuid,p_name text) returns text
language plpgsql security invoker set search_path='' as $$
declare u uuid:=auth.uid(); m uuid; business text; changed integer;
begin
 if u is null then raise insufficient_privilege; end if;
 if p_name is null or length(btrim(p_name)) not between 1 and 80 or p_code is null or p_code !~ '^[0-9a-f]{32}$' then raise invalid_parameter_value; end if;
 if not exists(select 1 from public.establishments where owner_id=u and id=p_establishment) then raise insufficient_privilege; end if;
 perform set_config('giro.invite_code',p_code,true);
 select merchant_id into m from giro_private.merchant_invites where token_hash=encode(sha256(convert_to(p_code,'UTF8')),'hex') and used_at is null and expires_at>now() for update;
 if m is null or m=u then raise invalid_parameter_value; end if;
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

create function giro_private.disconnect_merchant(p_link uuid) returns void
language plpgsql security invoker set search_path='' as $$
declare u uuid:=auth.uid();
begin
 if u is null then raise insufficient_privilege; end if;
 update giro_private.merchant_links set active=false where id=p_link and (merchant_id=u or rider_id=u);
 if not found then raise insufficient_privilege; end if;
end $$;

create function giro_private.rider_network() returns jsonb
language plpgsql stable security invoker set search_path='' as $$
declare u uuid:=auth.uid();
begin
 if u is null then raise insufficient_privilege; end if;
 return coalesce((select jsonb_agg(jsonb_build_object('id',l.id,'merchantName',m.name,'placeId',l.establishment_id,'riderName',l.rider_name) order by l.linked_at) from giro_private.merchant_links l join giro_private.merchants m on m.owner_id=l.merchant_id where l.rider_id=u and l.active),'[]'::jsonb);
end $$;

create function giro_private.start_rider_location(p_link uuid) returns uuid
language plpgsql security invoker set search_path='' as $$
declare u uuid:=auth.uid(); token uuid:=gen_random_uuid();
begin
 if u is null or not exists(select 1 from giro_private.merchant_links where id=p_link and rider_id=u and active) then raise insufficient_privilege; end if;
 if not exists(select 1 from public.rider_accounts where owner_id=u and active_since is not null) then raise check_violation using message='Start shift first'; end if;
 insert into giro_private.location_shares(rider_id,link_id,session_id) values(u,p_link,token)
 on conflict(rider_id) do update set link_id=excluded.link_id,session_id=excluded.session_id,expires_at=now()+interval '12 hours';
 delete from giro_private.rider_locations where rider_id=u;
 return token;
end $$;

create function giro_private.share_rider_location(p_link uuid,p_session uuid,p_lat double precision,p_lon double precision,p_accuracy double precision,p_captured timestamptz) returns void
language plpgsql security invoker set search_path='' as $$
declare u uuid:=auth.uid();
begin
 if u is null or not exists(select 1 from giro_private.merchant_links where id=p_link and rider_id=u and active) then raise insufficient_privilege; end if;
 if not exists(select 1 from public.rider_accounts where owner_id=u and active_since is not null) then raise check_violation using message='Start shift first'; end if;
 perform 1 from giro_private.location_shares where rider_id=u and link_id=p_link and session_id=p_session and expires_at>now() for update;
 if not found then raise insufficient_privilege using message='Sharing session ended'; end if;
 if p_lat is null or p_lon is null or p_accuracy is null or p_lat not between -90 and 90 or p_lon not between -180 and 180 or p_accuracy not between 0 and 50000 then raise invalid_parameter_value; end if;
 if p_captured is null or p_captured<now()-interval '60 seconds' or p_captured>now()+interval '10 seconds' then raise invalid_parameter_value using message='Stale GPS sample'; end if;
 insert into giro_private.rider_locations(rider_id,link_id,latitude,longitude,accuracy,captured_at,updated_at,expires_at)
 values(u,p_link,p_lat,p_lon,p_accuracy,p_captured,now(),now()+interval '90 seconds')
 on conflict(rider_id) do update set link_id=excluded.link_id,latitude=excluded.latitude,longitude=excluded.longitude,accuracy=excluded.accuracy,captured_at=excluded.captured_at,updated_at=excluded.updated_at,expires_at=excluded.expires_at;
end $$;

create function giro_private.stop_rider_location() returns void
language plpgsql security invoker set search_path='' as $$
declare u uuid:=auth.uid();
begin
 if u is null then raise insufficient_privilege; end if;
 delete from giro_private.location_shares where rider_id=u;
 delete from giro_private.rider_locations where rider_id=u;
end $$;

create function giro_private.merchant_dashboard(p_day date) returns jsonb
language plpgsql stable security invoker set search_path='' as $$
declare u uuid:=auth.uid(); profile jsonb; riders jsonb; orders jsonb;
begin
 if u is null then raise insufficient_privilege; end if;
 if p_day is null then raise invalid_parameter_value; end if;
 select jsonb_build_object('name',name,'address',address) into profile from giro_private.merchants where owner_id=u;
 select coalesce(jsonb_agg(jsonb_build_object('id',l.id,'name',l.rider_name,
 'pending',(select count(*) from public.deliveries d where d.owner_id=l.rider_id and d.establishment_id=l.establishment_id and d.status='pending'),
 'completedToday',(select count(*) from public.deliveries d where d.owner_id=l.rider_id and d.establishment_id=l.establishment_id and d.status='delivered' and d.work_day=p_day),
 'feesToday',coalesce((select sum(d.earnings_cents) from public.deliveries d where d.owner_id=l.rider_id and d.establishment_id=l.establishment_id and d.status='delivered' and d.work_day=p_day),0),
 'due',coalesce((select sum(d.earnings_cents-d.retained_cents) from public.deliveries d where d.owner_id=l.rider_id and d.establishment_id=l.establishment_id and d.status='delivered'),0)-coalesce((select sum(f.amount_cents) from public.financial_entries f where f.owner_id=l.rider_id and f.establishment_id=l.establishment_id and f.kind='payout'),0),
 'cashDue',coalesce((select sum(d.cash_collected_cents-d.retained_cents) from public.deliveries d where d.owner_id=l.rider_id and d.establishment_id=l.establishment_id and d.status='delivered'),0)-coalesce((select sum(f.amount_cents) from public.financial_entries f where f.owner_id=l.rider_id and f.establishment_id=l.establishment_id and f.kind='remittance'),0),
 'location',case when loc.expires_at>now() and sharing.expires_at>now() then jsonb_build_object('lat',loc.latitude,'lon',loc.longitude,'accuracy',loc.accuracy,'capturedAt',loc.captured_at,'updatedAt',loc.updated_at,'expiresAt',loc.expires_at) else null end
 ) order by l.rider_name),'[]'::jsonb) into riders
 from giro_private.merchant_links l left join giro_private.rider_locations loc on loc.link_id=l.id and loc.rider_id=l.rider_id left join giro_private.location_shares sharing on sharing.rider_id=l.rider_id and sharing.link_id=l.id
 where l.merchant_id=u and l.active;
 select coalesce(jsonb_agg(t.item order by t.created desc),'[]'::jsonb) into orders from (
 select d.created_at created,jsonb_build_object('id',d.id,'linkId',l.id,'riderName',l.rider_name,'order',d.order_number,'customer',d.customer_name,'address',d.address,'fee',d.earnings_cents,'orderTotal',d.order_total_cents,'payment',d.payment,'status',d.status,'day',d.work_day,'departedAt',d.departed_at,'completedAt',d.completed_at) item
 from giro_private.merchant_links l join public.deliveries d on d.owner_id=l.rider_id and d.establishment_id=l.establishment_id
 where l.merchant_id=u and l.active and (d.work_day=p_day or d.status='pending') order by d.created_at desc limit 500
 ) t;
 return jsonb_build_object('profile',profile,'riders',riders,'deliveries',orders,'serverTime',now());
end $$;

-- Revoke the default PUBLIC function execution before exposing narrow wrappers.
revoke all on all functions in schema giro_private from public,anon;
grant execute on all functions in schema giro_private to authenticated;
create function public.merchant_setup(p_name text,p_address text) returns void language sql security invoker set search_path='' as $$ select giro_private.merchant_setup(p_name,p_address) $$;
create function public.merchant_invite() returns text language sql security invoker set search_path='' as $$ select giro_private.merchant_invite() $$;
create function public.rider_connect(p_code text,p_establishment uuid,p_name text) returns text language sql security invoker set search_path='' as $$ select giro_private.rider_connect(p_code,p_establishment,p_name) $$;
create function public.disconnect_merchant(p_link uuid) returns void language sql security invoker set search_path='' as $$ select giro_private.disconnect_merchant(p_link) $$;
create function public.rider_network() returns jsonb language sql stable security invoker set search_path='' as $$ select giro_private.rider_network() $$;
create function public.start_rider_location(p_link uuid) returns uuid language sql security invoker set search_path='' as $$ select giro_private.start_rider_location(p_link) $$;
create function public.share_rider_location(p_link uuid,p_session uuid,p_lat double precision,p_lon double precision,p_accuracy double precision,p_captured timestamptz) returns void language sql security invoker set search_path='' as $$ select giro_private.share_rider_location(p_link,p_session,p_lat,p_lon,p_accuracy,p_captured) $$;
create function public.stop_rider_location() returns void language sql security invoker set search_path='' as $$ select giro_private.stop_rider_location() $$;
create function public.merchant_dashboard(p_day date) returns jsonb language sql stable security invoker set search_path='' as $$ select giro_private.merchant_dashboard(p_day) $$;
revoke all on function public.merchant_setup(text,text),public.merchant_invite(),public.rider_connect(text,uuid,text),public.disconnect_merchant(uuid),public.rider_network(),public.start_rider_location(uuid),public.share_rider_location(uuid,uuid,double precision,double precision,double precision,timestamptz),public.stop_rider_location(),public.merchant_dashboard(date) from public,anon;
grant execute on function public.merchant_setup(text,text),public.merchant_invite(),public.rider_connect(text,uuid,text),public.disconnect_merchant(uuid),public.rider_network(),public.start_rider_location(uuid),public.share_rider_location(uuid,uuid,double precision,double precision,double precision,timestamptz),public.stop_rider_location(),public.merchant_dashboard(date) to authenticated;

-- Preserve the existing rider workspace contract and synchronize departure status.
create or replace function public.get_rider_workspace() returns jsonb language sql stable security invoker set search_path='' as $$
 select jsonb_build_object('revision',coalesce(a.revision,0),'state',jsonb_build_object(
 'preferences',jsonb_build_object('name',coalesce(a.display_name,''),'city',coalesce(a.city,''),'goal',coalesce(a.goal_cents,15000),'activeSince',case when a.active_since is null then null else to_char(a.active_since at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') end),
 'places',coalesce((select jsonb_agg(jsonb_build_object('id',e.id,'name',e.name,'address',e.address,'rule',e.rate_rule,'rate',e.rate_value) order by e.created_at,e.id) from public.establishments e where e.owner_id=(select auth.uid())),'[]'::jsonb),
 'deliveries',coalesce((select jsonb_agg(jsonb_build_object(
 'id',d.id,'placeId',d.establishment_id,'order',d.order_number,'customer',d.customer_name,'phone',d.phone,'address',d.address,'complement',d.complement,'notes',d.notes,
 'customerFee',d.customer_fee_cents,'earnings',d.earnings_cents,'orderTotal',d.order_total_cents,'cashCollected',d.cash_collected_cents,'retained',d.retained_cents,'tip',d.tip_cents,
 'payment',d.payment,'status',d.status,'day',d.work_day::text,'priority',d.priority,
 'departedAt',case when d.departed_at is null then null else to_char(d.departed_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') end,
 'createdAt',to_char(d.created_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
 'completedAt',case when d.completed_at is null then null else to_char(d.completed_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') end,
 'point',case when d.latitude is null then null else jsonb_build_object('lat',d.latitude,'lon',d.longitude,'label',d.location_label) end
 ) order by d.created_at,d.id) from public.deliveries d where d.owner_id=(select auth.uid())),'[]'::jsonb),
 'movements',coalesce((select jsonb_agg(jsonb_build_object('id',f.id,'placeId',f.establishment_id,'day',f.work_day::text,'kind',f.kind,'amount',f.amount_cents,'description',f.description) order by f.work_day,f.id) from public.financial_entries f where f.owner_id=(select auth.uid())),'[]'::jsonb)
 )) from (select 1) singleton left join public.rider_accounts a on a.owner_id=(select auth.uid());
$$;

-- One transaction for the profile, deliveries and financial records. A stale
-- revision raises 40001 and rolls back the whole write, including deletions.
create or replace function public.save_rider_workspace(p_data jsonb,p_expected_revision integer)
returns integer language plpgsql security invoker set search_path='' as $$
declare v_uid uuid:=auth.uid(); v_revision integer; v_count integer;
begin
 if v_uid is null then raise insufficient_privilege using message='Authentication required'; end if;
 if p_expected_revision is null or p_expected_revision<0 or p_data is null or jsonb_typeof(p_data)<>'object' or octet_length(p_data::text)>3000000
 or jsonb_typeof(p_data->'preferences') is distinct from 'object'
 or jsonb_typeof(p_data->'places') is distinct from 'array'
 or jsonb_typeof(p_data->'deliveries') is distinct from 'array'
 or jsonb_typeof(p_data->'movements') is distinct from 'array' then
  raise invalid_parameter_value using message='Invalid workspace';
 end if;
 if jsonb_array_length(p_data->'places')>100 or jsonb_array_length(p_data->'deliveries')>3000 or jsonb_array_length(p_data->'movements')>3000 then
  raise invalid_parameter_value using message='Workspace limit exceeded';
 end if;
 if p_expected_revision=0 then
  insert into public.rider_accounts(owner_id) values(v_uid) on conflict(owner_id) do nothing;
 end if;
 update public.rider_accounts set display_name=p_data->'preferences'->>'name',city=p_data->'preferences'->>'city',
 goal_cents=(p_data->'preferences'->>'goal')::integer,active_since=(p_data->'preferences'->>'activeSince')::timestamptz,
 revision=revision+1,updated_at=now() where owner_id=v_uid and revision=p_expected_revision returning revision into v_revision;
 if v_revision is null then raise serialization_failure using message='Workspace revision conflict'; end if;

 insert into public.establishments(id,owner_id,name,address,rate_rule,rate_value)
 select (x->>'id')::uuid,v_uid,x->>'name',x->>'address',x->>'rule',(x->>'rate')::integer from jsonb_array_elements(p_data->'places') x
 on conflict(id) do update set name=excluded.name,address=excluded.address,rate_rule=excluded.rate_rule,rate_value=excluded.rate_value,updated_at=now()
 where public.establishments.owner_id=v_uid;
 get diagnostics v_count=row_count;
 if v_count<>jsonb_array_length(p_data->'places') then raise insufficient_privilege using message='Establishment ownership conflict'; end if;

 insert into public.deliveries(id,owner_id,establishment_id,order_number,customer_name,phone,address,complement,notes,
 customer_fee_cents,earnings_cents,order_total_cents,cash_collected_cents,retained_cents,tip_cents,payment,status,work_day,priority,latitude,longitude,location_label,created_at,completed_at,departed_at)
 select (x->>'id')::uuid,v_uid,(x->>'placeId')::uuid,x->>'order',x->>'customer',x->>'phone',x->>'address',x->>'complement',x->>'notes',
 (x->>'customerFee')::integer,(x->>'earnings')::integer,(x->>'orderTotal')::integer,(x->>'cashCollected')::integer,(x->>'retained')::integer,(x->>'tip')::integer,
 x->>'payment',x->>'status',(x->>'day')::date,(x->>'priority')::boolean,
 (x->'point'->>'lat')::double precision,(x->'point'->>'lon')::double precision,x->'point'->>'label',(x->>'createdAt')::timestamptz,(x->>'completedAt')::timestamptz,(x->>'departedAt')::timestamptz
 from jsonb_array_elements(p_data->'deliveries') x
 on conflict(id) do update set establishment_id=excluded.establishment_id,order_number=excluded.order_number,customer_name=excluded.customer_name,phone=excluded.phone,
 address=excluded.address,complement=excluded.complement,notes=excluded.notes,customer_fee_cents=excluded.customer_fee_cents,earnings_cents=excluded.earnings_cents,
 order_total_cents=excluded.order_total_cents,cash_collected_cents=excluded.cash_collected_cents,retained_cents=excluded.retained_cents,tip_cents=excluded.tip_cents,
 payment=excluded.payment,status=excluded.status,work_day=excluded.work_day,priority=excluded.priority,latitude=excluded.latitude,longitude=excluded.longitude,
 location_label=excluded.location_label,created_at=excluded.created_at,completed_at=excluded.completed_at,departed_at=excluded.departed_at,updated_at=now()
 where public.deliveries.owner_id=v_uid;
 get diagnostics v_count=row_count;
 if v_count<>jsonb_array_length(p_data->'deliveries') then raise insufficient_privilege using message='Delivery ownership conflict'; end if;

 insert into public.financial_entries(id,owner_id,establishment_id,work_day,kind,amount_cents,description)
 select (x->>'id')::uuid,v_uid,(x->>'placeId')::uuid,(x->>'day')::date,x->>'kind',(x->>'amount')::integer,x->>'description'
 from jsonb_array_elements(p_data->'movements') x
 on conflict(id) do update set establishment_id=excluded.establishment_id,work_day=excluded.work_day,kind=excluded.kind,amount_cents=excluded.amount_cents,description=excluded.description,updated_at=now()
 where public.financial_entries.owner_id=v_uid;
 get diagnostics v_count=row_count;
 if v_count<>jsonb_array_length(p_data->'movements') then raise insufficient_privilege using message='Financial entry ownership conflict'; end if;

 delete from public.financial_entries f where f.owner_id=v_uid and not exists(select 1 from jsonb_array_elements(p_data->'movements') x where (x->>'id')::uuid=f.id);
 delete from public.deliveries d where d.owner_id=v_uid and not exists(select 1 from jsonb_array_elements(p_data->'deliveries') x where (x->>'id')::uuid=d.id);
 delete from public.establishments e where e.owner_id=v_uid and not exists(select 1 from jsonb_array_elements(p_data->'places') x where (x->>'id')::uuid=e.id);
 return v_revision;
end;
$$;
revoke all on function public.get_rider_workspace() from public,anon;
revoke all on function public.save_rider_workspace(jsonb,integer) from public,anon;
grant execute on function public.get_rider_workspace() to authenticated;
grant execute on function public.save_rider_workspace(jsonb,integer) to authenticated;
