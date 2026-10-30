-- Allow each workspace to add its own production pipeline columns.
-- Existing fixed status values remain valid and keep their current data.
alter table public.ideas
  drop constraint if exists ideas_status_check;

alter table public.workspace_pipeline_columns
  drop constraint if exists workspace_pipeline_columns_status_check;

alter table public.ideas
  add constraint ideas_status_length_check
  check (char_length(btrim(status)) between 1 and 80);

alter table public.workspace_pipeline_columns
  add column if not exists sort_order integer not null default 0;

alter table public.workspace_pipeline_columns
  add constraint workspace_pipeline_columns_status_length_check
  check (char_length(btrim(status)) between 1 and 80);

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
