-- Run after schema.sql when migrating an existing installation.
-- Existing rows remain unassigned until an owner chooses a workspace and runs the
-- backfill below; this avoids silently exposing old data to a new account.
alter table public.ideas add column if not exists workspace_id uuid references public.workspaces(id) on delete cascade;
alter table public.tracks add column if not exists workspace_id uuid references public.workspaces(id) on delete cascade;
alter table public.config_presets add column if not exists workspace_id uuid references public.workspaces(id) on delete cascade;
alter table public.editing_shortcuts add column if not exists workspace_id uuid references public.workspaces(id) on delete cascade;
alter table public.production_sops add column if not exists workspace_id uuid references public.workspaces(id) on delete cascade;

alter table public.ideas enable row level security;
alter table public.tracks enable row level security;
alter table public.config_presets enable row level security;
alter table public.editing_shortcuts enable row level security;
alter table public.production_sops enable row level security;
create policy "members can access ideas" on public.ideas using (public.is_workspace_member(workspace_id)) with check (public.is_workspace_member(workspace_id));
create policy "members can access tracks" on public.tracks using (public.is_workspace_member(workspace_id)) with check (public.is_workspace_member(workspace_id));
create policy "members can access configs" on public.config_presets using (public.is_workspace_member(workspace_id)) with check (public.is_workspace_member(workspace_id));
create policy "members can access shortcuts" on public.editing_shortcuts using (public.is_workspace_member(workspace_id)) with check (public.is_workspace_member(workspace_id));
create policy "members can access sops" on public.production_sops using (public.is_workspace_member(workspace_id)) with check (public.is_workspace_member(workspace_id));

create index if not exists ideas_workspace_idx on public.ideas(workspace_id);
create index if not exists schedules_workspace_idx on public.content_schedules(workspace_id, scheduled_at);
create index if not exists media_workspace_idx on public.media_assets(workspace_id);
