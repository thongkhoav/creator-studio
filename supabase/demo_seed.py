"""Generate demo_seed.sql: an English demo workspace for screenshots and videos.

The SQL creates a workspace named "Creator Studio Demo" owned by the account whose
email you set at the top of the file, then fills it with ideas, audio, presets,
pipeline column names, concepts and brainstorm history. Dates are relative to the
day you run it, so the board always looks current. Run it in the Supabase SQL
editor after signing up once in the app. Every row is scoped to the new workspace, so
it can live next to real workspaces in the same project without mixing data.
"""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

# Internal status values are fixed by the schema; the demo shows English column titles.
IDEA, SCRIPT, FILMING, EDIT, PUBLISHED = "Lên ý tưởng", "Kịch bản", "Quay video", "Edit", "Đã đăng"
COLUMNS = {IDEA: "Ideas", SCRIPT: "Scripting", FILMING: "Filming", EDIT: "Editing", PUBLISHED: "Published"}
CONCEPTS = ["Day in the life", "Dev humor", "Tutorial", "Setup tour", "Trend remix", "Career tips", "Productivity"]

TT, IG, YT, FB, LI, X = "TikTok", "Instagram Reels", "YouTube Shorts", "Facebook Reels", "LinkedIn", "X"

# (title, status, concept, priority, day offset from today or None, hook, outline, hashtags, platforms)
IDEAS = [
    ("A day in my life as a remote developer", PUBLISHED, "Day in the life", 1, -26,
     "6:30 AM. Coffee first, bugs second.", "Morning walk, stand-up, deep-work block, gym, evening side project.",
     ["#dayinmylife", "#developer", "#remotework"], [TT, IG, YT]),
    ("5 VS Code extensions I install on every laptop", PUBLISHED, "Tutorial", 1, -22,
     "Number 3 saves me an hour a week.", "One extension per 5-second clip with a before/after.",
     ["#vscode", "#coding", "#devtools"], [TT, YT, LI]),
    ("When the bug only happens in production", PUBLISHED, "Dev humor", 2, -19,
     "Works on my machine.", "Classic meme format with a screen recording punchline.",
     ["#programmerhumor", "#devlife"], [TT, IG, X]),
    ("My $500 desk setup tour", PUBLISHED, "Setup tour", 1, -15,
     "Everything on this desk costs less than one monitor.", "Slow pan, price tags as text, one tip per item.",
     ["#desksetup", "#wfh"], [TT, IG, YT, FB]),
    ("How I plan a week of content in one hour", PUBLISHED, "Productivity", 1, -11,
     "One hour on Sunday, seven videos ready.", "Screen recording of this pipeline: ideas, scripts, schedule.",
     ["#contentcreator", "#productivity"], [TT, YT, LI]),
    ("Explaining APIs with a coffee shop", PUBLISHED, "Tutorial", 2, -6,
     "The barista is the API.", "Order, kitchen, response: map each to a request and response.",
     ["#techexplained", "#api"], [TT, IG, YT, LI]),
    ("Learning a new framework in 7 days", EDIT, "Day in the life", 1, 2,
     "Day 1: I understand nothing.", "Seven 10-second check-ins, final app demo at the end.",
     ["#learntocode", "#buildinpublic"], [TT, YT]),
    ("3 interview questions I always get asked", EDIT, "Career tips", 1, 3,
     "If you only prepare one answer, prepare this one.", "Question on screen, short answer, common mistake.",
     ["#techinterview", "#careertips"], [TT, LI, YT]),
    ("Pomodoro vs deep work: one week test", EDIT, "Productivity", 2, 5,
     "I tracked every minute for a week.", "Split screen of both weeks, chart at the end.",
     ["#productivity", "#focus"], [IG, YT, LI]),
    ("Rewriting my first project after 3 years", EDIT, "Tutorial", 2, 6,
     "Past me wrote this. Present me is scared.", "Old code vs new code, three lessons.",
     ["#refactoring", "#coding"], [TT, YT, X]),
    ("Trending sound: what clients ask vs what they need", FILMING, "Trend remix", 1, 4,
     "", "Lip-sync on the trending audio with captions.",
     ["#freelance", "#clientlife"], [TT, IG]),
    ("Rainy evening coding session", FILMING, "Day in the life", 3, 7,
     "", "Slow cinematic shots, lo-fi track, no voice-over.",
     ["#lofi", "#codingvibes"], [IG, TT]),
    ("Keyboard sound test: 3 switches", FILMING, "Setup tour", 2, 8,
     "Which one would you type on all day?", "Same sentence typed on three keyboards, viewers vote.",
     ["#mechanicalkeyboard", "#desksetup"], [TT, YT]),
    ("What I would tell myself on day one of coding", FILMING, "Career tips", 2, 9,
     "Five things nobody told me.", "Talking head, one tip per cut, B-roll of old projects.",
     ["#learntocode", "#advice"], [TT, IG, LI]),
    ("Freelance pricing: hourly or fixed?", SCRIPT, "Career tips", 1, 10,
     "I lost money on my first fixed-price job.", "Story, the rule I use now, one example quote.",
     ["#freelancing", "#pricing"], [LI, YT, TT]),
    ("Build a landing page in 60 seconds", SCRIPT, "Tutorial", 1, 11,
     "Timer starts now.", "Sped-up screen recording, final page reveal.",
     ["#webdev", "#speedrun"], [TT, IG, YT]),
    ("Dev humor: naming variables", SCRIPT, "Dev humor", 2, 12,
     "The hardest problem in computer science.", "Three skits: temp, data2, finalFinal.",
     ["#programmerhumor"], [TT, IG, X]),
    ("Morning routine that keeps me shipping", SCRIPT, "Productivity", 2, 13,
     "", "Five steps, one shot each, captions only.",
     ["#morningroutine", "#productivity"], [IG, TT]),
    ("Desk stretches for long coding days", SCRIPT, "Productivity", 3, 14,
     "Your back will thank you.", "Four stretches, 10 seconds each, timer overlay.",
     ["#wellness", "#wfh"], [TT, IG, FB]),
    ("Turning a client brief into a plan", SCRIPT, "Career tips", 2, 15,
     "This one page saves every project.", "Blurry brief to a one-page scope, step by step.",
     ["#freelance", "#projectmanagement"], [LI, YT]),
    ("Git commands I actually use", IDEA, "Tutorial", 2, None,
     "", "", ["#git", "#coding"], [TT, YT, X]),
    ("Office vs home vs cafe: where I code best", IDEA, "Day in the life", 2, None,
     "", "", ["#remotework"], [TT, IG]),
    ("Reacting to my first portfolio", IDEA, "Dev humor", 3, None,
     "", "", ["#portfolio", "#webdev"], [TT, YT]),
    ("AI tools in my daily workflow", IDEA, "Productivity", 1, None,
     "", "", ["#ai", "#devtools"], [TT, LI, YT]),
    ("Cable management in 5 minutes", IDEA, "Setup tour", 3, None,
     "", "", ["#desksetup"], [TT, IG]),
    ("Duet: rating viewers' desk setups", IDEA, "Trend remix", 2, None,
     "", "", ["#desksetup", "#duet"], [TT]),
    ("How I name my side projects", IDEA, "Dev humor", 3, None,
     "", "", ["#sideproject"], [TT, X]),
    ("First 30 days as a freelancer: real numbers", IDEA, "Career tips", 1, None,
     "", "", ["#freelance", "#buildinpublic"], [YT, LI, TT]),
]

