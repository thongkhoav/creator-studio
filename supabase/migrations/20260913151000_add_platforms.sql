alter table public.ideas add column if not exists platforms jsonb not null default '[\"TikTok\"]'::jsonb;
