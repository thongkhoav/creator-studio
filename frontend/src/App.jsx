import { useEffect, useMemo, useRef, useState } from "react";
import { supabase, supabaseConfigured, apiFetch } from "./lib/supabase";
import OperationsPage from "./components/OperationsPage";
import {
  activePipelineStatuses,
  earliestPlatformPublishDate,
  updateIdeaDraft,
  buildBrainstormCopy,
  conceptSuggestions,
  createBrainstormIdeaPayload,
  formatDateTime,
  getPlanningMetrics,
  keepValidPipelineStatus,
  mergeConceptNames,
  mergeIdea,
  mergePipelineColumnTitles,
  normalizeConcept,
  normalizePlatformPublishDates,
  normalizePlatformPublishLinks,
  removeIdea,
  reorderPipelineStatuses,
  sameConcept,
  sortIdeas,
} from "./data.mjs";
import PlatformBadge from "./components/PlatformBadge";
import AudioDialog from "./components/AudioDialog";
import { sameMood, workspaceMoods } from "./audio.mjs";
import { importSample, importSampleFilename, importScopeConfig } from "./importSamples.mjs";

const STATUSES = ["Lên ý tưởng", "Kịch bản", "Quay video", "Edit", "Đã đăng"];
const PLATFORMS = [
  "TikTok",
  "Instagram Reels",
  "YouTube Shorts",
  "Facebook Reels",
  "LinkedIn",
  "X",
];
const CONCEPTS = [
  "Vlog",
  "IT meme",
  "Listing",
  "Bắt trend",
  "Capcut mood",
  "Mental Health",
  "Setup",
  "Life moment",
  "Sức khỏe",
  "Khác",
];
const fallback = {
  ideas: [],
  tracks: [],
  config_presets: [],
  editing_shortcuts: [],
  production_sops: [],
};
const EMPTY_FILTERS = {
  query: "",
  concept: "all",
  status: "all",
  priority: "all",
};

const STATUS_LABELS = {
  "Lên ý tưởng": {
    vi: "Lên ý tưởng",
    en: "Idea",
    ko: "아이디어",
    ja: "アイデア",
  },
  "Kịch bản": { vi: "Kịch bản", en: "Script", ko: "스크립트", ja: "台本" },
  "Quay video": { vi: "Quay video", en: "Filming", ko: "촬영", ja: "撮影" },
  Edit: { vi: "Edit", en: "Editing", ko: "편집", ja: "編集" },
  "Đã đăng": { vi: "Đã đăng", en: "Published", ko: "게시됨", ja: "公開済み" },
};
const CONCEPT_LABELS = {
  "Bắt trend": { en: "Trend" },
  "Capcut mood": { en: "CapCut mood" },
  "Life moment": { en: "Life moment" },
  "Sức khỏe": { en: "Wellness" },
  Khác: { en: "Other" },
};
const COPY = {
  vi: {
    workspace: "Workspace",
    pipeline: "Pipeline",
    audio: "Thư viện nhạc",
    reference: "Tra cứu nhanh",
    brainstorm: "Brainstorm AI",
    addIdea: "＋ Thêm ý tưởng",
    import: "↓ Import JSON",
    importTitle: "Import nội dung bằng JSON",
    importHelp:
      "Nhập thêm ý tưởng, nhạc và preset nền tảng. Dữ liệu được thêm mới, không ghi đè.",
    pasteJson: "Dán JSON vào đây...",
    checkJson: "Kiểm tra JSON",
    importData: "Import dữ liệu",
    checking: "Đang kiểm tra...",
    ready: "Sẵn sàng",
    downloadExample: "Tải JSON mẫu",
    useExample: "Dùng mẫu",
    processing: "Đang xử lý",
    published: "Đã đăng",
    backlog: "Ý tưởng tồn đọng",
    pipelineTitle: "Production pipeline",
    pipelineHint: "Chỉnh sửa trực tiếp trong bảng để cập nhật pipeline.",
    editTable: "Bảng chỉnh sửa",
    save: "Lưu",
    cancel: "Hủy",
    edit: "Sửa",
    search: "Tìm ý tưởng...",
    concept: "Concept",
    priority: "Ưu tiên",
    status: "Trạng thái",
    date: "Ngày đăng",
    platforms: "Nền tảng",
    title: "Tên ý tưởng",
    brainstormTitle: "Brainstorm cho mọi nền tảng",
    brainstormHint:
      "Nhập một brief, chọn các kênh và nhận hook, outline cùng phiên bản phù hợp từng nền tảng.",
    brief: "Chủ đề hoặc nỗi đau",
    format: "Format",
    duration: "Thời lượng",
    generate: "Tạo ý tưởng",
    generating: "Đang nghĩ...",
    result: "3 hướng có thể quay ngay",
    hook: "Hook",
    outline: "Dàn ý",
    saveToPipeline: "Lưu thành ý tưởng",
    savedToPipeline: "Đã lưu vào Pipeline",
    copyScript: "Copy kịch bản",
    copied: "Đã copy kịch bản",
    brainstormHistory: "Lịch sử brainstorm",
    noBrainstormHistory: "Chưa có lịch sử",
    restore: "Mở lại",
    language: "Ngôn ngữ",
    vietnamese: "Tiếng Việt",
    english: "English",
    logout: "Đăng xuất",
    referenceHint: "Tra cứu nhanh trong lúc viết, quay và dựng.",
    audioHint: "Chọn đúng nhịp cho từng câu chuyện.",
    all: "Tất cả",
    noResults: "Chưa có dữ liệu",
    dueToday: "Đến hạn hôm nay",
    overdue: "Quá hạn",
    upcomingWeek: "Sắp đăng trong tuần",
    unscheduled: "Chưa có lịch",
    clearSmartFilter: "Bỏ lọc nhanh",
    saveFilter: "Lưu bộ lọc",
    savedFilters: "Bộ lọc đã lưu",
    allIdeas: "Tất cả ý tưởng",
    selectedCount: "đã chọn",
    applyStatus: "Đổi trạng thái",
    deleteIdea: "Xóa ý tưởng",
    ideaDeleted: "Đã xóa ý tưởng",
    ideaDeleteFailed: "Không thể xóa ý tưởng",
    confirmDeleteIdea: "Xóa ý tưởng này khỏi workspace?",
    moveTo: "Chuyển sang",
    dragHint: "Kéo card sang cột để đổi trạng thái",
    retry: "Thử lại",
    demoMode: "DEMO LOCAL · AI chưa kết nối",
    trackUsed: "Đã dùng",
    addToColumn: "Thêm vào cột",
    saveAllToPipeline: "Lưu cả 3 vào Pipeline",
    openInPipeline: "Mở trong Pipeline ↗",
    platformCaptions: "Caption theo nền tảng",
    expandWithAi: "✦ Phát triển bằng AI",
    quickCapture: "Ghi nhanh ý tưởng",
    themeDark: "Chuyển sang nền tối",
    themeLight: "Chuyển sang nền sáng",
    quickCapturePlaceholder: "Vừa nghĩ ra gì? Gõ rồi Enter…",
    quickCaptureAdd: "Thêm vào",
    quickCaptureConcept: "Ghi nhanh",
    expandHint: "AI viết hook, dàn ý và caption từ ý tưởng này.",
    expandReview: "AI đã điền bản nháp. Xem lại rồi bấm Lưu.",
    trackUnused: "Chưa dùng",
    syncLoading: "Đang đồng bộ",
    syncConnected: "Đã kết nối",
    syncError: "Đồng bộ lỗi",
    editColumnTitle: "Đổi tên cột",
    columnTitlePlaceholder: "Tên cột",
    saveColumnTitle: "Lưu tên cột",
    columnTitleUpdated: "Đã cập nhật tên cột",
    columnTitleUpdateFailed: "Không thể cập nhật tên cột",
    deleteColumn: "Xóa cột",
    columnDeleted: "Đã xóa cột khỏi workspace",
    columnDeleteFailed: "Không thể xóa cột",
    columnDeleteHasIdeas: "Hãy chuyển hết card ra khỏi cột trước khi xóa.",
    confirmDeleteColumn: "Xóa cột này khỏi workspace?",
    addColumn: "Thêm cột",
    newColumnTitle: "Tên cột mới",
    columnAdded: "Đã thêm cột",
    columnAddFailed: "Không thể thêm cột",
    reorderColumnsHint: "Kéo tiêu đề để sắp xếp cột",
    columnOrderUpdated: "Đã cập nhật thứ tự cột",
    columnOrderUpdateFailed: "Không thể cập nhật thứ tự cột",
  },
  en: {
    workspace: "Workspace",
    pipeline: "Pipeline",
    audio: "Audio library",
    reference: "Quick reference",
    brainstorm: "AI brainstorm",
    addIdea: "＋ Add idea",
    import: "↓ Import JSON",
    importTitle: "Import content as JSON",
    importHelp:
      "Add ideas, audio and platform presets. Imported rows are appended.",
    pasteJson: "Paste JSON here...",
    checkJson: "Validate JSON",
    importData: "Import data",
    checking: "Checking...",
    ready: "Ready",
    downloadExample: "Download example",
    useExample: "Use example",
    processing: "In progress",
    published: "Published",
    backlog: "Backlog ideas",
    pipelineTitle: "Production pipeline",
    pipelineHint: "Edit directly in the table to update the pipeline.",
    editTable: "Editable table",
    save: "Save",
    cancel: "Cancel",
    edit: "Edit",
    search: "Search ideas...",
    concept: "Concept",
    priority: "Priority",
    status: "Status",
    date: "Publish date",
    platforms: "Platforms",
    title: "Idea title",
    brainstormTitle: "Brainstorm for every platform",
    brainstormHint:
      "Enter a brief, select channels, and get hooks, outlines, and channel-specific adaptations.",
    brief: "Topic or pain point",
    format: "Format",
    duration: "Duration",
    generate: "Generate ideas",
    generating: "Thinking...",
    result: "3 ideas ready to shoot",
    hook: "Hook",
    outline: "Outline",
    saveToPipeline: "Save as idea",
    savedToPipeline: "Saved to Pipeline",
    copyScript: "Copy script",
    copied: "Script copied",
    brainstormHistory: "Brainstorm history",
    noBrainstormHistory: "No history yet",
    restore: "Open",
    language: "Language",
    vietnamese: "Tiếng Việt",
    english: "English",
    logout: "Log out",
    referenceHint: "Quick reference while writing, filming, and editing.",
    audioHint: "Pick the right rhythm for each story.",
    all: "All",
    noResults: "No data yet",
    dueToday: "Due today",
    overdue: "Overdue",
    upcomingWeek: "Due this week",
    unscheduled: "Unscheduled",
    clearSmartFilter: "Clear quick filter",
    saveFilter: "Save filter",
    savedFilters: "Saved filters",
    allIdeas: "All ideas",
    selectedCount: "selected",
    applyStatus: "Change status",
    deleteIdea: "Delete idea",
    ideaDeleted: "Idea deleted",
    ideaDeleteFailed: "Could not delete idea",
    confirmDeleteIdea: "Delete this idea from the workspace?",
    moveTo: "Move to",
    dragHint: "Drag a card to another column to change status",
    retry: "Retry",
    demoMode: "LOCAL DEMO · AI unavailable",
    trackUsed: "Used",
    addToColumn: "Add to",
    saveAllToPipeline: "Save all to Pipeline",
    openInPipeline: "Open in Pipeline ↗",
    platformCaptions: "Platform captions",
    expandWithAi: "✦ Expand with AI",
    quickCapture: "Quick capture",
    themeDark: "Switch to dark theme",
    themeLight: "Switch to light theme",
    quickCapturePlaceholder: "Got an idea? Type it and press Enter…",
    quickCaptureAdd: "Add to",
    quickCaptureConcept: "Inbox",
    expandHint: "AI writes a hook, beats and captions from this idea.",
    expandReview: "AI filled in a draft. Review it, then Save.",
    trackUnused: "Unused",
    syncLoading: "Syncing",
    syncConnected: "Connected",
    syncError: "Sync error",
    editColumnTitle: "Rename column",
    columnTitlePlaceholder: "Column title",
    saveColumnTitle: "Save column title",
    columnTitleUpdated: "Column title updated",
    columnTitleUpdateFailed: "Could not update column title",
    deleteColumn: "Delete column",
    columnDeleted: "Column removed from workspace",
    columnDeleteFailed: "Could not delete column",
    columnDeleteHasIdeas: "Move all cards out of this column before deleting it.",
    confirmDeleteColumn: "Remove this column from the workspace?",
    addColumn: "Add column",
    newColumnTitle: "New column title",
    columnAdded: "Column added",
    columnAddFailed: "Could not add column",
    reorderColumnsHint: "Drag a header to reorder columns",
    columnOrderUpdated: "Column order updated",
    columnOrderUpdateFailed: "Could not update column order",
  },
};
function Spinner() { return <span className="spinner" aria-hidden="true" />; }

const LANGUAGE_NAMES = {
  vi: "Tiếng Việt",
  en: "English",
  ko: "한국어",
  ja: "日本語",
  id: "Bahasa Indonesia",
  th: "ไทย",
  ms: "Bahasa Melayu",
  fil: "Filipino",
};
const LANGUAGE_FLAGS = {
  vi: "🇻🇳",
  en: "🇬🇧",
  ko: "🇰🇷",
  ja: "🇯🇵",
  id: "🇮🇩",
  th: "🇹🇭",
  ms: "🇲🇾",
  fil: "🇵🇭",
};
const languageOption = (code, name) =>
  `${LANGUAGE_FLAGS[code] || "🌐"} ${name}`;
