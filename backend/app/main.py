from __future__ import annotations

import json
import csv
import io
import os
import base64
import hashlib
import hmac
import secrets
import time
import uuid
from concurrent.futures import ThreadPoolExecutor
from datetime import date
from pathlib import Path
from typing import Any, Literal, Protocol
from urllib.parse import urlparse

import httpx
from fastapi import Depends, FastAPI, HTTPException, Request, Response, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from .workspace import clear_caches, current_user, current_workspace, Database, User, Workspace
from pydantic import BaseModel, ConfigDict, Field, ValidationError, field_validator, model_validator

ROOT = Path(__file__).resolve().parents[2]
FRONTEND_DIST = ROOT / "frontend" / "dist"
STATUSES = ("Lên ý tưởng", "Kịch bản", "Quay video", "Edit", "Đã đăng")
CONCEPTS = ("Vlog", "IT meme", "Listing", "Bắt trend", "Capcut mood", "Mental Health", "Setup", "Life moment", "Sức khỏe", "Khác")
TABLES = ("ideas", "tracks", "config_presets", "editing_shortcuts", "production_sops")
PLATFORMS = ("TikTok", "Instagram Reels", "YouTube Shorts", "Facebook Reels", "LinkedIn", "X", "Khác")

class IdeaIn(BaseModel):
    title: str = Field(min_length=1, max_length=240)
    status: str = "Lên ý tưởng"
    concept: str = "Khác"
    priority: int = Field(default=2, ge=1, le=3)
    publish_date: str | None = None
    hook: str = ""
    main_content: str = ""
    audio_sfx: str = ""
    hashtag: list[str] = Field(default_factory=list)
    reference_url: str = ""
    notes: str = ""
    track_id: int | None = None
    platforms: list[str] = Field(default_factory=lambda: ["TikTok"], min_length=1)
    platform_publish_dates: dict[str, str | None] = Field(default_factory=dict)
    platform_publish_links: dict[str, str | None] = Field(default_factory=dict)

    @field_validator("publish_date", mode="before")
    @classmethod
    def empty_publish_date_is_null(cls, value: Any) -> str | None:
        # The frontend uses an empty string for an unset date, while Supabase
        # expects NULL for a nullable date column.
        if value is None or (isinstance(value, str) and not value.strip()):
            return None
        return value

    @field_validator("platforms")
    @classmethod
    def valid_platforms(cls, values: list[str]) -> list[str]:
        if len(set(values)) != len(values) or any(value not in PLATFORMS for value in values):
            raise ValueError("invalid platform")
        return values

    @field_validator("platform_publish_dates", mode="before")
    @classmethod
    def normalize_platform_publish_dates(cls, values: Any) -> dict[str, str | None]:
        if values is None:
            return {}
        if not isinstance(values, dict):
            raise ValueError("invalid platform publish dates")
        cleaned: dict[str, str | None] = {}
        for platform, value in values.items():
            if value is None or (isinstance(value, str) and not value.strip()):
                continue
            if platform not in PLATFORMS or not isinstance(value, str):
                raise ValueError("invalid platform publish dates")
            try:
                date.fromisoformat(value)
            except ValueError as exc:
                raise ValueError("invalid platform publish date") from exc
            cleaned[platform] = value
        return cleaned

    @field_validator("platform_publish_links", mode="before")
    @classmethod
    def normalize_platform_publish_links(cls, values: Any) -> dict[str, str | None]:
        if values is None:
            return {}
        if not isinstance(values, dict):
            raise ValueError("invalid platform publish links")
        cleaned: dict[str, str | None] = {}
        for platform, value in values.items():
            if value is None or (isinstance(value, str) and not value.strip()):
                continue
            if platform not in PLATFORMS or not isinstance(value, str):
                raise ValueError("invalid platform publish links")
            parsed = urlparse(value.strip())
            if parsed.scheme not in ("http", "https") or not parsed.netloc:
                raise ValueError("invalid platform publish link")
            cleaned[platform] = value.strip()
        return cleaned

    @model_validator(mode="after")
    def platform_metadata_match_selection(self) -> "IdeaIn":
        if any(platform not in self.platforms for platform in [*self.platform_publish_dates, *self.platform_publish_links]):
            raise ValueError("platform publish metadata must belong to a selected platform")
        return self

    @field_validator("status")
    @classmethod
    def valid_status(cls, value: str) -> str:
        value = str(value or "").strip()
        if not 1 <= len(value) <= 80: raise ValueError("invalid status")
        return value

    @field_validator("concept")
    @classmethod
    def valid_concept(cls, value: str) -> str:
        # Concepts are workspace-customizable; keep only basic input bounds here.
        value = value.strip()
        if not 1 <= len(value) <= 80: raise ValueError("invalid concept")
        return value

# UI language codes the brainstorm can answer in, mapped to names the model understands.
BRAINSTORM_LANGUAGES = {"vi": "Vietnamese", "en": "English", "ko": "Korean", "ja": "Japanese",
                        "id": "Indonesian", "th": "Thai", "ms": "Malay", "fil": "Filipino"}

class BrainstormIn(BaseModel):
    brief: str = Field(min_length=2, max_length=4000)
    language: Literal["vi", "en", "ko", "ja", "id", "th", "ms", "fil"] = "vi"
    format: str = Field(default="Vlog ngắn", max_length=80)
    duration: str = Field(default="30-40 giây", max_length=80)
    platforms: list[str] = Field(default_factory=lambda: ["TikTok", "Instagram Reels", "YouTube Shorts"], min_length=1)

    @field_validator("platforms")
    @classmethod
    def valid_brainstorm_platforms(cls, values: list[str]) -> list[str]:
        if len(set(values)) != len(values) or any(value not in PLATFORMS for value in values):
            raise ValueError("invalid platform")
        return values

class ExpandIdeaIn(BaseModel):
    title: str = Field(min_length=1, max_length=240)
    hook: str = Field(default="", max_length=2000)
    outline: str = Field(default="", max_length=8000)
    language: Literal["vi", "en", "ko", "ja", "id", "th", "ms", "fil"] = "vi"
    platforms: list[str] = Field(default_factory=lambda: ["TikTok"], min_length=1)

    @field_validator("platforms")
    @classmethod
    def valid_expand_platforms(cls, values: list[str]) -> list[str]:
        if len(set(values)) != len(values) or any(value not in PLATFORMS for value in values):
            raise ValueError("invalid platform")
        return values

