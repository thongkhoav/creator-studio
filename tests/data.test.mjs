import test from 'node:test';
import assert from 'node:assert/strict';
import { activePipelineStatuses, buildBrainstormCopy, conceptSuggestions, createBrainstormIdeaPayload, earliestPlatformPublishDate, filterIdeas, formatDateTime, getMetrics, getPlanningMetrics, keepValidPipelineStatus, mergeConceptNames, mergeIdea, mergePipelineColumnTitles, nextId, moveIdea, normalizeConcept, normalizeIdea, normalizePlatformPublishDates, normalizePlatformPublishLinks, platformMark, removeIdea, reorderPipelineStatuses, sameConcept, sortIdeas, updateIdeaDraft } from '../frontend/src/data.mjs';

const ideas = [
  normalizeIdea({ id: 1, title: 'Docker không phải VM', status: 'Đã đăng', concept: 'IT meme', priority: 1 }),
  normalizeIdea({ id: 2, title: 'Một ngày đi làm', status: 'Edit', concept: 'Vlog', priority: 2 }),
  normalizeIdea({ id: 3, title: 'Setup góc quay', status: 'Lên ý tưởng', concept: 'Setup', priority: 3 }),
];

test('platform scheduling uses the earliest date regardless of entry order', () => {
  assert.equal(earliestPlatformPublishDate({ TikTok: '2026-09-25', 'YouTube Shorts': '2026-09-23' }), '2026-09-23');
  assert.equal(earliestPlatformPublishDate({ TikTok: '' }), null);
});

test('editing and clearing platform dates updates the calendar date', () => {
  const draft = { publish_date: '2026-09-20', platforms: ['TikTok'], platform_publish_dates: {} };
  const edited = updateIdeaDraft(draft, 'platform_publish_dates', { TikTok: '2026-09-25' });
  assert.equal(edited.publish_date, '2026-09-25');
  assert.equal(updateIdeaDraft(edited, 'platform_publish_dates', { TikTok: '' }).publish_date, null);
  assert.equal(updateIdeaDraft(draft, 'title', 'Updated title').publish_date, '2026-09-20');
});

test('removing a scheduled platform clears its date and link and recalculates the calendar', () => {
  const draft = {
    platforms: ['TikTok', 'YouTube Shorts'], publish_date: '2026-09-23',
    platform_publish_dates: { TikTok: '2026-09-23', 'YouTube Shorts': '2026-09-25' },
    platform_publish_links: { TikTok: 'https://example.com/video' },
  };
  const edited = updateIdeaDraft(draft, 'platforms', ['YouTube Shorts']);
  assert.equal(edited.publish_date, '2026-09-25');
  assert.deepEqual(edited.platform_publish_dates, { 'YouTube Shorts': '2026-09-25' });
  assert.deepEqual(edited.platform_publish_links, {});
  assert.equal(updateIdeaDraft(edited, 'platforms', []).publish_date, null);
});

test('getMetrics counts pipeline states', () => {
  assert.deepEqual(getMetrics(ideas), { inProgress: 2, published: 1, backlog: 1, total: 3 });
});

test('filterIdeas searches title and filters concept/status/priority', () => {
  assert.equal(filterIdeas(ideas, { query: 'docker' }).length, 1);
  assert.equal(filterIdeas(ideas, { concept: 'Vlog' })[0].id, 2);
  assert.equal(filterIdeas(ideas, { status: 'Lên ý tưởng' })[0].id, 3);
  assert.equal(filterIdeas(ideas, { priority: '1' })[0].id, 1);
});

test('sortIdeas puts newest cards first by creation time and falls back to id', () => {
  const input = [
    normalizeIdea({ id: 2, title: 'Older', created_at: '2026-09-14T10:00:00Z' }),
    normalizeIdea({ id: 4, title: 'Newest', created_at: '2026-09-15T10:00:00Z' }),
    normalizeIdea({ id: 3, title: 'Same time, newer id', created_at: '2026-09-15T10:00:00Z' }),
  ];
  assert.deepEqual(sortIdeas(input, 'newest').map((idea) => idea.id), [4, 3, 2]);
  assert.deepEqual(sortIdeas(input, 'oldest').map((idea) => idea.id), [2, 3, 4]);
});

test('normalizeIdea preserves created and updated timestamps for detail metadata', () => {
  const idea = normalizeIdea({
    id: 9,
    title: 'Timestamped idea',
    created_at: '2026-09-15T10:00:00Z',
    updated_at: '2026-09-16T08:30:00Z',
  });
  assert.equal(idea.createdAt, '2026-09-15T10:00:00Z');
  assert.equal(idea.updatedAt, '2026-09-16T08:30:00Z');
});

test('normalizePlatformPublishDates keeps valid platform dates and ignores empty values', () => {
  assert.deepEqual(normalizePlatformPublishDates({
    TikTok: '2026-09-22',
    'YouTube Shorts': '',
    LinkedIn: null,
    Unknown: '2026-09-23',
  }), { TikTok: '2026-09-22' });
  assert.deepEqual(normalizeIdea({ platforms: ['TikTok', 'YouTube Shorts'], platform_publish_dates: { TikTok: '2026-09-22' } }).platformPublishDates, { TikTok: '2026-09-22' });
});

