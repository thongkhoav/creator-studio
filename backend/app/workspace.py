"""User-scoped Supabase transport. Service key is reserved for legacy backfill."""
import os
import time
from dataclasses import dataclass
from threading import Lock
from uuid import UUID

import httpx
from fastapi import HTTPException, Request

BASE_TABLES = ('ideas', 'tracks', 'config_presets', 'editing_shortcuts', 'production_sops')
CONTENT_TABLES = ('content_variants', 'content_schedules', 'platform_presets', 'publishing_checklist_items', 'media_assets')
WORKSPACE_CONCEPTS_TABLE = 'workspace_concepts'

# One pooled client keeps TLS connections to Supabase open between requests.
HTTP = httpx.Client(timeout=30, limits=httpx.Limits(max_connections=20, max_keepalive_connections=10))

# Every API call used to verify the token and the membership again, which cost two
# Supabase round trips before any data was read. Both answers are cached briefly; the
# data itself is still read with the user's token, so RLS keeps enforcing access.
USER_TTL = 60
MEMBER_TTL = 30
_cache = {}
_cache_lock = Lock()


def _cached(key):
    with _cache_lock:
        hit = _cache.get(key)
        if hit and hit[0] > time.monotonic():
            return hit[1]
        _cache.pop(key, None)
    return None


def _remember(key, value, ttl):
    with _cache_lock:
        if len(_cache) > 2000:
            _cache.clear()
        _cache[key] = (time.monotonic() + ttl, value)
    return value


def clear_caches():
    with _cache_lock:
        _cache.clear()


def configuration():
    url = os.environ.get('SUPABASE_URL', '').rstrip('/')
    key = os.environ.get('SUPABASE_PUBLISHABLE_KEY', '')
    if not url or not key:
        raise HTTPException(503, 'Configure SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY.')
    return url, key


@dataclass
class User:
    id: str
    email: str
    token: str


class Database:
    def __init__(self, user):
        self.user = user
        self.url, key = configuration()
        self.headers = {'apikey': key, 'Authorization': f'Bearer {user.token}'}

    def request(self, method, path, **kwargs):
        prefer = kwargs.pop('prefer', 'return=representation')
        try:
            response = HTTP.request(method, self.url + path, headers={**self.headers, 'Prefer': prefer}, **kwargs)
        except httpx.HTTPError as exc:
            raise HTTPException(503, 'Supabase is unavailable. Please retry.') from exc
        if response.status_code >= 400:
            code = {401: 401, 403: 403, 404: 404, 409: 409}.get(response.status_code, 422 if response.status_code == 400 else 503)
            raise HTTPException(code, 'Request rejected. Check permissions, record references and input values.')
        return response.json() if response.content else None

    def rows(self, table, workspace=None, **filters):
        params = {'select': '*', **filters}
        if workspace:
            params['workspace_id'] = f'eq.{workspace}'
        # PostgREST limits rows per request; paginate so the library is not truncated.
        result = []
        for offset in range(0, 100000, 500):
            order_field = (
                'user_id' if table == 'workspace_members'
                else 'sort_order' if table == 'workspace_pipeline_columns'
                else 'id'
            )
            page = self.request('GET', f'/rest/v1/{table}', params={**params, 'order': order_field, 'limit': 500, 'offset': offset})
            result.extend(page)
            if len(page) < 500:
                return result
        raise HTTPException(413, 'Workspace exceeds the supported library size.')

    def rpc(self, name, values):
        return self.request('POST', f'/rest/v1/rpc/{name}', json=values)

    def insert(self, table, values):
        return self.request('POST', f'/rest/v1/{table}', json=values)[0]

    def ensure_workspace_concept(self, workspace_id, name, created_by):
        normalized = name.strip().lower()
        filters = {'normalized_name': f'eq.{normalized}'}
        existing = self.rows('workspace_concepts', workspace_id, **filters)
        if existing:
            return existing[0]
        try:
            return self.insert(
                'workspace_concepts',
                {'workspace_id': workspace_id, 'name': name, 'created_by': created_by},
            )
        except HTTPException as exc:
            # Another request may have inserted the same normalized concept
            # between the read and insert. Return that row and preserve its
            # original creator.
            if exc.status_code != 409:
                raise
            existing = self.rows('workspace_concepts', workspace_id, **filters)
            if existing:
                return existing[0]
            raise

    def patch(self, table, record_id, values):
        rows = self.request('PATCH', f'/rest/v1/{table}', params={'id': f'eq.{record_id}'}, json=values)
        if not rows: raise HTTPException(404, 'Record not found in this workspace.')
        return rows[0]

    def delete(self, table, record_id):
        self.request('DELETE', f'/rest/v1/{table}', params={'id': f'eq.{record_id}'})
        return {'id': record_id}


def current_user(request: Request):
    scheme, _, token = request.headers.get('Authorization', '').partition(' ')
    if scheme.lower() != 'bearer' or not token:
        raise HTTPException(401, 'Sign in required.')
    cached = _cached(('user', token))
    if cached:
        return cached
    url, key = configuration()
    try:
        response = HTTP.get(url + '/auth/v1/user', headers={'apikey': key, 'Authorization': f'Bearer {token}'}, timeout=15)
    except httpx.HTTPError as exc:
        raise HTTPException(503, 'Authentication service unavailable.') from exc
    if response.status_code in (401, 403):
        raise HTTPException(401, 'Session expired. Sign in again.')
    if response.status_code != 200:
        raise HTTPException(503, 'Authentication service unavailable.')
    data = response.json()
    if not data.get('id') or not data.get('email_confirmed_at'):
        raise HTTPException(401, 'Confirm your email before signing in.')
    return _remember(('user', token), User(data['id'], data.get('email', ''), token), USER_TTL)


@dataclass
class Workspace:
    id: str
    role: str
    user: User
    db: Database

    def require(self, *roles):
        if self.role not in roles:
            raise HTTPException(403, 'Your role does not allow this action.')

    def get(self, table, record_id):
        rows = self.db.rows(table, self.id, id=f'eq.{record_id}')
        if not rows:
            raise HTTPException(404, 'Record not found in this workspace.')
        return rows[0]

    def write(self, table, values, record_id=None):
        self.require('owner', 'admin', *(('editor',) if table != 'platform_presets' else ()))
        if record_id is not None:
            self.get(table, record_id)
        params = {'workspace_id': f'eq.{self.id}', 'id': f'eq.{record_id}'} if record_id is not None else {}
        body = dict(values)
        if record_id is None:
            body['workspace_id'] = self.id
        rows = self.db.request('PATCH' if record_id is not None else 'POST', f'/rest/v1/{table}', params=params, json=body)
        if not rows:
            raise HTTPException(404, 'Record not found.')
        return rows[0]


def current_workspace(request: Request):
    # Called directly by route helpers; FastAPI does not resolve Depends here.
    user = current_user(request)
    try:
        workspace_id = str(UUID(request.headers.get('X-Workspace-ID', '')))
    except ValueError as exc:
        raise HTTPException(400, 'Select a workspace.') from exc
    db = Database(user)
    role = _cached(('role', user.id, workspace_id))
    if not role:
        members = db.rows('workspace_members', workspace_id, user_id=f'eq.{user.id}')
        if not members:
            raise HTTPException(403, 'Workspace access denied.')
        role = _remember(('role', user.id, workspace_id), members[0]['role'], MEMBER_TTL)
    return Workspace(workspace_id, role, user, db)
