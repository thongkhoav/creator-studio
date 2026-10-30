-- Allow workspaces to hide unused pipeline columns without changing idea status keys.
alter table public.workspace_pipeline_columns
  add column if not exists is_active boolean not null default true;

create index if not exists workspace_pipeline_columns_active_idx
  on public.workspace_pipeline_columns (workspace_id, is_active);

