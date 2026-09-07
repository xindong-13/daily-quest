# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Working conventions

**一律使用繁體中文回覆使用者，包括 commit message 與程式碼註解。** 這是使用者的明確要求，適用於這個 repo 的所有工作。

**使用者是非工程背景**：不熟命令列、不熟 git，看到英文報錯會卡住。給步驟要寫到「點哪個按鈕、畫面會出現什麼字」的程度，不能只說「執行 xxx」。**不要假設他會自己替換範例值**——曾經把 SQL 裡的 `'你的新密碼'` 這種佔位符原封不動送出去執行過；範例值要用明顯是佔位符的寫法，並在旁邊明講「這行要換成你的」。他同時維護另外兩個同款架構的 App（`コトバ Kotoba`、`Echo 英語`），做法盡量跟那兩個一致比較好懂。

## What this is

「每日任務」(Daily Quest) — a single-page PWA task/habit tracker in Traditional Chinese. Zero build step, zero framework, zero npm dependencies. Three files carry the entire app: `index.html`, `app.js` (~2800 lines), `style.css`. Opens directly via `file://` (double-click `index.html`) or served over HTTP for PWA/notification features.

Deployed via **GitHub Pages only**: `https://xindong-13.github.io/daily-quest/`. The user pushes via the one-click `update.bat` in the repo root (mirrors the same script in the sibling `コトバ Kotoba` / `Echo英語` projects — keep the naming/behavior consistent across all three if you touch it). They've also used the GitHub web UI directly (uploading/editing files at github.com) as a fallback when not at this machine — either path is fine to suggest.

- Netlify (`https://jerry-daily.netlify.app`) is **no longer used** — the `手機版-一鍵更新.bat` / `上傳到指定站台.bat` / `列出我的所有站台.bat` / `.netlify/` files are leftover from an earlier workflow. Don't suggest Netlify deploys or "update your phone site" flows unless the user brings it back up.

## Commands

No build, no test suite, no linter, no package.json — this is intentional (see 規劃書.md: "純 HTML/JS，沒有框架、沒有編譯步驟"). Development is: edit the file, open `index.html` in a browser, reload.

Versioning is done via the `.bat`/`.ps1` scripts in the repo root (Windows only):

- `bump-version.ps1` — increments `dq-vNN` in `sw.js` and keeps `APPVER` in `index.html:61` in sync. Also creates `.nojekyll` if missing (tells GitHub Pages to skip Jekyll processing). **Run this after any change to `app.js`/`index.html`/`style.css`/`sw.js`** — the service worker caches assets by version string, and phones/browsers won't see the update otherwise.
- `update.bat` — the one-click deploy: calls `bump-version.ps1`, then `git add -A`, commits ("update"), pushes to `origin`. This is the user's primary push path now (renamed from `GitHub-一鍵更新.bat` to match the `update.bat` naming used in the sibling `コトバ Kotoba` / `Echo英語` projects).
- `GitHub-第一次設定.bat` / `GitHub-用權杖登入.bat` — one-time git/GitHub setup and re-auth; only needed once per machine, or if push auth breaks.

## Architecture

Everything lives in `app.js`, organized top-to-bottom in the sections marked by `/* === ... === */` banners:

