import json
from pathlib import Path
import shutil
import sqlite3
import subprocess
import sys
import tempfile
import unittest


ROOT = Path(__file__).resolve().parents[2]
COLUMNS = {
    'tracks': ('title', 'artist_source', 'mood_genre', 'status', 'audio_url', 'notes'),
    'config_presets': ('group_name', 'attribute', 'value', 'notes', 'link_example'),
    'editing_shortcuts': ('category', 'key_combo', 'action', 'notes'),
    'production_sops': ('type', 'category_or_profile', 'recommended_mode', 'do_instructions', 'dont_instructions', 'camera_settings', 'post_process'),
    'ideas': ('title', 'status', 'concept', 'priority', 'publish_date', 'hook', 'main_content', 'audio_sfx', 'hashtag', 'reference_url', 'notes'),
}


def generate_sql(data):
    # Run the actual CLI in an isolated project so tests never overwrite seed.sql.
    with tempfile.TemporaryDirectory() as directory:
        project = Path(directory)
        (project / 'supabase').mkdir()
        shutil.copyfile(ROOT / 'supabase' / 'seed.py', project / 'supabase' / 'seed.py')
        (project / 'sheet-data.json').write_text(json.dumps(data), encoding='utf-8')
        subprocess.run([sys.executable, str(project / 'supabase' / 'seed.py')], check=True, capture_output=True, text=True)
        return (project / 'supabase' / 'seed.sql').read_text(encoding='utf-8')


def read_seed_rows(sql):
    # SQLite parses the generated literals independently of the serializer.
    # Only the PostgreSQL JSONB cast needs removing for this in-memory check.
    with sqlite3.connect(':memory:') as connection:
        connection.execute("attach database ':memory:' as public")
        for table, columns in COLUMNS.items():
            definitions = ','.join(f'{column} {"integer" if column == "priority" else "text"}' for column in columns)
            connection.execute(f'create table public.{table} ({definitions})')
        connection.executescript(sql.replace('::jsonb', ''))
        connection.row_factory = sqlite3.Row
        return {table: [dict(row) for row in connection.execute(f'select * from public.{table}')] for table in COLUMNS}


class SeedTests(unittest.TestCase):
    def test_missing_blank_and_whitespace_dates_become_sql_null(self):
        data = {table: [] for table in COLUMNS}
        data['ideas'] = [
            {'title': 'Missing date'},
            {'title': 'Null date', 'publish_date': None},
            {'title': 'Empty date', 'publish_date': ''},
            {'title': 'Whitespace date', 'publish_date': ' \t\n '},
            {'title': "Ngày thật: O'Brien", 'publish_date': '2026-09-11'},
        ]
        rows = read_seed_rows(generate_sql(data))['ideas']
        self.assertEqual([row['publish_date'] for row in rows], [None, None, None, None, '2026-09-11'])
        self.assertEqual(rows[-1]['title'], "Ngày thật: O'Brien")

    def test_all_sheet_rows_and_non_date_fields_are_preserved(self):
        data = json.loads((ROOT / 'sheet-data.json').read_text(encoding='utf-8'))
        rows = read_seed_rows(generate_sql(data))
        self.assertEqual({table: len(records) for table, records in rows.items()}, {
            'tracks': 6, 'config_presets': 4, 'editing_shortcuts': 6,
            'production_sops': 4, 'ideas': 12,
        })
        self.assertEqual(sum(row['publish_date'] is None for row in rows['ideas']), 9)
        for table, columns in COLUMNS.items():
            for source, actual in zip(data[table], rows[table]):
                expected = {column: str(source.get(column) or '') for column in columns}
                if table == 'ideas':
                    expected['priority'] = source.get('priority') or 2
                    expected['publish_date'] = source.get('publish_date') or None
                    expected['hashtag'] = json.dumps(source.get('hashtag') if isinstance(source.get('hashtag'), list) else [], ensure_ascii=False)
                self.assertEqual(actual, expected)

    def test_generated_seed_is_wrapped_in_one_transaction(self):
        statements = generate_sql({table: [] for table in COLUMNS}).splitlines()
        statements = [line for line in statements if line.strip() and not line.startswith('--')]
        self.assertEqual(statements, ['BEGIN;', 'COMMIT;'])

    def test_checked_in_seed_matches_generator(self):
        data = json.loads((ROOT / 'sheet-data.json').read_text(encoding='utf-8'))
        self.assertEqual((ROOT / 'supabase' / 'seed.sql').read_text(encoding='utf-8'), generate_sql(data))


if __name__ == '__main__':
    unittest.main()