class BrainstormHistoryIn(BaseModel):
    brief: str = Field(min_length=2, max_length=4000)
    format: str = Field(default="Vlog ngắn", max_length=80)
    duration: str = Field(default="30-40 giây", max_length=80)
    source: Literal["ai", "demo"] = "ai"
    platforms: list[str] = Field(min_length=1, max_length=len(PLATFORMS))
    ideas: list[dict[str, Any]] = Field(min_length=1, max_length=10)

    @field_validator("platforms")
    @classmethod
    def valid_history_platforms(cls, values: list[str]) -> list[str]:
        if len(set(values)) != len(values) or any(value not in PLATFORMS for value in values):
            raise ValueError("invalid platform")
        return values

class LoginIn(BaseModel):
    password: str = Field(min_length=1, max_length=512)

class MemberRoleIn(BaseModel):
    role: Literal['admin','editor','viewer']
class InviteIn(BaseModel):
    email: str = Field(min_length=3, max_length=320)
    role: Literal['admin','editor','viewer'] = 'editor'
class ScheduleIn(BaseModel):
    variant_id: int
    scheduled_at: str
    status: Literal['draft','scheduled','published','cancelled'] = 'scheduled'
    published_url: str = ''
class PresetIn(BaseModel):
    platform: str
    canvas: str = '1080 x 1920'
    safe_zone: str = ''
    caption_guidance: str = ''
    duration_guidance: str = ''
class ChecklistIn(BaseModel):
    variant_id: int
    label: str = Field(min_length=1, max_length=240)
    completed: bool = False
class MediaIn(BaseModel):
    idea_id: int | None = None
    variant_id: int | None = None
    kind: Literal['final_video','thumbnail','raw_footage','project','audio','published'] = 'final_video'
    label: str = ''
    url: str
    @field_validator('url')
    @classmethod
    def http_url(cls, value):
        parsed = urlparse(value)
        if parsed.scheme not in ('http','https') or not parsed.netloc: raise ValueError('URL must be http or https')
        return value

class ConceptIn(BaseModel):
    name: str = Field(min_length=1)

    @field_validator("name")
    @classmethod
    def valid_name(cls, value: str) -> str:
        value = value.strip()
        if not 1 <= len(value) <= 80:
            raise ValueError("invalid concept")
        return value

class PipelineColumnIn(BaseModel):
    status: str
    title: str = Field(min_length=1, max_length=80)

    @field_validator("status")
    @classmethod
    def valid_status(cls, value: str) -> str:
        value = str(value or "").strip()
        if value not in STATUSES and not (value.startswith("custom_") and 12 <= len(value) <= 80):
            raise ValueError("invalid pipeline status")
        return value

    @field_validator("title", mode="before")
    @classmethod
    def valid_title(cls, value: Any) -> str:
        value = str(value or "").strip()
        if not value:
            raise ValueError("pipeline title is required")
        return value

class PipelineColumnCreateIn(BaseModel):
    title: str = Field(min_length=1, max_length=80)

    @field_validator("title", mode="before")
    @classmethod
    def valid_title(cls, value: Any) -> str:
        value = str(value or "").strip()
        if not value:
            raise ValueError("pipeline title is required")
        return value

class PipelineColumnOrderIn(BaseModel):
    statuses: list[str] = Field(min_length=1, max_length=100)

    @field_validator("statuses")
    @classmethod
    def valid_statuses(cls, values: list[str]) -> list[str]:
        cleaned = [str(value or "").strip() for value in values]
        if len(set(cleaned)) != len(cleaned) or any(not value for value in cleaned):
            raise ValueError("invalid pipeline column order")
        return cleaned

IMPORT_TABLES = ("ideas", "tracks", "config_presets")
IMPORT_MAX_BYTES = 1024 * 1024
IMPORT_SCOPE_ALIASES = {
    "pipeline": "ideas",
    "audio": "tracks",
    "presets": "config_presets",
}

def import_url(value: str) -> str:
    if value and (urlparse(value).scheme not in ("http", "https") or not urlparse(value).netloc):
        raise ValueError("Link phải bắt đầu bằng http:// hoặc https://")
    return value

class ImportIdeaIn(IdeaIn):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)
    priority: int = Field(default=2, ge=1, le=3, strict=True)
    track_id: int | None = Field(default=None, gt=0, strict=True)

    @field_validator("publish_date", mode="before")
    @classmethod
    def import_date(cls, value: Any) -> str | None:
        if value is None or value == "" or (isinstance(value, str) and not value.strip()):
            return None
        if not isinstance(value, str):
            raise ValueError("Ngày phải có dạng YYYY-MM-DD")
        try:
            parsed = date.fromisoformat(value)
        except ValueError as exc:
            raise ValueError("Ngày phải có dạng YYYY-MM-DD hợp lệ") from exc
        if parsed.isoformat() != value:
            raise ValueError("Ngày phải có dạng YYYY-MM-DD")
        return value

    _reference_url = field_validator("reference_url")(import_url)

class ImportTrackIn(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)
    title: str = Field(min_length=1, max_length=240)
    artist_source: str = ""
    mood_genre: str = Field(default="Khác", min_length=1)
    status: Literal["Chưa dùng", "Đã dùng"] = "Chưa dùng"
    audio_url: str = ""
    notes: str = ""
    _audio_url = field_validator("audio_url")(import_url)

class ImportConfigIn(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)
    group_name: str = Field(min_length=1, max_length=240)
    attribute: str = Field(min_length=1, max_length=240)
    value: str = ""
    notes: str = ""
    link_example: str = ""
    _link_example = field_validator("link_example")(import_url)

