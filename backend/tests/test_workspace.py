import os
import unittest
from unittest.mock import patch
from fastapi.testclient import TestClient
from backend.app.main import app

class AuthBoundaryTests(unittest.TestCase):
    def test_shared_password_no_longer_authenticates(self):
        response = TestClient(app).post('/api/auth/login', json={'password': 'old-password'})
        self.assertNotEqual(response.status_code, 200)

    def test_missing_bearer_is_unauthorized(self):
        with patch.dict(os.environ, {'SUPABASE_URL': 'https://example.supabase.co', 'SUPABASE_PUBLISHABLE_KEY': 'sb_publishable_test'}, clear=False):
            self.assertEqual(TestClient(app).get('/api/state').status_code, 401)

    def test_config_never_exposes_secret(self):
        with patch.dict(os.environ, {'SUPABASE_URL': 'https://example.supabase.co', 'SUPABASE_PUBLISHABLE_KEY': 'sb_publishable_test', 'SUPABASE_SECRET_KEY': 'private-key'}):
            response = TestClient(app).get('/api/config')
            self.assertEqual(response.status_code, 200)
            self.assertEqual(response.json()['supabaseKey'], 'sb_publishable_test')
            self.assertNotIn('private-key', response.text)

class WorkspaceRequestTests(unittest.TestCase):
    workspace_id = '439b2a2c-b8b8-4d89-bf0b-646036e40767'
    user_id = 'b4db80c8-4774-4343-ab7f-2704cfe0c065'

    def setUp(self):
        import httpx
        self.httpx = httpx
        self.env = patch.dict(os.environ, {
            'AUTH_MODE': 'supabase', 'SUPABASE_URL': 'https://example.supabase.co',
            'SUPABASE_PUBLISHABLE_KEY': 'sb_publishable_test',
        })
        self.env.start()
        self.addCleanup(self.env.stop)
        self.headers = {'Authorization': 'Bearer test-user-token', 'X-Workspace-ID': self.workspace_id}
        self.auth = patch('backend.app.workspace.httpx.get', return_value=httpx.Response(200, json={
            'id': self.user_id, 'email': 'test@example.com', 'email_confirmed_at': '2026-09-13T00:00:00Z',
        }))
        self.auth.start()
        self.addCleanup(self.auth.stop)

    def database_response(self, method, url, **kwargs):
        self.assertEqual(kwargs['headers']['Authorization'], 'Bearer test-user-token')
        self.assertEqual(kwargs['params']['workspace_id'], 'eq.' + self.workspace_id)
        table = url.rsplit('/', 1)[-1]
        if table == 'workspace_members':
            if 'user_id' in kwargs['params']:
                self.assertEqual(kwargs['params']['user_id'], 'eq.' + self.user_id)
            return self.httpx.Response(200, json=[{'user_id': self.user_id, 'role': 'owner'}])
        return self.httpx.Response(200, json=[{'id': 1, 'workspace_id': self.workspace_id}])

    def test_authenticated_state_reads_scoped_tables_with_user_token(self):
        with patch('backend.app.workspace.httpx.request', side_effect=self.database_response):
            response = TestClient(app).get('/api/state', headers=self.headers)
        self.assertEqual(response.status_code, 200, response.text)
        self.assertEqual(set(response.json()), {'ideas', 'tracks', 'config_presets', 'editing_shortcuts', 'production_sops'})
        self.assertEqual(response.json()['ideas'][0]['workspace_id'], self.workspace_id)

    def test_nonmember_remains_forbidden_instead_of_service_unavailable(self):
        with patch('backend.app.workspace.httpx.request', return_value=self.httpx.Response(200, json=[])):
            response = TestClient(app).get('/api/state', headers=self.headers)
        self.assertEqual(response.status_code, 403, response.text)

    def test_edit_track_is_scoped_and_preserves_custom_mood(self):
        def database_response(method, url, **kwargs):
            if url.endswith('/workspace_members'):
                return self.database_response(method, url, **kwargs)
            self.assertTrue(url.endswith('/tracks'))
            self.assertEqual(kwargs['params']['workspace_id'], 'eq.' + self.workspace_id)
            self.assertEqual(kwargs['params']['id'], 'eq.7')
            if method == 'GET':
                return self.httpx.Response(200, json=[{'id': 7, 'title': 'Old title'}])
            self.assertEqual(method, 'PATCH')
            return self.httpx.Response(200, json=[{'id': 7, **kwargs['json']}])
        with patch('backend.app.workspace.httpx.request', side_effect=database_response):
            response = TestClient(app).patch('/api/tracks/7', headers=self.headers, json={
                'title': 'New title', 'mood_genre': ' Hài ', 'notes': 'Updated notes',
            })
        self.assertEqual(response.status_code, 200, response.text)
        self.assertEqual(response.json()['track']['mood_genre'], 'Hài')
        self.assertEqual(response.json()['track']['notes'], 'Updated notes')

    def test_edit_track_rejects_viewer_and_other_workspace_record(self):
        for role, expected in [('viewer', 403), ('editor', 404)]:
            with self.subTest(role=role):
                def database_response(method, url, **kwargs):
                    self.assertEqual(method, 'GET')
                    if url.endswith('/workspace_members'):
                        return self.httpx.Response(200, json=[{'role': role}])
                    self.assertEqual(kwargs['params']['workspace_id'], 'eq.' + self.workspace_id)
                    return self.httpx.Response(200, json=[])
                with patch('backend.app.workspace.httpx.request', side_effect=database_response):
                    response = TestClient(app).patch('/api/tracks/7', headers=self.headers, json={'title': 'New title'})
                self.assertEqual(response.status_code, expected, response.text)

    def test_custom_track_mood_is_saved_in_selected_workspace(self):
        def database_response(method, url, **kwargs):
            if url.endswith('/workspace_members'):
                return self.database_response(method, url, **kwargs)
            self.assertTrue(url.endswith('/tracks'))
            self.assertEqual(method, 'POST')
            self.assertEqual(kwargs['json']['workspace_id'], self.workspace_id)
            return self.httpx.Response(201, json=[{'id': 100, **kwargs['json']}])

        with patch('backend.app.workspace.httpx.request', side_effect=database_response):
            response = TestClient(app).post('/api/tracks', headers=self.headers, json={
                'title': 'Comedy track', 'mood_genre': ' Hài hước ',
            })
        self.assertEqual(response.status_code, 201, response.text)
        self.assertEqual(response.json()['track']['mood_genre'], 'Hài hước')
        self.assertEqual(response.json()['track']['workspace_id'], self.workspace_id)

    def test_missing_workspace_remains_bad_request(self):
        response = TestClient(app).get('/api/state', headers={'Authorization': 'Bearer test-user-token'})
        self.assertEqual(response.status_code, 400, response.text)

    def test_operations_dependency_resolves_real_user(self):
        with patch('backend.app.workspace.httpx.request', side_effect=self.database_response):
            response = TestClient(app).get('/api/members', headers=self.headers)
        self.assertEqual(response.status_code, 200, response.text)

    def concepts_database_response(self, method, url, **kwargs):
        self.assertEqual(kwargs['headers']['Authorization'], 'Bearer test-user-token')
        table = url.rsplit('/', 1)[-1]
        if table == 'workspace_members':
            self.assertEqual(kwargs['params']['workspace_id'], 'eq.' + self.workspace_id)
            self.assertEqual(kwargs['params']['user_id'], 'eq.' + self.user_id)
            return self.httpx.Response(200, json=[{'user_id': self.user_id, 'role': 'owner'}])
        self.assertEqual(table, 'workspace_concepts')
        if method == 'GET':
            self.assertEqual(kwargs['params']['workspace_id'], 'eq.' + self.workspace_id)
            if 'normalized_name' in kwargs['params']:
                return self.httpx.Response(200, json=[])
            return self.httpx.Response(200, json=[{
                'id': 7, 'workspace_id': self.workspace_id, 'name': 'YouTube subtitle',
            }])
        self.assertEqual(method, 'POST')
        self.assertNotIn('params', kwargs)
        self.assertEqual(kwargs['headers']['Prefer'], 'return=representation')
        return self.httpx.Response(201, json=[{
            'id': 8, 'workspace_id': self.workspace_id, 'name': 'Subtitle giữa màn hình',
        }])

    def test_workspace_concepts_are_scoped_and_can_be_created(self):
        with patch('backend.app.workspace.httpx.request', side_effect=self.concepts_database_response):
            client = TestClient(app)
            listed = client.get('/api/concepts', headers=self.headers)
            created = client.post(
                '/api/concepts',
                headers=self.headers,
                json={'name': ' Subtitle giữa màn hình '},
            )
        self.assertEqual(listed.status_code, 200, listed.text)
        self.assertEqual(listed.json()['concepts'][0]['name'], 'YouTube subtitle')
        self.assertEqual(created.status_code, 201, created.text)
        self.assertEqual(created.json()['concept']['name'], 'Subtitle giữa màn hình')

    def test_workspace_concept_name_is_trimmed_and_bounded(self):
        with patch('backend.app.workspace.httpx.request', side_effect=self.concepts_database_response):
            client = TestClient(app)
            self.assertEqual(
                client.post('/api/concepts', headers=self.headers, json={'name': '   '}).status_code,
                422,
            )
            self.assertEqual(
                client.post('/api/concepts', headers=self.headers, json={'name': 'x' * 81}).status_code,
                422,
            )
            self.assertEqual(
                client.post('/api/concepts', headers=self.headers, json={'name': ' ' + ('x' * 80) + ' '}).status_code,
                201,
            )

    def test_pipeline_column_titles_are_scoped_and_editable_by_editors(self):
        def database_response(method, url, **kwargs):
            table = url.rsplit('/', 1)[-1]
            if table == 'workspace_members':
                return self.httpx.Response(200, json=[{'user_id': self.user_id, 'role': 'editor'}])
            self.assertEqual(table, 'workspace_pipeline_columns')
            self.assertEqual(kwargs['params']['workspace_id'], 'eq.' + self.workspace_id)
            if method == 'GET':
                self.assertEqual(kwargs['params']['order'], 'sort_order')
                return self.httpx.Response(200, json=[{
                    'workspace_id': self.workspace_id,
                    'status': 'Lên ý tưởng',
                    'title': 'Inbox nội dung',
                }])
            self.assertEqual(method, 'PATCH')
            self.assertEqual(kwargs['params']['status'], 'eq.Lên ý tưởng')
            self.assertEqual(kwargs['json'], {'title': 'Ý tưởng cần duyệt'})
            return self.httpx.Response(200, json=[{
                'workspace_id': self.workspace_id,
                'status': 'Lên ý tưởng',
                'title': 'Ý tưởng cần duyệt',
            }])

        with patch('backend.app.workspace.httpx.request', side_effect=database_response):
            client = TestClient(app)
            listed = client.get('/api/pipeline/columns', headers=self.headers)
            updated = client.patch('/api/pipeline/columns', headers=self.headers, json={
                'status': 'Lên ý tưởng',
                'title': '  Ý tưởng cần duyệt  ',
            })
        self.assertEqual(listed.status_code, 200, listed.text)
        self.assertEqual(listed.json()['columns'][0]['title'], 'Inbox nội dung')
        self.assertEqual(updated.status_code, 200, updated.text)
        self.assertEqual(updated.json()['column']['title'], 'Ý tưởng cần duyệt')

    def test_pipeline_columns_can_be_reordered_for_workspace(self):
        calls = []
        def database_response(method, url, **kwargs):
            table = url.rsplit('/', 1)[-1]
            if table == 'workspace_members':
                return self.httpx.Response(200, json=[{'user_id': self.user_id, 'role': 'editor'}])
            self.assertEqual(table, 'workspace_pipeline_columns')
            calls.append((method, kwargs))
            if method == 'GET':
                return self.httpx.Response(200, json=[
                    {'status': 'Lên ý tưởng', 'sort_order': 1, 'is_active': True},
                    {'status': 'Kịch bản', 'sort_order': 2, 'is_active': True},
                    {'status': 'custom_review', 'sort_order': 3, 'is_active': True},
                ])
            self.assertEqual(method, 'PATCH')
            self.assertEqual(kwargs['json']['sort_order'], len([call for call in calls if call[0] == 'PATCH']))
            return self.httpx.Response(200, json=[])

        with patch('backend.app.workspace.httpx.request', side_effect=database_response):
            response = TestClient(app).patch('/api/pipeline/columns/order', headers=self.headers, json={
                'statuses': ['custom_review', 'Lên ý tưởng', 'Kịch bản'],
            })
        self.assertEqual(response.status_code, 200, response.text)
        self.assertEqual(len([call for call in calls if call[0] == 'PATCH']), 3)

    def test_pipeline_column_can_be_added_for_workspace(self):
        def database_response(method, url, **kwargs):
            table = url.rsplit('/', 1)[-1]
            if table == 'workspace_members':
                return self.httpx.Response(200, json=[{'user_id': self.user_id, 'role': 'editor'}])
            self.assertEqual(table, 'workspace_pipeline_columns')
            if method == 'GET':
                return self.httpx.Response(200, json=[
                    {'status': 'Lên ý tưởng', 'sort_order': 1},
                    {'status': 'Đã đăng', 'sort_order': 5},
                ])
            self.assertEqual(method, 'POST')
            self.assertEqual(kwargs['json']['workspace_id'], self.workspace_id)
            self.assertEqual(kwargs['json']['title'], 'Review')
            self.assertTrue(kwargs['json']['status'].startswith('custom_'))
            return self.httpx.Response(201, json=[{
                **kwargs['json'], 'is_active': True,
            }])

        with patch('backend.app.workspace.httpx.request', side_effect=database_response):
            response = TestClient(app).post('/api/pipeline/columns', headers=self.headers, json={'title': ' Review '})
        self.assertEqual(response.status_code, 201, response.text)
        self.assertEqual(response.json()['column']['title'], 'Review')

    def test_pipeline_column_title_rejects_empty_or_unknown_status(self):
        client = TestClient(app)
        with patch('backend.app.workspace.httpx.request', return_value=self.httpx.Response(200, json=[{
            'user_id': self.user_id, 'role': 'owner',
        }])):
            self.assertEqual(
                client.patch('/api/pipeline/columns', headers=self.headers, json={
                    'status': 'Lên ý tưởng', 'title': '   ',
                }).status_code,
                422,
            )
            self.assertEqual(
                client.patch('/api/pipeline/columns', headers=self.headers, json={
                    'status': 'Archive', 'title': 'Archive',
                }).status_code,
                422,
            )

    def test_pipeline_column_can_be_archived_only_when_empty(self):
        def database_response(method, url, **kwargs):
            table = url.rsplit('/', 1)[-1]
            if table == 'workspace_members':
                return self.httpx.Response(200, json=[{'user_id': self.user_id, 'role': 'owner'}])
            if table == 'ideas':
                self.assertEqual(method, 'GET')
                self.assertEqual(kwargs['params']['status'], 'eq.Edit')
                return self.httpx.Response(200, json=[])
            self.assertEqual(table, 'workspace_pipeline_columns')
            self.assertEqual(method, 'PATCH')
            self.assertEqual(kwargs['params']['status'], 'eq.Edit')
            self.assertEqual(kwargs['json'], {'is_active': False})
            return self.httpx.Response(200, json=[{
                'workspace_id': self.workspace_id, 'status': 'Edit', 'title': 'Edit', 'is_active': False,
            }])

        with patch('backend.app.workspace.httpx.request', side_effect=database_response):
            response = TestClient(app).delete('/api/pipeline/columns/Edit', headers=self.headers)
        self.assertEqual(response.status_code, 200, response.text)
        self.assertFalse(response.json()['column']['is_active'])

    def test_pipeline_column_delete_is_rejected_when_cards_exist(self):
        def database_response(method, url, **kwargs):
            table = url.rsplit('/', 1)[-1]
            if table == 'workspace_members':
                return self.httpx.Response(200, json=[{'user_id': self.user_id, 'role': 'owner'}])
            self.assertEqual(table, 'ideas')
            return self.httpx.Response(200, json=[{'id': 42, 'status': 'Edit'}])

        with patch('backend.app.workspace.httpx.request', side_effect=database_response):
            response = TestClient(app).delete('/api/pipeline/columns/Edit', headers=self.headers)
        self.assertEqual(response.status_code, 409, response.text)

    def test_viewer_cannot_create_idea_or_concept_indirectly(self):
        def viewer_response(method, url, **kwargs):
            table = url.rsplit('/', 1)[-1]
            if table == 'workspace_members':
                return self.httpx.Response(200, json=[{'user_id': self.user_id, 'role': 'viewer'}])
            self.fail(f'unexpected database request: {method} {url}')

        with patch('backend.app.workspace.httpx.request', side_effect=viewer_response):
            response = TestClient(app).post(
                '/api/ideas',
                headers=self.headers,
                json={'title': 'Viewer idea', 'concept': 'New concept'},
            )
        self.assertEqual(response.status_code, 403, response.text)

    def test_idea_uses_existing_workspace_concept_canonical_name(self):
        def canonical_response(method, url, **kwargs):
            table = url.rsplit('/', 1)[-1]
            if table == 'workspace_members':
                return self.httpx.Response(200, json=[{'user_id': self.user_id, 'role': 'editor'}])
            if table == 'workspace_concepts' and method == 'GET':
                if 'normalized_name' in kwargs['params']:
                    return self.httpx.Response(200, json=[{
                        'id': 7,
                        'workspace_id': self.workspace_id,
                        'name': 'Vlog',
                        'normalized_name': 'vlog',
                    }])
                return self.httpx.Response(200, json=[])
            if table == 'ideas' and method == 'POST':
                self.assertEqual(kwargs['json']['concept'], 'Vlog')
                return self.httpx.Response(201, json=[{
                    'id': 21,
                    'workspace_id': self.workspace_id,
                    'title': kwargs['json']['title'],
                    'concept': kwargs['json']['concept'],
                }])
            self.fail(f'unexpected database request: {method} {url}')

        with patch('backend.app.workspace.httpx.request', side_effect=canonical_response):
            response = TestClient(app).post(
                '/api/ideas',
                headers=self.headers,
                json={'title': 'Canonical concept', 'concept': ' vlog '},
            )
        self.assertEqual(response.status_code, 201, response.text)
        self.assertEqual(response.json()['idea']['concept'], 'Vlog')
