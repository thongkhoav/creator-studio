-- Run this in Supabase SQL Editor after applying
-- 20260918133000_custom_pipeline_columns.sql if any workspace was created
-- before that migration. It is safe to run more than once and preserves custom titles.
insert into public.workspace_pipeline_columns (workspace_id, status, title, sort_order)
select workspace.id, pipeline.status, pipeline.title, pipeline.sort_order
from public.workspaces as workspace
cross join (
  values
    ('Lên ý tưởng'::text, 'Lên ý tưởng'::text, 1),
    ('Kịch bản'::text, 'Kịch bản'::text, 2),
    ('Quay video'::text, 'Quay video'::text, 3),
    ('Edit'::text, 'Edit'::text, 4),
    ('Đã đăng'::text, 'Đã đăng'::text, 5)
) as pipeline(status, title, sort_order)
on conflict (workspace_id, status) do nothing;