class ImportIn(BaseModel):
    model_config = ConfigDict(extra="forbid")
    ideas: list[ImportIdeaIn] = Field(default_factory=list, max_length=500)
    tracks: list[ImportTrackIn] = Field(default_factory=list, max_length=500)
    config_presets: list[ImportConfigIn] = Field(default_factory=list, max_length=500)

    @model_validator(mode="after")
    def check_count(self) -> ImportIn:
        count = sum(len(getattr(self, table)) for table in IMPORT_TABLES)
        if not 1 <= count <= 500:
            raise ValueError("File cần có từ 1 đến 500 bản ghi tổng cộng")
        return self

    def counts(self) -> dict[str, int]:
        return {table: len(getattr(self, table)) for table in IMPORT_TABLES}

class Store(Protocol):
    def create_track(self, track: ImportTrackIn) -> dict[str, Any]: ...
    def state(self) -> dict[str, list[dict[str, Any]]]: ...
    def create_idea(self, idea: IdeaIn) -> dict[str, Any]: ...
    def update_idea(self, idea_id: int, patch: dict[str, Any]) -> dict[str, Any]: ...
    def delete_idea(self, idea_id: int) -> dict[str, Any]: ...
    def import_content(self, payload: ImportIn) -> dict[str, int]: ...
    def list_brainstorm_history(self) -> list[dict[str, Any]]: ...
    def create_brainstorm_history(self, payload: BrainstormHistoryIn) -> dict[str, Any]: ...

class MemoryStore:
    def __init__(self) -> None:
        source = ROOT / "sheet-data.json"
        raw = json.loads(source.read_text()) if source.exists() else {table: [] for table in TABLES}
        self.data = {table: list(raw.get(table, [])) for table in TABLES}
        self.brainstorm_history_data: list[dict[str, Any]] = []
        for index, idea in enumerate(self.data["ideas"], 1): idea.setdefault("id", index)
        for table in TABLES[1:]:
            for index, row in enumerate(self.data[table], 1): row.setdefault("id", index)

    def state(self) -> dict[str, list[dict[str, Any]]]: return self.data
    def create_track(self, track: ImportTrackIn) -> dict[str, Any]:
        record = track.model_dump(); record["id"] = max((int(row["id"]) for row in self.data["tracks"]), default=0) + 1
        self.data["tracks"].append(record); return record
    def create_idea(self, idea: IdeaIn) -> dict[str, Any]:
        record = idea.model_dump(); record["id"] = max((int(row["id"]) for row in self.data["ideas"]), default=0) + 1
        self.data["ideas"].append(record); return record
    def update_idea(self, idea_id: int, patch: dict[str, Any]) -> dict[str, Any]:
        for row in self.data["ideas"]:
            if int(row["id"]) == idea_id:
                row.update(patch); return row
        raise KeyError(idea_id)
    def delete_idea(self, idea_id: int) -> dict[str, Any]:
        for index, row in enumerate(self.data["ideas"]):
            if int(row["id"]) == idea_id:
                self.data["ideas"].pop(index)
                return {"id": idea_id}
        raise KeyError(idea_id)

    def list_brainstorm_history(self) -> list[dict[str, Any]]:
        return list(reversed(self.brainstorm_history_data))

    def create_brainstorm_history(self, payload: BrainstormHistoryIn) -> dict[str, Any]:
        record = payload.model_dump()
        record["id"] = max((int(row["id"]) for row in self.brainstorm_history_data), default=0) + 1
        record["created_at"] = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
        self.brainstorm_history_data.append(record)
        return record

    def import_content(self, payload: ImportIn) -> dict[str, int]:
        track_ids = {int(track["id"]) for track in self.data["tracks"]}
        if any(idea.track_id is not None and idea.track_id not in track_ids for idea in payload.ideas):
            raise ValueError("track_id không tồn tại trong thư viện nhạc")
        updated = dict(self.data)
        for table, rows in payload.model_dump().items():
            first_id = max((int(row["id"]) for row in self.data[table]), default=0) + 1
            updated[table] = self.data[table] + [{**row, "id": first_id + index} for index, row in enumerate(rows)]
        self.data = updated
        return payload.counts()

class SupabaseStore:
    def __init__(self) -> None:
        self.url = os.environ.get("SUPABASE_URL", "").rstrip("/")
        # New Supabase ``sb_secret_...`` keys replace the legacy service_role key.
        self.key = os.environ.get("SUPABASE_SECRET_KEY") or os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
        if not self.url or not self.key: raise RuntimeError("SUPABASE_URL and SUPABASE_SECRET_KEY are required")
        self.headers = {"apikey": self.key, "Authorization": f"Bearer {self.key}", "Content-Type": "application/json"}

    def _request(self, method: str, table: str, **kwargs: Any) -> list[dict[str, Any]]:
        response = httpx.request(method, f"{self.url}/rest/v1/{table}", headers={**self.headers, "Prefer": "return=representation"}, timeout=20, **kwargs)
        response.raise_for_status(); return response.json() if response.content else []
    def state(self) -> dict[str, list[dict[str, Any]]]: return {table: self._request("GET", table, params={"select": "*", "order": "id"}) for table in TABLES}
    def create_track(self, track: ImportTrackIn) -> dict[str, Any]: return self._request("POST", "tracks", json=track.model_dump())[0]
    def create_idea(self, idea: IdeaIn) -> dict[str, Any]: return self._request("POST", "ideas", json=idea.model_dump())[0]
    def update_idea(self, idea_id: int, patch: dict[str, Any]) -> dict[str, Any]:
        rows = self._request("PATCH", "ideas", params={"id": f"eq.{idea_id}"}, json=patch)
        if not rows: raise KeyError(idea_id)
        return rows[0]
    def delete_idea(self, idea_id: int) -> dict[str, Any]:
        rows = self._request("DELETE", "ideas", params={"id": f"eq.{idea_id}"})
        if not rows: raise KeyError(idea_id)
        return {"id": idea_id}

    def import_content(self, payload: ImportIn) -> dict[str, int]:
        # PostgREST executes this single RPC in one database transaction.
        response = httpx.post(f"{self.url}/rest/v1/rpc/import_content", headers=self.headers,
                              json={"payload": payload.model_dump()}, timeout=30)
        if response.status_code == 404:
            raise HTTPException(503, "Cần chạy supabase/import.sql trong Supabase SQL Editor trước khi import.")
        if response.status_code == 409:
            raise ValueError("Dữ liệu vi phạm ràng buộc; kiểm tra track_id đã tồn tại trong thư viện nhạc")
        response.raise_for_status()
        return response.json()

