-- Scope legacy libraries and provide owner/admin membership operations.
alter table public.ideas add column if not exists workspace_id uuid references public.workspaces(id) on delete cascade;
alter table public.tracks add column if not exists workspace_id uuid references public.workspaces(id) on delete cascade;
alter table public.config_presets add column if not exists workspace_id uuid references public.workspaces(id) on delete cascade;
create index if not exists ideas_workspace_idx on public.ideas(workspace_id);
create index if not exists tracks_workspace_idx on public.tracks(workspace_id);
create index if not exists config_workspace_idx on public.config_presets(workspace_id);

create or replace function public.invite_workspace_member(target_workspace uuid, invite_email text, invite_role text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare uid uuid; result jsonb;
begin
 if workspace_role(target_workspace) not in ('owner','admin') then raise exception 'not allowed'; end if;
 select id into uid from auth.users where lower(email)=lower(trim(invite_email)) limit 1;
 if uid is null then raise exception 'user must create an account before invite'; end if;
 if invite_role not in ('admin','editor','viewer') then raise exception 'invalid role'; end if;
 insert into workspace_members(workspace_id,user_id,role) values(target_workspace,uid,invite_role)
 on conflict (workspace_id,user_id) do update set role=excluded.role;
 return jsonb_build_object('user_id',uid,'role',invite_role);
end $$;
create or replace function public.change_workspace_member_role(target_workspace uuid,target_user uuid,new_role text)
returns jsonb language plpgsql security definer set search_path=public as $$
begin
 if workspace_role(target_workspace) not in ('owner','admin') or new_role not in ('admin','editor','viewer') then raise exception 'not allowed'; end if;
 update workspace_members set role=new_role where workspace_id=target_workspace and user_id=target_user and role <> 'owner';
 return jsonb_build_object('user_id',target_user,'role',new_role);
end $$;
create or replace function public.remove_workspace_member(target_workspace uuid,target_user uuid)
returns void language plpgsql security definer set search_path=public as $$
begin
 if workspace_role(target_workspace) not in ('owner','admin') then raise exception 'not allowed'; end if;
 delete from workspace_members where workspace_id=target_workspace and user_id=target_user and role <> 'owner';
end $$;


create or replace function public.preview_legacy_backfill(target_workspace uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
begin
 if workspace_role(target_workspace) <> 'owner' then raise exception 'owner required'; end if;
 return jsonb_build_object('ideas',(select count(*) from ideas where workspace_id is null),'tracks',(select count(*) from tracks where workspace_id is null),'config_presets',(select count(*) from config_presets where workspace_id is null));
end $$;

create or replace function public.backfill_legacy_workspace(target_workspace uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
declare i int; t int; c int;
begin
 if workspace_role(target_workspace) <> 'owner' then raise exception 'owner required'; end if;
 update ideas set workspace_id=target_workspace where workspace_id is null; get diagnostics i = row_count;
 update tracks set workspace_id=target_workspace where workspace_id is null; get diagnostics t = row_count;
 update config_presets set workspace_id=target_workspace where workspace_id is null; get diagnostics c = row_count;
 return jsonb_build_object('ideas',i,'tracks',t,'config_presets',c);
end $$;
