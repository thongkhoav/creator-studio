-- Store an optional published date for each selected platform on an idea.
alter table public.ideas
  add column if not exists platform_publish_dates jsonb not null default '{}'::jsonb;

alter table public.ideas
  add column if not exists platform_publish_links jsonb not null default '{}'::jsonb;