_memory_store = MemoryStore()
def get_store() -> Store:
    if os.environ.get("SUPABASE_URL") and (os.environ.get("SUPABASE_SECRET_KEY") or os.environ.get("SUPABASE_SERVICE_ROLE_KEY")): return SupabaseStore()
    return _memory_store

app = FastAPI(title="Content Creator Studio API", version="1.0.0")
app.add_middleware(CORSMiddleware, allow_origins=[os.environ.get("FRONTEND_ORIGIN", "http://localhost:5173")], allow_methods=["*"], allow_headers=["*"], allow_credentials=True)

SESSION_COOKIE = "content_creator_session"
SESSION_TTL = 60 * 60 * 24 * 14

def _auth_configured() -> bool:
    return bool(os.environ.get("APP_PASSWORD", "").strip() and _session_secret())

def _session_secret() -> str:
    return os.environ.get("APP_SESSION_SECRET", "").strip()

def _sign_session(expiry: int) -> str:
    payload = str(expiry).encode()
    signature = hmac.new(_session_secret().encode(), payload, hashlib.sha256).digest()
    return base64.urlsafe_b64encode(payload + b"." + signature).decode().rstrip("=")

def _valid_session(token: str | None) -> bool:
    if not token or not _session_secret(): return False
    try:
        raw = base64.urlsafe_b64decode(token + "=" * (-len(token) % 4))
        payload, signature = raw.split(b".", 1)
        expiry = int(payload)
    except (ValueError, TypeError):
        return False
    expected = hmac.new(_session_secret().encode(), payload, hashlib.sha256).digest()
    return expiry > int(time.time()) and hmac.compare_digest(signature, expected)

def require_auth(request: Request) -> None:
    # Production authentication is Supabase bearer auth. Password sessions are
    # retained only for the local compatibility test path while migration runs.
    if request.headers.get("Authorization", "").lower().startswith("bearer "):
        user = current_user(request)
        request.state.user = user
        return
    auth_mode = os.environ.get("AUTH_MODE") or ("supabase" if os.environ.get("SUPABASE_URL") else "legacy")
    if auth_mode.lower() != "legacy" and not request.headers.get("Authorization", "").lower().startswith("bearer "):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Sign in required.")
    if auth_mode.lower() != "legacy":
        return
    if not os.environ.get("APP_PASSWORD", "").strip() or not _session_secret(): raise HTTPException(503, "Authentication is misconfigured: set APP_PASSWORD and APP_SESSION_SECRET.")
    if not _valid_session(request.cookies.get(SESSION_COOKIE)): raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Login required")

def scoped_workspace(request: Request) -> Workspace | None:
    if request.headers.get("Authorization", "").lower().startswith("bearer "):
        return current_workspace(request)
    return None

@app.get("/api/auth/me")
def auth_me(request: Request) -> dict[str, bool]:
    if request.headers.get("Authorization", "").lower().startswith("bearer "):
        user = current_user(request)
        return {"authenticated": True, "user": {"id": user.id, "email": user.email}}
    auth_mode = os.environ.get("AUTH_MODE") or ("supabase" if os.environ.get("SUPABASE_URL") else "legacy")
    if auth_mode.lower() != "legacy": raise HTTPException(401, "Sign in required.")
    if not _auth_configured(): raise HTTPException(503, "Authentication is misconfigured: set Supabase Auth.")
    return {"authenticated": _valid_session(request.cookies.get(SESSION_COOKIE))}

@app.post("/api/auth/login")
def auth_login(credentials: LoginIn, response: Response, request: Request) -> dict[str, bool]:
    if os.environ.get("SUPABASE_URL") and os.environ.get("AUTH_MODE", "supabase").lower() != "legacy":
        raise HTTPException(410, "Password login was replaced by Supabase Auth.")
    if not _auth_configured(): raise HTTPException(503, "Authentication is misconfigured: set APP_PASSWORD and APP_SESSION_SECRET.")
    if not secrets.compare_digest(credentials.password.encode("utf-8"), os.environ["APP_PASSWORD"].encode("utf-8")):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid password")
    secure = request.url.scheme == "https" or request.headers.get("x-forwarded-proto", "").lower() == "https"
    response.set_cookie(SESSION_COOKIE, _sign_session(int(time.time()) + SESSION_TTL), httponly=True, secure=secure, samesite="lax", max_age=SESSION_TTL, path="/")
    return {"authenticated": True}

@app.post("/api/auth/logout")
def auth_logout(response: Response) -> dict[str, bool]:
    response.delete_cookie(SESSION_COOKIE, path="/")
    return {"authenticated": False}

@app.get("/api/health")
def health() -> dict[str, Any]: return {"ok": True, "database": "supabase" if os.environ.get("SUPABASE_URL") else "memory", "ai_configured": bool(os.environ.get("LLM_API_KEY"))}

@app.get("/api/config")
def client_config() -> dict[str, str]:
    return {"supabaseUrl": os.environ.get("SUPABASE_URL", ""), "supabaseKey": os.environ.get("SUPABASE_PUBLISHABLE_KEY", "")}

def require_global_admin(request: Request):
    user = current_user(request)
    admins = {x.strip() for x in os.environ.get('ADMIN_USER_IDS','').split(',') if x.strip()}
    if user.id not in admins:
        raise HTTPException(403, 'Global admin access required.')
    return user

@app.get('/api/admin/status')
def admin_status(request: Request):
    user = require_global_admin(request)
    return {'is_admin': True, 'user_id': user.id}

@app.get('/api/admin/workspaces')
def admin_workspaces(request: Request):
    require_global_admin(request)
    url=os.environ.get('SUPABASE_URL','').rstrip('/'); key=os.environ.get('SUPABASE_SECRET_KEY','')
    if not url or not key: raise HTTPException(503, 'SUPABASE_SECRET_KEY is required for global admin.')
    headers={'apikey':key,'Authorization':f'Bearer {key}'}
    response=httpx.get(f'{url}/rest/v1/workspaces',headers=headers,params={'select':'id,name,created_by,created_at','order':'created_at.desc'},timeout=20)
    if response.status_code >= 400: raise HTTPException(503,'Could not load admin data.')
    return {'workspaces': response.json()}