test('normalizePlatformPublishLinks keeps valid links for supported platforms', () => {
  assert.deepEqual(normalizePlatformPublishLinks({
    TikTok: 'https://tiktok.com/@creator/video/1',
    'YouTube Shorts': '',
    Unknown: 'https://example.com/video',
  }), { TikTok: 'https://tiktok.com/@creator/video/1' });
  assert.equal(normalizeIdea({ platform_publish_links: { TikTok: 'https://example.com/video' } }).platformPublishLinks.TikTok, 'https://example.com/video');
});

test('formatDateTime shows localized date and time and falls back for empty values', () => {
  const formatted = formatDateTime('2026-09-16T08:30:00Z', 'vi');
  assert.match(formatted, /16\/09\/2026/);
  assert.match(formatted, /\d{1,2}:\d{2}/);
  assert.equal(formatDateTime('', 'vi'), 'Chưa có dữ liệu');
  assert.equal(formatDateTime('', 'en'), 'Not available');
});

test('filterIdeas can filter by platform within a pipeline column', () => {
  const platformIdeas = [
    normalizeIdea({ ...ideas[0], platforms: ['TikTok'] }),
    normalizeIdea({ ...ideas[1], platforms: ['YouTube Shorts'] }),
  ];
  assert.equal(filterIdeas(platformIdeas, { status: 'all', platform: 'YouTube Shorts' }).length, 1);
  assert.equal(filterIdeas(platformIdeas, { status: 'all', platform: 'YouTube Shorts' })[0].id, 2);
});

test('platformMark returns a recognizable mark for each supported platform', () => {
  assert.equal(platformMark('TikTok'), '♪');
  assert.equal(platformMark('Instagram Reels'), '◎');
  assert.equal(platformMark('YouTube Shorts'), '▶');
  assert.equal(platformMark('Unknown platform'), '✦');
});

test('normalizeConcept accepts workspace concept rows and trims custom names', () => {
  assert.equal(normalizeConcept({ name: '  YouTube education  ' }), 'YouTube education');
  assert.equal(normalizeConcept({ concept: '  Legacy concept ' }), 'Legacy concept');
  assert.equal(normalizeConcept('  Vlog  '), 'Vlog');
  assert.equal(normalizeConcept({ name: '   ' }), '');
});

test('mergeConceptNames combines workspace, defaults, and legacy idea concepts without duplicates', () => {
  assert.deepEqual(
    mergeConceptNames(
      [{ name: 'Workspace concept' }, { name: 'Vlog' }],
      ['vlog', 'Default concept'],
      [{ concept: 'Legacy concept' }, { concept: 'Workspace concept' }],
    ),
    ['Workspace concept', 'Vlog', 'Default concept', 'Legacy concept'],
  );
});

test('mergePipelineColumnTitles keeps defaults and uses valid workspace overrides', () => {
  assert.deepEqual(
    mergePipelineColumnTitles(
      ['Lên ý tưởng', 'Kịch bản', 'Quay video'],
      [
        { status: 'Lên ý tưởng', title: 'Inbox nội dung' },
        { status: 'Kịch bản', title: '  Script đang viết  ' },
        { status: 'Không hợp lệ', title: 'Không dùng' },
        { status: 'Quay video', title: '   ' },
      ],
    ),
    {
      'Lên ý tưởng': 'Inbox nội dung',
      'Kịch bản': 'Script đang viết',
      'Quay video': 'Quay video',
    },
  );
});

test('pipeline columns include active custom columns in workspace order', () => {
  const statuses = activePipelineStatuses(['Lên ý tưởng', 'Kịch bản'], [
    { status: 'Lên ý tưởng', sort_order: 1, is_active: true },
    { status: 'Kịch bản', sort_order: 2, is_active: true },
    { status: 'custom_review', title: 'Review', sort_order: 3, is_active: true },
    { status: 'custom_archive', title: 'Archive', sort_order: 4, is_active: false },
  ]);
  assert.deepEqual(statuses, ['Lên ý tưởng', 'Kịch bản', 'custom_review']);
  assert.equal(mergePipelineColumnTitles(['Lên ý tưởng'], [{ status: 'custom_review', title: 'Review' }]).custom_review, 'Review');
});

test('new ideas keep a status from the workspace active status list', () => {
  const statuses = activePipelineStatuses(['Lên ý tưởng', 'Đã đăng'], [
    { status: 'Lên ý tưởng', sort_order: 1, is_active: false },
    { status: 'custom_review', title: 'Review', sort_order: 2, is_active: true },
    { status: 'Đã đăng', sort_order: 3, is_active: true },
  ]);
  assert.deepEqual(statuses, ['custom_review', 'Đã đăng']);
  assert.equal(keepValidPipelineStatus(statuses, 'Lên ý tưởng'), 'custom_review');
  assert.equal(keepValidPipelineStatus(statuses, 'Đã đăng'), 'Đã đăng');
});

