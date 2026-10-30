-- Workspace-specific display names for the fixed production pipeline statuses.
create table if not exists public.workspace_pipeline_columns (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  status text not null check (status in ('Lên ý tưởng', 'Kịch bản', 'Quay video', 'Edit', 'Đã đăng')),
  title text not null check (char_length(btrim(title)) between 1 and 80),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (workspace_id, status)
);

create index if not exists workspace_pipeline_columns_workspace_idx
  on public.workspace_pipeline_columns (workspace_id);

alter table public.workspace_pipeline_columns enable row level security;
drop policy if exists "members can access pipeline columns" on public.workspace_pipeline_columns;
create policy "members can access pipeline columns"
  on public.workspace_pipeline_columns for all
  using (public.is_workspace_member(workspace_id))
  with check (public.is_workspace_member(workspace_id));

-- Seed each existing workspace without overwriting any title that was already customized.
insert into public.workspace_pipeline_columns (workspace_id, status, title)
select workspace.id, pipeline.status, pipeline.title
from public.workspaces as workspace
cross join (
  values
    ('Lên ý tưởng'::text, 'Lên ý tưởng'::text),
    ('Kịch bản'::text, 'Kịch bản'::text),
    ('Quay video'::text, 'Quay video'::text),
    ('Edit'::text, 'Edit'::text),
    ('Đã đăng'::text, 'Đã đăng'::text)
) as pipeline(status, title)
on conflict (workspace_id, status) do nothing;

-- New workspaces receive the same five editable columns at creation time.
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
  insert into public.workspace_pipeline_columns (workspace_id, status, title)
  values
    (created.id, 'Lên ý tưởng', 'Lên ý tưởng'),
    (created.id, 'Kịch bản', 'Kịch bản'),
    (created.id, 'Quay video', 'Quay video'),
    (created.id, 'Edit', 'Edit'),
    (created.id, 'Đã đăng', 'Đã đăng');
  return created;
end;
$$;