@app.get("/api/workspaces")
def workspaces(user: User = Depends(current_user)) -> dict[str, Any]:
    db = Database(user)
    return {"workspaces": db.rows("workspaces")}

@app.post("/api/workspaces")
def create_workspace(payload: dict[str, str], user: User = Depends(current_user)) -> dict[str, Any]:
    name = (payload.get("name") or "").strip()
    if not 2 <= len(name) <= 120: raise HTTPException(422, "Workspace name must be 2-120 characters.")
    return {"workspace": Database(user).rpc("create_workspace", {"workspace_name": name})}

def ws(request: Request):
    return current_workspace(request)

@app.get('/api/members')
def list_members(workspace: Workspace = Depends(ws)):
    return {'members': workspace.db.rows('workspace_members', workspace.id)}

@app.post('/api/members/invite')
def invite_member(payload: InviteIn, workspace: Workspace = Depends(ws)):
    workspace.require('owner','admin')
    return {'invitation': workspace.db.rpc('invite_workspace_member', {'target_workspace': workspace.id, 'invite_email': payload.email, 'invite_role': payload.role})}

@app.patch('/api/members/{user_id}')
def change_member(user_id: str, payload: MemberRoleIn, workspace: Workspace = Depends(ws)):
    workspace.require('owner','admin')
    member = workspace.db.rpc('change_workspace_member_role', {'target_workspace': workspace.id, 'target_user': user_id, 'new_role': payload.role})
    clear_caches()
    return {'member': member}

@app.delete('/api/members/{user_id}')
def remove_member(user_id: str, workspace: Workspace = Depends(ws)):
    workspace.require('owner','admin')
    workspace.db.rpc('remove_workspace_member', {'target_workspace': workspace.id, 'target_user': user_id})
    clear_caches()
    return {'ok': True}

@app.get('/api/concepts')
def concepts(workspace: Workspace = Depends(ws)):
    return {'concepts': workspace.db.rows('workspace_concepts', workspace.id)}

@app.post('/api/concepts', status_code=201)
def create_concept(payload: ConceptIn, workspace: Workspace = Depends(ws)):
    workspace.require('owner', 'admin', 'editor')
    concept = workspace.db.ensure_workspace_concept(
        workspace.id, payload.name, workspace.user.id,
    )
    return {'concept': concept}

@app.get('/api/pipeline/columns')
def pipeline_columns(workspace: Workspace = Depends(ws)):
    return {'columns': workspace.db.rows('workspace_pipeline_columns', workspace.id)}

def _validate_workspace_pipeline_status(workspace: Workspace, status: str) -> None:
    try:
        PipelineColumnIn(status=status, title='Column')
    except ValueError as exc:
        raise HTTPException(422, 'Invalid pipeline status.') from exc
    columns = workspace.db.rows('workspace_pipeline_columns', workspace.id, status=f'eq.{status}')
    if not columns:
        raise HTTPException(422, 'Pipeline column is not configured for this workspace.')

@app.post('/api/pipeline/columns', status_code=201)
def create_pipeline_column(payload: PipelineColumnCreateIn, workspace: Workspace = Depends(ws)):
    workspace.require('owner', 'admin', 'editor')
    existing = workspace.db.rows('workspace_pipeline_columns', workspace.id)
    status = f'custom_{uuid.uuid4().hex}'
    sort_order = max((int(row.get('sort_order') or 0) for row in existing), default=len(existing)) + 1
    return {'column': workspace.db.insert('workspace_pipeline_columns', {
        'workspace_id': workspace.id,
        'status': status,
        'title': payload.title,
        'sort_order': sort_order,
        'is_active': True,
    })}

@app.patch('/api/pipeline/columns/order')
def reorder_pipeline_columns(payload: PipelineColumnOrderIn, workspace: Workspace = Depends(ws)):
    workspace.require('owner', 'admin', 'editor')
    columns = workspace.db.rows('workspace_pipeline_columns', workspace.id)
    by_status = {str(row.get('status')): row for row in columns}
    if set(payload.statuses) != {status for status, row in by_status.items() if row.get('is_active', True)}:
        raise HTTPException(422, 'Order must include every active pipeline column exactly once.')
    for order, status in enumerate(payload.statuses, 1):
        workspace.db.request(
            'PATCH',
            '/rest/v1/workspace_pipeline_columns',
            params={
                'workspace_id': f'eq.{workspace.id}',
                'status': f'eq.{status}',
            },
            json={'sort_order': order},
        )
    updated = workspace.db.rows('workspace_pipeline_columns', workspace.id)
    return {'columns': updated}

@app.patch('/api/pipeline/columns')
def update_pipeline_column(payload: PipelineColumnIn, workspace: Workspace = Depends(ws)):
    workspace.require('owner', 'admin', 'editor')
    _validate_workspace_pipeline_status(workspace, payload.status)
    rows = workspace.db.request(
        'PATCH',
        '/rest/v1/workspace_pipeline_columns',
        params={
            'workspace_id': f'eq.{workspace.id}',
            'status': f'eq.{payload.status}',
        },
        json={'title': payload.title},
    )
    if not rows:
        raise HTTPException(404, 'Pipeline column not found in this workspace.')
    return {'column': rows[0]}

@app.delete('/api/pipeline/columns/{status}')
def archive_pipeline_column(status: str, workspace: Workspace = Depends(ws)):
    workspace.require('owner', 'admin', 'editor')
    try:
        PipelineColumnIn(status=status, title='Column')
    except ValueError as exc:
        raise HTTPException(422, 'Invalid pipeline status.') from exc
    ideas = workspace.db.rows('ideas', workspace.id, status=f'eq.{status}')
    if ideas:
        raise HTTPException(409, 'Move or remove all ideas from this column before deleting it.')
    rows = workspace.db.request(
        'PATCH',
        '/rest/v1/workspace_pipeline_columns',
        params={
            'workspace_id': f'eq.{workspace.id}',
            'status': f'eq.{status}',
        },
        json={'is_active': False},
    )
    if not rows:
        raise HTTPException(404, 'Pipeline column not found in this workspace.')
    return {'column': rows[0]}

