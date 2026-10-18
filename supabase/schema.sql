-- Giro initial relational schema. Applied to the dedicated Giro project only.
-- Amounts are integer cents. RLS and SECURITY INVOKER apply to every API call.
create table public.rider_accounts (
 owner_id uuid primary key references auth.users(id) on delete cascade,
 display_name varchar(80) not null default '', city varchar(100) not null default '',
 goal_cents integer not null default 15000 check (goal_cents between 0 and 100000000),
 active_since timestamptz, revision integer not null default 0 check (revision >= 0),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.establishments (
 id uuid primary key, owner_id uuid not null references auth.users(id) on delete cascade,
 name varchar(100) not null check (length(btrim(name)) > 0), address varchar(300) not null default '',
 rate_rule text not null check (rate_rule in ('full','fixed','percent')),
 rate_value integer not null default 0 check (rate_value between 0 and 100000000),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 unique(owner_id,id), check (rate_rule <> 'percent' or rate_value <= 10000)
);
create table public.deliveries (
 id uuid primary key, owner_id uuid not null references auth.users(id) on delete cascade,
 establishment_id uuid not null, order_number varchar(60) not null default '',
 customer_name varchar(300) not null default '', phone varchar(30) not null default '',
 address varchar(400) not null check (length(address) >= 5), complement varchar(300) not null default '', notes varchar(1500) not null default '',
 customer_fee_cents integer not null check (customer_fee_cents between 0 and 100000000),
 earnings_cents integer not null check (earnings_cents between 0 and 100000000),
 order_total_cents integer not null check (order_total_cents between 0 and 100000000),
 cash_collected_cents integer not null default 0 check (cash_collected_cents between 0 and 100000000),
 retained_cents integer not null default 0 check (retained_cents between 0 and 100000000),
 tip_cents integer not null default 0 check (tip_cents between 0 and 100000000),
 payment text not null check (payment in ('paid','cash','card','pix')),
 status text not null default 'pending' check (status in ('pending','delivered','cancelled')),
 work_day date not null, priority boolean not null default false,
 latitude double precision, longitude double precision, location_label varchar(300),
 created_at timestamptz not null, completed_at timestamptz, updated_at timestamptz not null default now(),
 foreign key(owner_id,establishment_id) references public.establishments(owner_id,id),
 check (retained_cents <= cash_collected_cents and retained_cents <= earnings_cents),
 check ((latitude is null and longitude is null and location_label is null) or
        (latitude is not null and longitude is not null and location_label is not null and latitude between -90 and 90 and longitude between -180 and 180))
);
create index deliveries_owner_day_idx on public.deliveries(owner_id,work_day);
create index deliveries_owner_status_idx on public.deliveries(owner_id,status);
create index deliveries_owner_establishment_idx on public.deliveries(owner_id,establishment_id);
create table public.financial_entries (
 id uuid primary key, owner_id uuid not null references auth.users(id) on delete cascade,
 establishment_id uuid, work_day date not null,
 kind text not null check (kind in ('expense','extra','payout','remittance')),
 amount_cents integer not null check (amount_cents between 0 and 100000000),
 description varchar(200) not null check (length(btrim(description)) > 0),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 foreign key(owner_id,establishment_id) references public.establishments(owner_id,id),
 check (kind not in ('payout','remittance') or establishment_id is not null)
);
create index financial_entries_owner_day_idx on public.financial_entries(owner_id,work_day);
create index financial_entries_owner_establishment_idx on public.financial_entries(owner_id,establishment_id);

alter table public.rider_accounts enable row level security;
alter table public.establishments enable row level security;
alter table public.deliveries enable row level security;
alter table public.financial_entries enable row level security;
revoke all on public.rider_accounts,public.establishments,public.deliveries,public.financial_entries from anon;
grant select,insert,update,delete on public.rider_accounts,public.establishments,public.deliveries,public.financial_entries to authenticated;

create policy rider_accounts_select on public.rider_accounts for select to authenticated using ((select auth.uid())=owner_id);
create policy rider_accounts_insert on public.rider_accounts for insert to authenticated with check ((select auth.uid())=owner_id);
create policy rider_accounts_update on public.rider_accounts for update to authenticated using ((select auth.uid())=owner_id) with check ((select auth.uid())=owner_id);
create policy rider_accounts_delete on public.rider_accounts for delete to authenticated using ((select auth.uid())=owner_id);
create policy establishments_select on public.establishments for select to authenticated using ((select auth.uid())=owner_id);
create policy establishments_insert on public.establishments for insert to authenticated with check ((select auth.uid())=owner_id);
create policy establishments_update on public.establishments for update to authenticated using ((select auth.uid())=owner_id) with check ((select auth.uid())=owner_id);
create policy establishments_delete on public.establishments for delete to authenticated using ((select auth.uid())=owner_id);
create policy deliveries_select on public.deliveries for select to authenticated using ((select auth.uid())=owner_id);
create policy deliveries_insert on public.deliveries for insert to authenticated with check ((select auth.uid())=owner_id);
create policy deliveries_update on public.deliveries for update to authenticated using ((select auth.uid())=owner_id) with check ((select auth.uid())=owner_id);
create policy deliveries_delete on public.deliveries for delete to authenticated using ((select auth.uid())=owner_id);
create policy financial_entries_select on public.financial_entries for select to authenticated using ((select auth.uid())=owner_id);
create policy financial_entries_insert on public.financial_entries for insert to authenticated with check ((select auth.uid())=owner_id);
create policy financial_entries_update on public.financial_entries for update to authenticated using ((select auth.uid())=owner_id) with check ((select auth.uid())=owner_id);
create policy financial_entries_delete on public.financial_entries for delete to authenticated using ((select auth.uid())=owner_id);

-- Assemble the UI's data contract from normalized tables in one consistent read.
create function public.get_rider_workspace() returns jsonb language sql stable security invoker set search_path='' as $$
 select jsonb_build_object('revision',coalesce(a.revision,0),'state',jsonb_build_object(
 'preferences',jsonb_build_object('name',coalesce(a.display_name,''),'city',coalesce(a.city,''),'goal',coalesce(a.goal_cents,15000),'activeSince',case when a.active_since is null then null else to_char(a.active_since at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') end),
 'places',coalesce((select jsonb_agg(jsonb_build_object('id',e.id,'name',e.name,'address',e.address,'rule',e.rate_rule,'rate',e.rate_value) order by e.created_at,e.id) from public.establishments e where e.owner_id=(select auth.uid())),'[]'::jsonb),
 'deliveries',coalesce((select jsonb_agg(jsonb_build_object(
 'id',d.id,'placeId',d.establishment_id,'order',d.order_number,'customer',d.customer_name,'phone',d.phone,'address',d.address,'complement',d.complement,'notes',d.notes,
 'customerFee',d.customer_fee_cents,'earnings',d.earnings_cents,'orderTotal',d.order_total_cents,'cashCollected',d.cash_collected_cents,'retained',d.retained_cents,'tip',d.tip_cents,
 'payment',d.payment,'status',d.status,'day',d.work_day::text,'priority',d.priority,
 'createdAt',to_char(d.created_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
 'completedAt',case when d.completed_at is null then null else to_char(d.completed_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') end,
 'point',case when d.latitude is null then null else jsonb_build_object('lat',d.latitude,'lon',d.longitude,'label',d.location_label) end
 ) order by d.created_at,d.id) from public.deliveries d where d.owner_id=(select auth.uid())),'[]'::jsonb),
 'movements',coalesce((select jsonb_agg(jsonb_build_object('id',f.id,'placeId',f.establishment_id,'day',f.work_day::text,'kind',f.kind,'amount',f.amount_cents,'description',f.description) order by f.work_day,f.id) from public.financial_entries f where f.owner_id=(select auth.uid())),'[]'::jsonb)
 )) from (select 1) singleton left join public.rider_accounts a on a.owner_id=(select auth.uid());
$$;

-- One transaction for the profile, deliveries and financial records. A stale
-- revision raises 40001 and rolls back the whole write, including deletions.
create function public.save_rider_workspace(p_data jsonb,p_expected_revision integer)
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
 customer_fee_cents,earnings_cents,order_total_cents,cash_collected_cents,retained_cents,tip_cents,payment,status,work_day,priority,latitude,longitude,location_label,created_at,completed_at)
 select (x->>'id')::uuid,v_uid,(x->>'placeId')::uuid,x->>'order',x->>'customer',x->>'phone',x->>'address',x->>'complement',x->>'notes',
 (x->>'customerFee')::integer,(x->>'earnings')::integer,(x->>'orderTotal')::integer,(x->>'cashCollected')::integer,(x->>'retained')::integer,(x->>'tip')::integer,
 x->>'payment',x->>'status',(x->>'day')::date,(x->>'priority')::boolean,
 (x->'point'->>'lat')::double precision,(x->'point'->>'lon')::double precision,x->'point'->>'label',(x->>'createdAt')::timestamptz,(x->>'completedAt')::timestamptz
 from jsonb_array_elements(p_data->'deliveries') x
 on conflict(id) do update set establishment_id=excluded.establishment_id,order_number=excluded.order_number,customer_name=excluded.customer_name,phone=excluded.phone,
 address=excluded.address,complement=excluded.complement,notes=excluded.notes,customer_fee_cents=excluded.customer_fee_cents,earnings_cents=excluded.earnings_cents,
 order_total_cents=excluded.order_total_cents,cash_collected_cents=excluded.cash_collected_cents,retained_cents=excluded.retained_cents,tip_cents=excluded.tip_cents,
 payment=excluded.payment,status=excluded.status,work_day=excluded.work_day,priority=excluded.priority,latitude=excluded.latitude,longitude=excluded.longitude,
 location_label=excluded.location_label,created_at=excluded.created_at,completed_at=excluded.completed_at,updated_at=now()
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

-- Daily per-account quota keeps AI image-reading costs predictable.
create table public.ai_scan_usage (
 owner_id uuid not null references auth.users(id) on delete cascade,
 scan_day date not null default (now() at time zone 'America/Sao_Paulo')::date,
 scans integer not null default 0 check (scans between 0 and 40),
 updated_at timestamptz not null default now(),
 primary key(owner_id,scan_day)
);
alter table public.ai_scan_usage enable row level security;
revoke all on public.ai_scan_usage from anon;
grant select,insert,update on public.ai_scan_usage to authenticated;
create policy ai_scan_usage_select on public.ai_scan_usage for select to authenticated using ((select auth.uid())=owner_id);
create policy ai_scan_usage_insert on public.ai_scan_usage for insert to authenticated with check ((select auth.uid())=owner_id);
create policy ai_scan_usage_update on public.ai_scan_usage for update to authenticated using ((select auth.uid())=owner_id) with check ((select auth.uid())=owner_id);

create function public.claim_ai_scan() returns boolean language plpgsql security invoker set search_path='' as $$
declare v_uid uuid:=auth.uid(); v_claimed integer;
begin
 if v_uid is null then raise insufficient_privilege using message='Authentication required'; end if;
 insert into public.ai_scan_usage(owner_id,scan_day,scans)
 values(v_uid,(now() at time zone 'America/Sao_Paulo')::date,1)
 on conflict(owner_id,scan_day) do update set scans=public.ai_scan_usage.scans+1,updated_at=now()
 where public.ai_scan_usage.scans<40
 returning scans into v_claimed;
 return v_claimed is not null;
end;
$$;
revoke all on function public.claim_ai_scan() from public,anon;
grant execute on function public.claim_ai_scan() to authenticated;