# (title, source, mood, used, notes)
TRACKS = [
    ("Sunday Morning Lo-fi", "YouTube Audio Library", "Lo-fi", True, "Default for day-in-the-life videos"),
    ("Neon Drive", "YouTube Audio Library", "Upbeat", True, "Hook lands on the first beat"),
    ("Paper Planes", "Royalty-free library", "Chill", False, ""),
    ("Late Night Commit", "Royalty-free library", "Lo-fi", False, "Rainy coding sessions"),
    ("Big Reveal Riser", "Royalty-free library", "Cinematic", False, "Before/after transitions"),
    ("Quick Laugh Stinger", "Royalty-free library", "Funny", True, "Meme punchlines"),
    ("Open Road", "YouTube Audio Library", "Upbeat", False, "Travel and B-roll"),
    ("Soft Piano Notes", "YouTube Audio Library", "Emotional", False, "Career story videos"),
    ("City Lights", "Royalty-free library", "Cinematic", True, ""),
    ("Bounce Pop", "Royalty-free library", "Upbeat", False, "Tutorial speed-ups"),
    ("Coffee Shop Ambience", "Royalty-free library", "Chill", False, "Background under voice-over"),
    ("Retro Arcade Loop", "Royalty-free library", "Funny", False, "Dev humor skits"),
]