const LOCALE_COPY = {
  ko: {
    workspace: "워크스페이스",
    pipeline: "파이프라인",
    audio: "오디오 라이브러리",
    reference: "빠른 참조",
    brainstorm: "AI 브레인스토밍",
    addIdea: "＋ 아이디어 추가",
    import: "↓ JSON 가져오기",
    processing: "진행 중",
    published: "게시됨",
    backlog: "아이디어 보관함",
    save: "저장",
    cancel: "취소",
    edit: "편집",
    search: "아이디어 검색...",
    concept: "콘셉트",
    priority: "우선순위",
    status: "상태",
    date: "게시일",
    platforms: "플랫폼",
    title: "아이디어 제목",
    language: "언어",
    logout: "로그아웃",
    all: "전체",
  },
  ja: {
    workspace: "ワークスペース",
    pipeline: "パイプライン",
    audio: "音源ライブラリ",
    reference: "クイックリファレンス",
    brainstorm: "AIブレインストーム",
    addIdea: "＋ アイデアを追加",
    import: "↓ JSONをインポート",
    processing: "進行中",
    published: "公開済み",
    backlog: "アイデア一覧",
    save: "保存",
    cancel: "キャンセル",
    edit: "編集",
    search: "アイデアを検索...",
    concept: "コンセプト",
    priority: "優先度",
    status: "ステータス",
    date: "公開日",
    platforms: "プラットフォーム",
    title: "アイデア名",
    language: "言語",
    logout: "ログアウト",
    all: "すべて",
  },
  id: {
    workspace: "Ruang kerja",
    pipeline: "Pipeline",
    audio: "Pustaka audio",
    reference: "Referensi cepat",
    brainstorm: "Brainstorm AI",
    addIdea: "＋ Tambah ide",
    import: "↓ Impor JSON",
    processing: "Sedang diproses",
    published: "Diterbitkan",
    backlog: "Ide tersimpan",
    save: "Simpan",
    cancel: "Batal",
    edit: "Edit",
    search: "Cari ide...",
    concept: "Konsep",
    priority: "Prioritas",
    status: "Status",
    date: "Tanggal terbit",
    platforms: "Platform",
    title: "Judul ide",
    language: "Bahasa",
    logout: "Keluar",
    all: "Semua",
  },
  th: {
    workspace: "เวิร์กสเปซ",
    pipeline: "ไปป์ไลน์",
    audio: "คลังเสียง",
    reference: "ข้อมูลอ้างอิง",
    brainstorm: "ระดมความคิดด้วย AI",
    addIdea: "＋ เพิ่มไอเดีย",
    import: "↓ นำเข้า JSON",
    processing: "กำลังดำเนินการ",
    published: "เผยแพร่แล้ว",
    backlog: "ไอเดียค้าง",
    save: "บันทึก",
    cancel: "ยกเลิก",
    edit: "แก้ไข",
    search: "ค้นหาไอเดีย...",
    concept: "คอนเซ็ปต์",
    priority: "ลำดับความสำคัญ",
    status: "สถานะ",
    date: "วันที่เผยแพร่",
    platforms: "แพลตฟอร์ม",
    title: "ชื่อไอเดีย",
    language: "ภาษา",
    logout: "ออกจากระบบ",
    all: "ทั้งหมด",
  },
  ms: {
    workspace: "Ruang kerja",
    pipeline: "Saluran kerja",
    audio: "Pustaka audio",
    reference: "Rujukan pantas",
    brainstorm: "Sumbang saran AI",
    addIdea: "＋ Tambah idea",
    import: "↓ Import JSON",
    processing: "Sedang berjalan",
    published: "Diterbitkan",
    backlog: "Idea tertangguh",
    save: "Simpan",
    cancel: "Batal",
    edit: "Edit",
    search: "Cari idea...",
    concept: "Konsep",
    priority: "Keutamaan",
    status: "Status",
    date: "Tarikh terbit",
    platforms: "Platform",
    title: "Tajuk idea",
    language: "Bahasa",
    logout: "Log keluar",
    all: "Semua",
  },
  fil: {
    workspace: "Workspace",
    pipeline: "Pipeline",
    audio: "Audio library",
    reference: "Mabilis na sanggunian",
    brainstorm: "AI brainstorm",
    addIdea: "＋ Magdagdag ng ideya",
    import: "↓ Mag-import ng JSON",
    processing: "Isinasagawa",
    published: "Nai-publish",
    backlog: "Mga nakaimbak na ideya",
    save: "I-save",
    cancel: "Kanselahin",
    edit: "I-edit",
    search: "Maghanap ng ideya...",
    concept: "Konsepto",
    priority: "Prayoridad",
    status: "Status",
    date: "Petsa ng pag-publish",
    platforms: "Mga platform",
    title: "Pamagat ng ideya",
    language: "Wika",
    logout: "Mag-log out",
    all: "Lahat",
  },
};
for (const [locale, translations] of Object.entries(LOCALE_COPY))
  COPY[locale] = { ...COPY.en, ...translations };

