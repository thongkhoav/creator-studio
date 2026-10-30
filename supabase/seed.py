"""Generate seed.sql from the sheet export JSON without embedding credentials."""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
data = json.loads((ROOT / 'sheet-data.json').read_text())

def q(value):
    return "'" + str(value or '').replace("'", "''") + "'"
def nullable_date(value):
    return 'NULL' if value is None or not str(value).strip() else q(value)
def j(value): return q(json.dumps(value if isinstance(value, list) else [], ensure_ascii=False)) + '::jsonb'
lines = ['-- Generated from sheet-data.json. Run schema.sql first.', 'BEGIN;']
for track in data['tracks']:
    lines.append('insert into public.tracks (title,artist_source,mood_genre,status,audio_url,notes) values (%s,%s,%s,%s,%s,%s);' % tuple(q(track.get(k)) for k in ('title','artist_source','mood_genre','status','audio_url','notes')))
for row in data['config_presets']:
    lines.append('insert into public.config_presets (group_name,attribute,value,notes,link_example) values (%s,%s,%s,%s,%s);' % tuple(q(row.get(k)) for k in ('group_name','attribute','value','notes','link_example')))
for row in data['editing_shortcuts']:
    lines.append('insert into public.editing_shortcuts (category,key_combo,action,notes) values (%s,%s,%s,%s);' % tuple(q(row.get(k)) for k in ('category','key_combo','action','notes')))
for row in data['production_sops']:
    lines.append('insert into public.production_sops (type,category_or_profile,recommended_mode,do_instructions,dont_instructions,camera_settings,post_process) values (%s,%s,%s,%s,%s,%s,%s);' % tuple(q(row.get(k)) for k in ('type','category_or_profile','recommended_mode','do_instructions','dont_instructions','camera_settings','post_process')))
for row in data['ideas']:
    lines.append('insert into public.ideas (title,status,concept,priority,publish_date,hook,main_content,audio_sfx,hashtag,reference_url,notes) values (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s);' % (q(row.get('title')),q(row.get('status')),q(row.get('concept')),row.get('priority') or 2,nullable_date(row.get('publish_date')),q(row.get('hook')),q(row.get('main_content')),q(row.get('audio_sfx')),j(row.get('hashtag')),q(row.get('reference_url')),q(row.get('notes'))))
lines.append('COMMIT;')
(ROOT / 'supabase' / 'seed.sql').write_text('\n'.join(lines) + '\n')
print('generated', len(lines) - 3, 'rows')
