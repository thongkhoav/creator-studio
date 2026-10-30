-- Run this in Supabase SQL Editor after applying
-- 20260914090000_workspace_concepts.sql.
--
-- It only copies non-empty concepts from ideas that already belong to a
-- workspace. It does not modify ideas or assign unscoped rows to a workspace.

begin;

with source_concepts as (
  select distinct on (i.workspace_id, lower(btrim(i.concept)))
    i.workspace_id,
    btrim(i.concept) as name,
    w.created_by
  from public.ideas as i
  join public.workspaces as w
    on w.id = i.workspace_id
  where i.workspace_id is not null
    and char_length(btrim(coalesce(i.concept, ''))) between 1 and 80
  order by i.workspace_id, lower(btrim(i.concept)), i.id
)
insert into public.workspace_concepts (workspace_id, name, created_by)
select workspace_id, name, created_by
from source_concepts
on conflict (workspace_id, normalized_name) do nothing;

commit;

-- Optional verification:
select
  workspace_id,
  count(*) as concept_count,
  count(distinct lower(btrim(name))) as distinct_name_count
from public.workspace_concepts
group by workspace_id
order by workspace_id;