function normalizeIdea(idea) {
  return {
    ...idea,
    hashtag: Array.isArray(idea.hashtag) ? idea.hashtag : [],
    mainContent: idea.main_content ?? idea.mainContent ?? "",
    audioSfx: idea.audio_sfx ?? idea.audioSfx ?? "",
    publishDate: idea.publish_date ?? idea.publishDate ?? "",
    createdAt: idea.createdAt ?? idea.created_at ?? "",
    updatedAt: idea.updatedAt ?? idea.updated_at ?? "",
    trackId: idea.track_id ?? idea.trackId ?? null,
    platforms:
      Array.isArray(idea.platforms) && idea.platforms.length
        ? idea.platforms
        : ["TikTok"],
    platformPublishDates: normalizePlatformPublishDates(
      idea.platform_publish_dates ?? idea.platformPublishDates,
    ),
    platformPublishLinks: normalizePlatformPublishLinks(
      idea.platform_publish_links ?? idea.platformPublishLinks,
    ),
  };
}
function contentSimilarity(a, b) { const tokens = (text) => new Set(String(text || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").split(/[^a-z0-9]+/).filter((word) => word.length > 2)); const left = tokens(a); const right = tokens(b); if (!left.size || !right.size) return 0; const overlap = [...left].filter((word) => right.has(word)).length; return overlap / Math.max(left.size, right.size); }

function formatDate(value, lang) {
  const locales = {
    vi: "vi-VN",
    en: "en-US",
    ko: "ko-KR",
    ja: "ja-JP",
    id: "id-ID",
    th: "th-TH",
    ms: "ms-MY",
    fil: "en-PH",
  };
  return value
    ? new Intl.DateTimeFormat(locales[lang] || "en-US", {
        day: "2-digit",
        month: "2-digit",
      }).format(new Date(`${value}T00:00:00`))
    : lang === "vi"
      ? "Chưa lên lịch"
      : "Unscheduled";
}
function RecordMetadata({ record, lang }) {
  const created = record?.createdAt ?? record?.created_at ?? "";
  const updated = record?.updatedAt ?? record?.updated_at ?? "";
  const label = (vi, en) => (lang === "en" ? en : vi);
  return (
    <dl className="record-metadata">
      <div>
        <dt>{label("Tạo lúc", "Created")}</dt>
        <dd>{formatDateTime(created, lang)}</dd>
      </div>
      <div>
        <dt>{label("Cập nhật lúc", "Modified")}</dt>
        <dd>{formatDateTime(updated, lang)}</dd>
      </div>
    </dl>
  );
}
function statusLabel(value, lang, customTitles = {}) {
  const customTitle = customTitles[value]?.trim();
  if (customTitle && customTitle !== value) return customTitle;
  return STATUS_LABELS[value]?.[lang] || value;
}
function conceptLabel(value, lang) {
  return CONCEPT_LABELS[value]?.[lang] || value;
}
// Offline fallback when the AI is unreachable: English for the English UI,
// Vietnamese otherwise.
function demoBrainstorm(brief, format, duration, platforms, lang = "vi") {
  const en = lang === "en";
  return platforms
    .slice(0, 3)
    .map((platform, index) => ({
      title: en ? `${brief}: angle ${index + 1}` : `${brief}: ${index + 1} góc kể chuyện`,
      hook: index
        ? en
          ? `A version made for ${platform}.`
          : `Một phiên bản dành riêng cho ${platform}.`
        : en
          ? `If you have ever dealt with ${brief.toLowerCase()}, this one is for you.`
          : `Nếu bạn từng ${brief.toLowerCase()}, video này là cho bạn.`,
      outline: en
        ? "Open with a real situation → 3 content beats → a call to action that fits the channel."
        : "Mở bằng tình huống thật → 3 nhịp nội dung → CTA phù hợp với kênh.",
      format: `${format} · ${duration}`,
      platforms: [platform],
      adaptations: {
        [platform]: en
          ? `Keep it short, clear captions, and a call to action that suits ${platform}.`
          : `Giữ nhịp ngắn, caption rõ và CTA theo hành vi của ${platform}.`,
      },
    }));
}
function PlatformPicker({ value, onChange, label, publishDates = {}, onDateChange, publishLinks = {}, onLinkChange, dateLabel = "Published date", linkLabel = "Uploaded link" }) {
  return (
    <fieldset className="platform-picker">
      <legend>{label}</legend>
      <div className="platform-options">
        {PLATFORMS.map((platform) => (
          <label className="platform-option" key={platform}>
            <input
              type="checkbox"
              name="platforms"
              value={platform}
              checked={value.includes(platform)}
              onChange={(event) =>
                onChange(
                  event.target.checked
                    ? [...value, platform]
                    : value.filter((item) => item !== platform),
                )
              }
            />
            <PlatformBadge platform={platform} />
          </label>
        ))}
      </div>
      {(onDateChange || onLinkChange) && value.length > 0 && (
        <div className="platform-publish-dates">
          <p className="platform-publish-dates-title">{dateLabel} · {linkLabel}</p>
          {value.map((platform) => (
            <label className="platform-publish-date" key={platform}>
              <span><PlatformBadge platform={platform} compact /></span>
              <div className="platform-publish-fields">
                {onDateChange && <input
                  type="date"
                  value={publishDates[platform] || ""}
                  onChange={(event) => onDateChange(platform, event.target.value)}
                  aria-label={`${dateLabel} ${platform}`}
                />}
                {onLinkChange && <input
                  type="url"
                  value={publishLinks[platform] || ""}
                  onChange={(event) => onLinkChange(platform, event.target.value)}
                  placeholder={linkLabel}
                  aria-label={`${linkLabel} ${platform}`}
                />}
              </div>
            </label>
          ))}
        </div>
      )}
    </fieldset>
  );
}

function BrainstormPage({ lang, t, brainstorm, history, aiLoading, brainstormSource, brainstormError, onRun, onRetry, onSaveIdea, onOpenIdea, onNotify, onCopy, onRestore, columns = [], conceptOptions = [] }) {
  const [platforms, setPlatforms] = useState([
    "TikTok",
    "Instagram Reels",
    "YouTube Shorts",
  ]);
  const [drafts, setDrafts] = useState(brainstorm || []);
  const [savingIndex, setSavingIndex] = useState(null);
  const [savedIds, setSavedIds] = useState(() => new Map());
  const [targetStatus, setTargetStatus] = useState("");
  const [targetConcept, setTargetConcept] = useState("AI brainstorm");
  const resultsRef = useRef(null);
  const wasLoading = useRef(aiLoading);
  useEffect(() => {
    // Bring new ideas into view when a generation finishes; the form fills the first screen.
    if (wasLoading.current && !aiLoading) resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    wasLoading.current = aiLoading;
  }, [aiLoading]);
  const status = columns.some((column) => column.status === targetStatus) ? targetStatus : columns[0]?.status || "Lên ý tưởng";
  useEffect(() => {
    setDrafts(brainstorm || []);
    setSavedIds(new Map());
  }, [brainstorm]);
  const updateDraft = (index, key, value) => {
    setDrafts((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, [key]: value } : item));
  };
  const saveDraft = async (item, index, options = {}) => {
    setSavingIndex(index);
    const saved = await onSaveIdea(item, { status, concept: targetConcept, ...options });
    if (saved) setSavedIds((current) => new Map(current).set(index, saved.id));
    setSavingIndex(null);
    return saved;
  };
  const saveAll = async () => {
    // One at a time so a new concept is created once, not raced by three requests.
    let count = 0;
    for (const [index, item] of drafts.entries()) {
      if (savedIds.has(index) || !item.title?.trim()) continue;
      if (await saveDraft(item, index, { quiet: true })) count += 1;
    }
    if (count) onNotify(lang === "en" ? `Saved ${count} ideas to Pipeline.` : `Đã lưu ${count} ý tưởng vào Pipeline.`);
  };
  const unsaved = drafts.filter((item, index) => !savedIds.has(index) && item.title?.trim()).length;
  return (
    <section className="view brainstorm-page">
      <div className="page-heading">
        <div>
          <p className="eyebrow">AI COPILOT</p>
          <h1>{t("brainstormTitle")}</h1>
          <p>{t("brainstormHint")}</p>
        </div>
      </div>
      <div className="brainstorm-layout">
      <div className="brainstorm-main">
      <form
        className="brainstorm-form"
        onSubmit={(event) => {
          event.preventDefault();
          const form = new FormData(event.currentTarget);
          if (platforms.length)
            onRun(
              form.get("brief"),
              form.get("format"),
              form.get("duration"),
              platforms,
            );
        }}
      >
        <label>
          {t("brief")}
          <textarea
            name="brief"
            rows="4"
            minLength="2"
            required
            placeholder={
              lang === "en"
                ? "Example: remote work habits for developers"
                : "Ví dụ: thói quen làm việc remote của lập trình viên"
            }
          />
        </label>
        <div className="form-row">
          <label>
            {t("format")}
            <select name="format">
              <option>Short vlog</option>
              <option>IT meme</option>
              <option>List / Top 5</option>
              <option>Carousel</option>
            </select>
          </label>
          <label>
            {t("duration")}
            <select name="duration">
              <option>30-40 seconds</option>
              <option>45-60 seconds</option>
              <option>7 slides</option>
            </select>
          </label>
        </div>
        <PlatformPicker
          label={t("platforms")}
          value={platforms}
          onChange={setPlatforms}
        />
        <button
          className="primary-btn"
          disabled={aiLoading || !platforms.length}
        >
          {aiLoading ? <><Spinner />{t("generating")}</> : t("generate")}
        </button>
      </form>
      {brainstormSource === "demo" && (
        <div className="brainstorm-demo-banner" role="status">
          <div><strong>{t("demoMode")}</strong><span>{brainstormError || (lang === "en" ? "Results are local examples until the AI service is available." : "Đây là kết quả demo local cho đến khi kết nối lại AI.")}</span></div>
          <button type="button" className="secondary-btn" onClick={onRetry} disabled={aiLoading}>{aiLoading ? <><Spinner />{t("generating")}</> : t("retry")}</button>
        </div>
      )}
        {drafts.length > 0 && (
          <div className="brainstorm-results" ref={resultsRef}>
          <div className="result-section-head"><h2>{t("result")}</h2><span>{drafts.length} ideas</span></div>
          <div className="brainstorm-save-bar">
            <label>{t("addToColumn")}
              <select value={status} onChange={(event) => setTargetStatus(event.target.value)}>
                {columns.map((column) => <option key={column.status} value={column.status}>{column.title}</option>)}
              </select>
            </label>
            <label>{t("concept")}
              <select value={targetConcept} onChange={(event) => setTargetConcept(event.target.value)}>
                {[...new Set(["AI brainstorm", ...conceptOptions])].map((concept) => <option key={concept} value={concept}>{concept}</option>)}
              </select>
            </label>
            <button type="button" className="primary-btn" disabled={!unsaved || savingIndex !== null} onClick={saveAll}>
              {savingIndex !== null ? <><Spinner />{t("save")}</> : t("saveAllToPipeline")}
            </button>
          </div>
          {drafts.map((item, index) => (
            <article
              className="brainstorm-result"
              key={`${item.title}-${index}`}
            >
              <div className="result-head">
                <input
                  className="brainstorm-title-input"
                  aria-label={`${t("title")} ${index + 1}`}
                  value={item.title || ""}
                  onChange={(event) => updateDraft(index, "title", event.target.value)}
                />
                <span className="platform-badge-list">
                  {(item.platforms || []).map((platform) => (
                    <PlatformBadge key={platform} platform={platform} compact />
                  ))}
                </span>
              </div>
              <label className="brainstorm-edit-field"><b>{t("hook")}</b><textarea rows="3" value={item.hook || ""} onChange={(event) => updateDraft(index, "hook", event.target.value)} /></label>
              <label className="brainstorm-edit-field"><b>{t("outline")}</b><textarea rows="4" value={item.outline || ""} onChange={(event) => updateDraft(index, "outline", event.target.value)} /></label>
              {item.adaptations && (
                <div className="adaptations">
                  {Object.entries(item.adaptations).map(([platform, copy]) => (
                    <span key={platform} className="adaptation-platform">
                      <PlatformBadge platform={platform} compact />
                      <span>{copy}</span>
                    </span>
                  ))}
                </div>
              )}
              <div className="brainstorm-result-actions">
                <button type="button" className="secondary-btn" onClick={() => onCopy(buildBrainstormCopy(item))}>
                  ⧉ {t("copyScript")}
                </button>
                {savedIds.has(index) ? (
                  <button type="button" className="secondary-btn saved-idea-link" onClick={() => onOpenIdea(savedIds.get(index))}>
                    ✓ {t("openInPipeline")}
                  </button>
                ) : (
                  <button type="button" className="primary-btn" disabled={savingIndex !== null || !item.title?.trim()} onClick={() => saveDraft(item, index)}>
                    {savingIndex === index ? <><Spinner />{t("save")}</> : t("saveToPipeline")}
                  </button>
                )}
              </div>
            </article>
          ))}
          </div>
        )}
      </div>
        <aside className="brainstorm-history">
          <div className="result-section-head"><h2>{t("brainstormHistory")}</h2><span>{history.length}</span></div>
          {history.length ? history.slice(0, 8).map((entry) => (
            <button type="button" className="history-entry" key={entry.id} onClick={() => { onRestore(entry); setTimeout(() => resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 0); }}>
              <strong>{entry.brief}</strong>
              <span>{entry.source === "demo" ? t("demoMode") : formatDateTime(entry.created_at || entry.createdAt, lang)} · {t("restore")}</span>
            </button>
          )) : <p className="history-empty">{t("noBrainstormHistory")}</p>}
        </aside>
      </div>
    </section>
  );
}

function PipelineCalendar({ ideas, lang, onOpen }) {
  const today = new Date();
  const [month, setMonth] = useState(
    new Date(today.getFullYear(), today.getMonth(), 1),
  );
  const year = month.getFullYear();
  const monthIndex = month.getMonth();
  const first = new Date(year, monthIndex, 1);
  const days = new Date(year, monthIndex + 1, 0).getDate();
  const offset = (first.getDay() + 6) % 7;
  const byDate = ideas.reduce((acc, idea) => {
    if (idea.publishDate) (acc[idea.publishDate] ||= []).push(idea);
    return acc;
  }, {});
  const monthLabel = month.toLocaleDateString(
    lang === "en" ? "en-US" : "vi-VN",
    { month: "long", year: "numeric" },
  );
  return (
    <div className="pipeline-calendar">
      <div className="calendar-toolbar">
        <button
          type="button"
          onClick={() => setMonth(new Date(year, monthIndex - 1, 1))}
        >
          ‹
        </button>
        <strong>{monthLabel}</strong>
        <button
          type="button"
          onClick={() => setMonth(new Date(year, monthIndex + 1, 1))}
        >
          ›
        </button>
      </div>
      <div className="calendar-weekdays">
        {(lang === "en"
          ? ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
          : ["T2", "T3", "T4", "T5", "T6", "T7", "CN"]
        ).map((day) => (
          <span key={day}>{day}</span>
        ))}
      </div>
      <div className="calendar-grid">
        {Array.from({ length: offset + days }, (_, index) => {
          const day = index - offset + 1;
          if (day < 1)
            return (
              <span className="calendar-cell empty" key={`empty-${index}`} />
            );
          const date = `${year}-${String(monthIndex + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
          return (
            <div className="calendar-cell" key={date}>
              <b>{day}</b>
              {(byDate[date] || []).map((idea) => (
                <button
                  type="button"
                  className={`calendar-idea status-${STATUSES.indexOf(idea.status) + 1}`}
                  key={idea.id}
                  onClick={() => onOpen(idea)}
                >
                  {idea.title}
                </button>
              ))}
            </div>
          );
        })}
      </div>
      <div className="calendar-unscheduled">
        <strong>
          {lang === "en" ? "Unscheduled" : "Chưa lên lịch"} ·{" "}
          {ideas.filter((idea) => !idea.publishDate).length}
        </strong>
        <div>
          {ideas
            .filter((idea) => !idea.publishDate)
            .slice(0, 8)
            .map((idea) => (
              <button type="button" key={idea.id} onClick={() => onOpen(idea)}>
                {idea.title}
              </button>
            ))}
        </div>
      </div>
    </div>
  );
}

function EditableTable({ ideas, conceptOptions, pipelineTitles, pipelineStatuses, lang, t, onSave }) {
  const pageSize = 15;
  const [page, setPage] = useState(1);
  const [editingId, setEditingId] = useState(null);
  const [draft, setDraft] = useState(null);
  const [savingId, setSavingId] = useState(null);
  const pageCount = Math.max(1, Math.ceil(ideas.length / pageSize));
  useEffect(() => setPage(1), [ideas.length]);
  useEffect(() => {
    if (page > pageCount) setPage(pageCount);
  }, [page, pageCount]);
  const begin = (idea) => {
    setEditingId(idea.id);
    setDraft({
      ...idea,
      publish_date: idea.publishDate || "",
      platforms: idea.platforms,
      platform_publish_dates: idea.platformPublishDates || {},
      platform_publish_links: idea.platformPublishLinks || {},
    });
  };
  const update = (key, value) =>
    setDraft((current) => updateIdeaDraft(current, key, value));
  const save = async (ideaId) => {
    setSavingId(ideaId);
    try {
      const saved = await onSave(ideaId, draft);
      if (saved !== false) setEditingId(null);
    } finally {
      setSavingId(null);
    }
  };
  const visibleIdeas = ideas.slice((page - 1) * pageSize, page * pageSize);
  return (
    <section className="panel editable-panel">
      <div className="panel-head">
        <div>
          <h2>{t("editTable")}</h2>
          <p>{t("pipelineHint")}</p>
        </div>
      </div>
      <div className="table-scroll">
        <table className="idea-table">
          <thead>
            <tr>
              <th>{t("title")}</th>
              <th>{t("status")}</th>
              <th>{t("concept")}</th>
              <th>{t("priority")}</th>
              <th>{t("date")}</th>
              <th>{t("platforms")}</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {visibleIdeas.map((idea) =>
              editingId === idea.id ? (
                <tr key={idea.id}>
                  <td>
                    <input
                      value={draft.title}
                      onChange={(e) => update("title", e.target.value)}
                    />
                  </td>
                  <td>
                    <select
                      value={draft.status}
                      onChange={(e) => update("status", e.target.value)}
                    >
                      {pipelineStatuses.map((status) => (
                        <option key={status} value={status}>
                          {statusLabel(status, lang, pipelineTitles)}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <input
                      list={`table-concept-options-${idea.id}`}
                      value={draft.concept}
                      onChange={(e) => update("concept", e.target.value)}
                    />
                    <datalist id={`table-concept-options-${idea.id}`}>
                      {conceptOptions.map((concept) => (
                        <option key={concept} value={concept}>
                          {conceptLabel(concept, lang)}
                        </option>
                      ))}
                    </datalist>
                  </td>
                  <td>
                    <select
                      value={draft.priority}
                      onChange={(e) =>
                        update("priority", Number(e.target.value))
                      }
                    >
                      <option value="1">P1</option>
                      <option value="2">P2</option>
                      <option value="3">P3</option>
                    </select>
                  </td>
                  <td>{formatDate(draft.publish_date, lang)}</td>
                  <td>
                    <PlatformPicker
                      label={t("platforms")}
                      value={draft.platforms}
                      onChange={(value) => update("platforms", value)}
                      publishDates={draft.platform_publish_dates}
                      dateLabel={t("date")}
                      onDateChange={(platform, value) => update("platform_publish_dates", { ...draft.platform_publish_dates, [platform]: value })}
                      publishLinks={draft.platform_publish_links}
                      linkLabel={lang === "en" ? "Uploaded link" : "Link đã đăng"}
                      onLinkChange={(platform, value) => update("platform_publish_links", { ...draft.platform_publish_links, [platform]: value })}
                    />
                  </td>
                  <td className="row-actions">
                    <button
                      type="button"
                      className="table-save"
                      onClick={() => save(idea.id)}
                      disabled={savingId === idea.id}
                    >
                      {savingId === idea.id ? (
                        <>
                          <Spinner />
                          {t("save")}
                        </>
                      ) : (
                        t("save")
                      )}
                    </button>
                    <button
                      type="button"
                      className="table-cancel"
                      onClick={() => setEditingId(null)}
                      disabled={savingId === idea.id}
                    >
                      {t("cancel")}
                    </button>
                  </td>
                </tr>
              ) : (
                <tr key={idea.id}>
                  <td className="table-title">{idea.title}</td>
                  <td>
                    <span className="status-pill">
                      {statusLabel(idea.status, lang, pipelineTitles)}
                    </span>
                  </td>
                  <td>{conceptLabel(idea.concept, lang)}</td>
                  <td>P{idea.priority}</td>
                  <td>{formatDate(idea.publishDate, lang)}</td>
                  <td>
                    <div className="table-platforms">
                      {idea.platforms.map((platform) => (
                        <PlatformBadge key={platform} platform={platform} compact iconOnly />
                      ))}
                    </div>
                  </td>
                  <td>
                    <button
                      type="button"
                      className="table-edit"
                      onClick={() => begin(idea)}
                    >
                      {t("edit")}
                    </button>
                  </td>
                </tr>
              ),
            )}
          </tbody>
        </table>
      </div>
      <div className="table-pagination">
        <span>
          {ideas.length
            ? `${(page - 1) * pageSize + 1}–${Math.min(page * pageSize, ideas.length)} / ${ideas.length}`
            : t("noResults")}
        </span>
        <div>
          <button
            type="button"
            disabled={page === 1}
            onClick={() => setPage((value) => value - 1)}
          >
            ‹
          </button>
          <strong>
            {page} / {pageCount}
          </strong>
          <button
            type="button"
            disabled={page === pageCount}
            onClick={() => setPage((value) => value + 1)}
          >
            ›
          </button>
        </div>
      </div>
    </section>
  );
}

function ConceptPicker({
  value,
  options,
  lang,
  onChange,
  placeholder,
  ariaLabel,
}) {
  const pickerRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState(value || "");
  const normalizedValue = normalizeConcept(value);
  const listQuery = open && sameConcept(query, value) ? "" : query;
  const suggestions = conceptSuggestions(options, listQuery);
  useEffect(() => {
    setQuery(value || "");
  }, [value]);
  useEffect(() => {
    if (!open) return undefined;
    const closeOnOutsideClick = (event) => {
      if (!pickerRef.current?.contains(event.target)) setOpen(false);
    };
    const closeOnEscape = (event) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);
  const selectConcept = (concept) => {
    setQuery(concept);
    onChange(concept);
    setOpen(false);
  };
  const hasExactSuggestion = suggestions.some((concept) =>
    sameConcept(concept, query),
  );
  return (
    <div className={`concept-picker ${open ? "is-open" : ""}`} ref={pickerRef}>
      <div className="concept-picker-control">
        <input
          value={query}
          onFocus={() => setOpen(true)}
          onChange={(event) => {
            setQuery(event.target.value);
            onChange(event.target.value);
            setOpen(true);
          }}
          placeholder={placeholder}
          aria-label={ariaLabel}
          aria-expanded={open}
          aria-autocomplete="list"
        />
        <button
          type="button"
          className="concept-picker-toggle"
          aria-label={lang === "en" ? "Show concepts" : "Hiện danh sách concept"}
          aria-expanded={open}
          onClick={() => setOpen((current) => !current)}
        >
          {open ? "▴" : "▾"}
        </button>
      </div>
      {open && (
        <div className="concept-picker-menu" role="listbox">
          {suggestions.map((concept) => (
            <button
              type="button"
              role="option"
              aria-selected={sameConcept(concept, normalizedValue)}
              className={sameConcept(concept, normalizedValue) ? "selected" : ""}
              key={concept}
              onClick={() => selectConcept(concept)}
            >
              {conceptLabel(concept, lang)}
            </button>
          ))}
          {normalizedValue && !hasExactSuggestion && (
            <button
              type="button"
              role="option"
              className="custom-option"
              onClick={() => selectConcept(normalizedValue)}
            >
              {lang === "en" ? `Use “${normalizedValue}”` : `Dùng “${normalizedValue}”`}
            </button>
          )}
          {!suggestions.length && !normalizedValue && (
            <span className="concept-picker-empty">
              {lang === "en" ? "No concepts yet" : "Chưa có concept"}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

function IdeaDrawer({ idea, conceptOptions, pipelineTitles, pipelineStatuses, lang, t, onClose, onSave, onDelete, onExpand }) {
  const [draft, setDraft] = useState({
    ...idea,
    publish_date: idea.publishDate || "",
    main_content: idea.mainContent || "",
    platforms: idea.platforms || [],
    platform_publish_dates: idea.platformPublishDates || {},
    platform_publish_links: idea.platformPublishLinks || {},
  });
  const [saving, setSaving] = useState(false);
  const [expanding, setExpanding] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const update = (key, value) =>
    setDraft((current) => updateIdeaDraft(current, key, value));
  const label = (vi, en) => (lang === "en" ? en : vi);
  const expand = async () => {
    setExpanding(true);
    const result = await onExpand(draft);
    setExpanding(false);
    if (!result) return;
    // Fill the form only; nothing is saved until the creator presses Save.
    setDraft((current) => ({ ...current, hook: result.hook, main_content: result.mainContent }));
    setExpanded(true);
  };
  return (
    <aside
      className="idea-drawer"
      aria-label={label("Chi tiết ý tưởng", "Idea details")}
    >
      <div className="drawer-head">
        <div>
          <p className="eyebrow">IDEA DETAIL</p>
          <h2>{label("Chỉnh sửa ý tưởng", "Edit idea")}</h2>
        </div>
        <button type="button" className="close-btn" onClick={onClose}>
          ×
        </button>
      </div>
      <RecordMetadata record={idea} lang={lang} />
      <form
        onSubmit={async (event) => {
          event.preventDefault();
          setSaving(true);
          const saved = await onSave(idea.id, draft);
          if (saved !== false) {
            onClose();
            return;
          }
          setSaving(false);
        }}
      >
        <label>
          {t("title")}
          <input
            value={draft.title}
            onChange={(event) => update("title", event.target.value)}
            required
          />
        </label>
        <div className="expand-ai">
          <button type="button" className="secondary-btn" onClick={expand} disabled={expanding || !draft.title?.trim()}>
            {expanding ? <><Spinner />{t("generating")}</> : t("expandWithAi")}
          </button>
          <span>{expanded ? t("expandReview") : t("expandHint")}</span>
        </div>
        <label>
          {t("hook")}
          <textarea
            rows="3"
            className={expanded ? "ai-filled" : ""}
            value={draft.hook || ""}
            onChange={(event) => update("hook", event.target.value)}
          />
        </label>
        <label>
          {label("Nội dung chính", "Main content")}
          <textarea
            rows={expanded ? 9 : 5}
            className={expanded ? "ai-filled" : ""}
            value={draft.main_content || ""}
            onChange={(event) => update("main_content", event.target.value)}
          />
        </label>
        <div className="form-row">
          <label>
            {t("status")}
            <select
              className={`status-select status-${STATUSES.indexOf(draft.status) + 1}`}
              value={draft.status}
              onChange={(event) => update("status", event.target.value)}
            >
              {pipelineStatuses.map((status) => (
                <option key={status} value={status}>
                  {statusLabel(status, lang, pipelineTitles)}
                </option>
              ))}
            </select>
          </label>
          <label>
            {t("priority")}
            <select
              value={draft.priority}
              onChange={(event) =>
                update("priority", Number(event.target.value))
              }
            >
              <option value="1">P1</option>
              <option value="2">P2</option>
              <option value="3">P3</option>
            </select>
          </label>
        </div>
        <label>
          {t("concept")}
          <ConceptPicker
            value={draft.concept}
            options={conceptOptions}
            lang={lang}
            onChange={(value) => update("concept", value)}
            placeholder={
              lang === "en"
                ? "Type or create a concept"
                : "Nhập hoặc tạo concept"
            }
            ariaLabel={t("concept")}
          />
          <small className="field-hint">
            {lang === "en"
              ? "Type a new concept to create it for this idea."
              : "Nhập concept mới để tạo cho ý tưởng này."}
          </small>
        </label>
        <PlatformPicker
          label={t("platforms")}
          value={draft.platforms}
          onChange={(value) => update("platforms", value)}
          publishDates={draft.platform_publish_dates}
          dateLabel={t("date")}
          onDateChange={(platform, value) => update("platform_publish_dates", { ...draft.platform_publish_dates, [platform]: value })}
          publishLinks={draft.platform_publish_links}
          linkLabel={lang === "en" ? "Uploaded link" : "Link đã đăng"}
          onLinkChange={(platform, value) => update("platform_publish_links", { ...draft.platform_publish_links, [platform]: value })}
        />
        <div className="dialog-actions">
          <button
            type="button"
            className="danger-btn"
            onClick={async () => {
              setSaving(true);
              const deleted = await onDelete(idea);
              if (!deleted) setSaving(false);
            }}
            disabled={saving}
          >
            {t("deleteIdea")}
          </button>
          <button
            type="button"
            className="secondary-btn"
            onClick={onClose}
            disabled={saving}
          >
            {t("cancel")}
          </button>
          <button className="primary-btn" disabled={saving}>
            {saving ? (
              <>
                <Spinner />
                {t("save")}
              </>
            ) : (
              t("save")
            )}
          </button>
        </div>
      </form>
    </aside>
  );
}

function ImportDialog({ scope, onClose, onImported, notify, lang, t, workspaceId }) {
  const dialog = useRef(null);
  const [raw, setRaw] = useState("");
  const [preview, setPreview] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [selectedType, setSelectedType] = useState("application/json");
  const isCsv = selectedType === "text/csv";
  const scopeConfig = importScopeConfig(scope);
  const sampleContent = importSample(scope, isCsv ? "csv" : "json");
  const scopeLabel = {
    pipeline: lang === "en" ? "ideas" : "ý tưởng",
    audio: lang === "en" ? "tracks" : "nhạc",
    presets: "presets",
  }[scope] || (lang === "en" ? "content" : "nội dung");
  const importTitle = lang === "en" ? `Import ${scopeLabel}` : `Import ${scopeLabel}`;
  const importHelp = isCsv
    ? (lang === "en"
        ? `Import ${scopeLabel} from CSV using this page's columns.`
        : `Import ${scopeLabel} từ CSV theo đúng cột của page này.`)
    : (lang === "en"
        ? `Import only ${scopeLabel} on this page. Download or copy the sample to use the right JSON shape.`
        : `Chỉ import ${scopeLabel} cho page này. Tải hoặc copy mẫu để dùng đúng format JSON.`);
  useEffect(() => { dialog.current.showModal(); }, []);
  const copySample = async () => {
    try {
      await navigator.clipboard.writeText(sampleContent);
      notify(lang === "en" ? `Copied ${isCsv ? "CSV" : "JSON"} sample.` : `Đã copy mẫu ${isCsv ? "CSV" : "JSON"}.`);
    } catch {
      setRaw(sampleContent);
      setPreview(null);
      setError(lang === "en" ? "Clipboard is unavailable; sample placed in the editor." : "Không thể truy cập clipboard; mẫu đã được đưa vào ô nhập.");
    }
  };
  const readFile = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (file.size > 1024 * 1024) {
      setError(
        lang === "en"
          ? "File is larger than 1 MB."
          : "File vượt quá giới hạn 1 MB.",
      );
      return;
    }
    setRaw(await file.text());
    setSelectedType(file.name.toLowerCase().endsWith(".csv") ? "text/csv" : "application/json");
    setPreview(null);
    setError("");
  };
  const call = async (path) => {
    setBusy(true);
    setError("");
    try {
      const response = await apiFetch(
        `${path}?scope=${encodeURIComponent(scopeConfig.table)}`,
        {
          method: "POST",
          headers: { "Content-Type": selectedType },
          body: raw,
        },
        workspaceId,
      );
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        const detail = Array.isArray(payload.detail)
          ? payload.detail
              .map((item) => `${item.loc.join(".")}: ${item.msg}`)
              .join("\n")
          : payload.detail;
        throw new Error(detail || "JSON không hợp lệ.");
      }
      return payload;
    } catch (caught) {
      setError(caught.message);
      return null;
    } finally {
      setBusy(false);
    }
  };
  const previewImport = async () => {
    if (!raw.trim()) {
      setError(
        lang === "en"
          ? "Choose a JSON file or paste content first."
          : "Hãy chọn file JSON hoặc dán nội dung trước.",
      );
      return;
    }
    setPreview(await call("/api/import/preview"));
  };
  const submitImport = async () => {
    const result = await call("/api/import");
    if (result) {
      notify(
        lang === "en"
          ? `Imported ${Object.values(result.imported).reduce((sum, count) => sum + count, 0)} rows`
          : `Đã import ${Object.values(result.imported).reduce((sum, count) => sum + count, 0)} bản ghi`,
      );
      onImported();
      onClose();
    }
  };
  return (
    <dialog ref={dialog} onCancel={(event) => { event.preventDefault(); if (!busy) onClose(); }}>
      <form
        className="import-dialog"
        onSubmit={(event) => {
          event.preventDefault();
          preview ? submitImport() : previewImport();
        }}
      >
        <div className="dialog-head">
          <div>
            <p className="eyebrow">DATA IMPORT</p>
            <h2>{importTitle}</h2>
          </div>
          <button type="button" className="close-btn" onClick={onClose}>
            ×
          </button>
        </div>
        <div className="import-format-tabs"><button type="button" className={!isCsv ? "active" : ""} onClick={() => { setSelectedType("application/json"); setRaw(""); setPreview(null); }}>JSON</button><button type="button" className={isCsv ? "active" : ""} onClick={() => { setSelectedType("text/csv"); setRaw(""); setPreview(null); }}>CSV</button></div><p className="import-help">{importHelp}</p>
        <input
          type="file"
          accept={isCsv ? "text/csv,.csv" : "application/json,.json"}
          onChange={readFile}
        />
        <textarea
          value={raw}
          onChange={(event) => {
            setRaw(event.target.value);
            setPreview(null);
            setError("");
          }}
          rows="9"
          placeholder={isCsv ? "Dán CSV vào đây..." : t("pasteJson")}
        />
        {error && (
          <pre className="import-error" role="alert">
            {error}
          </pre>
        )}
        {preview && (
          <div className="import-preview">
            <strong>{t("ready")}</strong>
            {Object.entries(preview.counts).map(([key, count]) => (
              <span key={key}>
                {key}: {count}
              </span>
            ))}
          </div>
        )}
        <div className="dialog-actions">
          <a
            className="secondary-btn"
            href={`data:${isCsv ? "text/csv" : "application/json"};charset=utf-8,${encodeURIComponent(sampleContent)}`}
            download={importSampleFilename(scope, isCsv ? "csv" : "json")}
          >
            {isCsv ? "Tải CSV mẫu" : t("downloadExample")}
          </a>
          <button type="button" className="secondary-btn" onClick={copySample}>
            {lang === "en" ? `Copy ${isCsv ? "CSV" : "JSON"} sample` : `Copy mẫu ${isCsv ? "CSV" : "JSON"}`}
          </button>
          <button
            type="button"
            className="secondary-btn"
            onClick={() => {
              setRaw(sampleContent);
              setPreview(null);
              setError("");
            }}
          >
            {isCsv ? "Dùng CSV mẫu" : t("useExample")}
          </button>
          <button type="submit" className="primary-btn" disabled={busy}>
            {busy ? <><Spinner />{t("checking")}</> : preview ? t("importData") : isCsv ? "Kiểm tra CSV" : t("checkJson")}
          </button>
        </div>
      </form>
    </dialog>
  );
}

function LoginScreen({ onLogin, lang }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (!response.ok)
        throw new Error(
          response.status === 401
            ? lang === "en"
              ? "Incorrect password."
              : "Mật khẩu không đúng."
            : lang === "en"
              ? "Unable to sign in."
              : "Không thể đăng nhập lúc này.",
        );
      onLogin();
    } catch (caught) {
      setError(caught.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <main className="login-shell">
      <form className="login-card" onSubmit={submit}>
        <span className="brand-mark">✦</span>
        <p className="eyebrow">CONTENT WORKSPACE</p>
        <h1>{lang === "en" ? "Sign in" : "Đăng nhập"}</h1>
        <p className="login-copy">
          {lang === "en"
            ? "Enter your workspace password."
            : "Nhập mật khẩu ứng dụng để mở workspace."}
        </p>
        <label>
          {lang === "en" ? "Password" : "Mật khẩu"}
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoFocus
            required
          />
        </label>
        {error && (
          <p className="login-error" role="alert">
            {error}
          </p>
        )}
        <button className="primary-btn full" disabled={busy}>
          {busy ? "..." : lang === "en" ? "Open workspace" : "Mở workspace"}
        </button>
      </form>
    </main>
  );
}

function LoginLanguagePicker({ lang, onChange }) {
  return (
    <label className="login-language">
      {COPY[lang]?.language || "Language"}
      <select value={lang} onChange={(event) => onChange(event.target.value)}>
        {Object.entries(LANGUAGE_NAMES).map(([code, name]) => (
          <option key={code} value={code}>
            {languageOption(code, name)}
          </option>
        ))}
      </select>
    </label>
  );
}
function SupabaseLogin({ lang }) {
  const [mode, setMode] = useState("login");
  const [selectedLang, setSelectedLang] = useState(lang);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [message, setMessage] = useState("");
  const copy = COPY[selectedLang] || COPY.en;
  const submit = async (event) => {
    event.preventDefault();
    setMessage("");
    const result =
      mode === "login"
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({
            email,
            password,
            options: {
              emailRedirectTo: `${window.location.origin}/auth/callback`,
            },
          });
    setMessage(
      result.error?.message ||
        (mode === "login"
          ? selectedLang === "en"
            ? "Signed in."
            : "Đã đăng nhập."
          : selectedLang === "en"
            ? "Check your email to confirm your account."
            : "Hãy kiểm tra email để xác nhận tài khoản."),
    );
  };
  return (
    <main className="login-shell">
      <form className="login-card" onSubmit={submit}>
        <div className="login-toolbar">
          <span className="brand-mark">✦</span>
          <LoginLanguagePicker
            lang={selectedLang}
            onChange={(value) => {
              setSelectedLang(value);
              localStorage.setItem("content-lang", value);
            }}
          />
        </div>
        <p className="eyebrow">CONTENT WORKSPACE</p>
        <h1>
          {mode === "login"
            ? selectedLang === "en"
              ? "Sign in"
              : selectedLang === "vi"
                ? "Đăng nhập"
                : copy.login || "Sign in"
            : selectedLang === "en"
              ? "Create account"
              : selectedLang === "vi"
                ? "Tạo tài khoản"
                : copy.signup || "Create account"}
        </h1>
        <label>
          Email
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </label>
        <label>
          {selectedLang === "en"
            ? "Password"
            : selectedLang === "vi"
              ? "Mật khẩu"
              : "Password"}
          <span className="password-field">
            <input
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              minLength="8"
              required
            />
            <button
              type="button"
              className="password-toggle"
              aria-label={selectedLang === "vi"
                ? showPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"
                : showPassword ? "Hide password" : "Show password"}
              aria-pressed={showPassword}
              onClick={() => setShowPassword((visible) => !visible)}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" />
                <circle cx="12" cy="12" r="3" />
                {showPassword && <path d="m3 3 18 18" />}
              </svg>
            </button>
          </span>
        </label>
        {message && (
          <p className="login-copy" role="status">
            {message}
          </p>
        )}
        <button className="primary-btn full">
          {mode === "login"
            ? selectedLang === "en"
              ? "Sign in"
              : selectedLang === "vi"
                ? "Đăng nhập"
                : "Sign in"
            : selectedLang === "en"
              ? "Sign up"
              : selectedLang === "vi"
                ? "Đăng ký"
                : "Sign up"}
        </button>
        <button
          type="button"
          className="link-btn login-switch"
          onClick={() => {
            setMode(mode === "login" ? "signup" : "login");
            setShowPassword(false);
          }}
        >
          {mode === "login"
            ? selectedLang === "en"
              ? "Create an account"
              : selectedLang === "vi"
                ? "Tạo tài khoản mới"
                : "Create an account"
            : selectedLang === "en"
              ? "Back to sign in"
              : selectedLang === "vi"
                ? "Quay lại đăng nhập"
                : "Back to sign in"}
        </button>
      </form>
    </main>
  );
}

function CreateWorkspace({ lang, onCreated }) {
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const submit = async (event) => {
    event.preventDefault();
    const response = await apiFetch("/api/workspaces", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    if (!response.ok) {
      setError(
        lang === "en"
          ? "Could not create workspace."
          : "Không thể tạo workspace.",
      );
      return;
    }
    const payload = await response.json();
    onCreated(payload.workspace);
  };
  return (
    <main className="login-shell">
      <form className="login-card" onSubmit={submit}>
        <span className="brand-mark">✦</span>
        <p className="eyebrow">CONTENT WORKSPACE</p>
        <h1>{lang === "en" ? "Create your workspace" : "Tạo workspace"}</h1>
        <p className="login-copy">
          {lang === "en"
            ? "Start a private space for your content team."
            : "Tạo không gian riêng cho team content của bạn."}
        </p>
        <label>
          {lang === "en" ? "Workspace name" : "Tên workspace"}
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            minLength="2"
            maxLength="120"
            required
          />
        </label>
        {error && (
          <p className="login-error" role="alert">
            {error}
          </p>
        )}
        <button className="primary-btn full">
          {lang === "en" ? "Create workspace" : "Tạo workspace"}
        </button>
      </form>
    </main>
  );
}

function AdminPage({ workspaceId }) {
  const [rows, setRows] = useState([]);
  useEffect(() => {
    apiFetch("/api/admin/workspaces", {}, workspaceId)
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => setRows(j?.workspaces || []));
  }, [workspaceId]);
  return (
    <section className="view">
      <div className="page-heading">
        <div>
          <p className="eyebrow">ADMIN</p>
          <h1>Global administration</h1>
          <p>All workspaces on this installation.</p>
        </div>
      </div>
      <div className="ref-list">
        {rows.map((row) => (
          <div className="ref-row" key={row.id}>
            <strong>{row.name}</strong>
            <span>{row.id}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

function PaginationControls({ page, setPage, total, pageSize = 12 }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  return (
    <div className="table-pagination compact-pagination">
      <span>{total ? `${(page - 1) * pageSize + 1}–${Math.min(page * pageSize, total)} / ${total}` : "No data"}</span>
      <div className="pagination-pages">
        <button type="button" aria-label="Previous page" disabled={page === 1} onClick={() => setPage((value) => value - 1)}>‹</button>
        {Array.from({ length: pages }, (_, index) => index + 1).map((pageNumber) => (
          <button
            type="button"
            className={pageNumber === page ? "active" : ""}
            aria-current={pageNumber === page ? "page" : undefined}
            aria-label={`Page ${pageNumber}`}
            key={pageNumber}
            onClick={() => setPage(pageNumber)}
          >
            {pageNumber}
          </button>
        ))}
        <button type="button" aria-label="Next page" disabled={page >= pages} onClick={() => setPage((value) => value + 1)}>›</button>
      </div>
    </div>
  );
}

export default function App() {
  const routeView = () =>
    ({
      "/": "pipeline",
      "/pipeline": "pipeline",
      "/audio": "audio",
      "/reference": "reference",
      "/brainstorm": "brainstorm",
      "/operations": "operations",
      "/admin": "admin",
    })[window.location.pathname] || "pipeline";
  const [workspaces, setWorkspaces] = useState([]);
  const [view, setView] = useState(routeView);
  const [pipelineMode, setPipelineMode] = useState("board");
  const [kanbanSort, setKanbanSort] = useState("newest");
  const [detailIdea, setDetailIdea] = useState(null);
  const [pendingOpenIdeaId, setPendingOpenIdeaId] = useState(null);
  const [quickTitle, setQuickTitle] = useState("");
  const [theme, setTheme] = useState(() => document.documentElement.dataset.theme === "light" ? "light" : "dark");
  const quickCaptureRef = useRef(null);
  const [returnToIdeaForm, setReturnToIdeaForm] = useState(false);
  const [lang, setLang] = useState(
    () => localStorage.getItem("content-lang") || "vi",
  );
  const [data, setData] = useState(fallback);
  const [workspaceConcepts, setWorkspaceConcepts] = useState([]);
  const [pipelineColumns, setPipelineColumns] = useState([]);
  const [editingColumnStatus, setEditingColumnStatus] = useState(null);
  const [columnTitleDraft, setColumnTitleDraft] = useState("");
  const [columnTitleSaving, setColumnTitleSaving] = useState(false);
  const [columnTitleError, setColumnTitleError] = useState("");
  const [addingColumn, setAddingColumn] = useState(false);
  const [newColumnTitle, setNewColumnTitle] = useState("");
  const [workspaceId, setWorkspaceId] = useState(
    () => localStorage.getItem("workspace-id") || "",
  );
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [planningFilter, setPlanningFilter] = useState("all");
  const [savedFilters, setSavedFilters] = useState([]);
  const [selectedIdeaIds, setSelectedIdeaIds] = useState(() => new Set());
  const [draggedIdeaId, setDraggedIdeaId] = useState(null);
  const [draggedColumnStatus, setDraggedColumnStatus] = useState(null);
  const [audioFilter, setAudioFilter] = useState({ query: "", mood: "all" });
  const [audioPage, setAudioPage] = useState(1);
  const [ref, setRef] = useState("config");
  const [refPage, setRefPage] = useState(1);
  const [ideaOpen, setIdeaOpen] = useState(false);
  const [audioOpen, setAudioOpen] = useState(false);
  const [editingTrack, setEditingTrack] = useState(null);
  const [brainstorm, setBrainstorm] = useState(null);
  const [brainstormHistory, setBrainstormHistory] = useState([]);
  const [brainstormSource, setBrainstormSource] = useState(null);
  const [brainstormError, setBrainstormError] = useState("");
  const [lastBrainstormRequest, setLastBrainstormRequest] = useState(null);
  const [toast, setToast] = useState("");
  const [loading, setLoading] = useState(true);
  const [syncStatus, setSyncStatus] = useState("loading");
  const refreshRequestId = useRef(0);
  const [aiLoading, setAiLoading] = useState(false);
  const [authenticated, setAuthenticated] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [importScope, setImportScope] = useState(null);
  const [accountOpen, setAccountOpen] = useState(false);
  const [form, setForm] = useState({
    title: "",
    status: "Lên ý tưởng",
    concept: "Vlog",
    priority: 2,
    hook: "",
    main_content: "",
    publish_date: "",
    platforms: ["TikTok"],
    platform_publish_dates: {},
    platform_publish_links: {},
  });
  const t = (key) => COPY[lang]?.[key] || COPY.en[key] || key;
  const pipelineColumnTitles = useMemo(
    () => mergePipelineColumnTitles(STATUSES, pipelineColumns),
    [pipelineColumns],
  );
  const activePipelineStatusValues = useMemo(
    () => activePipelineStatuses(STATUSES, pipelineColumns),
    [pipelineColumns],
  );
  useEffect(() => {
    setForm((current) => {
      const status = keepValidPipelineStatus(activePipelineStatusValues, current.status);
      return status === current.status ? current : { ...current, status };
    });
  }, [activePipelineStatusValues]);
  const pipelineStatusLabel = (status) =>
    statusLabel(status, lang, pipelineColumnTitles);
  const beginColumnTitleEdit = (status) => {
    setEditingColumnStatus(status);
    setColumnTitleDraft(pipelineStatusLabel(status));
    setColumnTitleError("");
  };
  const cancelColumnTitleEdit = () => {
    setEditingColumnStatus(null);
    setColumnTitleDraft("");
    setColumnTitleError("");
  };
  const saveColumnTitle = async (status) => {
    const title = columnTitleDraft.trim();
    if (!title || title.length > 80) {
      setColumnTitleError(
        lang === "en"
          ? "Use a title between 1 and 80 characters."
          : "Tên cột phải dài từ 1 đến 80 ký tự.",
      );
      return false;
    }
    setColumnTitleSaving(true);
    setColumnTitleError("");
    try {
      const response = await apiFetch(
        "/api/pipeline/columns",
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status, title }),
        },
        workspaceId,
      );
      if (!response.ok) throw new Error();
      const payload = await response.json();
      setPipelineColumns((current) => [
        ...current.filter((column) => column.status !== status),
        payload.column,
      ]);
      cancelColumnTitleEdit();
      notify(t("columnTitleUpdated"));
      return true;
    } catch {
      setColumnTitleError(t("columnTitleUpdateFailed"));
      return false;
    } finally {
      setColumnTitleSaving(false);
    }
  };
  const archivePipelineColumn = async (status) => {
    setColumnTitleSaving(true);
    setColumnTitleError("");
    try {
      const response = await apiFetch(
        `/api/pipeline/columns/${encodeURIComponent(status)}`,
        { method: "DELETE" },
        workspaceId,
      );
      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        if (response.status === 409) throw new Error(t("columnDeleteHasIdeas"));
        throw new Error(payload?.detail || t("columnDeleteFailed"));
      }
      const payload = await response.json();
      setPipelineColumns((current) => [
        ...current.filter((column) => column.status !== status),
        payload.column,
      ]);
      cancelColumnTitleEdit();
      notify(t("columnDeleted"));
      return true;
    } catch (error) {
      setColumnTitleError(error.message || t("columnDeleteFailed"));
      return false;
    } finally {
      setColumnTitleSaving(false);
    }
  };
  const addPipelineColumn = async (event) => {
    event.preventDefault();
    const title = newColumnTitle.trim();
    if (!title || title.length > 80) {
      setColumnTitleError(lang === "en" ? "Use a title between 1 and 80 characters." : "Tên cột phải dài từ 1 đến 80 ký tự.");
      return false;
    }
    setColumnTitleSaving(true);
    setColumnTitleError("");
    try {
      const response = await apiFetch(
        "/api/pipeline/columns",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title }),
        },
        workspaceId,
      );
      if (!response.ok) throw new Error();
      const payload = await response.json();
      setPipelineColumns((current) => [...current, payload.column]);
      setNewColumnTitle("");
      setAddingColumn(false);
      notify(t("columnAdded"));
      return true;
    } catch {
      setColumnTitleError(t("columnAddFailed"));
      return false;
    } finally {
      setColumnTitleSaving(false);
    }
  };
  const reorderPipelineColumns = async (sourceStatus, targetStatus) => {
    if (!sourceStatus || !targetStatus || sourceStatus === targetStatus) return true;
    const currentOrder = activePipelineStatusValues;
    const nextOrder = reorderPipelineStatuses(currentOrder, sourceStatus, targetStatus);
    if (nextOrder.join("\u0000") === currentOrder.join("\u0000")) return false;
    const previousColumns = pipelineColumns;
    const sortOrder = new Map(nextOrder.map((status, index) => [status, index + 1]));
    setPipelineColumns((current) => current.map((column) => (
      sortOrder.has(column.status) ? { ...column, sort_order: sortOrder.get(column.status) } : column
    )));
    try {
      const response = await apiFetch(
        "/api/pipeline/columns/order",
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ statuses: nextOrder }),
        },
        workspaceId,
      );
      if (!response.ok) throw new Error();
      const payload = await response.json();
      if (Array.isArray(payload.columns)) setPipelineColumns(payload.columns);
      notify(t("columnOrderUpdated"));
      return true;
    } catch {
      setPipelineColumns(previousColumns);
      notify(t("columnOrderUpdateFailed"));
      return false;
    } finally {
      setDraggedColumnStatus(null);
    }
  };
  const notify = (message) => {
    setToast(message);
    window.setTimeout(() => setToast(""), 2300);
  };
  const refresh = async (selectedWorkspaceId = workspaceId, isCurrent = () => true) => {
    if (!selectedWorkspaceId) return;
    const requestId = ++refreshRequestId.current;
    setLoading(true);
    setSyncStatus("loading");
    try {
      const response = await apiFetch("/api/state", {}, selectedWorkspaceId);
      if (!response.ok) throw new Error();
      const payload = await response.json();
      if (!isCurrent() || requestId !== refreshRequestId.current) return;
      setData(payload);
      setSyncStatus("connected");
      if (Array.isArray(payload.concepts)) {
        setWorkspaceConcepts(payload.concepts);
      }
    } catch {
      if (!isCurrent() || requestId !== refreshRequestId.current) return;
      setSyncStatus("error");
      notify(
        lang === "en"
          ? "Could not load workspace data."
          : "Không tải được dữ liệu workspace",
      );
    } finally {
      if (isCurrent() && requestId === refreshRequestId.current) setLoading(false);
    }
  };
  useEffect(() => {
    const onPopState = () => setView(routeView());
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);
  useEffect(() => {
    localStorage.setItem("content-lang", lang);
    document.documentElement.lang = lang;
  }, [lang]);
  useEffect(() => {
    if (!supabaseConfigured) {
      setAuthenticated(false);
      return undefined;
    }
    supabase.auth
      .getSession()
      .then(({ data: { session } }) => setAuthenticated(Boolean(session)));
    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, session) => setAuthenticated(Boolean(session)),
    );
    return () => listener.subscription.unsubscribe();
  }, []);
  useEffect(() => {
    if (authenticated) {
      apiFetch("/api/admin/status").then((r) => setIsAdmin(r.ok));
      apiFetch("/api/workspaces")
        .then((response) => response.json())
        .then((payload) => {
          setWorkspaces(payload.workspaces || []);
          const selected = workspaceId || payload.workspaces?.[0]?.id || "";
          setWorkspaceId(selected);
          if (selected) localStorage.setItem("workspace-id", selected);
        })
        .catch(() => {});
    }
  }, [authenticated]);
  useEffect(() => {
    if (authenticated && workspaceId) {
      let active = true;
      const selectedWorkspaceId = workspaceId;
      setData(fallback);
      setWorkspaceConcepts([]);
      setPipelineColumns([]);
      setEditingColumnStatus(null);
      refresh(selectedWorkspaceId, () => active);
      (async () => {
        try {
          const response = await apiFetch(
            "/api/concepts",
            {},
            selectedWorkspaceId,
          );
          if (!active || !response.ok) return;
          const payload = await response.json();
          if (Array.isArray(payload.concepts)) {
            setWorkspaceConcepts(payload.concepts);
          }
        } catch {
          // The concepts migration may not be deployed yet; ideas still provide a fallback list.
        }
      })();
      (async () => {
        try {
          const response = await apiFetch(
            "/api/pipeline/columns",
            {},
            selectedWorkspaceId,
          );
          if (!active || !response.ok) return;
          const payload = await response.json();
          if (Array.isArray(payload.columns)) setPipelineColumns(payload.columns);
        } catch {
          // Older deployments fall back to the built-in status labels.
        }
      })();
      return () => {
        active = false;
      };
    }
    setData(fallback);
    setWorkspaceConcepts([]);
    setPipelineColumns([]);
    return undefined;
  }, [authenticated, workspaceId]);
  useEffect(() => {
    if (!authenticated || !workspaceId) {
      setBrainstormHistory([]);
      return undefined;
    }
    let active = true;
    apiFetch("/api/brainstorm/history", {}, workspaceId)
      .then((response) => response.ok ? response.json() : null)
      .then((payload) => {
        if (active && payload?.history) setBrainstormHistory(payload.history);
      })
      .catch(() => {});
    return () => { active = false; };
  }, [authenticated, workspaceId]);
  useEffect(() => { setAudioPage(1); }, [audioFilter.query, audioFilter.mood]);
  useEffect(() => { setRefPage(1); }, [ref]);
  useEffect(() => {
    setFilters(EMPTY_FILTERS);
    setPlanningFilter("all");
    setSelectedIdeaIds(new Set());
    try {
      const stored = JSON.parse(localStorage.getItem(`pipeline-filters-${workspaceId}`) || "[]");
      setSavedFilters(Array.isArray(stored) ? stored : []);
    } catch {
      setSavedFilters([]);
    }
    setAudioFilter({ query: "", mood: "all" });
    setAudioPage(1);
    setEditingTrack(null);
  }, [workspaceId]);
  const moodOptions = useMemo(
    () => workspaceMoods(data.tracks || [], workspaceId),
    [data.tracks, workspaceId],
  );
  const ideas = useMemo(
    () => (data.ideas || []).map(normalizeIdea),
    [data.ideas],
  );
  useEffect(() => {
    if (!pendingOpenIdeaId) return;
    const idea = ideas.find((item) => String(item.id) === String(pendingOpenIdeaId));
    if (idea) {
      setDetailIdea(idea);
      setPendingOpenIdeaId(null);
    }
  }, [pendingOpenIdeaId, ideas]);
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", theme === "light" ? "#f3f4f6" : "#111317");
    try { localStorage.setItem("content-theme", theme); } catch { /* private mode: theme still applies for this visit */ }
  }, [theme]);
  useEffect(() => {
    // "N" jumps to quick capture from anywhere on the pipeline, unless the user is typing.
    const onKey = (event) => {
      if (view !== "pipeline" || event.key.toLowerCase() !== "n" || event.metaKey || event.ctrlKey || event.altKey) return;
      if (event.target.closest?.("input, textarea, select, [contenteditable=true], dialog, .idea-drawer")) return;
      event.preventDefault();
      quickCaptureRef.current?.focus();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [view]);
  const filteredIdeas = useMemo(
    () => {
      const now = new Date();
      const dateKey = (value) => {
        const date = value instanceof Date ? value : new Date(value);
        if (Number.isNaN(date.getTime())) return "";
        return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
      };
      const today = dateKey(now);
      const mondayOffset = (now.getDay() + 6) % 7;
      const weekEnd = dateKey(new Date(now.getFullYear(), now.getMonth(), now.getDate() + (6 - mondayOffset)));
      return ideas.filter((idea) => {
        const text =
          `${idea.title} ${idea.hook} ${idea.mainContent}`.toLowerCase();
        const publishDate = dateKey(idea.publishDate);
        const active = idea.status !== "Đã đăng";
        const matchesPlanning = planningFilter === "all"
          || (planningFilter === "published" && idea.status === "Đã đăng")
          || (planningFilter === "backlog" && idea.status === "Lên ý tưởng")
          || (planningFilter === "today" && active && publishDate === today)
          || (planningFilter === "overdue" && active && publishDate && publishDate < today)
          || (planningFilter === "week" && active && publishDate && publishDate > today && publishDate <= weekEnd)
          || (planningFilter === "unscheduled" && active && !publishDate);
        return (
          matchesPlanning &&
          (!filters.query || text.includes(filters.query.toLowerCase())) &&
          (filters.status === "all" || idea.status === filters.status) &&
          (filters.concept === "all" || sameConcept(idea.concept, filters.concept)) &&
          (filters.priority === "all" ||
            String(idea.priority) === filters.priority)
        );
      });
    },
    [ideas, filters, planningFilter],
  );
  const conceptOptions = useMemo(
    () =>
      mergeConceptNames(
        workspaceConcepts,
        // Starter concepts only help an empty workspace; otherwise they mix into the team's own list.
        workspaceConcepts.length ? [] : CONCEPTS,
        ideas.map((idea) => idea.concept),
      ),
    [workspaceConcepts, ideas],
  );
  const platformOptions = useMemo(
    () =>
      [
        ...new Set([
          ...PLATFORMS,
          ...ideas.flatMap((idea) => idea.platforms || []),
        ]),
      ].filter(Boolean),
    [ideas],
  );
  if (authenticated === null)
    return (
      <main className="login-shell">
        <p className="login-loading">Loading...</p>
      </main>
    );
  if (!authenticated)
    return supabaseConfigured ? (
      <SupabaseLogin lang={lang} />
    ) : (
      <main className="login-shell">
        <p className="login-copy">Configure Supabase Auth to sign in.</p>
      </main>
    );
  const logout = async () => {
    await supabase.auth.signOut();
    setAccountOpen(false);
    setAuthenticated(false);
  };
  const metrics = {
    inProgress: ideas.filter((idea) => idea.status !== "Đã đăng").length,
    published: ideas.filter((idea) => idea.status === "Đã đăng").length,
    backlog: ideas.filter((idea) => idea.status === "Lên ý tưởng").length,
  };
  const planningMetrics = getPlanningMetrics(ideas);
  const toggleIdeaSelection = (ideaId) => {
    setSelectedIdeaIds((current) => {
      const next = new Set(current);
      const key = String(ideaId);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };
  const clearIdeaSelection = () => setSelectedIdeaIds(new Set());
  const quickUpdateStatus = async (idea, status) => {
    if (!status || status === idea.status) return true;
    // Move the card right away; the server call confirms it, and a failure moves it back.
    const setStatus = (value) => setData((current) => ({
      ...current,
      ideas: (current.ideas || []).map((item) => String(item.id) === String(idea.id) ? { ...item, status: value } : item),
    }));
    setStatus(status);
    const saved = await updateIdea(idea.id, { ...idea, status, publish_date: idea.publishDate, main_content: idea.mainContent }, { quiet: true });
    if (!saved) setStatus(idea.status);
    return saved;
  };
  const bulkUpdateStatus = async (status) => {
    const selected = ideas.filter((idea) => selectedIdeaIds.has(String(idea.id)));
    if (!selected.length) return;
    const results = [];
    for (const idea of selected) results.push(await quickUpdateStatus(idea, status));
    if (results.every(Boolean)) notify(lang === "en" ? `${selected.length} ideas updated.` : `Đã đổi trạng thái ${selected.length} idea.`);
    clearIdeaSelection();
  };
  const removeIdeaFromViews = (ideaId) => {
    const key = String(ideaId);
    setData((current) => ({ ...current, ideas: removeIdea(current.ideas || [], ideaId) }));
    setSelectedIdeaIds((current) => {
      const next = new Set(current);
      next.delete(key);
      return next;
    });
    setDraggedIdeaId((current) => String(current) === key ? null : current);
    setDetailIdea((current) => String(current?.id) === key ? null : current);
    setReturnToIdeaForm(false);
  };
  const deleteIdea = async (idea) => {
    if (!window.confirm(t("confirmDeleteIdea"))) return false;
    try {
      const response = await apiFetch(`/api/ideas/${idea.id}`, { method: "DELETE" }, workspaceId);
      if (!response.ok) throw new Error();
      removeIdeaFromViews(idea.id);
      await refresh();
      notify(t("ideaDeleted"));
      return true;
    } catch {
      notify(t("ideaDeleteFailed"));
      return false;
    }
  };
  const saveCurrentFilter = () => {
    const parts = [
      filters.query && `“${filters.query}”`,
      filters.concept !== "all" && filters.concept,
      filters.status !== "all" && pipelineStatusLabel(filters.status),
      filters.priority !== "all" && `P${filters.priority}`,
    ].filter(Boolean);
    const label = parts.join(" · ") || `${t("savedFilters")} ${savedFilters.length + 1}`;
    const entry = { id: String(Date.now()), label, filters: { ...filters } };
    const next = [entry, ...savedFilters.filter((item) => item.label !== label)].slice(0, 8);
    setSavedFilters(next);
    localStorage.setItem(`pipeline-filters-${workspaceId}`, JSON.stringify(next));
    notify(lang === "en" ? "Filter saved." : "Đã lưu bộ lọc.");
  };
  const applySavedFilter = (id) => {
    const entry = savedFilters.find((item) => item.id === id);
    if (entry) {
      setFilters({ ...EMPTY_FILTERS, ...entry.filters });
      setPlanningFilter("all");
    }
  };
  const tracks = (data.tracks || []).filter(
    (track) =>
      (audioFilter.mood === "all" || sameMood(track.mood_genre, audioFilter.mood.slice(5))) &&
      (!audioFilter.query ||
        `${track.title} ${track.artist_source} ${track.notes}`
          .toLowerCase()
          .includes(audioFilter.query.toLowerCase())),
  );
  const updateIdea = async (ideaId, draft, { quiet = false } = {}) => {
    try {
      await ensureWorkspaceConcept(draft.concept);
      const response = await apiFetch(
        `/api/ideas/${ideaId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: draft.title,
            status: draft.status,
            concept: normalizeConcept(draft.concept),
            priority: Number(draft.priority),
            publish_date: draft.publish_date || null,
            platforms: draft.platforms,
            platform_publish_dates: normalizePlatformPublishDates(draft.platform_publish_dates),
            platform_publish_links: normalizePlatformPublishLinks(draft.platform_publish_links),
            hook: draft.hook || "",
            main_content: draft.main_content ?? draft.mainContent ?? "",
          }),
        },
        workspaceId,
      );
      if (!response.ok) throw new Error();
      const payload = await response.json().catch(() => ({}));
      if (payload.idea) {
        setData((current) => ({
          ...current,
          ideas: mergeIdea(current.ideas || [], payload.idea),
        }));
      } else {
        await refresh();
      }
      if (!quiet) notify(lang === "en" ? "Idea updated." : "Đã cập nhật ý tưởng");
      return true;
    } catch {
      notify(
        lang === "en" ? "Could not update idea." : "Không thể cập nhật ý tưởng",
      );
      return false;
    }
  };
  const ensureWorkspaceConcept = async (value) => {
    const concept = normalizeConcept(value);
    if (!concept || !workspaceId) return;
    const known = workspaceConcepts.some(
      (item) => normalizeConcept(item).toLowerCase() === concept.toLowerCase(),
    );
    if (known) return;
    setWorkspaceConcepts((current) => mergeConceptNames(current, [concept]));
    try {
      const response = await apiFetch(
        "/api/concepts",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: concept }),
        },
        workspaceId,
      );
      if (!response.ok) return;
      const payload = await response.json().catch(() => ({}));
      setWorkspaceConcepts((current) =>
        mergeConceptNames(current, [payload.concept || payload, concept]),
      );
    } catch {
      // Keep the idea save flow working when this optional endpoint is unavailable.
    }
  };
  const setField = (event) =>
    setForm((current) => ({
      ...current,
      [event.target.name]: event.target.value,
    }));
  const createIdea = async (event) => {
    event.preventDefault();
    const incoming = `${form.title} ${form.hook} ${form.main_content}`.trim();
    const duplicate = ideas.find((idea) => idea.title.trim().toLowerCase() === form.title.trim().toLowerCase());
    if (duplicate) { notify(lang === "en" ? "An idea with this title already exists." : "Đã có idea trùng tên này."); return; }
    try {
      await ensureWorkspaceConcept(form.concept);
      const response = await apiFetch(
        "/api/ideas",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...form,
            concept: normalizeConcept(form.concept),
            priority: Number(form.priority),
            publish_date: earliestPlatformPublishDate(form.platform_publish_dates),
            hashtag: [],
            platforms: form.platforms,
            platform_publish_dates: normalizePlatformPublishDates(form.platform_publish_dates),
            platform_publish_links: normalizePlatformPublishLinks(form.platform_publish_links),
          }),
        },
        workspaceId,
      );
      if (!response.ok) throw new Error();
      setIdeaOpen(false);
      setForm({
        title: "",
        status: "Lên ý tưởng",
        concept: "Vlog",
        priority: 2,
        hook: "",
        main_content: "",
        publish_date: "",
        platforms: ["TikTok"],
        platform_publish_dates: {},
        platform_publish_links: {},
      });
      await refresh();
      notify(lang === "en" ? "Idea added." : "Đã thêm ý tưởng mới");
    } catch {
      notify(lang === "en" ? "Could not save idea." : "Không thể lưu ý tưởng");
    }
  };
  const runBrainstorm = async (brief, format, duration, platforms) => {
    setAiLoading(true);
    setLastBrainstormRequest({ brief, format, duration, platforms });
    setBrainstormError("");
    try {
      const response = await apiFetch(
        "/api/brainstorm",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ brief, format, duration, platforms, language: lang }),
        },
        workspaceId,
      );
      if (!response.ok) throw new Error();
      const payload = await response.json();
      setBrainstorm(payload.ideas);
      setBrainstormSource("ai");
      await saveBrainstormHistory({ brief, format, duration, platforms, ideas: payload.ideas, source: "ai" });
      notify(
        lang === "en" ? "AI generated 3 ideas." : "AI đã tạo 3 hướng nội dung",
      );
    } catch {
      const demoIdeas = demoBrainstorm(brief, format, duration, platforms, lang);
      setBrainstorm(demoIdeas);
      setBrainstormSource("demo");
      setBrainstormError(lang === "en" ? "AI could not be reached." : "Không thể kết nối tới AI.");
      await saveBrainstormHistory({ brief, format, duration, platforms, ideas: demoIdeas, source: "demo" });
      notify(
        lang === "en"
          ? "AI unavailable; showing local demo."
          : "AI chưa cấu hình, đang dùng demo local",
      );
    } finally {
      setAiLoading(false);
    }
  };
  const saveBrainstormHistory = async (entry) => {
    try {
      const response = await apiFetch(
        "/api/brainstorm/history",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(entry),
        },
        workspaceId,
      );
      if (!response.ok) return false;
      const payload = await response.json();
      if (payload.history) setBrainstormHistory((current) => [payload.history, ...current].slice(0, 20));
      return true;
    } catch {
      return false;
    }
  };
  const saveBrainstormIdea = async (item, { status, concept, quiet = false } = {}) => {
    try {
      const draft = createBrainstormIdeaPayload(item, { status, concept, captionsLabel: t("platformCaptions") });
      await ensureWorkspaceConcept(draft.concept);
      const response = await apiFetch(
        "/api/ideas",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(draft),
        },
        workspaceId,
      );
      if (!response.ok) throw new Error();
      const payload = await response.json();
      setData((current) => ({ ...current, ideas: [...(current.ideas || []), payload.idea] }));
      if (!quiet) notify(lang === "en" ? "Saved to Pipeline." : "Đã lưu vào Pipeline.");
      return payload.idea;
    } catch {
      notify(lang === "en" ? "Could not save this idea." : "Không thể lưu ý tưởng này.");
      return null;
    }
  };
  const quickCapture = async (event) => {
    event.preventDefault();
    const title = quickTitle.trim();
    if (!title) return;
    const concept = t("quickCaptureConcept");
    const idea = { title, status: activePipelineStatusValues[0] || "Lên ý tưởng", concept, priority: 2, platforms: ["TikTok"] };
    // Show the card at once and let the server catch up, so capturing never waits on the network.
    const tempId = `pending-${Date.now()}`;
    setData((current) => ({ ...current, ideas: [...(current.ideas || []), { ...idea, id: tempId, created_at: new Date().toISOString() }] }));
    setQuickTitle("");
    quickCaptureRef.current?.focus();
    try {
      await ensureWorkspaceConcept(concept);
      const response = await apiFetch(
        "/api/ideas",
        { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(idea) },
        workspaceId,
      );
      if (!response.ok) throw new Error();
      const payload = await response.json();
      setData((current) => ({ ...current, ideas: (current.ideas || []).map((item) => item.id === tempId ? payload.idea : item) }));
      notify(lang === "en" ? "Captured. Open the card to add details." : "Đã ghi lại. Mở card để thêm chi tiết.");
    } catch {
      setData((current) => ({ ...current, ideas: (current.ideas || []).filter((item) => item.id !== tempId) }));
      setQuickTitle((current) => current || title);
      notify(lang === "en" ? "Could not save this idea." : "Không thể lưu ý tưởng này.");
    }
  };
  const expandIdea = async (draft) => {
    try {
      const response = await apiFetch(
        "/api/brainstorm/expand",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: draft.title, hook: draft.hook || "", outline: draft.main_content || "", platforms: draft.platforms?.length ? draft.platforms : ["TikTok"], language: lang }),
        },
        workspaceId,
      );
      if (!response.ok) throw new Error();
      const { idea } = await response.json();
      const { main_content: mainContent } = createBrainstormIdeaPayload({ ...idea, title: draft.title }, { captionsLabel: t("platformCaptions") });
      return { hook: idea.hook, mainContent };
    } catch {
      notify(lang === "en" ? "AI could not expand this idea. Try again." : "AI chưa phát triển được ý tưởng này. Thử lại nhé.");
      return null;
    }
  };
  const openIdeaInPipeline = (ideaId) => {
    window.history.pushState({}, "", "/pipeline");
    setView("pipeline");
    setPendingOpenIdeaId(ideaId);
  };
  const copyBrainstormScript = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      notify(lang === "en" ? "Script copied." : "Đã copy kịch bản.");
    } catch {
      notify(lang === "en" ? "Copy failed. Select the script and copy it manually." : "Copy lỗi. Hãy chọn kịch bản và copy thủ công.");
    }
  };
  const nav = [
    ["pipeline", "▦", t("pipeline")],
    ["audio", "♫", t("audio")],
    ["reference", "⌘", t("reference")],
    ["brainstorm", "✦", t("brainstorm")],
    // Operations is still a raw admin tool; keep it out of the creator's navigation.
    ...(isAdmin ? [["operations", "◈", "Operations"], ["admin", "⚙", "Admin"]] : []),
  ];
  if (!workspaceId)
    return (
      <CreateWorkspace
        lang={lang}
        onCreated={(workspace) => {
          setWorkspaces((items) => [...items, workspace]);
          setWorkspaceId(workspace.id);
          localStorage.setItem("workspace-id", workspace.id);
        }}
      />
    );
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark">✦</span>
          <div>
            <strong>
              Content
              <br />
              Studio
            </strong>
            <small>multi-platform workspace</small>
          </div>
        </div>
        <nav className="nav-list">
          {nav.map(([key, icon, label]) => (
            <button
              key={key}
              className={`nav-item ${view === key ? "active" : ""}`}
              onClick={() => {
                window.history.pushState(
                  {},
                  "",
                  key === "pipeline" ? "/pipeline" : `/${key}`,
                );
                setView(key);
              }}
            >
              <span>{icon}</span>
              <span className="nav-label">{label}</span>
              {key === "pipeline" && <b>{ideas.length}</b>}
            </button>
          ))}
        </nav>
        <div className="sidebar-footer">
          <div className={`sync-dot sync-${syncStatus}`} />
          <div>
            <strong>Supabase workspace</strong>
            <small>{syncStatus === "loading" ? t("syncLoading") : syncStatus === "error" ? t("syncError") : t("syncConnected")}</small>
          </div>
        </div>
      </aside>
      <main className="main-content">
        <header className="topbar">
          <div className="breadcrumb">
            <label className="workspace-switch">
              <span>{t("workspace")}</span>
              <select
                value={workspaceId}
                onChange={(event) => {
                  setWorkspaceId(event.target.value);
                  localStorage.setItem("workspace-id", event.target.value);
                }}
              >
                <option value="">Select workspace</option>
                {workspaces.map((workspace) => (
                  <option key={workspace.id} value={workspace.id}>
                    {workspace.name}
                  </option>
                ))}
              </select>
            </label>
            <i>/</i>
            <strong>{nav.find(([key]) => key === view)?.[2]}</strong>
          </div>
          <div className="top-actions">
            <button
              type="button"
              className="icon-btn theme-toggle"
              onClick={() => setTheme((current) => (current === "light" ? "dark" : "light"))}
              aria-label={theme === "light" ? t("themeDark") : t("themeLight")}
              title={theme === "light" ? t("themeDark") : t("themeLight")}
            >
              {theme === "light" ? "☾" : "☀"}
            </button>
            <label className="language-switch">
              <span aria-hidden="true">🌐</span>
              <select
                aria-label={t("language")}
                value={lang}
                onChange={(event) => setLang(event.target.value)}
              >
                {Object.entries(LANGUAGE_NAMES).map(([code, name]) => (
                  <option key={code} value={code}>
                    {languageOption(code, name)}
                  </option>
                ))}
              </select>
            </label>
            <div className="account-menu">
              <button
                className="avatar"
                onClick={() => setAccountOpen((open) => !open)}
                aria-label="Account menu"
                aria-expanded={accountOpen}
              >
                R
              </button>
              {accountOpen && (
                <div className="account-popover">
                  <span className="account-name">My workspace</span>
                  <button className="account-logout" onClick={logout}>
                    {t("logout")}
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>
        {view === "pipeline" && (
          <section className="view pipeline-view">
            <div className="page-header">
              <div>
                <h1>{t("pipeline")}</h1>
                <p>{lang === "en" ? "Capture ideas, move them to published, and see what is due." : "Ghi ý tưởng, đẩy tới lúc đăng và xem việc sắp đến hạn."}</p>
              </div>
              <div className="page-actions">
                <button className="secondary-btn import-btn" onClick={() => setImportScope("pipeline")}>
                  {lang === "en" ? "Import ideas" : "Import ý tưởng"}
                </button>
                <button className="primary-btn" onClick={() => setIdeaOpen(true)}>
                  {t("addIdea")}
                </button>
              </div>
            </div>
            <div className="stat-strip">
              {[
                [t("processing"), metrics.inProgress, lang === "en" ? "From idea to edit" : "Từ ý tưởng đến edit", "var(--orange)", "all"],
                [t("published"), metrics.published, lang === "en" ? "Videos live" : "Video đã lên kênh", "var(--lime)", "published"],
                [t("backlog"), metrics.backlog, lang === "en" ? "Needs a brainstorm" : "Cần một buổi brainstorm", "var(--purple)", "backlog"],
                [t("dueToday"), planningMetrics.dueToday, lang === "en" ? "Click to focus today" : "Bấm để xem việc hôm nay", "var(--blue)", "today"],
                [t("overdue"), planningMetrics.overdue, lang === "en" ? "Needs attention" : "Cần xử lý ngay", "var(--orange)", "overdue"],
                [t("upcomingWeek"), planningMetrics.upcomingWeek, lang === "en" ? "Remaining this week" : "Các ngày còn lại trong tuần", "var(--lime)", "week"],
                [t("unscheduled"), planningMetrics.unscheduled, lang === "en" ? "Give these a date" : "Gán ngày đăng", "var(--purple)", "unscheduled"],
              ].map(([label, value, note, color, filter]) => (
                <button
                  type="button"
                  className={`stat ${filter !== "all" && planningFilter === filter ? "active" : ""}`}
                  style={{ "--metric-color": color }}
                  key={label}
                  title={note}
                  onClick={() => {
                    setPlanningFilter(filter);
                    if (filter === "published") setFilters((current) => ({ ...current, status: "Đã đăng" }));
                    else if (filter === "backlog") setFilters((current) => ({ ...current, status: "Lên ý tưởng" }));
                    else if (filter === "all") setFilters((current) => ({ ...current, status: "all" }));
                    else setFilters((current) => ({ ...current, status: "all" }));
                  }}
                >
                  <strong className="stat-value">{value}</strong>
                  <span className="stat-label">{label}</span>
                  <span className="stat-note">{note}</span>
                </button>
              ))}
            </div>
            <section
              className={`panel pipeline-panel ${pipelineMode}-mode`}
            >
              <div className="panel-head">
                <div>
                  <h2>{t("pipelineTitle")}</h2>
                  <p>{t("pipelineHint")}</p>
                </div>
                <div className="view-tools">
                  <div className="view-toggle">
                    <button
                      type="button"
                      className={pipelineMode === "board" ? "active" : ""}
                      onClick={() => setPipelineMode("board")}
                    >
                      ▦ Board
                    </button>
                    <button
                      type="button"
                      className={pipelineMode === "calendar" ? "active" : ""}
                      onClick={() => setPipelineMode("calendar")}
                    >
                      ▣ Calendar
                    </button>
                    <button
                      type="button"
                      className={pipelineMode === "table" ? "active" : ""}
                      onClick={() => setPipelineMode("table")}
                    >
                      ☰ Table
                    </button>
                  </div>
                  <div className="search-wrap">
                    <span>⌕</span>
                    <input
                      value={filters.query}
                      onChange={(event) =>
                        setFilters({ ...filters, query: event.target.value })
                      }
                      placeholder={t("search")}
                    />
                  </div>
                  <select
                    value={filters.concept}
                    onChange={(event) =>
                      setFilters({ ...filters, concept: event.target.value })
                    }
                  >
                    <option value="all">
                      {t("all")} {t("concept")}
                    </option>
                    {conceptOptions.map((concept) => (
                      <option key={concept} value={concept}>
                        {conceptLabel(concept, lang)}
                      </option>
                    ))}
                  </select>
                  <select
                    value={filters.priority}
                    onChange={(event) =>
                      setFilters({ ...filters, priority: event.target.value })
                    }
                  >
                    <option value="all">
                      {t("all")} {t("priority")}
                    </option>
                    <option value="1">P1 · High</option>
                    <option value="2">P2 · Medium</option>
                    <option value="3">P3 · Low</option>
                      </select>
                  <select
                    value={kanbanSort}
                    onChange={(event) => setKanbanSort(event.target.value)}
                    aria-label={lang === "en" ? "Sort Kanban cards" : "Sắp xếp card Kanban"}
                  >
                    <option value="newest">{lang === "en" ? "Newest first" : "Mới nhất trước"}</option>
                    <option value="oldest">{lang === "en" ? "Oldest first" : "Cũ nhất trước"}</option>
                    <option value="priority">{lang === "en" ? "Priority: high first" : "Ưu tiên cao trước"}</option>
                    <option value="title">{lang === "en" ? "Title: A–Z" : "Tên: A–Z"}</option>
                  </select>
                  <details className="more-filters">
                    <summary>{lang === "en" ? "More" : "Thêm"}</summary>
                    <div className="more-filters-menu">
                      <select
                    value={filters.status}
                    onChange={(event) =>
                      setFilters({ ...filters, status: event.target.value })
                    }
                  >
                    <option value="all">
                      {t("all")} {t("status")}
                    </option>
                    {activePipelineStatusValues.map((status) => (
                      <option key={status} value={status}>
                        {pipelineStatusLabel(status)}
                      </option>
                    ))}
                  </select>
                      <select
                    value=""
                    onChange={(event) => applySavedFilter(event.target.value)}
                    aria-label={t("savedFilters")}
                  >
                    <option value="">{t("savedFilters")}</option>
                    {savedFilters.map((entry) => <option key={entry.id} value={entry.id}>{entry.label}</option>)}
                  </select>
                  <button type="button" className="secondary-btn compact-action" onClick={saveCurrentFilter}>＋ {t("saveFilter")}</button>
                    </div>
                  </details>
                </div>
              </div>
              <form className="quick-capture" onSubmit={quickCapture}>
                <span aria-hidden="true">＋</span>
                <input
                  ref={quickCaptureRef}
                  value={quickTitle}
                  onChange={(event) => setQuickTitle(event.target.value)}
                  maxLength={240}
                  aria-label={t("quickCapture")}
                  placeholder={t("quickCapturePlaceholder")}
                />
                <kbd>N</kbd>
                <button type="submit" className="primary-btn" disabled={!quickTitle.trim()}>
                  {t("quickCaptureAdd")} {activePipelineStatusValues[0] ? pipelineStatusLabel(activePipelineStatusValues[0]) : ""}
                </button>
              </form>
              {pipelineMode === "board" && <div className="pipeline-subtools" title={`${t("dragHint")} · ${t("reorderColumnsHint")}`}>
                <button type="button" className="link-btn select-visible" onClick={() => setSelectedIdeaIds(new Set(filteredIdeas.map((idea) => String(idea.id))))}>{lang === "en" ? "Select visible" : "Chọn các card đang hiện"}</button>
                {!addingColumn ? (
                  <button type="button" className="secondary-btn compact-action" onClick={() => { setAddingColumn(true); setColumnTitleError(""); }}>{t("addColumn")}</button>
                ) : (
                  <form className="column-add-form" onSubmit={addPipelineColumn}>
                    <input
                      value={newColumnTitle}
                      onChange={(event) => setNewColumnTitle(event.target.value)}
                      maxLength="80"
                      placeholder={t("newColumnTitle")}
                      aria-label={t("newColumnTitle")}
                      autoFocus
                    />
                    <button type="submit" className="column-title-save" disabled={columnTitleSaving}>✓</button>
                    <button type="button" className="column-title-cancel" onClick={() => { setAddingColumn(false); setNewColumnTitle(""); setColumnTitleError(""); }} disabled={columnTitleSaving}>×</button>
                  </form>
                )}
                {planningFilter !== "all" && <button type="button" className="filter-chip" onClick={() => { setPlanningFilter("all"); setFilters((current) => ({ ...current, status: "all" })); }}>× {t("clearSmartFilter")}</button>}
                {selectedIdeaIds.size > 0 && (
                  <div className="bulk-actions">
                    <strong>{selectedIdeaIds.size} {t("selectedCount")}</strong>
                    <select defaultValue="" onChange={(event) => { if (event.target.value) bulkUpdateStatus(event.target.value); }} aria-label={t("applyStatus")}>
                      <option value="">{t("applyStatus")}</option>
                      {activePipelineStatusValues.map((status) => <option key={status} value={status}>{pipelineStatusLabel(status)}</option>)}
                    </select>
                    <button type="button" className="link-btn" onClick={clearIdeaSelection}>{t("cancel")}</button>
                  </div>
                )}
              </div>}
              {columnTitleError && !editingColumnStatus && <p className="column-title-error" role="alert">{columnTitleError}</p>}
              {pipelineMode === "board" && <div
                className="kanban"
                style={{ "--pipeline-column-count": activePipelineStatusValues.length }}
              >
                {activePipelineStatusValues.map((status) => (
                  <section
                    className={`kanban-col status-col-${STATUSES.indexOf(status) + 1} ${draggedIdeaId ? "drop-target" : ""}`}
                    key={status}
                    onDragOver={(event) => event.preventDefault()}
                    onDrop={() => {
                      const dragged = ideas.find((item) => String(item.id) === String(draggedIdeaId));
                      if (dragged) quickUpdateStatus(dragged, status);
                      setDraggedIdeaId(null);
                    }}
                  >
                    {(() => {
                      const columnIdeas = sortIdeas(
                        filteredIdeas.filter((idea) => idea.status === status),
                        kanbanSort,
                      );
                      return (
                        <>
                    <div
                      className={`col-head ${draggedColumnStatus === status ? "column-dragging" : ""}`}
                      draggable={editingColumnStatus !== status}
                      onDragStart={(event) => {
                        setDraggedColumnStatus(status);
                        event.dataTransfer.effectAllowed = "move";
                        event.dataTransfer.setData("text/plain", status);
                      }}
                      onDragEnd={() => setDraggedColumnStatus(null)}
                      onDragOver={(event) => {
                        if (draggedColumnStatus && draggedColumnStatus !== status) event.preventDefault();
                      }}
                      onDrop={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        reorderPipelineColumns(draggedColumnStatus, status);
                      }}
                      title={editingColumnStatus === status ? undefined : t("reorderColumnsHint")}
                    >
                      {editingColumnStatus === status ? (
                        <form
                          className="column-title-editor"
                          onSubmit={(event) => {
                            event.preventDefault();
                            saveColumnTitle(status);
                          }}
                        >
                          <input
                            value={columnTitleDraft}
                            onChange={(event) => setColumnTitleDraft(event.target.value)}
                            maxLength="80"
                            placeholder={t("columnTitlePlaceholder")}
                            aria-label={t("editColumnTitle")}
                            autoFocus
                          />
                          <button type="submit" className="column-title-save" disabled={columnTitleSaving} aria-label={t("saveColumnTitle")}>✓</button>
                          <button
                            type="button"
                            className="column-title-delete"
                            onClick={() => {
                              if (window.confirm(t("confirmDeleteColumn"))) {
                                archivePipelineColumn(status);
                              }
                            }}
                            disabled={columnTitleSaving}
                            aria-label={`${t("deleteColumn")}: ${pipelineStatusLabel(status)}`}
                          >
                            {t("deleteColumn")}
                          </button>
                          <button type="button" className="column-title-cancel" onClick={cancelColumnTitleEdit} disabled={columnTitleSaving} aria-label={t("cancel")}>×</button>
                        </form>
                      ) : (
                        <div className="column-title-wrap">
                          <span>{pipelineStatusLabel(status)}</span>
                          <button
                            type="button"
                            className="column-title-edit"
                            onClick={() => beginColumnTitleEdit(status)}
                            title={t("editColumnTitle")}
                            aria-label={`${t("editColumnTitle")}: ${pipelineStatusLabel(status)}`}
                          >
                            ✎
                          </button>
                        </div>
                      )}
                      <b>
                        {columnIdeas.length}
                      </b>
                    </div>
                    {editingColumnStatus === status && columnTitleError && (
                      <p className="column-title-error" role="alert">{columnTitleError}</p>
                    )}
                    <div className="idea-stack">
                      {columnIdeas.length ? columnIdeas.map((idea) => (
                          <article
                            className={`idea-card ${status === STATUSES[0] ? "idea-column-card" : ""} ${selectedIdeaIds.has(String(idea.id)) ? "selected" : ""}`}
                            key={idea.id}
                            role="button"
                            tabIndex="0"
                            draggable="true"
                            onDragStart={(event) => {
                              setDraggedIdeaId(String(idea.id));
                              event.dataTransfer.effectAllowed = "move";
                            }}
                            onDragEnd={() => setDraggedIdeaId(null)}
                            onClick={() => setDetailIdea(idea)}
                            onKeyDown={(event) => {
                              if (event.key === "Enter" || event.key === " ")
                                setDetailIdea(idea);
                            }}
                          >
                            <div className="idea-top">
                              <label className="idea-select" onClick={(event) => event.stopPropagation()}>
                                <input type="checkbox" checked={selectedIdeaIds.has(String(idea.id))} onChange={() => toggleIdeaSelection(idea.id)} aria-label={`${t("allIdeas")}: ${idea.title}`} />
                              </label>
                              <span className={`priority p${idea.priority}`}>P{idea.priority}</span>
                              <span className="idea-meta">{formatDate(idea.publishDate, lang)}</span>
                            </div>
                            <h3>{idea.title}</h3>
                            {idea.hook && (
                              <p className="idea-hook">“{idea.hook}”</p>
                            )}
                            <div className="idea-meta">
                              <span className="concept-tag">
                                {conceptLabel(idea.concept, lang)}
                              </span>
                              {idea.platforms.slice(0, 3).map((platform) => (
                                <PlatformBadge key={platform} platform={platform} compact iconOnly />
                              ))}
                            </div>
                          </article>
                        )) : (
                          <p className="column-empty">
                            {lang === "en" ? "No matching ideas" : "Không có idea phù hợp"}
                          </p>
                        )}
                    </div>
                        </>
                      );
                    })()}
                  </section>
                ))}
              </div>}
              {pipelineMode === "calendar" && (
                <PipelineCalendar
                  ideas={filteredIdeas}
                  lang={lang}
                  onOpen={setDetailIdea}
                />
              )}
              {pipelineMode === "table" && (
                <EditableTable
                  ideas={filteredIdeas}
                  conceptOptions={conceptOptions}
                  pipelineTitles={pipelineColumnTitles}
                  pipelineStatuses={activePipelineStatusValues}
                  lang={lang}
                  t={t}
                  onSave={updateIdea}
                />
              )}
            </section>
          </section>
        )}
        {view === "audio" && (
          <section className="view">
            <div className="page-heading">
              <div>
                <p className="eyebrow">SOUND PALETTE</p>
                <h1>{t("audio")}</h1>
                <p>{t("audioHint")}</p>
              </div>
              <div className="page-actions">
                <button type="button" className="secondary-btn import-btn" onClick={() => setImportScope("audio")}>
                  {lang === "en" ? "Import tracks" : "Import nhạc"}
                </button>
                <button type="button" className="primary-btn" onClick={() => setAudioOpen(true)}>
                  {lang === "en" ? "＋ Add track" : "＋ Thêm bài nhạc"}
                </button>
              </div>
            </div>
            <div className="filter-line">
              <div className="search-wrap">
                <span>⌕</span>
                <input
                  value={audioFilter.query}
                  onChange={(event) =>
                    setAudioFilter({
                      ...audioFilter,
                      query: event.target.value,
                    })
                  }
                  placeholder={
                    lang === "en"
                      ? "Search tracks, source, mood..."
                      : "Tìm bài hát, nguồn, mood..."
                  }
                />
              </div>
              <div className="segmented">
                {[null, ...moodOptions].map((mood) => (
                  <button
                    className={`segment ${audioFilter.mood === (mood === null ? "all" : `mood:${mood}`) ? "active" : ""}`}
                    key={mood === null ? "all" : `mood-${mood}`}
                    onClick={() => setAudioFilter({ ...audioFilter, mood: mood === null ? "all" : `mood:${mood}` })}
                  >
                    {mood === null ? t("all") : mood}
                  </button>
                ))}
              </div>
            </div>
            <div className="audio-grid">
              {tracks.slice((audioPage - 1) * 12, audioPage * 12).map((track) => (
                <article className="audio-card" key={track.id}>
                  <button
                    type="button"
                    className="audio-card-trigger"
                    aria-label={`${lang === "en" ? "Edit track" : "Chỉnh sửa bài nhạc"}: ${track.title}`}
                    onClick={() => setEditingTrack(track)}
                  />
                  <div className="audio-art">♫</div>
                  <h3>{track.title}</h3>
                  <p>
                    {track.artist_source} · {track.mood_genre}
                  </p>
                  <div className="audio-bottom">
                    <span
                      className={`audio-status ${track.status === "Đã dùng" ? "used" : ""}`}
                    >
                      {track.status === "Đã dùng" ? t("trackUsed") : t("trackUnused")}
                    </span>
                    {track.audio_url && (
                      <a
                        className="link-btn"
                        href={track.audio_url}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Open ↗
                      </a>
                    )}
                  </div>
                </article>
              ))}
            </div>
            <PaginationControls page={audioPage} setPage={setAudioPage} total={tracks.length} />
          </section>
        )}
        {audioOpen && <AudioDialog key={workspaceId} workspaceId={workspaceId} lang={lang} moods={moodOptions}
          onClose={() => setAudioOpen(false)}
          onSaved={(track) => {
            setData((current) => ({ ...current, tracks: [track, ...(current.tracks || [])] }));
            setAudioFilter({ query: "", mood: "all" });
            setAudioPage(1);
            notify(lang === "en" ? "Track added." : "Đã thêm bài nhạc");
          }} />}
        {editingTrack && <AudioDialog key={`${workspaceId}-${editingTrack.id}`} track={editingTrack}
          workspaceId={workspaceId} lang={lang} moods={moodOptions}
          onClose={() => setEditingTrack(null)}
          onSaved={(track) => {
            setData((current) => ({ ...current, tracks: (current.tracks || []).map((row) => String(row.id) === String(track.id) ? track : row) }));
            setAudioFilter({ query: "", mood: "all" });
            setAudioPage(1);
            notify(lang === "en" ? "Track updated." : "Đã cập nhật bài nhạc");
          }} />}
        {view === "reference" && (
          <section className="view">
            <div className="page-heading">
              <div>
                <p className="eyebrow">FIELD NOTES</p>
                <h1>{t("reference")}</h1>
                <p>{t("referenceHint")}</p>
              </div>
              <div className="page-actions">
                <button className="secondary-btn import-btn" onClick={() => setImportScope("presets")}>
                  {lang === "en" ? "Import presets" : "Import presets"}
                </button>
                <button
                  className="secondary-btn"
                  onClick={() => setView("brainstorm")}
                >
                  ✦ {t("brainstorm")}
                </button>
              </div>
            </div>
            <div className="reference-layout">
              <div className="reference-main">
                <div className="tabs">
                  {[
                    ["config", "Config presets"],
                    ["shortcuts", "Editing shortcuts"],
                    ["sop", "Filming SOP"],
                  ].map(([key, label]) => (
                    <button
                      className={`tab ${ref === key ? "active" : ""}`}
                      key={key}
                      onClick={() => setRef(key)}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <div className="ref-list">
                  {(ref === "config"
                    ? data.config_presets
                    : ref === "shortcuts"
                      ? data.editing_shortcuts
                      : data.production_sops
                  ).slice((refPage - 1) * 12, refPage * 12).map((item, index) => (
                    <div className="ref-row" key={item.id ?? index}>
                      <span className="ref-label">
                        {item.group_name ??
                          item.category ??
                          item.type?.replaceAll("_", " ")}
                      </span>
                      <strong>
                        {item.attribute ??
                          item.key_combo ??
                          item.category_or_profile}
                      </strong>
                      <p>
                        <b>
                          {item.value ?? item.action ?? item.recommended_mode}
                        </b>
                        <br />
                        {item.notes ?? item.do_instructions}
                      </p>
                    </div>
                  ))}
                </div>
                <PaginationControls page={refPage} setPage={setRefPage} total={(ref === "config" ? data.config_presets : ref === "shortcuts" ? data.editing_shortcuts : data.production_sops).length} />
              </div>
              <aside className="brainstorm-card">
                <div className="card-kicker">AI COPILOT</div>
                <h2>{t("brainstormTitle")}</h2>
                <p>{t("brainstormHint")}</p>
                <button
                  className="primary-btn full"
                  onClick={() => setView("brainstorm")}
                >
                  ✦ {t("brainstorm")}
                </button>
              </aside>
            </div>
          </section>
        )}
        {view === "brainstorm" && (
          <BrainstormPage
            lang={lang}
            t={t}
            brainstorm={brainstorm}
            history={brainstormHistory}
            aiLoading={aiLoading}
            brainstormSource={brainstormSource}
            brainstormError={brainstormError}
            onRun={runBrainstorm}
            onRetry={() => lastBrainstormRequest && runBrainstorm(lastBrainstormRequest.brief, lastBrainstormRequest.format, lastBrainstormRequest.duration, lastBrainstormRequest.platforms)}
            onSaveIdea={saveBrainstormIdea}
            onOpenIdea={openIdeaInPipeline}
            onNotify={notify}
            columns={activePipelineStatusValues.map((status) => ({ status, title: pipelineStatusLabel(status) }))}
            conceptOptions={conceptOptions}
            onCopy={copyBrainstormScript}
            onRestore={(entry) => { setBrainstorm(entry.ideas || []); setBrainstormSource(entry.source || "ai"); setBrainstormError(entry.source === "demo" ? (lang === "en" ? "This is a saved local demo." : "Đây là bản demo local đã lưu.") : ""); }}
          />
        )}
        {view === "operations" && (
          <OperationsPage
            workspaceId={workspaceId}
            lang={lang}
            notify={notify}
          />
        )}
        {view === "admin" && isAdmin && <AdminPage workspaceId={workspaceId} />}
      </main>
      {detailIdea && (
        <IdeaDrawer
          key={detailIdea.id}
          idea={detailIdea}
          conceptOptions={conceptOptions}
          pipelineTitles={pipelineColumnTitles}
          pipelineStatuses={activePipelineStatusValues}
          lang={lang}
          t={t}
          onClose={() => {
            setDetailIdea(null);
            if (returnToIdeaForm) setIdeaOpen(true);
            setReturnToIdeaForm(false);
          }}
          onSave={updateIdea}
          onDelete={deleteIdea}
          onExpand={expandIdea}
        />
      )}
      {ideaOpen && (
        <dialog className="add-idea-dialog" open>
          <form onSubmit={createIdea}>
            <div className="dialog-head">
              <div>
                <p className="eyebrow">NEW CONTENT</p>
                <h2>{t("addIdea")}</h2>
              </div>
              <button
                type="button"
                className="close-btn"
                onClick={() => setIdeaOpen(false)}
              >
                ×
              </button>
            </div>
            {form.title.trim() && (() => { const matches = ideas.map((idea) => ({ idea, score: contentSimilarity(`${form.title} ${form.hook} ${form.main_content}`, `${idea.title} ${idea.hook} ${idea.mainContent}`) })).filter(({ score }) => score >= 0.45).sort((a, b) => b.score - a.score).slice(0, 3); return matches.length ? <div className="content-match-warning" role="status"><strong>{lang === "en" ? "Similar content found" : "Có content tương tự"}</strong>{matches.map(({ idea, score }) => <button type="button" key={idea.id} aria-label={`${lang === "en" ? "View details" : "Xem chi tiết"}: ${idea.title}`} onClick={() => { setReturnToIdeaForm(true); setIdeaOpen(false); setDetailIdea(idea); }}>{idea.title}<span>{Math.round(score * 100)}% · {lang === "en" ? "View details →" : "Xem chi tiết →"}</span></button>)}</div> : null; })()}
            <label>
              {t("title")}
              <input
                name="title"
                value={form.title}
                onChange={setField}
                required
              />
            </label>
            <label>
              {t("hook")}
              <textarea name="hook" rows="2" value={form.hook} onChange={setField} placeholder={lang === "en" ? "The first line viewers hear" : "Câu mở đầu người xem nghe thấy"} />
            </label>
            <label>
              {lang === "en" ? "Main content" : "Nội dung chính"}
              <textarea name="main_content" rows="4" value={form.main_content} onChange={setField} placeholder={lang === "en" ? "Beats, notes, links you want to remember" : "Các ý chính, ghi chú, link cần nhớ"} />
            </label>
            <div className="form-row">
              <label>
                {t("concept")}
                <ConceptPicker
                  value={form.concept}
                  options={conceptOptions}
                  lang={lang}
                  onChange={(value) =>
                    setForm((current) => ({ ...current, concept: value }))
                  }
                  ariaLabel={t("concept")}
                />
              </label>
              <label>
                {t("priority")}
                <select
                  name="priority"
                  value={form.priority}
                  onChange={setField}
                >
                  <option value="1">P1</option>
                  <option value="2">P2</option>
                  <option value="3">P3</option>
                </select>
              </label>
            </div>
            <label>
              {t("status")}
              <select
                name="status"
                value={form.status}
                onChange={setField}
              >
                {activePipelineStatusValues.map((status) => (
                  <option key={status} value={status}>
                    {pipelineStatusLabel(status)}
                  </option>
                ))}
              </select>
            </label>
            <PlatformPicker
              label={t("platforms")}
              value={form.platforms}
              onChange={(value) => setForm((current) => ({
                ...current,
                platforms: value,
              }))}
            />
            <p className="field-hint">{lang === "en" ? "Set publish dates and links later from the idea card." : "Ngày đăng và link thêm sau trong card ý tưởng."}</p>
            <div className="dialog-actions">
              <button
                type="button"
                className="secondary-btn"
                onClick={() => setIdeaOpen(false)}
              >
                {t("cancel")}
              </button>
              <button className="primary-btn">{t("save")}</button>
            </div>
          </form>
        </dialog>
      )}
      {importScope && (
        <ImportDialog
          scope={importScope}
          onClose={() => setImportScope(null)}
          onImported={refresh}
          notify={notify}
          lang={lang}
          t={t}
          workspaceId={workspaceId}
        />
      )}
      <div className={`toast ${toast ? "show" : ""}`}>{toast}</div>
    </div>
  );
}
