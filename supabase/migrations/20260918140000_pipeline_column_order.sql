-- Persist the workspace-specific order of pipeline columns.
alter table public.workspace_pipeline_columns
  add column if not exists sort_order integer not null default 0;

update public.workspace_pipeline_columns
set sort_order = case status
  when 'Lên ý tưởng' then 1
  when 'Kịch bản' then 2
  when 'Quay video' then 3
  when 'Edit' then 4
  when 'Đã đăng' then 5
  else sort_order
end
where sort_order = 0;

create index if not exists workspace_pipeline_columns_order_idx
  on public.workspace_pipeline_columns (workspace_id, sort_order, created_at);

-- Keep deterministic ordering for workspaces created after this migration.
create or replace function public.create_workspace(workspace_name text)
returns public.workspaces
language plpgsql security definer set search_path = public
as $$
declare created public.workspaces;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  insert into public.workspaces(name, created_by)
  values (trim(workspace_name), auth.uid())
  returning * into created;
  insert into public.workspace_members(workspace_id, user_id, role)
  values (created.id, auth.uid(), 'owner');
  insert into public.workspace_pipeline_columns (workspace_id, status, title, sort_order)
  values
    (created.id, 'Lên ý tưởng', 'Lên ý tưởng', 1),
    (created.id, 'Kịch bản', 'Kịch bản', 2),
    (created.id, 'Quay video', 'Quay video', 3),
    (created.id, 'Edit', 'Edit', 4),
    (created.id, 'Đã đăng', 'Đã đăng', 5);
  return created;
end;
$$;
