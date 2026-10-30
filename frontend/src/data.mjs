export const STATUSES = ['Lên ý tưởng', 'Kịch bản', 'Quay video', 'Edit', 'Đã đăng'];
export const PLATFORM_MARKS = { TikTok: '♪', 'Instagram Reels': '◎', 'YouTube Shorts': '▶', 'Facebook Reels': 'f', LinkedIn: 'in', X: '𝕏', Khác: '✦' };
export function platformMark(platform) { return PLATFORM_MARKS[platform] || '✦'; }
export function normalizePlatformPublishDates(input = {}) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return {};
  return Object.fromEntries(Object.entries(input)
    .filter(([platform, value]) => Object.hasOwn(PLATFORM_MARKS, platform) && typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)));
}
export function normalizePlatformPublishLinks(input = {}) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return {};
  return Object.fromEntries(Object.entries(input)
    .filter(([platform, value]) => Object.hasOwn(PLATFORM_MARKS, platform) && typeof value === 'string' && /^https?:\/\/\S+$/i.test(value.trim()))
    .map(([platform, value]) => [platform, value.trim()]));
}
export function normalizeConcept(input) {
  const value = typeof input === 'string'
    ? input
    : input?.name ?? input?.concept ?? input?.label ?? '';
  return String(value).trim();
}
export function mergeConceptNames(...sources) {
  const names = [];
  const seen = new Set();
  for (const source of sources) {
    for (const item of Array.isArray(source) ? source : []) {
      const name = normalizeConcept(item);
      const key = name.toLocaleLowerCase();
      if (name && !seen.has(key)) {
        seen.add(key);
        names.push(name);
      }
    }
  }
  return names;
}
export function mergePipelineColumnTitles(statuses, rows) {
  const titles = Object.fromEntries((Array.isArray(statuses) ? statuses : []).map((status) => [status, status]));
  for (const row of Array.isArray(rows) ? rows : []) {
    const status = String(row?.status ?? '');
    const title = String(row?.title ?? '').trim();
    if (status && title && (Object.hasOwn(titles, status) || status.startsWith('custom_'))) titles[status] = title;
  }
  return titles;
}
export function activePipelineStatuses(statuses, rows) {
  const source = Array.isArray(statuses) ? statuses : [];
  const configured = Array.isArray(rows) ? rows : [];
  if (!configured.length) return source;
  const inactive = new Set(configured.filter((row) => row?.is_active === false).map((row) => String(row.status)));
  const configuredOrder = new Map(configured.map((row, index) => [String(row?.status), Number(row?.sort_order) || index + 1]));
  const active = [...new Set([...source, ...configured.map((row) => String(row?.status || '')).filter(Boolean)])]
    .filter((status) => !inactive.has(status));
  return active.sort((left, right) => (configuredOrder.get(left) ?? source.indexOf(left) + 1) - (configuredOrder.get(right) ?? source.indexOf(right) + 1));
}
export function keepValidPipelineStatus(statuses, current) {
  const options = Array.isArray(statuses) ? statuses : [];
  return options.includes(current) ? current : (options[0] ?? '');
}
export function reorderPipelineStatuses(statuses, sourceStatus, targetStatus) {
  const order = Array.isArray(statuses) ? [...statuses] : [];
  const sourceIndex = order.indexOf(sourceStatus);
  const targetIndex = order.indexOf(targetStatus);
  if (sourceIndex < 0 || targetIndex < 0 || sourceStatus === targetStatus) return order;
  order.splice(sourceIndex, 1);
  order.splice(targetIndex - (sourceIndex < targetIndex ? 1 : 0), 0, sourceStatus);
  return order;
}
export function sameConcept(left, right) {
  const a = normalizeConcept(left).toLocaleLowerCase();
  const b = normalizeConcept(right).toLocaleLowerCase();
  return Boolean(a && b && a === b);
}
export function conceptSuggestions(options, query = '') {
  const normalizedQuery = normalizeConcept(query).toLocaleLowerCase();
  return mergeConceptNames(options).filter((name) =>
    !normalizedQuery || name.toLocaleLowerCase().includes(normalizedQuery),
  );
}
export function getMetrics(ideas) { return { inProgress: ideas.filter((idea) => idea.status !== 'Đã đăng').length, published: ideas.filter((idea) => idea.status === 'Đã đăng').length, backlog: ideas.filter((idea) => idea.status === 'Lên ý tưởng').length, total: ideas.length }; }
export function filterIdeas(ideas, { query = '', status = 'all', concept = 'all', priority = 'all', platform = 'all' } = {}) { const q = query.trim().toLowerCase(); return ideas.filter((idea) => (!q || [idea.title, idea.hook, idea.mainContent].join(' ').toLowerCase().includes(q)) && (status === 'all' || idea.status === status) && (concept === 'all' || sameConcept(idea.concept, concept)) && (priority === 'all' || String(idea.priority) === String(priority)) && (platform === 'all' || (Array.isArray(idea.platforms) && idea.platforms.includes(platform)))); }
export function sortIdeas(ideas, sort = 'newest') {
  const direction = sort === 'oldest' ? 1 : -1;
  const value = (idea) => {
    const created = Date.parse(idea.createdAt ?? idea.created_at ?? '');
    return Number.isNaN(created) ? Number(idea.id) || 0 : created;
  };
  return [...ideas].sort((left, right) => {
    if (sort === 'title') return left.title.localeCompare(right.title, 'vi') || (Number(left.id) || 0) - (Number(right.id) || 0);
    if (sort === 'priority') return (Number(left.priority) || 3) - (Number(right.priority) || 3) || value(right) - value(left);
    const compared = (value(left) - value(right)) * direction;
    return compared || ((Number(left.id) || 0) - (Number(right.id) || 0)) * direction;
  });
}
const DATE_TIME_LOCALES = {
  vi: 'vi-VN',
  en: 'en-US',
  ko: 'ko-KR',
  ja: 'ja-JP',
  id: 'id-ID',
  th: 'th-TH',
  ms: 'ms-MY',
  fil: 'en-PH',
};
export function formatDateTime(value, lang = 'en') {
  if (!value) return lang === 'vi' ? 'Chưa có dữ liệu' : 'Not available';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return lang === 'vi' ? 'Chưa có dữ liệu' : 'Not available';
  return new Intl.DateTimeFormat(DATE_TIME_LOCALES[lang] || 'en-US', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}
export function moveIdea(ideas, id, status) { return ideas.map((idea) => idea.id === id ? { ...idea, status } : idea); }
export function earliestPlatformPublishDate(dates) {
  return Object.values(normalizePlatformPublishDates(dates)).sort()[0] || null;
}
export function updateIdeaDraft(draft, key, value) {
  const next = { ...draft, [key]: value };
  if (key === 'platforms') {
    next.platform_publish_dates = Object.fromEntries(Object.entries(draft.platform_publish_dates || {}).filter(([platform]) => value.includes(platform)));
    next.platform_publish_links = Object.fromEntries(Object.entries(draft.platform_publish_links || {}).filter(([platform]) => value.includes(platform)));
  }
  // Preserve legacy dates until the user edits the platform schedule.
  if (key === 'platform_publish_dates' || (key === 'platforms' && earliestPlatformPublishDate(draft.platform_publish_dates))) {
    next.publish_date = earliestPlatformPublishDate(next.platform_publish_dates);
  }
  return next;
}
export function mergeIdea(ideas, updatedIdea) { return ideas.map((idea) => String(idea.id) === String(updatedIdea?.id) ? { ...idea, ...updatedIdea } : idea); }
export function removeIdea(ideas, id) { return ideas.filter((idea) => String(idea.id) !== String(id)); }
export function nextId(items) { return items.reduce((max, item) => Math.max(max, Number(item.id) || 0), 0) + 1; }
export function normalizeIdea(input = {}) { const status = String(input.status ?? '').trim(); return { id: input.id ?? nextId([]), title: String(input.title ?? '').trim(), status: status || 'Lên ý tưởng', concept: input.concept ?? 'Khác', priority: Number(input.priority) || 3, hook: input.hook ?? '', mainContent: input.mainContent ?? input.main_content ?? '', publishDate: input.publishDate ?? input.publish_date ?? '', createdAt: input.createdAt ?? input.created_at ?? '', updatedAt: input.updatedAt ?? input.updated_at ?? '', platforms: Array.isArray(input.platforms) && input.platforms.length ? input.platforms : ['TikTok'], platformPublishDates: normalizePlatformPublishDates(input.platformPublishDates ?? input.platform_publish_dates), platformPublishLinks: normalizePlatformPublishLinks(input.platformPublishLinks ?? input.platform_publish_links) }; }
function localDateKey(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
export function getPlanningMetrics(ideas, now = new Date()) {
  const today = localDateKey(now);
  const date = new Date(now);
  const mondayOffset = (date.getDay() + 6) % 7;
  const weekEnd = new Date(date.getFullYear(), date.getMonth(), date.getDate() + (6 - mondayOffset));
  const weekEndKey = localDateKey(weekEnd);
  return ideas.reduce((metrics, idea) => {
    const publishDate = localDateKey(idea.publishDate ?? idea.publish_date);
    const active = idea.status !== 'Đã đăng';
    if (!publishDate && active) metrics.unscheduled += 1;
    if (publishDate === today && active) metrics.dueToday += 1;
    if (publishDate && publishDate < today && active) metrics.overdue += 1;
    if (publishDate && publishDate > today && publishDate <= weekEndKey && active) metrics.upcomingWeek += 1;
    return metrics;
  }, { dueToday: 0, overdue: 0, upcomingWeek: 0, unscheduled: 0 });
}
export function createBrainstormIdeaPayload(item = {}, { status = 'Lên ý tưởng', concept = 'AI brainstorm', captionsLabel = 'Platform captions' } = {}) {
  // Keep the per-platform captions with the outline so they reach the idea card.
  const captions = item.adaptations && typeof item.adaptations === 'object'
    ? Object.entries(item.adaptations).map(([platform, copy]) => `${platform}: ${String(copy).trim()}`).filter((line) => !line.endsWith(': '))
    : [];
  const outline = String(item.outline ?? '').trim();
  return {
    title: String(item.title ?? '').trim(),
    status: String(status || 'Lên ý tưởng'),
    concept: normalizeConcept(concept) || 'AI brainstorm',
    priority: 2,
    publish_date: null,
    hook: String(item.hook ?? '').trim(),
    main_content: captions.length ? [outline, '', `${captionsLabel}:`, ...captions].join('\n').trim() : outline,
    hashtag: [],
    platforms: Array.isArray(item.platforms) && item.platforms.length ? item.platforms : ['TikTok'],
  };
}
export function buildBrainstormCopy(item = {}) {
  const lines = [
    String(item.title ?? '').trim(),
    '',
    `Hook: ${String(item.hook ?? '').trim()}`,
    `Outline: ${String(item.outline ?? '').trim()}`,
  ];
  if (item.adaptations && typeof item.adaptations === 'object') {
    lines.push('', 'Platform adaptations:');
    for (const [platform, copy] of Object.entries(item.adaptations)) {
      lines.push(`${platform}: ${String(copy).trim()}`);
    }
  }
  return lines.join('\n').trim();
}
