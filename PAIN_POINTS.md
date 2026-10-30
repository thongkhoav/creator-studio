# Content Creator Studio — Pain Points

The main problems creators run into when growing a channel, managing ideas and taking content from idea to publish. This is the product backlog, not a list of finished features.

## Main pain points

### 1. Ideas are scattered and hard to find again

Creators keep ideas in Google Sheets, notes, messages and bookmarks. When it is time to produce a topic, they lose time digging up the hook, references, audio and context.

**Product opportunity:** one idea library with search, filters, tags/concepts, priority, platforms and reference links.

### 2. The path from idea to publish breaks

An idea can sit in a sheet with no owner, status, deadline, checklist or media link. The team can't tell which step a piece of content is at or why it is stuck.

**Product opportunity:** a clear pipeline with owner, status, publish schedule, checklist, and links between idea, variant and media.

### 3. One piece of content has to change for every platform

TikTok, Instagram Reels, YouTube Shorts, Facebook Reels, LinkedIn and X each want a different hook, caption, length, safe zone and CTA. Creators tend to copy one version everywhere and then fix it by hand.

**Product opportunity:** platform presets and a content variant per platform, with AI suggesting the adaptation.

### 4. A steady posting schedule is hard to keep

Creators can't see the whole schedule, so they double-book days, miss deadlines or post too much on one platform.

**Product opportunity:** a weekly/monthly calendar with schedule status, owner, published link and a warning when content isn't ready.

### 5. Media files live everywhere

Videos, thumbnails, project files, audio and published links sit in many places. Finding the final cut or checking a link before posting takes time.

**Product opportunity:** media assets stored as links, grouped by kind, attached to an idea or variant, with URL validation. No file storage in the first phase.

### 6. No pre-publish check

Checking the caption, thumbnail, subtitles, hashtags, audio rights, bio link and tracking depends on someone's memory.

**Product opportunity:** a checklist per variant/platform that records who completed each item and when.

### 7. AI brainstorm isn't grounded in real data

AI produces generic ideas when it doesn't know the audience, the formats already tried, the target platforms, the backlog or the team's references.

**Product opportunity:** brainstorm per workspace, saved results, one click to turn a result into an idea, and an adaptation per platform.

### 8. Teams overwrite each other or lack clear permissions

With several people working together it is unclear who can edit, who owns what, and who may invite members or change presets.

**Product opportunity:** workspaces, owner/admin/editor/viewer roles, an audit log and per-action permissions.

### 9. Moving old data out of Google Sheets is risky

A direct import can create duplicates, wrong dates, broken audio links, or leak data between workspaces.

**Product opportunity:** JSON import with preview and validation, timestamped migrations, and backfills with a preview count inside one atomic transaction.

### 10. No way to tell which content actually works

Creators know a video went out but have no system linking format, hook and platform to results such as views, watch time, saves, shares or conversions.

**Product opportunity:** manual performance snapshots first, platform API integrations later if needed.

## Suggested priorities

### P0 — needed for the workflow to be usable

- Search and filter ideas by status, platform, priority and date.
- Link idea → content variant → schedule → media link.
- Calendar CRUD and a publishing checklist.
- Workspace scoping, basic roles, and safe import/backfill.

### P1 — helps the team work faster and more consistently

- Platform preset editor.
- AI brainstorm per workspace, with results saved as ideas.
- Invite/manage members and activity history.
- Checklist templates per platform or format.

### P2 — helps grow the channel with data

- Performance tracking per platform.
- Analysis of which hooks and formats perform.
- Posting-time suggestions based on history.
- Integration with each platform's publishing or analytics API.

## Product principles

- The workspace is the boundary for data and access.
- AI supports decisions; the creator still reviews content before using it.
- In the first phase media is stored as external links, not uploaded into the app.
- Every migration of old data needs a preview and owner permission.
- Never store secret keys in the frontend or in import files.