1. **Constants & utilities** (top) — `PRIO` (must/important/normal/light/**exam** priority levels — `exam` was appended last with `rank: 4` specifically so it doesn't shift the existing ranks; inserting a new tier earlier in `PRIO_ORDER` would silently reshuffle every pre-existing task's stored `order` band, see `orderOf`/`nextOrder`), date helpers (`ymd`, `parseYmd`, `addDays`), `$`/`$$` DOM shortcuts, plus `PERIODS`/`SCHOOL_DAYS`/`courseColor` for the 課表 (class schedule) grid.
2. **State** (`S`) — one global object, shape defined in `blankState()`. Persisted to `localStorage` under key `daily_quest_v1`. `migrate(o)` upgrades any older saved shape to current (`version: 3`) on load — it strips removed features (coins/XP/achievements/attributes/difficulty, see git history) and backfills defaults. **Any change to the state shape must be handled in `migrate()`**, since real user data on GitHub Pages/Netlify must keep loading. `S.courses` is the 課表 grid: `{ id, day(1~5=一~五), period('1'~'8'/'A'~'D'), title, location, archived }`, one entry per occupied cell; soft-deleted via `archived` like tasks (not spliced out) so `mergeStates()` can carry the deletion across a sync merge instead of a stale device reviving it.
3. **Task/schedule logic** — tasks have one of three schedule types (`daily`, `weekly` with a `days[]` array, or `date`-specific) plus one-off todos. `isPlanned`/`isTaskDone`/`dayTasks` compute what shows on a given day. `changeScheduleFrom`/`changeScheduleAll` implement "edit from today forward vs. rewrite history" — schedule changes are stored as dated `segs` (segments) so past calendar days never retroactively change. This segment history is the trickiest invariant in the codebase; read `使用說明.md`'s "改排程：過去的紀錄不會被改掉" section before touching it.

   Manual drag-reordering (`S.dayOrder = { 'YYYY-MM-DD': [taskId...] }`) is **per-day, not global** — dragging "喝水" to the top on Monday only changes Monday; other days fall back to the global `order` field via `sortTasks(list, doneIds, day)`'s third argument. `pruneDayOrder()` caps this at the most recent 90 days. Overdue (`once`-type, past-due) tasks deliberately do **not** get folded into today's calendar/list — `dayTasks()`/`isPlanned` stays strictly per-actual-day; `overdueTasks()` is a separate feed that only powers the ⚠️ 逾期未完成 card on 今日, and an item vanishes from that card the instant it's checked off (not "carried to tomorrow"). This was a deliberate user decision — don't "fix" it back into a rollover list.
4. **Rendering** (`render()`, `viewToday/viewCalendar/viewWeek/viewMonth/viewManage/viewSchedule/viewStats/viewGoals/viewSettings`) — plain string-templated `innerHTML`, no virtual DOM, no component framework. Each `view*()` function renders one of the 7 tabs into `#view`. `render()` always re-runs `wire()` afterward, so any new element with a `data-*` handler attribute just works without extra wiring code — no delegation setup needed per view.

   `viewSchedule()` (課表 tab) renders the weekly class-schedule grid (`SCHOOL_DAYS` × `PERIODS`) via `courseAt(day, period)`; clicking a cell opens the same shared `#modal` used by task editing (`openCourseEdit`/`renderCourseEdit`/`saveCourse`, draft var `cd`). Course color is auto-derived from the title via `courseColor()` (hash into `COURSE_PALETTE`) — no manual color picker, so retyping the same course name in another cell keeps the same color automatically. This tab is additive; it doesn't touch 成績 (`viewStats`).

   `viewManage()` (事情 tab) deliberately hides `once`-scheduled (指定日期) tasks from the main "我的事情" list and count — they still drive `isPlanned`/stats/calendar normally, just tucked into a collapsed `<details class="mgroup-collapse">` at the bottom so the list doesn't fill up with one-off calendar events. It also renders a "📝 隨手待辦" quick-add block (`todoRow()`/`addQuickTodo()`) for undated errands (e.g. "還書") — items there are `schedule.type: 'todo'` tasks not yet completed (`!doneEver(id)`); checking one off removes it from that block and it shows up as done in 今日/成績 like any other todo. The block's delete button (`[data-del]`) calls `e.stopPropagation()` because it's nested inside the checkable `[data-toggle]` row — without that, a delete click also bubbles into the toggle handler and un-archives/re-toggles the task.
5. **Drag & drop** (`initDrag`/`onDragDown`/`beginDrag`/etc.) — custom pointer-based reordering for the week view and today list, not using the native HTML5 DnD API (needed for touch/long-press behavior).
6. **Cloud sync** (bottom third of the file, `SYNC_KEY`/`sbFetch`/`pushNow`/`mergeStates`) — optional, off by default. Talks directly to a user-provisioned Supabase table (`daily_sync`, schema in `syncSql()`) via the PostgREST HTTP API — no Supabase client library. Two devices sync by sharing a `code` (a `DQ-XXXX-XXXX-XXXX` pairing code, not a login). `mergeStates()` does field-level merging (tasks/goal-entries unioned by id, per-day logs merged by last-modified) rather than last-write-wins overwrite, so two offline devices editing different things both survive a merge.
7. **Reminders** (`scheduleReminders`/`fireReminder`/`watchMidnight`) — browser Notification API when served over HTTP; falls back to an in-page banner (`showBanner`) when opened via `file://`, since Chrome blocks notifications on that origin.

`sw.js` is a standard cache-then-network service worker; it's a no-op when the app is opened via `file://` (registration is skipped in `index.html` based on `location.protocol`).

### Key invariant: no retroactive history rewrites

Central design rule (drives #3 and #6 above, and is spelled out in `使用說明.md`): completed/missed status on any past calendar day must never change as a side effect of editing a task's current schedule, editing priority, or a sync merge. New schedules apply "from today" by default; rewriting the past is an explicit opt-in action.

## Known pitfalls (all hit before, all painful)

- **`.bat` files must be pure ASCII.** Chinese text in a `.bat` gets mangled under the user's cmd codepage and can get executed line-by-line, spewing `'xxx' 不是內部或外部命令`. Keep Chinese explanations in `.md` files; `.bat` files stay English-only. Check with: `python3 -c "import io,glob; [print(f, 'ok' if not any(ord(c)>127 for c in io.open(f,encoding='utf-8').read()) else 'has non-ascii') for f in glob.glob('*.bat')+glob.glob('*.ps1')+glob.glob('*.vbs')]"`.
- **`.bat` files can't `echo !something`** — `setlocal enabledelayedexpansion` eats the `!`. This once silently produced a broken `.gitignore` line and excluded `manifest.json` from a push (no `!` in the output), breaking the PWA icon/fullscreen behavior on the new URL. `.gitignore` is now committed directly and no script overwrites it.
- **CSS `.done` rules must come after priority (`.p-*`) rules** in `style.css`, or a tied-specificity priority style (e.g. `.task.p-light`) wins and a completed task never dims.
- **GitHub Pages serves this app from a subdirectory** (`/daily-quest/`, not root). Every asset reference (`index.html` `href`/`src`, `manifest.json`'s `start_url`/`scope`/`icons[].src`, `sw.js`'s `ASSETS`) must be relative (`./xxx`), never a leading `/`.
- **`localStorage` is bound to origin.** Moving to a new URL (e.g. between Netlify and GitHub Pages) means a brand-new, empty app — any "switch URLs" instruction must cover backup-first, and only tell the user to remove the old home-screen icon after confirming the new one has their data.
- **The linked Supabase free project auto-pauses after ~1 week idle**, surfacing as `Backend error! Retry your query` in the SQL editor and a broken sync in-app — not a code bug. Fix is Dashboard → Restore project. Worth naming as a possibility in any sync-error troubleshooting.
- **iPhone file downloads are unreliable** — the JSON export/import backup path can silently fail on iOS. The text-based 📋 複製成文字 / 📥 從文字還原 backup path (`openTextBackup`/`openTextRestore`) is the reliable one there; don't drop it in favor of only file export.
- **Repo is public** — never let a real Supabase project URL, anon key, or sync pairing code land in tracked source (only placeholder text and validation regexes belong there). Spot-check before committing: `grep -nE "eyJhbGciOiJIUzI1NiI|https://[a-z0-9]{8,}\.supabase\.co|DQ-[A-Z2-9]{4}-" app.js`. `.gitignore` already blocks `backups/` and `*.json` (except `!manifest.json`, which must stay tracked).

## Testing without a framework

No `package.json` by design (see 規劃書.md's zero-dependency requirement) — but `app.js` ends with a `module.exports` block exposing its internal functions specifically so it can be loaded in Node against a minimal faked `document`/`window`/`localStorage`/`crypto` (set `document.readyState = 'loading'` so `init()`'s `DOMContentLoaded` wait keeps the fake harness from actually booting the app). Sync-related tests just swap `global.fetch` for a fake server keyed by `code`.

Minimum check after any change:
1. `node --check app.js`
2. Render all 7 views (via the exported `A.views`) in both `week` and `month` `calMode` — output should have no `NaN`/`undefined`/`[object` and balanced `<`/`>`.
3. Run `migrate()` + a full render against a real backup file from `backups/`.
4. If sync logic changed: simulate two devices editing different things, confirm `mergeStates()` keeps both sides' changes.

## Shipping checklist

1. Edit `app.js`/`style.css`/`index.html`/`sw.js`.
2. Run the checks above.
3. Bump the version (`bump-version.ps1`, or `update.bat` which calls it) and push.
4. Tell the user: open the app → tap the blue "✨ 有新版本可以更新" bar → 立即更新 (or fully swipe-close and reopen if the bar doesn't appear).

## Reference docs (Traditional Chinese)

- `規劃書.md` — original feature/design plan, useful for *why* a feature exists.
- `使用說明.md` — end-user manual; the most precise spec of intended behavior for scheduling, streaks, overdue handling, and stats — treat it as the source of truth for expected behavior when in doubt.
- `設定教學_從頭到尾.md` — full setup walkthrough (Node.js → GitHub Pages → phone install → Supabase sync).
- `雲端同步設定教學.md` / `手機安裝教學_iPhone.md` — subset extracts of the above, generally redundant with it.