@app.get('/api/schedules')
def schedules(workspace: Workspace = Depends(ws)): return {'schedules': workspace.db.rows('content_schedules', workspace.id)}
@app.get('/api/variants')
def variants(workspace: Workspace = Depends(ws)): return {'variants': workspace.db.rows('content_variants', workspace.id)}
@app.post('/api/schedules', status_code=201)
def create_schedule(payload: ScheduleIn, workspace: Workspace = Depends(ws)):
    workspace.require('owner','admin','editor')
    return {'schedule': workspace.db.insert('content_schedules', {**payload.model_dump(), 'workspace_id': workspace.id})}
@app.patch('/api/schedules/{record_id}')
def update_schedule(record_id: int, payload: dict[str, Any], workspace: Workspace = Depends(ws)):
    workspace.require('owner','admin','editor'); return {'schedule': workspace.db.patch('content_schedules', record_id, payload)}
@app.delete('/api/schedules/{record_id}')
def delete_schedule(record_id: int, workspace: Workspace = Depends(ws)):
    workspace.require('owner','admin','editor'); return workspace.db.delete('content_schedules', record_id)

@app.get('/api/presets')
def presets(workspace: Workspace = Depends(ws)): return {'presets': workspace.db.rows('platform_presets', workspace.id)}
@app.post('/api/presets', status_code=201)
def create_preset(payload: PresetIn, workspace: Workspace = Depends(ws)):
    workspace.require('owner','admin'); return {'preset': workspace.db.insert('platform_presets', {**payload.model_dump(), 'workspace_id': workspace.id})}
@app.patch('/api/presets/{record_id}')
def update_preset(record_id: int, payload: PresetIn, workspace: Workspace = Depends(ws)):
    workspace.require('owner','admin'); return {'preset': workspace.db.patch('platform_presets', record_id, payload.model_dump())}
@app.delete('/api/presets/{record_id}')
def delete_preset(record_id: int, workspace: Workspace = Depends(ws)):
    workspace.require('owner','admin'); return workspace.db.delete('platform_presets', record_id)

@app.get('/api/checklist')
def checklist(workspace: Workspace = Depends(ws)): return {'items': workspace.db.rows('publishing_checklist_items', workspace.id)}
@app.post('/api/checklist', status_code=201)
def create_checklist(payload: ChecklistIn, workspace: Workspace = Depends(ws)):
    workspace.require('owner','admin','editor'); return {'item': workspace.db.insert('publishing_checklist_items', {**payload.model_dump(), 'workspace_id': workspace.id})}
@app.patch('/api/checklist/{record_id}')
def update_checklist(record_id: int, payload: dict[str, Any], workspace: Workspace = Depends(ws)):
    workspace.require('owner','admin','editor'); return {'item': workspace.db.patch('publishing_checklist_items', record_id, payload)}
@app.delete('/api/checklist/{record_id}')
def delete_checklist(record_id: int, workspace: Workspace = Depends(ws)):
    workspace.require('owner','admin','editor'); return workspace.db.delete('publishing_checklist_items', record_id)

@app.get('/api/media')
def media(workspace: Workspace = Depends(ws)): return {'media': workspace.db.rows('media_assets', workspace.id)}
@app.post('/api/media', status_code=201)
def create_media(payload: MediaIn, workspace: Workspace = Depends(ws)):
    workspace.require('owner','admin','editor'); return {'media': workspace.db.insert('media_assets', {**payload.model_dump(), 'workspace_id': workspace.id, 'created_by': workspace.user.id})}
@app.delete('/api/media/{record_id}')
def delete_media(record_id: int, workspace: Workspace = Depends(ws)):
    workspace.require('owner','admin','editor'); return workspace.db.delete('media_assets', record_id)

@app.get("/api/state")
def state(request: Request, _: None = Depends(require_auth), store: Store = Depends(get_store)) -> dict[str, list[dict[str, Any]]]:
    try:
        workspace = scoped_workspace(request)
        if workspace:
            # Read the five libraries in parallel instead of one Supabase round trip after another.
            with ThreadPoolExecutor(max_workers=len(TABLES)) as pool:
                results = pool.map(lambda table: workspace.db.rows(table, workspace.id), TABLES)
                return dict(zip(TABLES, results))
        return store.state()
    except HTTPException:
        raise
    except Exception as exc: raise HTTPException(503, "Database unavailable. Please retry.") from exc

@app.post("/api/ideas", status_code=201)
def create_idea(idea: IdeaIn, request: Request, _: None = Depends(require_auth), store: Store = Depends(get_store)) -> dict[str, Any]:
    try:
        workspace = scoped_workspace(request)
        if workspace:
            workspace.require('owner', 'admin', 'editor')
            if idea.status not in STATUSES:
                _validate_workspace_pipeline_status(workspace, idea.status)
            concept = workspace.db.ensure_workspace_concept(
                workspace.id, idea.concept, workspace.user.id,
            )
            return {"idea": workspace.db.insert("ideas", {
                **idea.model_dump(),
                "concept": concept["name"],
                "workspace_id": workspace.id,
            })}
        if idea.status not in STATUSES:
            raise HTTPException(422, 'Invalid pipeline status.')
        return {"idea": store.create_idea(idea)}
    except HTTPException:
        raise
    except Exception as exc: raise HTTPException(503, "Database unavailable. Please retry.") from exc

@app.delete("/api/ideas/{idea_id}")
def delete_idea(idea_id: int, request: Request, _: None = Depends(require_auth), store: Store = Depends(get_store)) -> dict[str, Any]:
    try:
        workspace = scoped_workspace(request)
        if workspace:
            workspace.require('owner', 'admin', 'editor')
            workspace.get("ideas", idea_id)
            return {"idea": workspace.db.delete("ideas", idea_id)}
        return {"idea": store.delete_idea(idea_id)}
    except HTTPException:
        raise
    except KeyError as exc:
        raise HTTPException(404, "Idea not found") from exc
    except Exception as exc:
        raise HTTPException(503, "Database unavailable. Please retry.") from exc

