-- Complete RLS for legacy workspace-scoped libraries.
-- On a fresh project nothing has added these columns or enabled RLS yet.
alter table public.editing_shortcuts add column if not exists workspace_id uuid references public.workspaces(id) on delete cascade;
alter table public.production_sops add column if not exists workspace_id uuid references public.workspaces(id) on delete cascade;
create index if not exists editing_shortcuts_workspace_idx on public.editing_shortcuts(workspace_id);
create index if not exists production_sops_workspace_idx on public.production_sops(workspace_id);
alter table public.ideas enable row level security;
alter table public.tracks enable row level security;
alter table public.config_presets enable row level security;
alter table public.editing_shortcuts enable row level security;
alter table public.production_sops enable row level security;

drop policy if exists "members can access editing shortcuts" on public.editing_shortcuts;
create policy "members can access editing shortcuts"
on public.editing_shortcuts for all
using (public.is_workspace_member(workspace_id))
with check (public.is_workspace_member(workspace_id));

drop policy if exists "members can access production sops" on public.production_sops;
create policy "members can access production sops"
on public.production_sops for all
using (public.is_workspace_member(workspace_id))
with check (public.is_workspace_member(workspace_id));

-- The first multi-user migration may have been applied manually, so make the
-- three other legacy policies idempotent as well.
drop policy if exists "members can access ideas" on public.ideas;
create policy "members can access ideas" on public.ideas for all
using (public.is_workspace_member(workspace_id))
with check (public.is_workspace_member(workspace_id));
drop policy if exists "members can access tracks" on public.tracks;
create policy "members can access tracks" on public.tracks for all
using (public.is_workspace_member(workspace_id))
with check (public.is_workspace_member(workspace_id));
drop policy if exists "members can access configs" on public.config_presets;
create policy "members can access configs" on public.config_presets for all
using (public.is_workspace_member(workspace_id))
with check (public.is_workspace_member(workspace_id));
