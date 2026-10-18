-- Initial schema for the Giro Supabase project. Run once in the SQL Editor.
-- No service-role key is needed by the application.
begin;
create table public.rider_workspaces (
 owner uuid primary key references auth.users(id) on delete cascade,
 data jsonb not null check(jsonb_typeof(data) = 'object'),
 revision integer not null default 0 check(revision >= 0),
 updated_at timestamptz not null default now()
);
alter table public.rider_workspaces enable row level security;
revoke all on public.rider_workspaces from anon;
grant select, insert, update, delete on public.rider_workspaces to authenticated;
create policy rider_workspace_select on public.rider_workspaces for select to authenticated using ((select auth.uid())=owner);
create policy rider_workspace_insert on public.rider_workspaces for insert to authenticated with check ((select auth.uid())=owner);
create policy rider_workspace_update on public.rider_workspaces for update to authenticated using ((select auth.uid())=owner) with check ((select auth.uid())=owner);
create policy rider_workspace_delete on public.rider_workspaces for delete to authenticated using ((select auth.uid())=owner);
create function public.save_rider_workspace(p_data jsonb, p_expected_revision integer)
returns integer language plpgsql security invoker set search_path = '' as $$
declare v_uid uuid := auth.uid(); v_revision integer;
begin
 if v_uid is null then raise insufficient_privilege using message='Authentication required'; end if;
 if p_expected_revision < 0 or p_expected_revision is null or p_data is null or jsonb_typeof(p_data) <> 'object' or octet_length(p_data::text)>3000000 then raise invalid_parameter_value using message='Invalid workspace'; end if;
 if p_expected_revision=0 then
  insert into public.rider_workspaces(owner,data,revision) values(v_uid,'{}'::jsonb,0) on conflict(owner) do nothing;
 end if;
 update public.rider_workspaces set data=p_data, revision=revision+1,updated_at=now() where owner=v_uid and revision=p_expected_revision returning revision into v_revision;
 if v_revision is null then raise serialization_failure using message='Workspace revision conflict'; end if;
 return v_revision;
end;
$$;
revoke all on function public.save_rider_workspace(jsonb,integer) from public,anon;
grant execute on function public.save_rider_workspace(jsonb,integer) to authenticated;
commit;
