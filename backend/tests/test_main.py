import os
import unittest
from unittest.mock import patch
from fastapi.testclient import TestClient
import backend.app.main as main
from backend.app.main import BrainstormHistoryIn, BrainstormIn, IdeaIn, MemoryStore, STATUSES

class MainTests(unittest.TestCase):
    def test_memory_store_loads_sheet_data(self):
        store = MemoryStore()
        self.assertEqual(len(store.state()['ideas']), 12)
        self.assertEqual(len(store.state()['tracks']), 6)

    def test_idea_validation_and_status_update(self):
        store = MemoryStore()
        idea = store.create_idea(IdeaIn(title='API chậm', concept='IT meme', priority=1))
        self.assertEqual(idea['status'], STATUSES[0])
        updated = store.update_idea(idea['id'], {'status': 'Edit'})
        self.assertEqual(updated['status'], 'Edit')

    def test_memory_store_deletes_idea(self):
        store = MemoryStore()
        idea = store.create_idea(IdeaIn(title='Xóa idea'))
        deleted = store.delete_idea(idea['id'])
        self.assertEqual(deleted, {'id': idea['id']})
        self.assertNotIn(idea['id'], [row['id'] for row in store.state()['ideas']])
        with self.assertRaises(KeyError):
            store.delete_idea(idea['id'])

    def test_memory_store_creates_track(self):
        from backend.app.main import ImportTrackIn
        store = MemoryStore()
        track = store.create_track(ImportTrackIn(title='Nhạc mới', mood_genre='Chill'))
        self.assertEqual(track['title'], 'Nhạc mới')
        self.assertEqual(store.state()['tracks'][-1]['id'], track['id'])


    def test_idea_platforms_default_and_validation(self):
        idea = IdeaIn(title='Multi platform')
        self.assertEqual(idea.platforms, ['TikTok'])
        self.assertEqual(IdeaIn(title='Trimmed concept', concept='  Custom concept  ').concept, 'Custom concept')
        with self.assertRaises(ValueError):
            IdeaIn(title='Long concept', concept=' ' + ('x' * 81) + ' ')
        with self.assertRaises(ValueError):
            IdeaIn(title='Bad', platforms=['Unknown network'])

    def test_idea_empty_publish_date_is_null_for_database(self):
        idea = IdeaIn(title='Không có ngày đăng', publish_date='')
        self.assertIsNone(idea.publish_date)

    def test_idea_accepts_platform_publish_dates(self):
        idea = IdeaIn(
            title='Đăng nhiều nền tảng',
            platforms=['TikTok', 'YouTube Shorts'],
            platform_publish_dates={
                'TikTok': '2026-09-22',
                'YouTube Shorts': '2026-09-25',
            },
        )
        self.assertEqual(idea.platform_publish_dates, {
            'TikTok': '2026-09-22',
            'YouTube Shorts': '2026-09-25',
        })

    def test_idea_rejects_platform_publish_date_for_unselected_platform(self):
        with self.assertRaises(ValueError):
            IdeaIn(
                title='Ngày không hợp lệ',
                platforms=['TikTok'],
                platform_publish_dates={'YouTube Shorts': '2026-09-25'},
            )

    def test_idea_accepts_platform_publish_links_for_selected_platforms(self):
        idea = IdeaIn(
            title='Link theo nền tảng',
            platforms=['TikTok', 'YouTube Shorts'],
            platform_publish_links={
                'TikTok': 'https://tiktok.com/@creator/video/1',
                'YouTube Shorts': 'https://youtube.com/shorts/abc',
            },
        )
        self.assertEqual(idea.platform_publish_links['TikTok'], 'https://tiktok.com/@creator/video/1')

    def test_idea_rejects_platform_publish_link_for_unselected_platform(self):
        with self.assertRaises(ValueError):
            IdeaIn(
                title='Link không hợp lệ',
                platforms=['TikTok'],
                platform_publish_links={'YouTube Shorts': 'https://youtube.com/shorts/abc'},
            )

    def test_brainstorm_input_has_safe_limits(self):
        request = BrainstormIn(brief='Coder remote', format='IT meme', duration='30-40 giây')
        self.assertEqual(request.brief, 'Coder remote')
        self.assertEqual(request.platforms, ['TikTok', 'Instagram Reels', 'YouTube Shorts'])
        self.assertEqual(BrainstormIn(brief='Coder remote', platforms=['LinkedIn']).platforms, ['LinkedIn'])
        with self.assertRaises(ValueError): BrainstormIn(brief='x')

    def test_brainstorm_history_stores_results_in_memory(self):
        store = MemoryStore()
        history = store.create_brainstorm_history(BrainstormHistoryIn(
            brief='Developer workflow',
            platforms=['TikTok'],
            ideas=[{'title': 'Idea one', 'hook': 'Hook', 'outline': 'Outline'}],
        ))
        self.assertEqual(history['ideas'][0]['title'], 'Idea one')
        self.assertEqual(store.list_brainstorm_history()[0]['id'], history['id'])

    def test_brainstorm_history_rejects_unknown_platform(self):
        with self.assertRaises(ValueError):
            BrainstormHistoryIn(brief='Developer workflow', platforms=['Unknown'], ideas=[{'title': 'x'}])

    def test_patch_idea_persists_platforms(self):
        with patch.dict(os.environ, {'APP_PASSWORD': 'correct horse', 'APP_SESSION_SECRET': 'test-secret'}, clear=False):
            client = TestClient(main.app)
            client.post('/api/auth/login', json={'password': 'correct horse'})
            idea_id = client.get('/api/state').json()['ideas'][0]['id']
            response = client.patch(f'/api/ideas/{idea_id}', json={'platforms': ['LinkedIn', 'X']})
            self.assertEqual(response.status_code, 200)
            self.assertEqual(response.json()['idea']['platforms'], ['LinkedIn', 'X'])

    def test_create_idea_persists_status_and_platform_publish_dates(self):
        with patch.dict(os.environ, {'APP_PASSWORD': 'correct horse', 'APP_SESSION_SECRET': 'test-secret'}, clear=False):
            client = TestClient(main.app)
            client.post('/api/auth/login', json={'password': 'correct horse'})
            response = client.post('/api/ideas', json={
                'title': 'Đăng TikTok và YouTube',
                'status': 'Đã đăng',
                'platforms': ['TikTok', 'YouTube Shorts'],
                'platform_publish_dates': {
                    'TikTok': '2026-09-22',
                    'YouTube Shorts': '2026-09-24',
                },
                'platform_publish_links': {
                    'TikTok': 'https://tiktok.com/@creator/video/1',
                    'YouTube Shorts': 'https://youtube.com/shorts/abc',
                },
            })
            self.assertEqual(response.status_code, 201)
            self.assertEqual(response.json()['idea']['status'], 'Đã đăng')
            self.assertEqual(response.json()['idea']['platform_publish_dates']['YouTube Shorts'], '2026-09-24')
            self.assertEqual(response.json()['idea']['platform_publish_links']['TikTok'], 'https://tiktok.com/@creator/video/1')

    def test_brainstorm_prompt_includes_selected_platforms(self):
        class FakeResponse:
            def raise_for_status(self): pass
            def json(self): return {'output_text': '{"ideas": []}'}

        with patch.dict(os.environ, {'APP_PASSWORD': 'correct horse', 'APP_SESSION_SECRET': 'test-secret', 'LLM_API_KEY': 'test-key'}, clear=False):
            client = TestClient(main.app)
            client.post('/api/auth/login', json={'password': 'correct horse'})
            with patch('backend.app.main.httpx.post', return_value=FakeResponse()) as request:
                response = client.post('/api/brainstorm', json={'brief': 'Developer workflow', 'platforms': ['LinkedIn', 'X']})
            self.assertEqual(response.status_code, 200)
            prompt = request.call_args.kwargs['json']['input']
            self.assertIn('LinkedIn, X', prompt)

    def test_brainstorm_history_api_requires_login_and_persists(self):
        with patch.dict(os.environ, {'APP_PASSWORD': 'history-password', 'APP_SESSION_SECRET': 'history-secret'}, clear=False):
            client = TestClient(main.app)
            self.assertEqual(client.get('/api/brainstorm/history').status_code, 401)
            client.post('/api/auth/login', json={'password': 'history-password'})
            saved = client.post('/api/brainstorm/history', json={
                'brief': 'Developer workflow',
                'platforms': ['TikTok'],
                'ideas': [{'title': 'Saved idea', 'hook': 'Hook', 'outline': 'Outline'}],
            })
            self.assertEqual(saved.status_code, 201)
            self.assertEqual(client.get('/api/brainstorm/history').json()['history'][0]['brief'], 'Developer workflow')

    def test_protected_api_requires_login_when_app_password_is_configured(self):
        with patch.dict(os.environ, {'APP_PASSWORD': 'correct horse', 'APP_SESSION_SECRET': 'test-secret'}, clear=False):
            client = TestClient(main.app)
            self.assertEqual(client.get('/api/state').status_code, 401)
            self.assertEqual(client.post('/api/auth/login', json={'password': 'wrong'}).status_code, 401)
            response = client.post('/api/auth/login', json={'password': 'correct horse'})
            self.assertEqual(response.status_code, 200)
            self.assertTrue(response.json()['authenticated'])
            self.assertEqual(client.get('/api/state').status_code, 200)
            self.assertEqual(client.post('/api/auth/logout').status_code, 200)
            self.assertEqual(client.get('/api/state').status_code, 401)

    def test_protected_api_fails_closed_when_password_is_not_set(self):
        with patch.dict(os.environ, {'APP_PASSWORD': '', 'APP_SESSION_SECRET': ''}, clear=False):
            self.assertEqual(TestClient(main.app).get('/api/state').status_code, 503)

    def test_frontend_fallback_cannot_read_files_outside_dist(self):
        with patch.dict(os.environ, {'APP_PASSWORD': 'correct horse', 'APP_SESSION_SECRET': 'test-secret'}, clear=False):
            response = TestClient(main.app).get('/%2e%2e/%2e%2e/sheet-data.json')
            self.assertEqual(response.status_code, 200)
            self.assertEqual(response.headers.get('content-type'), 'text/html; charset=utf-8')