@app.post("/api/tracks", status_code=201)
def create_track(track: ImportTrackIn, request: Request, _: None = Depends(require_auth), store: Store = Depends(get_store)) -> dict[str, Any]:
    try:
        workspace = scoped_workspace(request)
        if workspace:
            return {"track": workspace.db.insert("tracks", {**track.model_dump(), "workspace_id": workspace.id})}
        return {"track": store.create_track(track)}
    except HTTPException:
        raise
    except Exception as exc: raise HTTPException(503, "Database unavailable. Please retry.") from exc

@app.patch('/api/tracks/{track_id}')
def update_track(track_id: int, payload: dict[str, Any], workspace: Workspace = Depends(ws)):
    workspace.require('owner', 'admin', 'editor')
    source = workspace.get('tracks', track_id)
    fields = set(ImportTrackIn.model_fields)
    if set(payload) - fields:
        raise HTTPException(422, 'Unknown track fields.')
    try:
        track = ImportTrackIn.model_validate({**{key: value for key, value in source.items() if key in fields}, **payload})
    except ValidationError as exc:
        raise HTTPException(422, 'Invalid track fields. Check the title, mood, status and audio link.') from exc
    rows = workspace.db.request('PATCH', '/rest/v1/tracks',
        params={'id': f'eq.{track_id}', 'workspace_id': f'eq.{workspace.id}'}, json=track.model_dump())
    if not rows:
        raise HTTPException(404, 'Track not found in this workspace.')
    return {'track': rows[0]}

@app.patch("/api/ideas/{idea_id}")
def update_idea(idea_id: int, patch: dict[str, Any], request: Request, _: None = Depends(require_auth), store: Store = Depends(get_store)) -> dict[str, Any]:
    allowed = set(IdeaIn.model_fields)
    clean = {key: value for key, value in patch.items() if key in allowed}
    try:
        workspace = scoped_workspace(request)
        source = workspace.get("ideas", idea_id) if workspace else next((row for row in store.state()["ideas"] if int(row["id"]) == idea_id), {})
        validated = IdeaIn.model_validate({**source, **clean})
        if workspace:
            workspace.require('owner', 'admin', 'editor')
            if validated.status not in STATUSES:
                _validate_workspace_pipeline_status(workspace, validated.status)
            concept = workspace.db.ensure_workspace_concept(
                workspace.id, validated.concept, workspace.user.id,
            )
            return {"idea": workspace.db.patch("ideas", idea_id, {
                **validated.model_dump(),
                "concept": concept["name"],
            })}
        if validated.status not in STATUSES:
            raise HTTPException(422, 'Invalid pipeline status.')
        return {"idea": store.update_idea(idea_id, validated.model_dump())}
    except KeyError as exc: raise HTTPException(404, "Idea not found") from exc
    except ValueError as exc: raise HTTPException(422, str(exc)) from exc
    except HTTPException:
        raise
    except Exception as exc: raise HTTPException(503, "Database unavailable. Please retry.") from exc