# (group, attribute, value, notes)
PRESETS = [
    ("TikTok · Safe zone", "Text area", "Keep text 150 px from the top and 400 px from the bottom", "Avoid the caption and button area"),
    ("TikTok · Length", "Sweet spot", "21–34 seconds", "Hook in the first 2 seconds"),
    ("Instagram Reels · Cover", "Cover frame", "1080 × 1920, title centered in the middle 1080 × 1350", "Grid crops to 4:5"),
    ("YouTube Shorts · Title", "Title length", "Under 40 characters, keyword first", ""),
    ("LinkedIn · Caption", "Format", "Three short lines, one takeaway, question at the end", "No hashtags in the first line"),
    ("Audio · Mix", "Voice / music", "Voice 100%, music 15–20%", "Duck music under speech"),
    ("Export · Video", "Resolution", "1080 × 1920, 30 fps, H.264", "Same export for every platform"),
    ("Thumbnail · Text", "Font", "Bold sans-serif, white with dark shadow, 3–5 words", ""),
]

# Quick-reference rows; like everything else they belong to the demo workspace.
SHORTCUTS = [
    ("Editing", "S", "Split clip at playhead"),
    ("Editing", "V", "Select tool"),
    ("Editing", "Shift + D", "Enable / disable clip"),
    ("Editing", "Cmd + B", "Blade at playhead"),
    ("Playback", "Space", "Play / pause"),
    ("Playback", "J / K / L", "Rewind / pause / forward"),
    ("Timeline", "Cmd + =", "Zoom in"),
    ("Timeline", "Cmd + -", "Zoom out"),
]
SOPS = [
    ("CORE_RULE", "Shoot for speed first", "Use the normal color profile so clips can be edited on a phone the same day.",
     "Lock exposure and white balance before recording.", "Do not switch color profiles in the middle of a series.", "", ""),
    ("CAMERA_PROFILE", "Indoor desk shots", "Normal profile, 4K 30 fps",
     "Soft key light at 45 degrees, monitor brightness down.", "Do not mix daylight and warm bulbs.", "Shutter 1/60, ISO up to 800", "Light contrast boost"),
    ("CAMERA_PROFILE", "Outdoor walking vlog", "Normal profile, stabilization on",
     "Keep the horizon level; walk heel to toe.", "Do not shoot into direct sun without an ND filter.", "Shutter 1/60 with ND", "Warm tint +5"),
    ("FILMING_TECHNIQUE", "Hook in the first second", "Start on movement or bold on-screen text",
     "Show the result first, then how.", "No slow intros or logos.", "", ""),
    ("FILMING_TECHNIQUE", "B-roll checklist", "Five extra shots per video",
     "Hands on keyboard, screen close-up, coffee, wide desk, door/walk-in.", "Do not reuse the same B-roll two videos in a row.", "", ""),
]

BRAINSTORMS = [
    ("Productivity tips for developers who work from home", "Short vlog", "30–40 seconds", [TT, IG, LI], [
        {"title": "The 3-tab rule", "hook": "I close every tab but three. Here is why.",
         "outline": "Show 40 tabs, close them, explain the rule, show a calmer screen.", "format": "Short vlog",
         "platforms": [TT, IG, LI],
         "adaptations": {TT: "Fast cuts, on-screen counter of tabs.", IG: "Aesthetic desk B-roll, caption-led.",
                         LI: "Text post version with the rule and one result."}},
        {"title": "Do-not-disturb hour", "hook": "My most productive hour has zero notifications.",
         "outline": "Phone in a drawer, timer on, what got done, the result.", "format": "Short vlog",
         "platforms": [TT, IG], "adaptations": {TT: "Timer overlay counting down.", IG: "Slow, calm edit with lo-fi."}},
        {"title": "Shutdown ritual", "hook": "How I stop thinking about code at 6 PM.",
         "outline": "Write tomorrow's top task, close laptop, walk.", "format": "Short vlog",
         "platforms": [TT, LI], "adaptations": {TT: "POV style.", LI: "Short reflection with a question."}},
    ]),
    ("Explain what a database is to non-technical people", "Tutorial", "45–60 seconds", [YT, TT], [
        {"title": "A database is a very organized fridge", "hook": "You already use a database every morning.",
         "outline": "Shelves are tables, labels are columns, finding milk is a query.", "format": "Tutorial",
         "platforms": [YT, TT], "adaptations": {YT: "Add chapter text and a pinned comment.", TT: "Cut to 30 seconds, keep the fridge visual."}},
    ]),
]


def q(value):
    return "'" + str(value).replace("'", "''") + "'"


def jb(value):
    return q(json.dumps(value, ensure_ascii=False)) + "::jsonb"


