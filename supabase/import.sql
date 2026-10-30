-- Run after schema.sql. The API calls this function with the backend-only Supabase key.
create or replace function public.import_content(payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  inserted_ideas integer := 0;
  inserted_tracks integer := 0;
  inserted_configs integer := 0;
begin
  insert into public.tracks (title, artist_source, mood_genre, status, audio_url, notes)
  select x.title, coalesce(x.artist_source, ''), coalesce(x.mood_genre, 'Khác'), coalesce(x.status, 'Chưa dùng'), coalesce(x.audio_url, ''), coalesce(x.notes, '')
  from jsonb_to_recordset(coalesce(payload->'tracks', '[]'::jsonb)) as x(title text, artist_source text, mood_genre text, status text, audio_url text, notes text);
  get diagnostics inserted_tracks = row_count;

  insert into public.config_presets (group_name, attribute, value, notes, link_example)
  select x.group_name, x.attribute, coalesce(x.value, ''), coalesce(x.notes, ''), coalesce(x.link_example, '')
  from jsonb_to_recordset(coalesce(payload->'config_presets', '[]'::jsonb)) as x(group_name text, attribute text, value text, notes text, link_example text);
  get diagnostics inserted_configs = row_count;

  insert into public.ideas (title, status, concept, priority, publish_date, hook, main_content, audio_sfx, hashtag, reference_url, notes, track_id, platforms)
  select x.title, coalesce(x.status, 'Lên ý tưởng'), coalesce(x.concept, 'Khác'), coalesce(x.priority, 2), nullif(x.publish_date, '')::date,
         coalesce(x.hook, ''), coalesce(x.main_content, ''), coalesce(x.audio_sfx, ''), coalesce(x.hashtag, '[]'::jsonb), coalesce(x.reference_url, ''), coalesce(x.notes, ''), x.track_id, coalesce(x.platforms, '["TikTok"]'::jsonb)
  from jsonb_to_recordset(coalesce(payload->'ideas', '[]'::jsonb)) as x(title text, status text, concept text, priority smallint, publish_date text, hook text, main_content text, audio_sfx text, hashtag jsonb, reference_url text, notes text, track_id bigint, platforms jsonb);
  get diagnostics inserted_ideas = row_count;

  return jsonb_build_object('ideas', inserted_ideas, 'tracks', inserted_tracks, 'config_presets', inserted_configs);
end;
$$;

revoke all on function public.import_content(jsonb) from public, anon, authenticated;
grant execute on function public.import_content(jsonb) to service_role;