def ask_llm_json(instructions: str, prompt: str) -> dict[str, Any]:
    api_key = os.environ.get("LLM_API_KEY", "").strip()
    if not api_key: raise HTTPException(503, "AI is not configured. Set LLM_API_KEY on the server.")
    base_url = os.environ.get("LLM_BASE_URL", "https://api.openai.com/v1").rstrip("/")
    # JSON mode is rejected unless the input itself mentions JSON.
    payload = {"model": os.environ.get("LLM_MODEL", "gpt-4.1-mini"), "instructions": instructions, "input": f"{prompt}\n\nAnswer with the JSON object only.", "text": {"format": {"type": "json_object"}}}
    try:
        response = httpx.post(f"{base_url}/responses", headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"}, json=payload, timeout=45); response.raise_for_status(); data = response.json()
        text = data.get("output_text", "") or "\n".join(content.get("text", "") for item in data.get("output", []) for content in item.get("content", []) if isinstance(content, dict))
        parsed = json.loads(text)
        if not isinstance(parsed, dict): raise ValueError("expected a JSON object")
        return parsed
    except (httpx.HTTPError, json.JSONDecodeError, ValueError) as exc: raise HTTPException(502, f"AI proxy request failed: {exc}") from exc

@app.post("/api/brainstorm")
def brainstorm(request: BrainstormIn, http_request: Request, _: None = Depends(require_auth)) -> dict[str, Any]:
    if os.environ.get("SUPABASE_URL"):
        scoped_workspace(http_request)
    platform_list = ", ".join(request.platforms)
    language = BRAINSTORM_LANGUAGES[request.language]
    prompt = f"Topic: {request.brief}\nFormat: {request.format}\nLength: {request.duration}\nPlatforms to optimize for: {platform_list}"
    instructions = f"You are a multi-platform short-form content strategist. Write every text field in {language}. " + "Return JSON object {ideas:[{title,hook,outline,format,platforms,adaptations}]} with exactly 3 concrete shootable ideas. For each idea include platforms and concise adaptations for TikTok, Instagram Reels, YouTube Shorts, Facebook Reels, LinkedIn, or X when relevant. Do not claim a trend without evidence."
    ideas = ask_llm_json(instructions, prompt).get("ideas")
    if not isinstance(ideas, list): raise HTTPException(502, "AI proxy request failed: missing ideas")
    return {"ideas": ideas[:3], "source": "ai"}

@app.post("/api/brainstorm/expand")
def expand_idea(request: ExpandIdeaIn, http_request: Request, _: None = Depends(require_auth)) -> dict[str, Any]:
    # Turns a rough idea card into something shootable; the client shows it for review before saving.
    if os.environ.get("SUPABASE_URL"):
        scoped_workspace(http_request)
    language = BRAINSTORM_LANGUAGES[request.language]
    prompt = f"Idea: {request.title}\nCurrent hook: {request.hook or '-'}\nCurrent notes: {request.outline or '-'}\nPlatforms: {', '.join(request.platforms)}"
    instructions = f"You are a short-form video script editor. Write every text field in {language}. " + "Keep the creator's idea and any notes they wrote; sharpen it into a video they can film today. Return JSON object {hook, outline, adaptations} where hook is one spoken opening line under 15 words, outline is 4-6 short numbered beats separated by newlines, and adaptations maps each listed platform to one caption line. Do not claim a trend without evidence."
    result = ask_llm_json(instructions, prompt)
    hook, outline, adaptations = result.get("hook"), result.get("outline"), result.get("adaptations") or {}
    if not isinstance(hook, str) or not isinstance(outline, (str, list)) or not isinstance(adaptations, dict):
        raise HTTPException(502, "AI proxy request failed: unexpected shape")
    if isinstance(outline, list): outline = "\n".join(str(line) for line in outline)
    return {"idea": {"hook": hook.strip(), "outline": outline.strip(), "adaptations": {k: str(v) for k, v in adaptations.items() if k in request.platforms}}}

@app.get("/api/brainstorm/history")
def brainstorm_history(http_request: Request, _: None = Depends(require_auth), store: Store = Depends(get_store)) -> dict[str, Any]:
    workspace = scoped_workspace(http_request)
    if workspace:
        return {"history": workspace.db.rows("brainstorm_history", workspace.id)}
    return {"history": store.list_brainstorm_history()}

@app.post("/api/brainstorm/history", status_code=201)
def save_brainstorm_history(payload: BrainstormHistoryIn, http_request: Request, _: None = Depends(require_auth), store: Store = Depends(get_store)) -> dict[str, Any]:
    workspace = scoped_workspace(http_request)
    if workspace:
        workspace.require("owner", "admin", "editor")
        return {"history": workspace.db.insert("brainstorm_history", {
            **payload.model_dump(),
            "workspace_id": workspace.id,
            "created_by": workspace.user.id,
        })}
    return {"history": store.create_brainstorm_history(payload)}

async def import_payload(request: Request, _: None = Depends(require_auth)) -> ImportIn:
    body = bytearray()
    async for chunk in request.stream():
        body.extend(chunk)
        if len(body) > IMPORT_MAX_BYTES:
            raise HTTPException(413, "JSON vượt quá giới hạn 1 MB")
    try:
        text = body.decode("utf-8-sig")
        scope = request.query_params.get("scope", "ideas" if "csv" in request.headers.get("content-type", "").lower() else "")
        scope = IMPORT_SCOPE_ALIASES.get(scope, scope)
        if scope and scope not in IMPORT_TABLES:
            raise ValueError("Import scope không hợp lệ")
        if "csv" in request.headers.get("content-type", "").lower():
            rows = list(csv.DictReader(io.StringIO(text)))
            if scope == "ideas":
                for row in rows:
                    row["platforms"] = [p.strip() for p in row.get("platforms", "").replace(";", "|").split("|") if p.strip()]
            data = {table: [] for table in IMPORT_TABLES}
            data[scope] = rows
        else:
            data = json.loads(text)
            if scope:
                if not isinstance(data, dict):
                    raise ValueError("JSON import phải là object")
                selected_rows = data.get(scope, [])
                other_rows = [row for table in IMPORT_TABLES if table != scope for row in data.get(table, [])]
                unknown_tables = set(data) - set(IMPORT_TABLES)
                if other_rows or unknown_tables:
                    raise ValueError(f"Page này chỉ nhận import {scope}")
                data = {table: [] for table in IMPORT_TABLES} | {scope: selected_rows}
    except (ValueError, UnicodeDecodeError, csv.Error) as exc:
        raise HTTPException(422, "File không hợp lệ. Dùng đúng mẫu JSON hoặc CSV.") from exc
    try:
        return ImportIn.model_validate(data)
    except ValidationError as exc:
        # Do not echo the uploaded content in error responses.
        errors = [{"loc": list(error["loc"]), "msg": error["msg"], "type": error["type"]}
                  for error in exc.errors(include_input=False, include_context=False, include_url=False)]
        raise HTTPException(422, errors) from exc

@app.post("/api/import/preview")
def preview_import(payload: ImportIn = Depends(import_payload)) -> dict[str, Any]:
    return {"counts": payload.counts(), "preview": {table: rows[:3] for table, rows in payload.model_dump().items()}}

@app.post("/api/import")
def import_content(request: Request, payload: ImportIn = Depends(import_payload), store: Store = Depends(get_store)) -> dict[str, Any]:
    try:
        workspace = scoped_workspace(request)
        if workspace:
            workspace.require('owner','admin','editor')
            counts = {}
            for table, rows in payload.model_dump().items():
                counts[table] = 0
                for row in rows:
                    if table == 'ideas':
                        concept = workspace.db.ensure_workspace_concept(
                            workspace.id, row['concept'], workspace.user.id,
                        )
                        row = {**row, 'concept': concept['name']}
                    workspace.db.insert(table, {**row, 'workspace_id': workspace.id})
                    counts[table] += 1
            return {'imported': counts}
        return {"imported": store.import_content(payload)}
    except HTTPException:
        raise
    except ValueError as exc:
        raise HTTPException(422, str(exc)) from exc
    except Exception as exc:
        raise HTTPException(503, "Không thể import dữ liệu. Kiểm tra kết nối database trước khi thử lại.") from exc

if FRONTEND_DIST.exists():
    app.mount("/assets", StaticFiles(directory=FRONTEND_DIST / "assets"), name="assets")
    @app.get("/{path:path}")
    def frontend(path: str = "") -> FileResponse:
        target = (FRONTEND_DIST / path).resolve() if path else FRONTEND_DIST / "index.html"
        # Never let the SPA fallback turn arbitrary filesystem paths into downloads.
        if target.is_file() and (target == FRONTEND_DIST / "index.html" or FRONTEND_DIST in target.parents):
            return FileResponse(target)
        return FileResponse(FRONTEND_DIST / "index.html")

@app.get('/api/backfill/preview')
def backfill_preview(workspace: Workspace = Depends(ws)):
    workspace.require('owner')
    return {'counts': workspace.db.rpc('preview_legacy_backfill', {'target_workspace': workspace.id})}

@app.post('/api/backfill')
def backfill(workspace: Workspace = Depends(ws)):
    workspace.require('owner')
    return {'backfilled': workspace.db.rpc('backfill_legacy_workspace', {'target_workspace': workspace.id})}
