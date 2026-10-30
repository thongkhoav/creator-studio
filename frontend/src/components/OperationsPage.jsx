import { useEffect, useState } from "react";
import { apiFetch } from "../lib/supabase";
import PlatformBadge from "./PlatformBadge";

export default function OperationsPage({ workspaceId, lang, notify }) {
  const [tab, setTab] = useState("calendar");
  const [rows, setRows] = useState([]);
  const [page, setPage] = useState(1);
  const pageSize = 12;
  const [members, setMembers] = useState([]);
  const [form, setForm] = useState({});
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const responseError = async (response, fallback) => {
    const payload = await response.json().catch(() => ({}));
    return payload.detail || fallback;
  };
  const load = async () => {
    const path = {
      calendar: "/api/schedules",
      presets: "/api/presets",
      checklist: "/api/checklist",
      media: "/api/media",
      members: "/api/members",
    }[tab];
    setLoading(true);
    setError("");
    try {
      const r = await apiFetch(path, {}, workspaceId);
      if (!r.ok) throw new Error(await responseError(r, "Could not load this section."));
      const j = await r.json();
      setRows(j.schedules || j.presets || j.items || j.media || []);
      setMembers(j.members || []);
    } catch (cause) {
      setError(cause.message || (lang === "en" ? "Could not load this section." : "Không thể tải dữ liệu phần này."));
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    load();
    setPage(1);
  }, [tab, workspaceId]);
  const create = async (e) => {
    e.preventDefault();
    const path = {
      calendar: "/api/schedules",
      presets: "/api/presets",
      checklist: "/api/checklist",
      media: "/api/media",
      members: "/api/members/invite",
    }[tab];
    const body = {
      ...form,
      ...(["calendar", "checklist"].includes(tab)
        ? { variant_id: Number(form.variant_id) }
        : {}),
    };
    setBusy(true);
    setError("");
    try {
      const r = await apiFetch(
        path,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
        workspaceId,
      );
      if (!r.ok) throw new Error(await responseError(r, lang === "en" ? "Could not save this record." : "Không thể lưu bản ghi này."));
      setForm({});
      await load();
      notify(lang === "en" ? "Saved" : "Đã lưu");
    } catch (cause) {
      setError(cause.message || (lang === "en" ? "Could not save this record." : "Không thể lưu bản ghi này."));
      notify(cause.message || (lang === "en" ? "Could not save this record." : "Không thể lưu bản ghi này."));
    } finally {
      setBusy(false);
    }
  };
  const del = async (id) => {
    const path = {
      calendar: "/api/schedules/",
      checklist: "/api/checklist/",
      media: "/api/media/",
    }[tab];
    if (path) {
      setBusy(true);
      setError("");
      try {
        const response = await apiFetch(path + id, { method: "DELETE" }, workspaceId);
        if (!response.ok) throw new Error(await responseError(response, lang === "en" ? "Could not delete this record." : "Không thể xóa bản ghi này."));
        await load();
        notify(lang === "en" ? "Deleted" : "Đã xóa");
      } catch (cause) {
        setError(cause.message || (lang === "en" ? "Could not delete this record." : "Không thể xóa bản ghi này."));
        notify(cause.message || (lang === "en" ? "Could not delete this record." : "Không thể xóa bản ghi này."));
      } finally {
        setBusy(false);
      }
    }
  };
  return (
    <section className="view">
      <div className="page-heading">
        <div>
          <p className="eyebrow">WORKSPACE OPERATIONS</p>
          <h1>
            {tab === "calendar"
              ? "Content calendar"
              : tab === "presets"
                ? "Platform presets"
                : tab === "checklist"
                  ? "Publishing checklist"
                  : tab === "media"
                    ? "Media links"
                    : "Members"}
          </h1>
        </div>
      </div>
      <div className="tabs">
        {[
          ["calendar", "Calendar"],
          ["presets", "Presets"],
          ["checklist", "Checklist"],
          ["media", "Media links"],
          ["members", "Members"],
        ].map(([k, l]) => (
          <button
            className={`tab ${tab === k ? "active" : ""}`}
            onClick={() => setTab(k)}
            key={k}
          >
            {l}
          </button>
        ))}
      </div>
      {error && <div className="operation-error" role="alert"><span>{error}</span><button type="button" className="secondary-btn" onClick={load} disabled={loading}>{loading ? "…" : (lang === "en" ? "Retry" : "Thử lại")}</button></div>}
      <form className="inline-form operations-form" onSubmit={create}>
        {tab === "members" ? (
          <>
            <input
              placeholder="Email đã đăng ký"
              value={form.email || ""}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              required
            />
            <select
              value={form.role || "editor"}
              onChange={(e) => setForm({ ...form, role: e.target.value })}
            >
              <option>editor</option>
              <option>admin</option>
              <option>viewer</option>
            </select>
          </>
        ) : tab === "presets" ? (
          <>
            <input
              placeholder="Platform"
              required
              value={form.platform || ""}
              onChange={(e) => setForm({ ...form, platform: e.target.value })}
            />
            <input
              placeholder="Canvas"
              value={form.canvas || ""}
              onChange={(e) => setForm({ ...form, canvas: e.target.value })}
            />
          </>
        ) : tab === "checklist" ? (
          <>
            <input
              placeholder="Variant ID"
              required
              value={form.variant_id || ""}
              onChange={(e) => setForm({ ...form, variant_id: e.target.value })}
            />
            <input
              placeholder="Checklist item"
              required
              value={form.label || ""}
              onChange={(e) => setForm({ ...form, label: e.target.value })}
            />
          </>
        ) : tab === "media" ? (
          <>
            <input
              placeholder="Label"
              value={form.label || ""}
              onChange={(e) => setForm({ ...form, label: e.target.value })}
            />
            <input
              type="url"
              placeholder="https://..."
              required
              value={form.url || ""}
              onChange={(e) => setForm({ ...form, url: e.target.value })}
            />
          </>
        ) : (
          <>
            <input
              placeholder="Variant ID"
              required
              value={form.variant_id || ""}
              onChange={(e) => setForm({ ...form, variant_id: e.target.value })}
            />
            <input
              type="datetime-local"
              required
              value={form.scheduled_at || ""}
              onChange={(e) =>
                setForm({ ...form, scheduled_at: e.target.value })
              }
            />
          </>
        )}
        <button className="primary-btn" disabled={busy}>{busy ? "Saving…" : "Add"}</button>
      </form>
      {loading && <p className="operations-loading">{lang === "en" ? "Loading…" : "Đang tải…"}</p>}
      <div className="ref-list">
        {(tab === "members" ? members : rows)
          .slice((page - 1) * pageSize, page * pageSize)
          .map((r) => (
            <div className="ref-row" key={r.id || r.user_id}>
              <strong>
                {r.platform ? (
                  <PlatformBadge platform={r.platform} />
                ) : (
                  r.label || r.scheduled_at || r.url || r.user_id
                )}
              </strong>
              <span>{r.role || r.status || r.kind || ""}</span>
              {["calendar", "checklist", "media"].includes(tab) && (
                <button
                  type="button"
                  className="link-btn"
                  disabled={busy}
                  onClick={() => del(r.id)}
                >
                  Delete
                </button>
              )}
            </div>
          ))}
      </div>
      <div className="table-pagination">
        <span>
          {(tab === "members" ? members : rows).length
            ? `${(page - 1) * pageSize + 1}–${Math.min(page * pageSize, (tab === "members" ? members : rows).length)} / ${(tab === "members" ? members : rows).length}`
            : "No data"}
        </span>
        <div>
          <button
            type="button"
            disabled={page === 1}
            onClick={() => setPage((v) => v - 1)}
          >
            ‹
          </button>
          <strong>
            {page} /{" "}
            {Math.max(
              1,
              Math.ceil((tab === "members" ? members : rows).length / pageSize),
            )}
          </strong>
          <button
            type="button"
            disabled={
              page >=
              Math.ceil((tab === "members" ? members : rows).length / pageSize)
            }
            onClick={() => setPage((v) => v + 1)}
          >
            ›
          </button>
        </div>
      </div>
    </section>
  );
}