def date_expr(offset):
    return "NULL" if offset is None else f"current_date + {offset}"


def platform_dates(offset, platforms):
    if offset is None:
        return "'{}'::jsonb"
    pairs = ", ".join(f"{q(p)}, (current_date + {offset + i})::text" for i, p in enumerate(platforms))
    return f"jsonb_build_object({pairs})"


def platform_links(status, platforms, index):
    if status != PUBLISHED:
        return "'{}'::jsonb"
    return jb({p: f"https://example.com/demo/{p.lower().replace(' ', '-')}/{index:03d}" for p in platforms})


def generate_sql():
    out = [
        "-- Generated by supabase/demo_seed.py. English demo workspace for screenshots and videos.",
        "-- 1. Sign up once in the app. 2. Put that account's email below. 3. Run this in the SQL editor.",
        "-- Running it again creates a second demo workspace; delete the old one first if needed.",
        "do $$",
        "declare",
        "  demo_email text := 'you@example.com';  -- change this",
        "  owner_id uuid;",
        "  ws uuid;",
        "begin",
        "  select id into owner_id from auth.users where lower(email) = lower(demo_email);",
        "  if owner_id is null then raise exception 'No user with email %; sign up in the app first', demo_email; end if;",
        "  insert into public.workspaces (name, created_by) values ('Creator Studio Demo', owner_id) returning id into ws;",
        "  insert into public.workspace_members (workspace_id, user_id, role) values (ws, owner_id, 'owner') on conflict do nothing;",
    ]
    for status, title in COLUMNS.items():
        out.append(f"  insert into public.workspace_pipeline_columns (workspace_id, status, title) values (ws, {q(status)}, {q(title)});")
    for name in CONCEPTS:
        out.append(f"  insert into public.workspace_concepts (workspace_id, name, created_by) values (ws, {q(name)}, owner_id);")
    for title, source, mood, used, notes in TRACKS:
        status = "Đã dùng" if used else "Chưa dùng"
        out.append("  insert into public.tracks (workspace_id, title, artist_source, mood_genre, status, audio_url, notes) "
                   f"values (ws, {q(title)}, {q(source)}, {q(mood)}, {q(status)}, '', {q(notes)});")
    for group, attribute, value, notes in PRESETS:
        out.append("  insert into public.config_presets (workspace_id, group_name, attribute, value, notes, link_example) "
                   f"values (ws, {q(group)}, {q(attribute)}, {q(value)}, {q(notes)}, '');")
    for index, (title, status, concept, priority, offset, hook, outline, tags, platforms) in enumerate(IDEAS, 1):
        out.append(
            "  insert into public.ideas (workspace_id, title, status, concept, priority, publish_date, hook, main_content, "
            "audio_sfx, hashtag, reference_url, notes, platforms, platform_publish_dates, platform_publish_links) values "
            f"(ws, {q(title)}, {q(status)}, {q(concept)}, {priority}, {date_expr(offset)}, {q(hook)}, {q(outline)}, "
            f"'', {jb(tags)}, '', '', {jb(platforms)}, {platform_dates(offset, platforms)}, {platform_links(status, platforms, index)});")
    for age, (brief, fmt, duration, platforms, ideas) in enumerate(BRAINSTORMS):
        out.append("  insert into public.brainstorm_history (workspace_id, brief, format, duration, source, platforms, ideas, created_by, created_at) "
                   f"values (ws, {q(brief)}, {q(fmt)}, {q(duration)}, 'demo', {jb(platforms)}, {jb(ideas)}, owner_id, now() - interval '{age + 1} days');")
    for category, keys, action in SHORTCUTS:
        out.append("  insert into public.editing_shortcuts (workspace_id, category, key_combo, action, notes) "
                   f"values (ws, {q(category)}, {q(keys)}, {q(action)}, '');")
    for row in SOPS:
        out.append("  insert into public.production_sops (workspace_id, type, category_or_profile, recommended_mode, do_instructions, dont_instructions, camera_settings, post_process) "
                   f"values (ws, {', '.join(q(v) for v in row)});")
    out.append("  raise notice 'Demo workspace % created for %', ws, demo_email;")
    out.append("end $$;")
    return "\n".join(out) + "\n"


if __name__ == "__main__":
    (ROOT / "supabase" / "demo_seed.sql").write_text(generate_sql(), encoding="utf-8")
    print("generated supabase/demo_seed.sql:", len(IDEAS), "ideas,", len(TRACKS), "tracks,", len(PRESETS), "presets")
