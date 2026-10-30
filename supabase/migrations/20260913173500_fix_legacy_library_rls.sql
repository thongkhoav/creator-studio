-- Complete RLS for legacy workspace-scoped libraries.
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