class ImportTests(unittest.TestCase):
    def setUp(self):
        self.previous_store = main._memory_store
        main._memory_store = MemoryStore()
        self.env = patch.dict(os.environ, {'APP_PASSWORD': 'import-password', 'APP_SESSION_SECRET': 'import-secret'}, clear=False)
        self.env.start(); self.client = TestClient(main.app)
        self.client.post('/api/auth/login', json={'password': 'import-password'})
    def tearDown(self): self.env.stop(); main._memory_store = self.previous_store
    def test_imports_ideas_tracks_and_config_presets(self):
        response = self.client.post('/api/import', json={'ideas': [{'title': 'Ý tưởng import', 'concept': 'IT meme', 'priority': 1, 'platforms': ['Instagram Reels', 'X']}], 'tracks': [{'title': 'Nhạc import', 'mood_genre': 'Chill', 'status': 'Chưa dùng'}], 'config_presets': [{'group_name': 'Video', 'attribute': 'fps', 'value': '30'}]})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()['imported'], {'ideas': 1, 'tracks': 1, 'config_presets': 1})
        state = self.client.get('/api/state').json()
        self.assertEqual(state['ideas'][-1]['title'], 'Ý tưởng import')
        self.assertEqual(state['ideas'][-1]['platforms'], ['Instagram Reels', 'X'])
        self.assertEqual(state['tracks'][-1]['title'], 'Nhạc import')
        self.assertEqual(state['config_presets'][-1]['attribute'], 'fps')

    def test_delete_idea_removes_it_from_memory_api(self):
        idea_id = self.client.get('/api/state').json()['ideas'][0]['id']
        response = self.client.delete(f'/api/ideas/{idea_id}')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()['idea']['id'], idea_id)
        self.assertNotIn(idea_id, [row['id'] for row in self.client.get('/api/state').json()['ideas']])
        self.assertEqual(self.client.delete(f'/api/ideas/{idea_id}').status_code, 404)

    def test_imports_csv_for_selected_scope(self):
        track_csv = 'title,artist_source,mood_genre,status,audio_url,notes\nNhạc CSV,YouTube,Hài,Chưa dùng,,Không lời\n'
        response = self.client.post('/api/import?scope=tracks', content=track_csv.encode(), headers={'content-type': 'text/csv'})
        self.assertEqual(response.status_code, 200, response.text)
        self.assertEqual(response.json()['imported'], {'ideas': 0, 'tracks': 1, 'config_presets': 0})
        state = self.client.get('/api/state').json()
        self.assertEqual(state['tracks'][-1]['title'], 'Nhạc CSV')

        preset_csv = 'group_name,attribute,value,notes,link_example\nVideo,fps,30,Ghi chú,\n'
        response = self.client.post('/api/import?scope=config_presets', content=preset_csv.encode(), headers={'content-type': 'text/csv'})
        self.assertEqual(response.status_code, 200, response.text)
        self.assertEqual(response.json()['imported'], {'ideas': 0, 'tracks': 0, 'config_presets': 1})
        state = self.client.get('/api/state').json()
        self.assertEqual(state['config_presets'][-1]['attribute'], 'fps')

    def test_scoped_json_import_rejects_other_tables(self):
        response = self.client.post('/api/import?scope=tracks', json={'ideas': [{'title': 'Không đúng page'}]})
        self.assertEqual(response.status_code, 422)
    def test_import_rejects_invalid_rows_before_writing(self):
        response = self.client.post('/api/import', json={'ideas': [{'title': '', 'priority': 9}]})
        self.assertEqual(response.status_code, 422)
        self.assertEqual(len(main._memory_store.state()['ideas']), 12)

    def test_import_requires_authentication_and_enforces_limits(self):
        unauthenticated = TestClient(main.app)
        self.assertEqual(unauthenticated.post('/api/import/preview', json={'ideas': [{'title': 'x'}]}).status_code, 401)
        oversized = {'ideas': [{'title': str(index)} for index in range(501)]}
        response = self.client.post('/api/import/preview', json=oversized)
        self.assertEqual(response.status_code, 422)

if __name__ == '__main__': unittest.main()