test('reorderPipelineStatuses moves a column before the dropped target', () => {
  assert.deepEqual(reorderPipelineStatuses(['a', 'b', 'c'], 'a', 'c'), ['b', 'a', 'c']);
  assert.deepEqual(reorderPipelineStatuses(['a', 'b', 'c'], 'c', 'a'), ['c', 'a', 'b']);
  assert.deepEqual(reorderPipelineStatuses(['a', 'b'], 'a', 'a'), ['a', 'b']);
});

test('activePipelineStatuses hides workspace columns marked inactive', () => {
  assert.deepEqual(
    activePipelineStatuses(['Lên ý tưởng', 'Kịch bản', 'Quay video', 'Edit', 'Đã đăng'], [
      { status: 'Lên ý tưởng', is_active: true },
      { status: 'Kịch bản', is_active: false },
      { status: 'Edit', is_active: false },
    ]),
    ['Lên ý tưởng', 'Quay video', 'Đã đăng'],
  );
});

test('concept filtering is case-insensitive', () => {
  assert.equal(sameConcept('  Vlog ', 'vlog'), true);
  assert.equal(filterIdeas([ideas[0]], { concept: 'it MEME' }).length, 1);
});

test('concept suggestions show the complete workspace list before typing', () => {
  assert.deepEqual(
    conceptSuggestions(['Vlog', 'IT meme', 'Subtitle giữa màn hình']),
    ['Vlog', 'IT meme', 'Subtitle giữa màn hình'],
  );
});

test('moveIdea returns a changed copy and keeps source intact', () => {
  const moved = moveIdea(ideas, 2, 'Đã đăng');
  assert.equal(moved.find((idea) => idea.id === 2).status, 'Đã đăng');
  assert.equal(ideas.find((idea) => idea.id === 2).status, 'Edit');
});

test('mergeIdea replaces the updated idea so derived views can move it between statuses', () => {
  const updated = mergeIdea(ideas, { id: 2, status: 'Đã đăng', title: 'Một ngày đi làm' });
  assert.equal(updated.find((idea) => idea.id === 2).status, 'Đã đăng');
  assert.equal(updated.find((idea) => idea.id === 1).status, 'Đã đăng');
  assert.equal(updated.find((idea) => idea.id === 2).title, 'Một ngày đi làm');
  assert.notEqual(updated, ideas);
  assert.equal(ideas.find((idea) => idea.id === 2).status, 'Edit');
});

test('removeIdea deletes only the requested idea and supports string ids', () => {
  const remaining = removeIdea(ideas, '2');
  assert.deepEqual(remaining.map((idea) => idea.id), [1, 3]);
  assert.equal(ideas.length, 3);
});

test('nextId is greater than every numeric id', () => {
  assert.equal(nextId(ideas), 4);
});

test('getPlanningMetrics identifies today, overdue, this-week and unscheduled ideas', () => {
  const planningIdeas = [
    normalizeIdea({ id: 10, status: 'Edit', publish_date: '2026-09-18' }),
    normalizeIdea({ id: 11, status: 'Kịch bản', publish_date: '2026-09-17' }),
    normalizeIdea({ id: 12, status: 'Quay video', publish_date: '2026-09-20' }),
    normalizeIdea({ id: 13, status: 'Lên ý tưởng' }),
    normalizeIdea({ id: 14, status: 'Đã đăng', publish_date: '2026-09-18' }),
  ];
  assert.deepEqual(getPlanningMetrics(planningIdeas, new Date(2026, 8, 18)), {
    dueToday: 1,
    overdue: 1,
    upcomingWeek: 1,
    unscheduled: 1,
  });
});

test('createBrainstormIdeaPayload maps a brainstorm result to a pipeline idea', () => {
  assert.deepEqual(createBrainstormIdeaPayload({
    title: 'Remote không phải nghỉ',
    hook: 'Bạn đang remote sai cách?',
    outline: 'Mở bài → ví dụ → kết luận',
    platforms: ['TikTok', 'LinkedIn'],
  }), {
    title: 'Remote không phải nghỉ',
    status: 'Lên ý tưởng',
    concept: 'AI brainstorm',
    priority: 2,
    publish_date: null,
    hook: 'Bạn đang remote sai cách?',
    main_content: 'Mở bài → ví dụ → kết luận',
    hashtag: [],
    platforms: ['TikTok', 'LinkedIn'],
  });
});

test('buildBrainstormCopy includes the editable script and platform adaptations', () => {
  const copied = buildBrainstormCopy({
    title: 'Hook test',
    hook: 'Một câu mở đầu',
    outline: 'Ba cảnh quay',
    adaptations: { TikTok: 'Nhanh và dồn dập', LinkedIn: 'Thêm số liệu' },
  });
  assert.match(copied, /Hook test/);
  assert.match(copied, /Một câu mở đầu/);
  assert.match(copied, /TikTok: Nhanh và dồn dập/);
  assert.match(copied, /LinkedIn: Thêm số liệu/);
});
