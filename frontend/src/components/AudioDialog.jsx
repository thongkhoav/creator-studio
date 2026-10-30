import { useEffect, useRef, useState } from "react";
import { apiFetch } from "../lib/supabase";
import { sameMood } from "../audio.mjs";
import { formatDateTime } from "../data.mjs";

export default function AudioDialog({ onClose, onSaved, lang, workspaceId, moods = [], track = null }) {
  const dialog = useRef(null);
  const submitting = useRef(false);
  const [form, setForm] = useState({
    title: track?.title || "", artist_source: track?.artist_source || "",
    mood_genre: moods.find((mood) => sameMood(mood, track?.mood_genre)) || track?.mood_genre || "",
    status: track?.status || "Chưa dùng", audio_url: track?.audio_url || "", notes: track?.notes || "",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [customMood, setCustomMood] = useState(() => Boolean(track?.mood_genre && !moods.some((mood) => sameMood(mood, track.mood_genre))));
  const en = lang === "en";
  const title = track ? (en ? "Edit track" : "Chỉnh sửa bài nhạc") : (en ? "Add track" : "Thêm bài nhạc");
  const metadata = track && [
    [en ? "Created" : "Tạo lúc", formatDateTime(track.created_at ?? track.createdAt, lang)],
    [en ? "Modified" : "Cập nhật lúc", formatDateTime(track.updated_at ?? track.updatedAt, lang)],
  ];
  useEffect(() => { dialog.current.showModal(); }, []);
  const change = (event) => {
    setForm((current) => ({ ...current, [event.target.name]: event.target.value }));
    setError("");
  };
  const submit = async (event) => {
    event.preventDefault();
    if (submitting.current) return;
    if (!form.title.trim() || !form.mood_genre.trim()) {
      setError(en ? "Enter a title and mood / genre." : "Hãy nhập tên bài nhạc và mood / thể loại.");
      return;
    }
    submitting.current = true;
    setBusy(true);
    setError("");
    try {
      const response = await apiFetch(track ? `/api/tracks/${track.id}` : "/api/tracks", {
        method: track ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...Object.fromEntries(Object.entries(form).map(([key, value]) => [key, value.trim()])),
          mood_genre: moods.find((mood) => sameMood(mood, form.mood_genre)) || form.mood_genre.trim(),
        }),
      }, workspaceId);
      if (!response.ok) throw new Error();
      const { track: savedTrack } = await response.json();
      onSaved(savedTrack);
      onClose();
    } catch {
      setError(en ? "Could not save track. Check the fields and workspace permissions, then retry." : "Không thể lưu bài nhạc. Kiểm tra thông tin và quyền workspace rồi thử lại.");
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  };
  return (
    <dialog ref={dialog} className="audio-dialog" aria-labelledby="audio-dialog-title" onCancel={(event) => { event.preventDefault(); if (!busy) onClose(); }}>
      <form onSubmit={submit}>
        <div className="dialog-head">
          <div><p className="eyebrow">SOUND PALETTE</p><h2 id="audio-dialog-title">{title}</h2></div>
          <button type="button" className="close-btn" aria-label={en ? "Close" : "Đóng"} disabled={busy} onClick={onClose}>×</button>
        </div>
        {metadata && <dl className="record-metadata">
          {metadata.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}
        </dl>}
        <fieldset disabled={busy} className="audio-form-fields">
          <label>{en ? "Track title" : "Tên bài nhạc"}<input name="title" value={form.title} onChange={change} maxLength={240} required autoFocus /></label>
          <label>{en ? "Artist / source" : "Nghệ sĩ / nguồn"}<input name="artist_source" value={form.artist_source} onChange={change} /></label>
          <div className="form-row">
            <div>
              <label>{en ? "Mood / genre" : "Mood / thể loại"}
                <select
                  aria-label={en ? "Mood / genre" : "Mood / thể loại"}
                  value={customMood || !moods.length ? "custom" : form.mood_genre ? `mood:${form.mood_genre}` : ""}
                  required
                  onChange={(event) => {
                    setCustomMood(event.target.value === "custom");
                    setForm((current) => ({ ...current, mood_genre: event.target.value === "custom" ? "" : event.target.value.slice(5) }));
                    setError("");
                  }}
                >
                  <option value="" disabled>{en ? "Select a mood" : "Chọn mood / thể loại"}</option>
                  {moods.map((mood) => <option key={mood} value={`mood:${mood}`}>{mood}</option>)}
                  <option value="custom">{en ? "＋ Add a new mood" : "＋ Thêm mood mới"}</option>
                </select>
              </label>
              {(customMood || !moods.length) && <label>
                {en ? "New mood / genre" : "Mood / thể loại mới"}
                <input name="mood_genre" value={form.mood_genre} onChange={change} placeholder={en ? "e.g. Comedy, Cinematic…" : "VD: Hài hước, Điện ảnh…"} required />
              </label>}
              <p className="audio-mood-hint">{en ? "New moods are saved to this workspace with the track." : "Mood mới được lưu vào workspace này cùng bài nhạc."}</p>
            </div>
            <label>{en ? "Status" : "Trạng thái"}<select name="status" value={form.status} onChange={change}><option value="Chưa dùng">{en ? "Unused" : "Chưa dùng"}</option><option value="Đã dùng">{en ? "Used" : "Đã dùng"}</option></select></label>
          </div>
          <label>{en ? "Audio link" : "Link audio"}<input name="audio_url" type="url" pattern="https?://.+" placeholder="https://" value={form.audio_url} onChange={change} /></label>
          <label>{en ? "Notes" : "Ghi chú"}<textarea name="notes" aria-label={en ? "Notes" : "Ghi chú"} rows={3} value={form.notes} onChange={change} /></label>
        </fieldset>
        {error && <p className="import-error" role="alert">{error}</p>}
        <div className="dialog-actions">
          <button type="button" className="secondary-btn" disabled={busy} onClick={onClose}>{en ? "Cancel" : "Huỷ"}</button>
          <button type="submit" className="primary-btn" disabled={busy}>{busy ? (en ? "Saving…" : "Đang lưu…") : track ? (en ? "Save changes" : "Lưu thay đổi") : title}</button>
        </div>
      </form>
    </dialog>
  );
}
