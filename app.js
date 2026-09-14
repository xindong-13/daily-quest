/* =========================================================
   每日任務  —  app.js   v2
   純前端、無外部依賴、資料存在瀏覽器 localStorage
   ========================================================= */

'use strict';

/* ---------------- 常數 ---------------- */

const KEY = 'daily_quest_v1';

/* 重要程度四級 */
const PRIO = {
  must:      { name: '必做', icon: '🔴', color: '#ff5f79', rank: 0, desc: '今天絕對不能漏掉' },
  important: { name: '重要', icon: '🟠', color: '#ffb547', rank: 1, desc: '應該要完成' },
  normal:    { name: '一般', icon: '🔵', color: '#6d8cff', rank: 2, desc: '例行事項' },
  light:     { name: '隨手', icon: '⚪', color: '#8d95a8', rank: 3, desc: '有空再做就好' },
  // rank 接在最後面，才不會讓舊資料的手動排序、成績統計亂掉（見 CLAUDE.md）
  exam:      { name: '考試', icon: '📕', color: '#ffd60a', rank: 4, desc: '要考試的日子，用特別的顏色提醒你' },
};
const PRIO_ORDER = ['must', 'important', 'normal', 'light', 'exam'];

const WEEK = ['日', '一', '二', '三', '四', '五', '六'];

/* 課表：陽明交大式節次（1~8 節 + A~D 晚間節），週一到週五 */
const PERIODS = ['1', '2', '3', '4', '5', '6', '7', '8', 'A', 'B', 'C', 'D'];
const SCHOOL_DAYS = [1, 2, 3, 4, 5]; // WEEK 的索引：一~五
const COURSE_PALETTE = [
  '#ff6b6b', '#ffa94d', '#ffd43b', '#69db7c', '#38d9a9',
  '#4dabf7', '#748ffc', '#9775fa', '#e64980', '#20c997', '#fab005', '#5c7cfa',
];
function courseColor(title) {
  const custom = S && S.courseColors && S.courseColors[title];
  return custom || COURSE_PALETTE[hashStr(title || '') % COURSE_PALETTE.length];
}

const STARTER_TASKS = [
  { title: '喝滿 2000cc 水', priority: 'normal',    schedule: { type: 'daily' } },
  { title: '運動 30 分鐘',   priority: 'important', schedule: { type: 'weekly', days: [1, 3, 5] } },
  { title: '閱讀 20 頁',     priority: 'light',     schedule: { type: 'daily' } },
];

/* ---------------- 工具 ---------------- */

const $  = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
const esc = (s) => String(s).replace(/[&<>"']/g, c =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));

function ymd(d = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
function parseYmd(s) { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); }
function addDays(s, n) { const d = parseYmd(s); d.setDate(d.getDate() + n); return ymd(d); }
function daysBetween(a, b) { return Math.round((parseYmd(b) - parseYmd(a)) / 86400000); }
function fmtMD(s) { const d = parseYmd(s); return `${d.getMonth() + 1}/${d.getDate()}`; }
function hashStr(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return Math.abs(h);
}

/* ---------------- 狀態 ---------------- */

let S = null;

function blankState() {
  return {
    version: 3,
    profile: { name: '你', createdAt: ymd() },
    tasks: [],
    goals: [],
    courses: [],      // 課表：{ id, day(1~5=一~五), period('1'~'8'/'A'~'D'), title, location, archived }
    courseColors: {}, // 課表：{ 課程名稱: '#hex' }，使用者自己挑的顏色，優先於自動配色
    log: {},          // 'YYYY-MM-DD' -> { done:[id], times:{id:'HH:MM'}, perfect }
    dayOrder: {},     // 'YYYY-MM-DD' -> [taskId...]  某天手動排過的順序
    streak: { current: 0, best: 0, lastActive: null, shields: 0, shielded: [] },
    stats: { totalDone: 0, perfectDays: 0 },
    settings: { reminders: ['09:00', '20:30'], notify: false },
    lastOpen: null,
    updatedAt: new Date(0).toISOString(),
    rev: 0,
  };
}

/* 舊版資料自動升級：拿掉金幣／成就／商店／屬性／經驗值／費力程度 */
function migrate(o) {
  const base = blankState();
  const out = {
    ...base, ...o,
    profile:  { name: (o.profile && o.profile.name) || '你',
                createdAt: (o.profile && o.profile.createdAt) || ymd() },
    streak:   { ...base.streak, ...(o.streak || {}) },
    stats:    { totalDone: (o.stats && o.stats.totalDone) || 0,
                perfectDays: (o.stats && o.stats.perfectDays) || 0 },
    settings: { ...base.settings, ...(o.settings || {}) },
    goals: Array.isArray(o.goals) ? o.goals : [],
    tasks: Array.isArray(o.tasks) ? o.tasks : [],
    courses: Array.isArray(o.courses) ? o.courses : [],
    courseColors: (o.courseColors && typeof o.courseColors === 'object') ? o.courseColors : {},
    log: o.log && typeof o.log === 'object' ? o.log : {},
    dayOrder: (o.dayOrder && typeof o.dayOrder === 'object') ? o.dayOrder : {},
  };
  delete out.rewards; delete out.redemptions; delete out.achievements;
  delete out.profile.xp;
  out.version = 3;

  const firstLog = Object.keys(out.log).sort()[0];
  out.tasks.forEach(t => {
    if (!t.schedule || !t.schedule.type) t.schedule = { type: 'daily' };
    // 舊的「非常重要」= critical → 新的「必做」
    if (t.priority === 'critical') t.priority = 'must';
    if (!PRIO[t.priority]) t.priority = 'normal';
    delete t.attr; delete t.difficulty;
    if (typeof t.subject !== 'string') t.subject = '';
    if (typeof t.order !== 'number') {
      t.order = PRIO[t.priority].rank * 100000 + (out.tasks.indexOf(t) + 1) * 10;
    }
    if (Array.isArray(t.segs)) {
      t.segs = t.segs.filter(s => s && s.from && s.sc).sort((a, b) => a.from.localeCompare(b.from));
      if (!t.segs.length) delete t.segs;
    }
    // 沒有建立日的舊任務 → 用最早的紀錄日，避免統計把更早的日子算成漏掉
    if (!t.createdAt) t.createdAt = firstLog || out.profile.createdAt || ymd();
  });
  out.goals.forEach(g => {
    if (!Array.isArray(g.entries)) g.entries = [];
    g.target = Math.max(1, +g.target || 1);
  });
  Object.values(out.log).forEach(l => {
    if (!Array.isArray(l.done)) l.done = [];
    if (!l.times) l.times = {};
    delete l.coins; delete l.xp; delete l.boss;
  });
  if (!out.updatedAt) out.updatedAt = new Date(0).toISOString();
  out.rev = +o.rev || 0;
  return out;
}

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    return migrate(JSON.parse(raw));
  } catch (e) { console.error('讀取失敗', e); return null; }
}
/* bump = true 代表「這是一次真的修改」，會累加版本號並排程上傳雲端。
   版本號 rev 是一個只會往上加的計數器，不受兩台裝置時鐘不同步影響。 */
function save(bump = true) {
  if (bump) {
    S.rev = (+S.rev || 0) + 1;
    S.updatedAt = new Date().toISOString();
  }
  try { localStorage.setItem(KEY, JSON.stringify(S)); }
  catch (e) { toast('⚠️ 儲存失敗，瀏覽器可能封鎖了本機儲存'); }
  if (bump && syncReady()) schedulePush();
}

/* ---- 自動快照：任何一次「被雲端覆蓋」之前都先留一份，永遠救得回來 ---- */
const SNAP_KEY = 'daily_quest_snapshots';

function listSnapshots() {
  try { return JSON.parse(localStorage.getItem(SNAP_KEY) || '[]'); }
  catch (e) { return []; }
}
function pushSnapshot(reason) {
  try {
    const arr = listSnapshots();
    arr.unshift({ at: new Date().toISOString(), reason, rev: +S.rev || 0, data: S });
    localStorage.setItem(SNAP_KEY, JSON.stringify(arr.slice(0, 6)));
  } catch (e) { /* 空間不足就算了，不影響主流程 */ }
}
function restoreSnapshot(i) {
  const arr = listSnapshots();
  if (!arr[i]) return false;
  // 還原後的版本號必須比「目前的」和「快照的」都大，才推得回雲端
  const base = Math.max(+S.rev || 0, +(arr[i].data || {}).rev || 0);
  pushSnapshot('還原前');
  S = migrate(arr[i].data);
  S.rev = base;                       // save() 會再 +1
  save();
  render();
  return true;
}
function dayLog(d = ymd()) {
  if (!S.log[d]) S.log[d] = { done: [], times: {}, perfect: false };
  if (!S.log[d].times) S.log[d].times = {};
  return S.log[d];
}
/* 標記某一天的紀錄「剛剛被改過」，合併時用來判斷那天要以誰為準 */
function touchDay(d) {
  const l = dayLog(d);
  l.t = new Date().toISOString();
  return l;
}
function doneOn(d, id) { return !!(S.log[d] && S.log[d].done && S.log[d].done.includes(id)); }
function doneEver(id) {
  for (const d of Object.keys(S.log)) if ((S.log[d].done || []).includes(id)) return d;
  return null;
}

/* ---------------- 排程 ---------------- */

/* ---- 排程歷史 ----
   改「每週幾」的時候，過去的紀錄要維持原本的安排，
   所以每次改都留一段 { from: 生效日, sc: 排程 }，查詢時取生效日 <= 該日的最後一段。 */
function scheduleAt(task, date) {
  const segs = task.segs;
  if (Array.isArray(segs) && segs.length) {
    let best = null;
    for (const s of segs) {
      if (s.from <= date && (!best || s.from >= best.from)) best = s;
    }
    return (best || segs[0]).sc || task.schedule || { type: 'daily' };
  }
  return task.schedule || { type: 'daily' };
}

/* 從 from 這天起改成新的排程，之前的日子維持原樣 */
function changeScheduleFrom(task, newSc, from) {
  if (!Array.isArray(task.segs) || !task.segs.length) {
    task.segs = [{ from: task.createdAt || S.profile.createdAt || ymd(), sc: task.schedule }];
  }
  task.segs = task.segs.filter(s => s.from !== from);
  task.segs.push({ from, sc: newSc });
  task.segs.sort((a, b) => a.from.localeCompare(b.from));
  task.schedule = newSc;
}

/* 連過去一起改（清掉歷史） */
function changeScheduleAll(task, newSc) {
  delete task.segs;
  task.schedule = newSc;
}

/* 純粹的行事曆判斷：這一天原本就排了這件事嗎？
   ★ 建立日之前的日子一律不算 —— 才不會回頭看像是「以前都沒做」 */
function isPlanned(task, date) {
  if (task.archived) return false;
  const sc = scheduleAt(task, date);
  // 指定日期的事：日期本身就是排程，不受建立日限制
  if (sc.type === 'once') return sc.date === date;
  const born = task.createdAt || S.profile.createdAt || date;
  if (date < born) return false;
  if (sc.type === 'daily')  return true;
  if (sc.type === 'weekly') return (sc.days || []).includes(parseYmd(date).getDay());
  if (sc.type === 'todo') {
    const d0 = doneEver(task.id);
    return d0 ? d0 === date : date === ymd();
  }
  return false;
}

/* 這件事在這一天算不算「已完成」
   指定日期的事情比較特別：只要完成過，不管是哪天補勾的，
   在它排定的那天、以及補勾的那天，都要顯示成已完成。 */
function isTaskDone(t, date) {
  if ((t.schedule || {}).type === 'once') return !!doneEver(t.id);
  return doneOn(date, t.id);
}

/* 某一天排定的事。嚴格照日期，不會有別天的事跑進來。
   行事曆（週／月）與成績統計都用這個。 */
function dayTasks(d) { return S.tasks.filter(t => isPlanned(t, d)); }

/* 行事曆（週／月）專用：不含隨手待辦——那些只在「今日」自己一區顯示，
   不算是排定的行程，成績統計仍照 dayTasks／isPlanned 正常計算，不受影響。 */
function calendarTasks(d) { return dayTasks(d).filter(t => (t.schedule || {}).type !== 'todo'); }

/* 已經過期又還沒完成的「指定日期」事項。
   只會出現在「今日」分頁的獨立提醒區，不會混進行事曆的今天。 */
function overdueTasks() {
  const today = ymd();
  return S.tasks.filter(t => {
    if (t.archived) return false;
    const sc = t.schedule || {};
    if (sc.type !== 'once' || !sc.date) return false;
    if (sc.date >= today) return false;
    return !doneEver(t.id);       // 完成了就從這裡消失
  }).sort((a, b) => a.schedule.date.localeCompare(b.schedule.date)
                 || PRIO[prioOf(a)].rank - PRIO[prioOf(b)].rank);
}

/* 「今日」分頁真正該做的事（不含逾期，逾期另外列） */
function todaysTasks(date = ymd()) { return dayTasks(date); }

/* 一份清單裡已完成的 id（給排序用） */
function doneIdsOf(list, date) {
  return list.filter(t => isTaskDone(t, date)).map(t => t.id);
}

function overdueDays(task) {
  const sc = task.schedule || {};
  if (sc.type !== 'once' || !sc.date) return 0;
  if (doneEver(task.id)) return 0;
  const n = daysBetween(sc.date, ymd());
  return n > 0 ? n : 0;
}
function daysUntil(task) {
  const sc = task.schedule || {};
  if (sc.type !== 'once' || !sc.date) return null;
  return daysBetween(ymd(), sc.date);
}
function prioOf(t) { return PRIO[t.priority] ? t.priority : 'normal'; }

/* 排序：未完成的在上面，然後照「手動順序」。
   手動順序可以在行事曆或今日清單直接拖曳調整；
   新任務的預設順序會依重要程度分層，所以不拖也是照重要程度排。 */
function orderOf(t) {
  return typeof t.order === 'number' ? t.order : PRIO[prioOf(t)].rank * 100000 + 50000;
}

/* 某一天有沒有手動排過順序。有的話那天就照那份清單，其他天完全不受影響。 */
function dayOrderOf(day) {
  return (day && S.dayOrder && Array.isArray(S.dayOrder[day])) ? S.dayOrder[day] : null;
}
function setDayOrder(day, ids) {
  if (!S.dayOrder) S.dayOrder = {};
  S.dayOrder[day] = ids.slice();
}
function sortKey(t, arr) {
  if (arr) {
    const i = arr.indexOf(t.id);
    return i >= 0 ? i : 1e6 + orderOf(t);   // 那天之後才新增的排在後面
  }
  return orderOf(t);
}

/* day 有給的話就用那天的手動順序；沒給就用全域預設順序 */
function sortTasks(list, doneIds, day) {
  const arr = dayOrderOf(day);
  return list.slice().sort((a, b) => {
    const da = doneIds.includes(a.id) ? 1 : 0, db = doneIds.includes(b.id) ? 1 : 0;
    if (da !== db) return da - db;
    const oa = sortKey(a, arr), ob = sortKey(b, arr);
    if (oa !== ob) return oa - ob;
    return (a.createdAt || '').localeCompare(b.createdAt || '');
  });
}

/* 只留最近 90 天與未來的手動順序，避免無限累積 */
function pruneDayOrder() {
  if (!S.dayOrder) return;
  const cut = addDays(ymd(), -90);
  for (const k of Object.keys(S.dayOrder)) if (k < cut) delete S.dayOrder[k];
}

/* 新任務要放在它那個重要程度層的最後面 */
function nextOrder(priority) {
  const rank = PRIO[priority] ? PRIO[priority].rank : 2;
  const base = rank * 100000;
  let max = base;
  for (const t of S.tasks) {
    const o = orderOf(t);
    if (o >= base && o < base + 100000 && o > max) max = o;
  }
  return max + 10;
}

/* 依重要程度重新排一次（把手動順序清掉） */
function resortByPriority() {
  const list = S.tasks.slice().sort((a, b) => {
    const pa = PRIO[prioOf(a)].rank, pb = PRIO[prioOf(b)].rank;
    if (pa !== pb) return pa - pb;
    return orderOf(a) - orderOf(b);
  });
  list.forEach((t, i) => { t.order = PRIO[prioOf(t)].rank * 100000 + (i + 1) * 10; });
}

/* 在某一天之內把某一項移到新的位置。★ 只影響那一天。 */
function reorderWithin(list, fromIdx, toIdx, day) {
  if (fromIdx === toIdx || fromIdx < 0 || toIdx < 0) return false;
  const arr = list.slice();
  const [m] = arr.splice(fromIdx, 1);
  arr.splice(toIdx, 0, m);
  if (day) { setDayOrder(day, arr.map(t => t.id)); return true; }
  // 沒指定日期（例如「事情」分頁）才動全域順序
  const pool = list.map(orderOf).sort((a, b) => a - b);
  arr.forEach((t, i) => { t.order = pool[i]; });
  return true;
}

/* ---------------- 成績統計 ---------------- */

/* 一個任務在 [from, to] 之間的成績（to 預設到昨天，今天還沒過完不算漏） */
function taskReport(task, from, to) {
  const born = task.createdAt || S.profile.createdAt;
  let start = from && from > born ? from : born;
  const end = to || addDays(ymd(), -1);
  let planned = 0, done = 0;
  if (start > end) return { planned: 0, done: 0, missed: 0, rate: null };
  // 上限保護：最多回看 3 年
  if (daysBetween(start, end) > 1100) start = addDays(end, -1100);
  for (let d = start; d <= end; d = addDays(d, 1)) {
    if (!isPlanned(task, d)) continue;
    planned++;
    // 指定日期的事只要完成過就算做到（晚幾天補做也算）
    if (isTaskDone(task, d)) done++;
  }
  return { planned, done, missed: planned - done, rate: planned ? done / planned : null };
}

function overallReport(from, to) {
  const end = to || addDays(ymd(), -1);
  let planned = 0, done = 0;
  const rows = [];
  for (const t of S.tasks) {
    if (t.archived && !doneEver(t.id)) continue;
    const r = taskReport(t, from, end);
    if (r.planned === 0) continue;
    planned += r.planned; done += r.done;
    rows.push({ task: t, ...r });
  }
  rows.sort((a, b) => (a.rate ?? 1) - (b.rate ?? 1) || b.missed - a.missed);
  return { planned, done, missed: planned - done, rate: planned ? done / planned : null, rows };
}

/* ---------------- 連續天數 ---------------- */

function activeDay(d) {
  return (S.log[d] && S.log[d].done && S.log[d].done.length > 0) || S.streak.shielded.includes(d);
}
function maintainStreak() {
  const st = S.streak, today = ymd();
  if (!st.lastActive || st.lastActive >= today) return;
  let cur = addDays(st.lastActive, 1);
  while (cur < today) {
    if (activeDay(cur)) { cur = addDays(cur, 1); continue; }
    if (st.shields > 0) {
      st.shields--; st.shielded.push(cur); st.current++;
      toast(`🛡️ ${fmtMD(cur)} 沒有紀錄，自動用掉 1 張保護卡`);
    } else { st.current = 0; st.lastActive = null; return; }
    cur = addDays(cur, 1);
  }
  st.lastActive = addDays(today, -1);
}
function bumpStreak() {
  const st = S.streak, today = ymd();
  if (st.lastActive === today) return;
  const yest = addDays(today, -1);
  st.current = (st.lastActive === yest || activeDay(yest)) ? st.current + 1 : 1;
  st.lastActive = today;
  if (st.current > st.best) st.best = st.current;
  if (st.current % 10 === 0 && st.shields < 2) {
    st.shields++;
    toast('🛡️ 連續 10 天，獲得 1 張保護卡');
  }
}
/* ---------------- 勾選 ---------------- */

function toggleTask(id, ev, date) {
  const t = S.tasks.find(x => x.id === id);
  if (!t) return;
  let day = date || ymd();
  // 指定日期的事：取消時要回到當初實際勾選的那天，才不會重複記錄
  if ((t.schedule || {}).type === 'once') {
    const dd = doneEver(id);
    if (dd) day = dd;
  }
  const isToday = day === ymd();
  const isFuture = day > ymd();
  const lg = touchDay(day);
  const idx = lg.done.indexOf(id);

  if (idx >= 0) {
    lg.done.splice(idx, 1);
    delete lg.times[id];
    S.stats.totalDone = Math.max(0, S.stats.totalDone - 1);
    if (lg.perfect) { lg.perfect = false; S.stats.perfectDays = Math.max(0, S.stats.perfectDays - 1); }
  } else {
    const now = new Date();
    const hh = String(now.getHours()).padStart(2, '0');
    const mm = String(now.getMinutes()).padStart(2, '0');
    lg.done.push(id);
    lg.times[id] = isToday ? `${hh}:${mm}` : (isFuture ? '提前完成' : '補記');
    S.stats.totalDone++;

    if (isToday) bumpStreak();
    sparkle(ev);

    // 逾期的事完成後會從「今日」的提醒區消失，給一個明確回饋
    const sc0 = t.schedule || {};
    if (sc0.type === 'once' && sc0.date < ymd()) {
      toast(`✅ 完成「${t.title}」　（原本排在 ${fmtMD(sc0.date)}）`);
    } else if (isFuture) {
      toast(`✅ 提前完成「${t.title}」　（排在 ${fmtMD(day)}）`);
    }

    const list = todaysTasks(day);
    const perfect = list.length > 0 && list.every(x => isTaskDone(x, day));
    if (perfect && !lg.perfect) { lg.perfect = true; S.stats.perfectDays++; }
    if (perfect && isToday) {
      celebrate('🏁', '今天全部完成', `${list.length} 件事清空　·　連續 ${S.streak.current} 天`);
    }
  }
  save();
  render();
}

/* ---------------- 長期目標 ---------------- */

function goalProgress(g) {
  return (g.entries || []).reduce((s, e) => s + (+e.n || 0), 0);
}
function goalStats(g) {
  const cur = goalProgress(g);
  const pct = clamp(cur / g.target, 0, 1);
  const left = Math.max(0, g.target - cur);
  const startD = g.startDate || g.createdAt;
  const elapsed = Math.max(1, daysBetween(startD, ymd()) + 1);
  const perDay = cur / elapsed;
  let daysLeft = null, needPerWeek = null, onTrack = null, idealNow = null;
  if (g.deadline) {
    daysLeft = daysBetween(ymd(), g.deadline);
    const total = Math.max(1, daysBetween(startD, g.deadline) + 1);
    idealNow = g.target * clamp(elapsed / total, 0, 1);
    onTrack = cur >= idealNow - 1e-9;
    if (daysLeft > 0) needPerWeek = left / (daysLeft / 7);
  }
  const etaDays = perDay > 0 ? Math.ceil(left / perDay) : null;
  return { cur, pct, left, elapsed, perDay, daysLeft, needPerWeek, onTrack, idealNow, etaDays,
           done: cur >= g.target };
}

function addGoalEntry(goalId, n, note) {
  const g = S.goals.find(x => x.id === goalId);
  if (!g) return;
  const before = goalProgress(g) >= g.target;
  g.entries.push({ id: uid(), date: ymd(), n: +n || 1, note: (note || '').trim() });
  save();
  const st = goalStats(g);
  if (!before && st.done) {
    celebrate('🏆', '目標達成！', `${g.title}　${g.target}${g.unit || ''} 完成`);
  } else {
    toast(`＋${n} ${g.unit || ''}　${g.title}：${st.cur}/${g.target}（${Math.round(st.pct * 100)}%）`);
  }
  render();
}

/* ---------------- 視覺回饋 ---------------- */

function toast(msg) {
  const el = $('#toast');
  if (!el) return;
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => el.classList.remove('show'), 2800);
}

function celebrate(em, title, desc) {
  $('#cel-em').textContent = em;
  $('#cel-ti').textContent = title;
  $('#cel-ds').textContent = desc;
  $('#celebrate').classList.add('show');
  confetti();
}

function confetti() {
  const chars = ['✦', '✧', '★', '✶', '·'];
  for (let i = 0; i < 26; i++) {
    const s = document.createElement('div');
    s.className = 'spark';
    s.textContent = chars[i % chars.length];
    s.style.color = ['#6d8cff', '#9b7bff', '#3ddc97', '#ffb547'][i % 4];
    s.style.left = (window.innerWidth / 2) + 'px';
    s.style.top = (window.innerHeight / 2 - 40) + 'px';
    s.style.setProperty('--dx', (Math.random() * 480 - 240) + 'px');
    s.style.setProperty('--dy', (Math.random() * 360 - 210) + 'px');
    s.style.animationDelay = (i * 16) + 'ms';
    document.body.appendChild(s);
    setTimeout(() => s.remove(), 1500);
  }
}

function sparkle(ev) {
  const x = ev && ev.clientX ? ev.clientX : window.innerWidth / 2;
  const y = ev && ev.clientY ? ev.clientY : 200;
  const s = document.createElement('div');
  s.className = 'spark';
  s.textContent = '✓';
  s.style.fontSize = '22px';
  s.style.fontWeight = '800';
  s.style.color = '#3ddc97';
  s.style.left = x + 'px';
  s.style.top = y + 'px';
  s.style.setProperty('--dx', '0px');
  s.style.setProperty('--dy', '-70px');
  document.body.appendChild(s);
  setTimeout(() => s.remove(), 1200);
}

/* =========================================================
   畫面
   ========================================================= */

let TAB = 'today';
let calMode = 'week';
let weekStart = null;
let calYM = null;
let calSel = null;
let statRange = 'month';           // week | month | all
let subjFilter = '';               // 科目篩選：空字串＝全部
const draft = { title: '', priority: 'normal', schedType: 'daily', days: [], date: ymd(), subject: '' };
const gdraft = { title: '', target: 20, unit: '本', deadline: '' };

/* 科目（考試複習用）：任務上一個選填的文字標籤，跟課表共用同一套配色 hash，
   同一個名字在「課表」跟「事情」裡顏色會一致，但兩邊資料互不綁定 */
function subjectTag(t) {
  if (!t.subject) return '';
  const col = courseColor(t.subject);
  return `<span class="tag" style="color:${col};border-color:${col}55">📘 ${esc(t.subject)}</span>`;
}
function distinctSubjects() {
  const set = new Set();
  S.tasks.forEach(t => { if (!t.archived && t.subject) set.add(t.subject); });
  return Array.from(set).sort((a, b) => a.localeCompare(b, 'zh-Hant'));
}
function bySubject(list) {
  return subjFilter ? list.filter(t => (t.subject || '') === subjFilter) : list;
}
function subjectFilterBar() {
  const subs = distinctSubjects();
  if (!subs.length) return '';
  return `<div class="chips" style="margin-bottom:12px">
    <button class="chip ${!subjFilter ? 'on' : ''}" data-subjf="">全部科目</button>
    ${subs.map(s => `<button class="chip ${subjFilter === s ? 'on' : ''}" data-subjf="${esc(s)}">📘 ${esc(s)}</button>`).join('')}
  </div>`;
}

function thisWeekStart(d = ymd()) { return addDays(d, -parseYmd(d).getDay()); }

function render() {
  renderHero();
  $$('.tabs button').forEach(b => b.classList.toggle('on', b.dataset.tab === TAB));
  const v = $('#view');
  if (TAB === 'today')    v.innerHTML = viewToday();
  if (TAB === 'calendar') v.innerHTML = viewCalendar();
  if (TAB === 'manage')   v.innerHTML = viewManage();
  if (TAB === 'schedule') v.innerHTML = viewSchedule();
  if (TAB === 'stats')    v.innerHTML = viewStats();
  if (TAB === 'goals')    v.innerHTML = viewGoals();
  if (TAB === 'settings') v.innerHTML = viewSettings();
  wire();
}

function renderHero() {
  const lg = dayLog();
  const list = todaysTasks();
  const doneN = list.filter(t => isTaskDone(t, ymd())).length;
  const pct = list.length ? doneN / list.length : 0;
  const R = 33, C = 2 * Math.PI * R;
  const mustLeft = list.filter(t => prioOf(t) === 'must' && !isTaskDone(t, ymd())).length;
  const odN = overdueTasks().filter(t => !isTaskDone(t, ymd())).length;
  const all = list.length > 0 && doneN === list.length;
  const dt = new Date();

  return void ($('#hero').innerHTML = `
    <div class="hero-top">
      <div class="lvl-ring">
        <svg width="76" height="76" viewBox="0 0 76 76">
          <circle cx="38" cy="38" r="${R}" fill="none" stroke="rgba(255,255,255,.07)" stroke-width="6"/>
          <circle cx="38" cy="38" r="${R}" fill="none" stroke="url(#hg)" stroke-width="6"
            stroke-linecap="round" stroke-dasharray="${C.toFixed(1)}"
            stroke-dashoffset="${(C * (1 - pct)).toFixed(1)}"
            transform="rotate(-90 38 38)" style="transition:stroke-dashoffset .7s cubic-bezier(.3,1,.4,1)"/>
          <defs><linearGradient id="hg" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stop-color="${all ? '#3ddc97' : '#6d8cff'}"/>
            <stop offset="1" stop-color="${all ? '#3ddc97' : '#9b7bff'}"/>
          </linearGradient></defs>
        </svg>
        <div class="lvl-num">${doneN}<em>/${list.length}</em></div>
      </div>
      <div class="hero-id">
        <div class="hero-name">${esc(S.profile.name)}<span class="hero-title">${dt.getMonth() + 1}/${dt.getDate()} 週${WEEK[dt.getDay()]}</span></div>
        <div class="hero-xp">${list.length === 0 ? '今天沒有安排'
          : all ? '今天全部完成了 🏁'
          : mustLeft ? `還有 ${mustLeft} 件「必做」沒完成`
          : `還有 ${list.length - doneN} 件沒做`}${odN ? `　·　<span class="bad">另有 ${odN} 件逾期</span>` : ''}</div>
        <div class="hero-chips">
          <span class="chipx flame">🔥 連續 ${S.streak.current} 天</span>
          <span class="chipx">最佳 ${S.streak.best}</span>
          ${syncReady() ? `<button class="chipx sy sy-${sync.status}" id="hero-sync"
            title="點一下立刻同步">${heroSyncLabel()}</button>` : ''}
        </div>
      </div>
    </div>`);
}

/* ---------- 今日 ---------- */

function taskItem(t, lg, date) {
  const isDone = isTaskDone(t, date || ymd());
  const pk = prioOf(t), p = PRIO[pk];
  const od = overdueDays(t);
  const left = daysUntil(t);
  return `
    <div class="task p-${pk} ${isDone ? 'done' : ''} ${od > 0 && !isDone ? 'overdue' : ''}"
         data-toggle="${t.id}" data-drag="${t.id}" data-dragdate="${date || ymd()}"
         ${date ? `data-tdate="${date}"` : ''}>
      <div class="check">✓</div>
      <div class="t-main">
        <div class="t-name">${esc(t.title)}</div>
        <div class="t-meta">
          ${od > 0 && !isDone ? `<span class="tag od">逾期 ${od} 天</span>` : ''}
          <span class="tag" style="color:${p.color};border-color:${p.color}55">${p.icon} ${p.name}</span>
          ${subjectTag(t)}
          ${left === 0 && t.schedule.type === 'once'
            ? `<span class="tag" style="color:#ffb547;border-color:#ffb54755">📅 就是今天</span>`
            : schedLabel(t)}
          ${isDone && lg.times[t.id] ? `<span class="dim">✓ ${lg.times[t.id]}</span>` : ''}
        </div>
      </div>
      <button class="icobtn del sm" data-del="${t.id}" title="刪除">🗑</button>
    </div>`;
}

function upcomingList() {
  const today = ymd();
  const rows = S.tasks
    .filter(t => !t.archived && t.schedule.type === 'once' && !doneEver(t.id))
    .map(t => ({ t, n: daysBetween(today, t.schedule.date) }))
    .filter(r => r.n > 0 && r.n <= 14)
    .sort((a, b) => a.n - b.n || PRIO[prioOf(a.t)].rank - PRIO[prioOf(b.t)].rank);
  if (!rows.length) return '';
  return `<div class="card upcoming">
    <h2>📌 接下來<span class="sub">14 天內</span></h2>
    ${rows.map(({ t, n }) => {
      const pk = prioOf(t), p = PRIO[pk];
      return `<div class="up p-${pk}">
        <div class="up-n"><b>${n}</b><span>天後</span></div>
        <div class="up-m">
          <div class="up-t">${esc(t.title)}</div>
          <div class="t-meta"><span class="dim">${fmtMD(t.schedule.date)}（週${WEEK[parseYmd(t.schedule.date).getDay()]}）</span>
          <span class="tag" style="color:${p.color};border-color:${p.color}55">${p.icon} ${p.name}</span>${subjectTag(t)}</div>
        </div>
      </div>`;
    }).join('')}
  </div>`;
}

/* 考試倒數：獨立卡片放在今日最上面，考試當天特別強調，盡量不讓你忘記 */
function examCard() {
  const today = ymd();
  const rows = S.tasks
    .filter(t => !t.archived && prioOf(t) === 'exam' && !isTaskDone(t, today))
    .map(t => {
      const date = t.schedule && t.schedule.type === 'once' ? t.schedule.date : null;
      const n = date ? daysBetween(today, date) : null;
      return { t, date, n };
    })
    .filter(r => r.n === null || (r.n >= 0 && r.n <= 30))
    .sort((a, b) => (a.n === null ? 999 : a.n) - (b.n === null ? 999 : b.n));
  if (!rows.length) return '';
  const hasToday = rows.some(r => r.n === 0);
  return `<div class="card exam-card ${hasToday ? 'exam-today' : ''}">
    <h2>📕 考試提醒<span class="hcount bad">${rows.length}</span></h2>
    ${rows.map(({ t, date, n }) => `
      <div class="exam-row ${n === 0 ? 'now' : ''}">
        <div class="exam-n">${n === 0 ? '🚨 今天' : n === null ? '—' : `${n}<span>天後</span>`}</div>
        <div class="exam-m">
          <div class="exam-t">${esc(t.title)}</div>
          ${date ? `<div class="dim">${fmtMD(date)}（週${WEEK[parseYmd(date).getDay()]}）</div>` : ''}
        </div>
      </div>`).join('')}
  </div>`;
}

function overdueCard() {
  const rows = overdueTasks();
  if (!rows.length) return '';
  const today = ymd();
  return `<div class="card overdue-card">
    <h2>⚠️ 逾期未完成<span class="sub">原本排在更早的日子</span>
      <span class="hcount bad">${rows.filter(t => !isTaskDone(t, today)).length}</span></h2>
    <div class="tasklist">
      ${rows.map(t => {
        const pk = prioOf(t), p = PRIO[pk];
        const isDone = isTaskDone(t, today);
        const n = daysBetween(t.schedule.date, today);
        return `<div class="task p-${pk} ${isDone ? 'done' : ''} ${isDone ? '' : 'overdue'}"
                     data-toggle="${t.id}">
          <div class="check">✓</div>
          <div class="t-main">
            <div class="t-name">${esc(t.title)}</div>
            <div class="t-meta">
              <span class="tag od">${n} 天前</span>
              <span class="tag" style="color:${p.color};border-color:${p.color}55">${p.icon} ${p.name}</span>
              <span class="dim">📅 ${fmtMD(t.schedule.date)}（週${WEEK[parseYmd(t.schedule.date).getDay()]}）</span>
            </div>
          </div>
          <button class="icobtn del sm" data-del="${t.id}" title="刪除">🗑</button>
        </div>`;
      }).join('')}
    </div>
    <p class="hint">這些是過去某天排定、但還沒完成的事。它們只會出現在這裡提醒你，
    行事曆上仍然留在原本那一天，不會跑到今天。<b>勾掉之後就會從這裡消失</b>，行事曆上原本那天會變成已完成。</p>
  </div>`;
}

/* 隨手待辦：不算進「當天任務」，獨立一區放在「今日接下來」下面、「當天任務」上面 */
function quickTodoCard(todos, lg, today) {
  if (!todos.length) return '';
  const doneIds = doneIdsOf(todos, today);
  const sorted = sortTasks(todos, doneIds, today);
  return `<div class="card">
    <h2>📝 隨手待辦<span class="hcount">${doneIds.length}<em>/${todos.length}</em></span></h2>
    <div class="tasklist">${sorted.map(t => taskItem(t, lg, today)).join('')}</div>
  </div>`;
}

function viewToday() {
  const today = ymd();
  const lg = dayLog(today);
  const list = todaysTasks(today);
  const todos = list.filter(t => (t.schedule || {}).type === 'todo');
  const mainList = list.filter(t => (t.schedule || {}).type !== 'todo');
  const done = list.filter(t => isTaskDone(t, today));
  const dt = parseYmd(today);
  const sorted = sortTasks(mainList, doneIdsOf(mainList, today), today);
  const filteredSorted = bySubject(sorted);
  const rate = list.length ? done.length / list.length : 0;

  const goalCards = S.goals.filter(g => !g.archived && !goalStats(g).done);

  return `
    ${examCard()}
    ${upcomingList()}
    ${quickTodoCard(todos, lg, today)}
    ${overdueCard()}
    <div class="card">
      <h2>${dt.getMonth() + 1} 月 ${dt.getDate()} 日<span class="sub">週${WEEK[dt.getDay()]}</span>
        <span class="hcount">${done.length}<em>/${list.length}</em></span></h2>
      <div class="topbar"><i style="width:${(rate * 100).toFixed(0)}%"></i></div>
      ${mainList.length === 0
        ? `<div class="empty"><span class="big">🌤</span>今天沒有排事情<br><span class="dim">到「行事曆」雙擊某天就能新增</span></div>`
        : `${subjectFilterBar()}
           ${filteredSorted.length
             ? `<div class="tasklist">${filteredSorted.map(t => taskItem(t, lg)).join('')}</div>`
             : `<div class="empty"><span class="big">📘</span>今天「${esc(subjFilter)}」沒有排事情</div>`}`}
    </div>

    ${goalCards.length ? `<div class="card">
      <h2>🎯 長期目標<span class="sub">進行中</span></h2>
      ${goalCards.map(g => goalMini(g)).join('')}
    </div>` : ''}`;
}

function goalMini(g) {
  const st = goalStats(g);
  return `<div class="gmini" data-gotab="1">
    <div class="gm-t">${esc(g.title)}<span>${st.cur}/${g.target} ${esc(g.unit || '')}</span></div>
    <div class="gbar"><i style="width:${(st.pct * 100).toFixed(1)}%"></i>
      ${st.idealNow != null ? `<u style="left:${clamp(st.idealNow / g.target, 0, 1) * 100}%"></u>` : ''}</div>
  </div>`;
}

function schedLabel(t) {
  const sc = t.schedule || { type: 'daily' };
  if (sc.type === 'daily')  return `<span class="dim">🔁 每天</span>`;
  if (sc.type === 'weekly') return `<span class="dim">📆 週${(sc.days || []).slice().sort().map(d => WEEK[d]).join('、')}</span>`;
  if (sc.type === 'once') {
    const n = daysBetween(ymd(), sc.date);
    return `<span class="dim">📅 ${fmtMD(sc.date)}・${n === 0 ? '今天' : n > 0 ? n + ' 天後' : -n + ' 天前'}</span>`;
  }
  return `<span class="dim">📝 待辦</span>`;
}

/* ---------- 行事曆 ---------- */

function viewCalendar() {
  if (!weekStart) weekStart = thisWeekStart();
  return `
    <div class="modebar">
      <button class="mb ${calMode === 'week' ? 'on' : ''}" data-mode="week">週</button>
      <button class="mb ${calMode === 'month' ? 'on' : ''}" data-mode="month">月</button>
    </div>` + (calMode === 'week' ? viewWeek() : viewMonth());
}

function viewWeek() {
  const today = ymd();
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const a = parseYmd(days[0]), b = parseYmd(days[6]);
  const range = `${a.getMonth() + 1}/${a.getDate()} – ${b.getMonth() + 1}/${b.getDate()}`;
  const isNow = weekStart === thisWeekStart();
  let wTotal = 0, wDone = 0;

  const col = (d) => {
    const raw = calendarTasks(d);
    const doneIds = doneIdsOf(raw, d);
    const list = sortTasks(raw, doneIds, d);
    const doneN = doneIds.length;
    if (d <= today) { wTotal += list.length; wDone += doneN; }
    const dt = parseYmd(d);
    const allDone = list.length > 0 && doneN === list.length;

    const chip = (t) => {
      const pk = prioOf(t), p = PRIO[pk];
      const isDone = doneIds.includes(t.id);
      return `<div class="wt ${isDone ? 'done' : ''} p-${pk}"
                   style="border-left-color:${p.color}"
                   data-drag="${t.id}" data-dragdate="${d}"
                   data-wtoggle="${t.id}" data-wdate="${d}"
                   title="${esc(t.title)}">
        <span class="wt-c">${isDone ? '✓' : '○'}</span>
        <span class="wt-n">${esc(t.title)}</span>
        <button class="wt-del" data-del="${t.id}" title="刪除">✕</button>
      </div>`;
    };

    return `<div class="wday ${d === today ? 'today' : ''} ${d < today ? 'past' : ''} ${allDone ? 'ok' : ''}" data-wday="${d}">
      <div class="wd-h">
        <div><span class="wd-w">週${WEEK[dt.getDay()]}</span><span class="wd-d">${dt.getDate()}</span></div>
        <button class="wd-add" data-add="${d}" title="新增">＋</button>
      </div>
      <div class="wd-body">${list.length ? list.map(chip).join('') : `<div class="wd-empty">雙擊新增</div>`}</div>
      ${list.length ? `<div class="wd-f">${doneN}/${list.length}</div>` : ''}
    </div>`;
  };

  return `
    <div class="card">
      <div class="cal-head">
        <button class="icobtn" id="wk-prev">‹</button>
        <div class="cal-title">${range}${isNow ? ' <span class="nowtag">本週</span>' : ''}</div>
        <button class="icobtn" id="wk-next">›</button>
        <button class="btn sm ghost" id="wk-now">本週</button>
      </div>
      <div class="wgrid">${days.map(col).join('')}</div>
      <div class="kpis" style="margin-top:16px">
        <div class="kpi"><div class="v">${wTotal}</div><div class="k">排到今天</div></div>
        <div class="kpi"><div class="v good">${wDone}</div><div class="k">已完成</div></div>
        <div class="kpi"><div class="v bad">${wTotal - wDone}</div><div class="k">還沒做</div></div>
      </div>
      <div class="draghint">🖐 <b>拖曳</b>可以調整順序，或把事情拖到別天<br>
        <span style="opacity:.7">電腦：按住直接拖　·　手機：長按一下再拖　·　<b>順序只影響你拖的那一天</b></span></div>
      <p class="hint"><b>雙擊任何一天的空白處</b>（或按 ＋）就能新增那天的事情並設定重要程度。點事項可打勾，過去的日子也能補勾。<br>
        「指定日期」的事拖到別天 = 改日期；「每週」的事拖到別天 = <b>從今天起</b>改成那個星期，過去維持原樣。</p>
    </div>`;
}

function viewMonth() {
  const now = new Date();
  if (!calYM) calYM = { y: now.getFullYear(), m: now.getMonth() };
  const { y, m } = calYM;
  const today = ymd();
  const startPad = new Date(y, m, 1).getDay();
  const dim = new Date(y, m + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < startPad; i++) cells.push(null);
  for (let d = 1; d <= dim; d++) cells.push(ymd(new Date(y, m, d)));
  while (cells.length % 7) cells.push(null);

  let mTotal = 0, mDone = 0, mCrit = 0;

  const cell = (d) => {
    if (!d) return `<div class="cal-c empty"></div>`;
    const list = calendarTasks(d);
    const doneIds = doneIdsOf(list, d);
    const doneN = doneIds.length;
    if (d <= today) { mTotal += list.length; mDone += doneN; }
    const hasExam = list.some(t => prioOf(t) === 'exam' && !doneIds.includes(t.id));
    const hasCrit = list.some(t => prioOf(t) === 'must');
    const hasImp = list.some(t => prioOf(t) === 'important');
    if (hasCrit) mCrit++;
    const dots = list.slice(0, 6).map(t =>
      `<i style="background:${PRIO[prioOf(t)].color}${doneIds.includes(t.id) ? ';opacity:.28' : ''}"></i>`).join('');
    const allDone = list.length > 0 && doneN === list.length;
    return `<div class="cal-c ${d === today ? 'today' : ''} ${d === calSel ? 'sel' : ''} ${allDone ? 'ok' : ''} ${hasExam ? 'has-exam' : ''}" data-cal="${d}">
      <div class="cal-n ${hasExam ? 'exam' : hasCrit ? 'crit' : hasImp ? 'imp' : ''}">${+d.slice(8)}</div>
      <div class="cal-dots">${dots}${list.length > 6 ? `<span class="more">+${list.length - 6}</span>` : ''}</div>
      ${list.length ? `<div class="cal-cnt">${doneN}/${list.length}</div>` : ''}
    </div>`;
  };

  let detail = '';
  if (calSel) {
    const list = sortTasks(calendarTasks(calSel), doneIdsOf(calendarTasks(calSel), calSel), calSel);
    const dt = parseYmd(calSel);
    const lg = S.log[calSel] || { done: [], times: {} };
    detail = `<div class="card">
      <h2>${dt.getMonth() + 1} 月 ${dt.getDate()} 日<span class="sub">週${WEEK[dt.getDay()]}・${list.length} 件</span>
        <button class="btn sm" style="float:right;margin-top:-3px" data-add="${calSel}">＋ 新增</button></h2>
      ${list.length ? `<div class="tasklist">${list.map(t => taskItem(t, lg, calSel)).join('')}</div>`
                    : `<div class="empty">這天沒有安排</div>`}
    </div>`;
  }

  return `
    <div class="card">
      <div class="cal-head">
        <button class="icobtn" id="cal-prev">‹</button>
        <div class="cal-title">${y} 年 ${m + 1} 月</div>
        <button class="icobtn" id="cal-next">›</button>
        <button class="btn sm ghost" id="cal-today">今天</button>
      </div>
      <div class="cal-wk">${WEEK.map(w => `<div>${w}</div>`).join('')}</div>
      <div class="cal-grid">${cells.map(cell).join('')}</div>
      <div class="cal-legend">
        ${PRIO_ORDER.map(k => `<span><i style="background:${PRIO[k].color}"></i>${PRIO[k].name}</span>`).join('')}
      </div>
      <div class="kpis" style="margin-top:14px">
        <div class="kpi"><div class="v">${mTotal}</div><div class="k">排到今天</div></div>
        <div class="kpi"><div class="v good">${mDone}</div><div class="k">已完成</div></div>
        <div class="kpi"><div class="v bad">${mCrit}</div><div class="k">有必做的日子</div></div>
      </div>
      <p class="hint">點任何一天可以看那天的清單並新增。</p>
    </div>
    ${detail}`;
}

/* ---------- 快速新增 ---------- */

let qa = null;

function openQuickAdd(date) {
  qa = { date, title: '', priority: 'normal', repeat: 'once', subject: '' };
  renderModal();
}
function closeModal() {
  qa = null; ge = null; ed = null; cd = null;
  $('#modal').classList.remove('show');
  $('#modal-body').innerHTML = '';
}

function renderModal() {
  if (!qa) return;
  const dt = parseYmd(qa.date);
  const n = daysBetween(ymd(), qa.date);
  const when = n === 0 ? '今天' : n > 0 ? `${n} 天後` : `${-n} 天前`;
  const REP = {
    once:   { t: '只有這天', d: '一次性行程，做完就結束' },
    weekly: { t: `每週${WEEK[dt.getDay()]}`, d: `以後每個週${WEEK[dt.getDay()]}都會自動出現` },
    daily:  { t: '每天', d: '從這天起每天都會自動出現' },
  };
  $('#modal-body').innerHTML = `
    <div class="mhead">
      <div><div class="mh-d">${dt.getMonth() + 1} 月 ${dt.getDate()} 日</div>
           <div class="mh-s">週${WEEK[dt.getDay()]}　·　${when}</div></div>
      <button class="icobtn" id="qa-x">✕</button>
    </div>
    <label class="fld"><span>要做什麼</span>
      <input id="qa-title" placeholder="例如：看牙醫" maxlength="60" value="${esc(qa.title)}"></label>
    <label class="fld"><span>重要程度</span></label>
    <div class="chips" id="qa-prio">
      ${PRIO_ORDER.map(k =>
        `<button class="chip pr-${k} ${qa.priority === k ? 'on' : ''}" data-qp="${k}">${PRIO[k].icon} ${PRIO[k].name}</button>`).join('')}
    </div>
    <p class="hint" style="margin-top:7px">${PRIO[qa.priority].desc}</p>
    <label class="fld" style="margin-top:14px"><span>重複方式</span></label>
    <div class="chips" id="qa-rep">
      ${Object.entries(REP).map(([k, v]) =>
        `<button class="chip ${qa.repeat === k ? 'on' : ''}" data-qr="${k}">${v.t}</button>`).join('')}
    </div>
    <p class="hint" style="margin-top:7px">${REP[qa.repeat].d}</p>
    <label class="fld" style="margin-top:14px"><span>科目（選填）</span>
      <input id="qa-subject" list="subj-list-qa" placeholder="例如：微積分" maxlength="20" value="${esc(qa.subject || '')}"></label>
    <datalist id="subj-list-qa">${distinctSubjects().map(s => `<option value="${esc(s)}">`).join('')}</datalist>
    <div class="row" style="margin-top:22px">
      <button class="btn ghost" id="qa-cancel">取消</button>
      <button class="btn" id="qa-save">加入</button>
    </div>`;
  $('#modal').classList.add('show');
  wireQuickAdd();
  const i = $('#qa-title');
  if (i && i.focus) { i.focus(); if (i.setSelectionRange) i.setSelectionRange(999, 999); }
}

function wireQuickAdd() {
  const keep = () => {
    const i = $('#qa-title'); if (i && typeof i.value === 'string') qa.title = i.value;
    const s = $('#qa-subject'); if (s && typeof s.value === 'string') qa.subject = s.value;
  };
  $$('#qa-prio .chip').forEach(b => b.addEventListener('click', () => { keep(); qa.priority = b.dataset.qp; renderModal(); }));
  $$('#qa-rep .chip').forEach(b  => b.addEventListener('click', () => { keep(); qa.repeat = b.dataset.qr; renderModal(); }));
  $('#qa-x').addEventListener('click', closeModal);
  $('#qa-cancel').addEventListener('click', closeModal);
  $('#qa-save').addEventListener('click', saveQuickAdd);
  $('#qa-title').addEventListener('keydown', e => {
    if (e.key === 'Enter') saveQuickAdd();
    if (e.key === 'Escape') closeModal();
  });
}

function saveQuickAdd() {
  const i = $('#qa-title');
  const title = ((i && i.value) || qa.title || '').trim();
  if (!title) { toast('請先輸入要做什麼'); return; }
  const dt = parseYmd(qa.date);
  const sc = qa.repeat === 'once'   ? { type: 'once', date: qa.date }
           : qa.repeat === 'weekly' ? { type: 'weekly', days: [dt.getDay()] }
           :                          { type: 'daily' };
  // 重複性的事情從被點的那天起算，不會回頭汙染過去的統計
  const born = qa.date > ymd() ? qa.date : ymd();
  const subject = (($('#qa-subject') || {}).value || qa.subject || '').trim();
  S.tasks.push({
    id: uid(), title, priority: qa.priority, order: nextOrder(qa.priority),
    schedule: sc, subject, createdAt: born, archived: false,
  });
  const label = qa.repeat === 'once' ? fmtMD(qa.date)
              : qa.repeat === 'weekly' ? `每週${WEEK[dt.getDay()]}` : '每天';
  const flag = PRIO[qa.priority].icon;
  save(); closeModal(); render();
  toast(`✅ ${flag}${label}：${title}`);
}

/* ---------- 編輯一件事 ---------- */

let ed = null;   // { id, title, priority, type, days, date, subject, mode }

function openTaskEdit(id) {
  const t = S.tasks.find(x => x.id === id);
  if (!t) return;
  const sc = t.schedule || { type: 'daily' };
  ed = {
    id, title: t.title, priority: prioOf(t),
    type: sc.type || 'daily',
    days: (sc.days || []).slice(),
    date: sc.date || ymd(),
    subject: t.subject || '',
    mode: 'from-today',
  };
  renderTaskEdit();
}

function scEqual(a, b) {
  if (!a || !b || a.type !== b.type) return false;
  if (a.type === 'weekly') return (a.days || []).slice().sort().join() === (b.days || []).slice().sort().join();
  if (a.type === 'once') return a.date === b.date;
  return true;
}

function renderTaskEdit() {
  if (!ed) return;
  const t = S.tasks.find(x => x.id === ed.id);
  if (!t) return closeModal();
  const oldSc = t.schedule || { type: 'daily' };
  const newSc = edSchedule();
  const changedRepeat = (ed.type === 'weekly' || ed.type === 'daily') && !scEqual(oldSc, newSc);
  const hist = Array.isArray(t.segs) ? t.segs.length : 0;

  $('#modal-body').innerHTML = `
    <div class="mhead">
      <div><div class="mh-d">編輯</div>
           <div class="mh-s">${hist ? `這件事改過 ${hist - 1} 次排程，過去的紀錄都保留著` : '改排程時可以選擇要不要影響過去'}</div></div>
      <button class="icobtn" id="ed-x">✕</button>
    </div>

    <label class="fld"><span>名稱</span>
      <input id="ed-title" maxlength="60" value="${esc(ed.title)}"></label>

    <label class="fld"><span>重要程度</span></label>
    <div class="chips" id="ed-prio">
      ${PRIO_ORDER.map(k =>
        `<button class="chip pr-${k} ${ed.priority === k ? 'on' : ''}" data-ep="${k}">${PRIO[k].icon} ${PRIO[k].name}</button>`).join('')}
    </div>

    <label class="fld" style="margin-top:16px"><span>排程</span></label>
    <div class="chips" id="ed-type">
      <button class="chip ${ed.type === 'daily' ? 'on' : ''}"  data-et="daily">🔁 每天</button>
      <button class="chip ${ed.type === 'weekly' ? 'on' : ''}" data-et="weekly">📆 每週指定</button>
      <button class="chip ${ed.type === 'once' ? 'on' : ''}"   data-et="once">📅 指定日期</button>
      <button class="chip ${ed.type === 'todo' ? 'on' : ''}"   data-et="todo">📝 待辦</button>
    </div>

    ${ed.type === 'weekly' ? `
      <div class="chips" id="ed-days" style="margin-top:12px">
        ${WEEK.map((w, i) => `<button class="chip day ${ed.days.includes(i) ? 'on' : ''}" data-ed="${i}">${w}</button>`).join('')}
      </div>
      <p class="hint">目前：${ed.days.length ? '每週 ' + ed.days.slice().sort().map(d => WEEK[d]).join('、') : '⚠️ 至少選一天'}</p>` : ''}

    ${ed.type === 'once' ? `
      <label class="fld" style="margin-top:12px"><span>日期</span>
        <input type="date" id="ed-date" value="${ed.date}"></label>` : ''}

    <label class="fld" style="margin-top:14px"><span>科目（選填）</span>
      <input id="ed-subject" list="subj-list-ed" placeholder="例如：微積分" maxlength="20" value="${esc(ed.subject || '')}"></label>
    <datalist id="subj-list-ed">${distinctSubjects().map(s => `<option value="${esc(s)}">`).join('')}</datalist>

    ${changedRepeat ? `
      <div class="edwarn">
        <div class="ew-t">要從什麼時候開始改？</div>
        <div class="chips" id="ed-mode">
          <button class="chip ${ed.mode === 'from-today' ? 'on' : ''}" data-em="from-today">從今天起</button>
          <button class="chip ${ed.mode === 'all' ? 'on' : ''}" data-em="all">連過去一起改</button>
        </div>
        <p class="hint" style="margin-top:8px">${ed.mode === 'from-today'
          ? `✅ <b>${fmtMD(ymd())} 以前</b>維持原本的「${schedText(oldSc)}」，成績不會被改動；<b>從今天起</b>才用新的「${schedText(newSc)}」。`
          : `⚠️ 過去的日子也會重新用「${schedText(newSc)}」計算，成績單的排程次數會跟著變。`}</p>
      </div>` : ''}

    <div class="row" style="margin-top:20px">
      <button class="btn ghost" id="ed-cancel">取消</button>
      <button class="btn" id="ed-save">儲存</button>
    </div>`;

  $('#modal').classList.add('show');
  wireTaskEdit();
}

function edSchedule() {
  if (ed.type === 'weekly') return { type: 'weekly', days: ed.days.slice().sort((a, b) => a - b) };
  if (ed.type === 'once')   return { type: 'once', date: ed.date };
  return { type: ed.type };
}

function schedText(sc) {
  if (!sc) return '—';
  if (sc.type === 'daily')  return '每天';
  if (sc.type === 'weekly') return '每週 ' + (sc.days || []).slice().sort().map(d => WEEK[d]).join('、');
  if (sc.type === 'once')   return sc.date;
  return '待辦';
}

function wireTaskEdit() {
  const keep = () => {
    const i = $('#ed-title'); if (i && typeof i.value === 'string') ed.title = i.value;
    const s = $('#ed-subject'); if (s && typeof s.value === 'string') ed.subject = s.value;
  };
  $$('#ed-prio .chip').forEach(b => b.addEventListener('click', () => { keep(); ed.priority = b.dataset.ep; renderTaskEdit(); }));
  $$('#ed-type .chip').forEach(b => b.addEventListener('click', () => { keep(); ed.type = b.dataset.et; renderTaskEdit(); }));
  $$('#ed-days .chip').forEach(b => b.addEventListener('click', () => {
    keep(); const d = +b.dataset.ed; const i = ed.days.indexOf(d);
    i >= 0 ? ed.days.splice(i, 1) : ed.days.push(d); renderTaskEdit();
  }));
  $$('#ed-mode .chip').forEach(b => b.addEventListener('click', () => { keep(); ed.mode = b.dataset.em; renderTaskEdit(); }));
  if ($('#ed-date')) $('#ed-date').addEventListener('change', e => { keep(); ed.date = e.target.value; renderTaskEdit(); });
  $('#ed-x').addEventListener('click', closeModal);
  $('#ed-cancel').addEventListener('click', closeModal);
  $('#ed-save').addEventListener('click', saveTaskEdit);
}

function saveTaskEdit() {
  const t = S.tasks.find(x => x.id === ed.id);
  if (!t) return closeModal();
  const i = $('#ed-title');
  const title = ((i && i.value) || ed.title || '').trim();
  if (!title) return toast('名稱不能空白');
  if (ed.type === 'weekly' && !ed.days.length) return toast('請至少選一個星期');

  const oldSc = t.schedule || { type: 'daily' };
  const newSc = edSchedule();
  t.title = title;
  t.priority = ed.priority;
  t.subject = (($('#ed-subject') || {}).value || ed.subject || '').trim();

  if (!scEqual(oldSc, newSc)) {
    if ((ed.type === 'weekly' || ed.type === 'daily') && ed.mode === 'from-today') {
      changeScheduleFrom(t, newSc, ymd());
      toast(`✅ 從今天起改成「${schedText(newSc)}」，過去維持原樣`);
    } else {
      changeScheduleAll(t, newSc);
      toast(`✅ 已改成「${schedText(newSc)}」`);
    }
  } else {
    toast('✅ 已儲存');
  }
  save(); closeModal(); render();
}

/* ---------- 任務管理 ---------- */

/* 隨手待辦：事情頁直接勾，勾了就算當天完成 */
function todoRow(t) {
  const pk = prioOf(t);
  return `
    <div class="task p-${pk}" data-toggle="${t.id}" data-tdate="${ymd()}">
      <div class="check">✓</div>
      <div class="t-main"><div class="t-name">${esc(t.title)}</div></div>
      <button class="icobtn del sm" data-del="${t.id}" title="刪除">🗑</button>
    </div>`;
}

function viewManage() {
  const active = S.tasks.filter(t => !t.archived);
  const row = (t) => {
    const pk = prioOf(t), p = PRIO[pk];
    const r = taskReport(t);
    return `<div class="mrow p-${pk}">
      <div class="m-main">
        <div class="m-name">${esc(t.title)}</div>
        <div class="t-meta">
          <span class="tag" style="color:${p.color};border-color:${p.color}55">${p.icon} ${p.name}</span>
          ${subjectTag(t)}
          ${schedLabel(t)}
          ${Array.isArray(t.segs) && t.segs.length > 1 ? `<span class="tag" style="color:#9b7bff;border-color:#9b7bff55">改過 ${t.segs.length - 1} 次</span>` : ''}
          ${r.planned ? `<span class="dim">成績 ${r.done}/${r.planned}</span>` : `<span class="dim">尚未開始</span>`}
        </div>
      </div>
      <button class="icobtn" data-prioup="${t.id}" title="切換重要程度">${p.icon}</button>
      <button class="icobtn" data-edit="${t.id}" title="編輯">✏️</button>
      <button class="icobtn del" data-del="${t.id}" title="刪除">🗑</button>
    </div>`;
  };
  const group = (label, arr) => arr.length
    ? `<div class="mgroup"><div class="mg-lab">${label}<span>${arr.length}</span></div>${sortTasks(arr, []).map(row).join('')}</div>` : '';
  const activeF = bySubject(active);   // 科目篩選只影響下面「我的事情」清單，不影響隨手待辦
  const onceList = activeF.filter(t => t.schedule.type === 'once');
  const byType = {
    '🔁 每天': activeF.filter(t => t.schedule.type === 'daily'),
    '📆 每週': activeF.filter(t => t.schedule.type === 'weekly'),
    '📝 待辦': activeF.filter(t => t.schedule.type === 'todo'),
  };
  const visibleN = activeF.length - onceList.length;
  const pendingTodos = active.filter(t => t.schedule.type === 'todo' && !doneEver(t.id));

  return `
    <div class="card">
      <h2>新增</h2>
      <label class="fld"><span>要做什麼</span>
        <input id="f-title" placeholder="例如：跑步 3 公里" maxlength="60" value="${esc(draft.title)}"></label>

      <label class="fld"><span>重要程度</span></label>
      <div class="chips" id="f-prio">
        ${PRIO_ORDER.map(k =>
          `<button class="chip pr-${k} ${draft.priority === k ? 'on' : ''}" data-prio="${k}">${PRIO[k].icon} ${PRIO[k].name}</button>`).join('')}
      </div>
      <p class="hint" style="margin-top:7px">${PRIO[draft.priority].desc}</p>

      <label class="fld" style="margin-top:14px"><span>排程</span></label>
      <div class="chips" id="f-sched">
        <button class="chip ${draft.schedType === 'daily' ? 'on' : ''}"  data-sch="daily">🔁 每天重複</button>
        <button class="chip ${draft.schedType === 'weekly' ? 'on' : ''}" data-sch="weekly">📆 每週指定</button>
        <button class="chip ${draft.schedType === 'once' ? 'on' : ''}"   data-sch="once">📅 指定日期</button>
        <button class="chip ${draft.schedType === 'todo' ? 'on' : ''}"   data-sch="todo">📝 待辦</button>
      </div>
      ${draft.schedType === 'daily' ? `<p class="hint">設定一次，之後每天自動出現，不用再重設。</p>` : ''}
      ${draft.schedType === 'todo' ? `<p class="hint">會留在「今日」直到你完成為止。</p>` : ''}

      ${draft.schedType === 'weekly' ? `
        <div class="chips" id="f-days" style="margin-top:12px">
          ${WEEK.map((w, i) => `<button class="chip day ${draft.days.includes(i) ? 'on' : ''}" data-day="${i}">${w}</button>`).join('')}
        </div>` : ''}

      ${draft.schedType === 'once' ? `
        <div class="chips" id="f-quick" style="margin-top:12px">
          ${[['明天', 1], ['3 天後', 3], ['1 週後', 7], ['2 週後', 14], ['1 個月後', 30]].map(([n, k]) =>
            `<button class="chip ${draft.date === addDays(ymd(), k) ? 'on' : ''}" data-quick="${k}">${n}</button>`).join('')}
        </div>
        <label class="fld" style="margin-top:12px"><span>日期</span>
          <input type="date" id="f-date" value="${draft.date}"></label>
        <p class="hint">${draft.date >= ymd()
          ? `${draft.date}（週${WEEK[parseYmd(draft.date).getDay()]}）・${daysBetween(ymd(), draft.date) === 0 ? '就是今天' : daysBetween(ymd(), draft.date) + ' 天後'}`
          : '⚠️ 這是過去的日期'}</p>` : ''}

      <label class="fld" style="margin-top:14px"><span>科目（選填）</span>
        <input id="f-subject" list="subj-list-f" placeholder="例如：微積分" maxlength="20" value="${esc(draft.subject || '')}"></label>
      <datalist id="subj-list-f">${distinctSubjects().map(s => `<option value="${esc(s)}">`).join('')}</datalist>
      <p class="hint">考試複習可以填科目，之後在「今日」「我的事情」可以照科目篩選。</p>

      <button class="btn" id="f-add" style="margin-top:4px">加入</button>
    </div>

    <div class="card">
      <h2>📝 隨手待辦<span class="sub">沒有固定時間，但要做</span></h2>
      <label class="fld"><span>例如：還書</span>
        <input id="td-title" placeholder="要做的事" maxlength="60"></label>
      <button class="btn" id="td-add" style="margin-top:8px">加入</button>
      ${pendingTodos.length
        ? `<div class="tasklist" style="margin-top:14px">${pendingTodos.map(t => todoRow(t)).join('')}</div>`
        : `<p class="hint">目前沒有待辦的雜事。打勾後會直接算進當天完成的事項。</p>`}
    </div>

    <div class="card">
      <h2>我的事情<span class="sub">${visibleN} 項</span></h2>
      ${subjectFilterBar()}
      ${visibleN ? Object.entries(byType).map(([k, v]) => group(k, v)).join('')
        : active.length
          ? `<div class="empty"><span class="big">📘</span>「${esc(subjFilter)}」目前沒有排事情</div>`
          : `<div class="empty"><span class="big">📋</span>還沒有任何事情</div>`}
      ${visibleN ? `
        <button class="btn ghost sm" id="m-resort" style="margin-top:6px">依重要程度重新排序</button>
        <p class="hint">✏️ 可以改名稱、重要程度、排程。改「每週幾」的時候可以選 <b>從今天起</b>，過去的紀錄與成績維持原樣。<br>
        圓點可快速切換重要程度。刪除只會停用它，過去的成績會保留。<br>
        清單順序可以在<b>行事曆或今日清單直接拖曳</b>調整。</p>` : ''}
      ${onceList.length ? `
        <details class="mgroup-collapse" style="margin-top:14px">
          <summary class="mg-lab">📅 指定日期的事件<span>${onceList.length}</span></summary>
          <p class="hint" style="margin-top:0">不列在上面的清單，成績還是照算；點開才看得到，方便刪除或修改。</p>
          ${sortTasks(onceList, []).map(row).join('')}
        </details>` : ''}
    </div>`;
}

/* ---------- 課表 ---------- */

function courseAt(day, period) {
  return S.courses.find(c => !c.archived && c.day === day && c.period === period) || null;
}

/* 目前排課裡不重複的課程名稱（給「已經有的課程」快速選單用），
   同一個名稱取第一筆代表地點就好 */
function courseTitleOptions() {
  const map = new Map();
  for (const c of S.courses) {
    if (c.archived || map.has(c.title)) continue;
    map.set(c.title, c);
  }
  return Array.from(map.values());
}

function viewSchedule() {
  const active = S.courses.filter(c => !c.archived);
  const rows = PERIODS.map(p => {
    const cells = SCHOOL_DAYS.map(d => {
      const c = courseAt(d, p);
      if (!c) return `<div class="sc-cell empty" data-scadd="${d}|${p}" title="新增課程">＋</div>`;
      const col = courseColor(c.title);
      return `<div class="sc-cell filled" data-scedit="${c.id}"
                   style="background:${col}26;border-color:${col}88" title="${esc(c.title)}">
        <div class="sc-title" style="color:${col}">${esc(c.title)}</div>
        ${c.location ? `<div class="sc-loc">📍${esc(c.location)}</div>` : ''}
      </div>`;
    }).join('');
    return `<div class="sc-row"><div class="sc-p">${p}</div>${cells}</div>`;
  }).join('');

  return `
    <div class="card">
      <h2>🏫 我的課表<span class="sub">${active.length} 堂課</span></h2>
      <div class="sc-grid">
        <div class="sc-row sc-head"><div class="sc-p"></div>${SCHOOL_DAYS.map(d => `<div class="sc-dh">週${WEEK[d]}</div>`).join('')}</div>
        ${rows}
      </div>
      <p class="hint">📌 節次照陽明交大式排法：1~4 節（早上）、5~8 節（下午）、A~D 節（晚上）。<br>
      點空格新增課程、點已經有課的格子可以編輯或刪除。同一門課只要打一樣的名字，顏色會自動配成同一種，也可以自己在編輯畫面挑顏色。<br>
      一堂課有好幾個節次的話，第一次打完後，編輯畫面裡可以直接「複製到這裡」加其他節次，或是新增時點「已經有的課程」帶入，不用每次重打。</p>
      ${active.length === 0 ? `<div class="empty"><span class="big">🏫</span>還沒有加課，點上面任何一個空格開始</div>` : ''}
    </div>`;
}

let cd = null;   // 課表編輯草稿：{ id, day, period, title, location, color }

function openCourseEdit(day, period, id) {
  if (id) {
    const c = S.courses.find(x => x.id === id);
    if (!c) return;
    cd = { id: c.id, day: c.day, period: c.period, title: c.title, location: c.location || '', color: S.courseColors[c.title] || null };
  } else {
    cd = { id: null, day, period, title: '', location: '', color: null };
  }
  renderCourseEdit();
}

/* 挑色／輸入到一半時，先把畫面上已經打的字存回草稿，重畫才不會被清空 */
function keepCourseDraft() {
  const ti = $('#cd-title'); if (ti) cd.title = ti.value;
  const lo = $('#cd-loc'); if (lo) cd.location = lo.value;
}

function renderCourseEdit() {
  if (!cd) return;
  const activeColor = cd.color || courseColor(cd.title);
  const picks = !cd.id ? courseTitleOptions() : [];
  const emptySlots = [];
  for (const d of SCHOOL_DAYS) for (const p of PERIODS) {
    if (d === cd.day && p === cd.period) continue;
    if (!courseAt(d, p)) emptySlots.push({ d, p });
  }

  $('#modal-body').innerHTML = `
    <div class="mhead">
      <div><div class="mh-d">${cd.id ? '編輯課程' : '新增課程'}</div>
           <div class="mh-s">週${WEEK[cd.day]}・第 ${cd.period} 節</div></div>
      <button class="icobtn" id="cd-x">✕</button>
    </div>
    ${picks.length ? `
    <label class="fld"><span>已經有的課程<span class="dim" style="font-weight:400"> · 點一下直接帶入</span></span></label>
    <div class="chips">
      ${picks.map(c => `<button class="chip" style="border-color:${courseColor(c.title)}88;color:${courseColor(c.title)}"
            data-cdpick="${esc(c.title)}" data-cdpickloc="${esc(c.location || '')}">${esc(c.title)}</button>`).join('')}
    </div>` : ''}
    <label class="fld" style="margin-top:14px"><span>課程名稱</span>
      <input id="cd-title" placeholder="例如：微積分" maxlength="40" value="${esc(cd.title)}"></label>
    <label class="fld" style="margin-top:14px"><span>上課地點</span>
      <input id="cd-loc" placeholder="例如：工程四館 101" maxlength="40" value="${esc(cd.location)}"></label>
    <label class="fld" style="margin-top:14px"><span>顏色<span class="dim" style="font-weight:400"> · 不選就用自動配色</span></span></label>
    <div class="sw-row">
      ${COURSE_PALETTE.map(hex => `<button class="sw ${activeColor === hex ? 'on' : ''}" style="background:${hex}" data-cdcolor="${hex}"></button>`).join('')}
    </div>
    <div class="row" style="margin-top:22px">
      ${cd.id ? `<button class="btn ghost del" id="cd-del">刪除</button>` : `<button class="btn ghost" id="cd-cancel">取消</button>`}
      <button class="btn" id="cd-save">${cd.id ? '儲存' : '加入'}</button>
    </div>
    ${cd.id && emptySlots.length ? `
    <hr class="sep">
    <label class="fld"><span>🔁 這堂課還有別的節次？</span></label>
    <div class="row">
      <select id="cd-dup-slot">
        ${emptySlots.map(({ d, p }) => `<option value="${d}|${p}">週${WEEK[d]}・第 ${p} 節</option>`).join('')}
      </select>
      <button class="btn ghost sm" id="cd-dup-add">複製到這裡</button>
    </div>
    <p class="hint" style="margin-top:6px">選一個空的節次，會直接用一樣的名稱、地點、顏色加一堂，不用重打。</p>` : ''}`;
  $('#modal').classList.add('show');
  wireCourseEdit();
  const i = $('#cd-title');
  if (i && i.focus) i.focus();
}

function wireCourseEdit() {
  $('#cd-x').addEventListener('click', closeModal);
  if ($('#cd-cancel')) $('#cd-cancel').addEventListener('click', closeModal);
  if ($('#cd-del')) $('#cd-del').addEventListener('click', () => {
    if (!confirm('確定刪除這堂課？')) return;
    const c = S.courses.find(x => x.id === cd.id);
    if (c) c.archived = true;
    save(); closeModal(); render();
  });
  $$('[data-cdpick]').forEach(b => b.addEventListener('click', () => {
    cd.title = b.dataset.cdpick;
    cd.location = b.dataset.cdpickloc || '';
    cd.color = S.courseColors[cd.title] || null;
    renderCourseEdit();
  }));
  $$('[data-cdcolor]').forEach(b => b.addEventListener('click', () => {
    keepCourseDraft();
    cd.color = b.dataset.cdcolor;
    renderCourseEdit();
  }));
  if ($('#cd-dup-add')) $('#cd-dup-add').addEventListener('click', () => {
    keepCourseDraft();
    if (!cd.title.trim()) { toast('請先輸入課程名稱'); return; }
    const sel = $('#cd-dup-slot');
    const [d, p] = sel.value.split('|');
    const day = +d, period = p;
    if (courseAt(day, period)) { toast('這個節次已經有課了'); return; }
    S.courses.push({ id: uid(), day, period, title: cd.title.trim(), location: cd.location.trim(), archived: false, createdAt: ymd() });
    if (cd.color) S.courseColors[cd.title.trim()] = cd.color;
    save(); render();
    toast(`✅ 已加到 週${WEEK[day]}・第 ${period} 節`);
    renderCourseEdit();
  });
  $('#cd-save').addEventListener('click', saveCourse);
  $('#cd-title').addEventListener('keydown', e => {
    if (e.key === 'Enter') saveCourse();
    if (e.key === 'Escape') closeModal();
  });
}

function saveCourse() {
  const title = (($('#cd-title') || {}).value || '').trim();
  if (!title) { toast('請先輸入課程名稱'); return; }
  const location = (($('#cd-loc') || {}).value || '').trim();
  if (cd.id) {
    const c = S.courses.find(x => x.id === cd.id);
    if (c) { c.title = title; c.location = location; }
  } else {
    S.courses.push({ id: uid(), day: cd.day, period: cd.period, title, location, archived: false, createdAt: ymd() });
  }
  if (cd.color) S.courseColors[title] = cd.color;
  save(); closeModal(); render();
  toast(`✅ ${title}`);
}

/* ---------- 統計 ---------- */

function rangeStart() {
  if (statRange === 'week') return thisWeekStart();
  if (statRange === 'month') return ymd(new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  return null;
}

function viewStats() {
  const from = rangeStart();
  const rep = overallReport(from);
  const lgToday = dayLog();
  const todayList = todaysTasks();
  const todayLeft = todayList.filter(t => !lgToday.done.includes(t.id)).length;
  const label = statRange === 'week' ? '本週' : statRange === 'month' ? '本月' : '全部';

  return `
    <div class="modebar">
      <button class="mb ${statRange === 'week' ? 'on' : ''}" data-range="week">本週</button>
      <button class="mb ${statRange === 'month' ? 'on' : ''}" data-range="month">本月</button>
      <button class="mb ${statRange === 'all' ? 'on' : ''}" data-range="all">全部</button>
    </div>

    <div class="card">
      <h2>${label}成績<span class="sub">不含今天（今天還沒過完）</span></h2>
      ${rep.planned === 0
        ? `<div class="empty"><span class="big">📊</span>${label}還沒有結算完的資料</div>`
        : `
        <div class="bigrate">
          <div class="br-n">${Math.round(rep.rate * 100)}<em>%</em></div>
          <div class="br-l">完成率</div>
        </div>
        <div class="splitbar">
          <i class="s-done" style="width:${(rep.done / rep.planned * 100).toFixed(1)}%"></i>
          <i class="s-miss" style="width:${(rep.missed / rep.planned * 100).toFixed(1)}%"></i>
        </div>
        <div class="kpis" style="margin-top:16px">
          <div class="kpi"><div class="v">${rep.planned}</div><div class="k">應該做</div></div>
          <div class="kpi"><div class="v good">${rep.done}</div><div class="k">做到了</div></div>
          <div class="kpi"><div class="v bad">${rep.missed}</div><div class="k">漏掉了</div></div>
        </div>`}
      <div class="todaynote">今天還有 <b>${todayLeft}</b> 件沒做（共 ${todayList.length} 件）${
        (() => { const n = overdueTasks().filter(t => !isTaskDone(t, ymd())).length;
                 return n ? `<br><span class="bad">另有 ${n} 件逾期未處理</span>` : ''; })()}</div>
    </div>

    <div class="card">
      <h2>每件事的成績單<span class="sub">完成率低的排前面</span></h2>
      ${rep.rows.length ? rep.rows.map(r => {
        const p = PRIO[prioOf(r.task)];
        const pc = Math.round(r.rate * 100);
        const tone = pc >= 80 ? 'good' : pc >= 50 ? 'warn' : 'bad';
        return `<div class="score">
          <div class="sc-h">
            <span class="sc-n">${p.icon} ${esc(r.task.title)}</span>
            <span class="sc-p ${tone}">${pc}%</span>
          </div>
          <div class="splitbar sm">
            <i class="s-done" style="width:${(r.done / r.planned * 100).toFixed(1)}%"></i>
            <i class="s-miss" style="width:${(r.missed / r.planned * 100).toFixed(1)}%"></i>
          </div>
          <div class="sc-f">排了 ${r.planned} 次　·　<b class="good">做 ${r.done}</b>　·　<b class="bad">漏 ${r.missed}</b></div>
        </div>`;
      }).join('') : `<div class="empty">還沒有資料</div>`}
    </div>

    <div class="card">
      <h2>近 30 天完成率</h2>
      ${lineChart()}
    </div>

    <div class="card">
      <h2>累積<span class="sub">從開始到現在</span></h2>
      <div class="kpis">
        <div class="kpi"><div class="v">${S.stats.totalDone}</div><div class="k">總完成數</div></div>
        <div class="kpi"><div class="v">${S.streak.best}</div><div class="k">最長連續</div></div>
        <div class="kpi"><div class="v">${S.stats.perfectDays}</div><div class="k">全清天數</div></div>
      </div>
    </div>`;
}

function lineChart() {
  const W = 620, H = 158, P = 26;
  const pts = [];
  for (let i = 29; i >= 0; i--) {
    const d = addDays(ymd(), -i);
    const total = dayTasks(d).length;
    const done = ((S.log[d] || {}).done || []).length;
    pts.push({ d, r: total ? clamp(done / total, 0, 1) : null });
  }
  const x = (i) => P + i * (W - P * 2) / 29;
  const y = (r) => H - P - r * (H - P * 2);
  const seg = [];
  let cur = [];
  pts.forEach((p, i) => {
    if (p.r === null) { if (cur.length) seg.push(cur); cur = []; }
    else cur.push(`${x(i).toFixed(1)},${y(p.r).toFixed(1)}`);
  });
  if (cur.length) seg.push(cur);
  const has = seg.some(s => s.length);
  if (!has) return `<div class="empty">還沒有資料</div>`;

  return `<svg viewBox="0 0 ${W} ${H}" class="chart">
    <defs><linearGradient id="lg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#6d8cff" stop-opacity=".34"/>
      <stop offset="1" stop-color="#6d8cff" stop-opacity="0"/>
    </linearGradient></defs>
    ${[0, .5, 1].map(r => `<line x1="${P}" y1="${y(r)}" x2="${W - P}" y2="${y(r)}" stroke="rgba(255,255,255,.06)"/>
      <text x="0" y="${y(r) + 4}" fill="#8d95a8" font-size="10">${r * 100}%</text>`).join('')}
    ${seg.filter(s => s.length > 1).map(s =>
      `<polygon points="${s[0].split(',')[0]},${H - P} ${s.join(' ')} ${s[s.length - 1].split(',')[0]},${H - P}" fill="url(#lg)"/>
       <polyline points="${s.join(' ')}" fill="none" stroke="#6d8cff" stroke-width="2.4" stroke-linejoin="round" stroke-linecap="round"/>`).join('')}
    ${pts.map((p, i) => p.r !== null
      ? `<circle cx="${x(i).toFixed(1)}" cy="${y(p.r).toFixed(1)}" r="${p.r === 1 ? 3.4 : 2.5}"
           fill="${p.r === 1 ? '#3ddc97' : '#9b7bff'}"/>` : '').join('')}
    <text x="${P}" y="${H - 5}" fill="#8d95a8" font-size="10">30 天前</text>
    <text x="${W - P}" y="${H - 5}" fill="#8d95a8" font-size="10" text-anchor="end">今天</text>
  </svg>`;
}

/* ---------- 長期目標 ---------- */

let ge = null;   // 進度輸入視窗

function viewGoals() {
  const live = S.goals.filter(g => !g.archived && !goalStats(g).done);
  const done = S.goals.filter(g => !g.archived && goalStats(g).done);

  return `
    ${live.length ? live.map(goalCard).join('') : ''}
    ${done.length ? `<div class="card"><h2>🏆 已達成<span class="sub">${done.length} 個</span></h2>
      ${done.map(g => `<div class="gdone">
        <div><b>${esc(g.title)}</b><span class="dim">　${g.target}${esc(g.unit || '')}</span></div>
        <button class="icobtn del" data-gdel="${g.id}">🗑</button></div>`).join('')}
    </div>` : ''}

    <div class="card">
      <h2>${S.goals.length ? '再加一個目標' : '設定你的第一個長期目標'}</h2>
      <label class="fld"><span>目標是什麼</span>
        <input id="g-title" placeholder="例如：今年看 20 本書" maxlength="50" value="${esc(gdraft.title)}"></label>
      <div class="row">
        <label class="fld" style="flex:2"><span>總共要幾次</span>
          <input id="g-target" type="number" min="1" max="100000" value="${gdraft.target}"></label>
        <label class="fld" style="flex:1"><span>單位</span>
          <input id="g-unit" placeholder="本" maxlength="6" value="${esc(gdraft.unit)}"></label>
      </div>
      <label class="fld"><span>期限（可不填）</span>
        <input type="date" id="g-deadline" value="${gdraft.deadline}"></label>
      <div class="chips" style="margin-bottom:14px">
        <button class="chip" data-gdl="90">3 個月後</button>
        <button class="chip" data-gdl="180">半年後</button>
        <button class="chip" data-gdl="365">一年後</button>
        <button class="chip" data-gdl="yearend">今年年底</button>
      </div>
      <button class="btn" id="g-add">建立目標</button>
      <p class="hint">建立後，每完成一次就按 ＋1 記一筆（可以順便寫下是哪一本、哪一次），App 會幫你算進度、速度、還差多少。</p>
    </div>`;
}

function goalCard(g) {
  const st = goalStats(g);
  const R = 42, C = 2 * Math.PI * R;
  const recent = (g.entries || []).slice().reverse().slice(0, 6);
  const paceTxt = g.deadline
    ? (st.left === 0 ? '已達成'
      : st.daysLeft < 0 ? `期限已過 ${-st.daysLeft} 天，還差 ${st.left} ${g.unit || ''}`
      : st.daysLeft === 0 ? `期限就是今天，還差 ${st.left} ${g.unit || ''}`
      : `還有 ${st.daysLeft} 天，平均每週要 ${(st.needPerWeek || 0).toFixed(1)} ${g.unit || ''}`)
    : (st.etaDays ? `照目前速度，大約還要 ${st.etaDays} 天` : '記第一筆進度就會開始估算');

  return `<div class="card goal">
    <div class="g-head">
      <div class="g-ring">
        <svg width="104" height="104" viewBox="0 0 104 104">
          <circle cx="52" cy="52" r="${R}" fill="none" stroke="rgba(255,255,255,.07)" stroke-width="8"/>
          <circle cx="52" cy="52" r="${R}" fill="none" stroke="url(#gg)" stroke-width="8" stroke-linecap="round"
            stroke-dasharray="${C.toFixed(1)}" stroke-dashoffset="${(C * (1 - st.pct)).toFixed(1)}"
            transform="rotate(-90 52 52)" style="transition:stroke-dashoffset .8s cubic-bezier(.3,1,.4,1)"/>
          <defs><linearGradient id="gg" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stop-color="#3ddc97"/><stop offset="1" stop-color="#6d8cff"/>
          </linearGradient></defs>
        </svg>
        <div class="g-pct">${Math.round(st.pct * 100)}<em>%</em></div>
      </div>
      <div class="g-info">
        <div class="g-title">${esc(g.title)}</div>
        <div class="g-count">${st.cur}<em> / ${g.target} ${esc(g.unit || '')}</em></div>
        <div class="g-pace ${st.onTrack === false ? 'behind' : st.onTrack === true ? 'ahead' : ''}">
          ${st.onTrack === false ? '⚠️ 進度落後　' : st.onTrack === true ? '✓ 進度超前　' : ''}${paceTxt}
        </div>
      </div>
      <button class="icobtn del" data-gdel="${g.id}" title="刪除">🗑</button>
    </div>

    ${goalChart(g, st)}

    <div class="row" style="margin-top:14px">
      <button class="btn" data-ginc="${g.id}">＋ 記一筆進度</button>
      <button class="btn ghost" style="flex:0 0 90px" data-glog="${g.id}">全部紀錄</button>
    </div>

    ${recent.length ? `<div class="gtimeline">
      ${recent.map(e => `<div class="ge">
        <span class="ge-d">${fmtMD(e.date)}</span>
        <span class="ge-n">+${e.n}</span>
        <span class="ge-t">${e.note ? esc(e.note) : '<span class="dim">（沒有備註）</span>'}</span>
      </div>`).join('')}
      ${g.entries.length > 6 ? `<div class="dim" style="font-size:12px;padding-top:6px">…共 ${g.entries.length} 筆</div>` : ''}
    </div>` : `<p class="hint">還沒有任何紀錄。完成一次就按上面的「＋ 記一筆進度」。</p>`}
  </div>`;
}

/* 累積進度折線（實線＝實際，虛線＝理想速度） */
function goalChart(g, st) {
  const start = g.startDate || g.createdAt;
  const end = g.deadline && g.deadline > ymd() ? g.deadline : ymd();
  const span = Math.max(1, daysBetween(start, end));
  const W = 620, H = 130, P = 8, B = 18;
  const x = (d) => P + clamp(daysBetween(start, d) / span, 0, 1) * (W - P * 2);
  const y = (v) => H - B - clamp(v / g.target, 0, 1) * (H - B - 10);

  const sorted = (g.entries || []).slice().sort((a, b) => a.date.localeCompare(b.date));
  let acc = 0;
  const pts = [`${x(start).toFixed(1)},${y(0).toFixed(1)}`];
  for (const e of sorted) { acc += (+e.n || 0); pts.push(`${x(e.date).toFixed(1)},${y(acc).toFixed(1)}`); }
  if (sorted.length) pts.push(`${x(ymd()).toFixed(1)},${y(acc).toFixed(1)}`);

  const ideal = g.deadline
    ? `<line x1="${x(start).toFixed(1)}" y1="${y(0).toFixed(1)}" x2="${x(g.deadline > ymd() ? g.deadline : ymd()).toFixed(1)}" y2="${y(g.target).toFixed(1)}"
        stroke="#8d95a8" stroke-width="1.6" stroke-dasharray="5 5" opacity=".55"/>` : '';

  return `<svg viewBox="0 0 ${W} ${H}" class="chart gchart">
    <defs><linearGradient id="gl" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#3ddc97" stop-opacity=".28"/>
      <stop offset="1" stop-color="#3ddc97" stop-opacity="0"/>
    </linearGradient></defs>
    <line x1="${P}" y1="${y(g.target).toFixed(1)}" x2="${W - P}" y2="${y(g.target).toFixed(1)}"
      stroke="rgba(255,255,255,.10)" stroke-width="1"/>
    <text x="${W - P}" y="${(y(g.target) - 5).toFixed(1)}" fill="#8d95a8" font-size="10" text-anchor="end">目標 ${g.target}</text>
    ${ideal}
    ${pts.length > 1 ? `
      <polygon points="${x(start).toFixed(1)},${H - B} ${pts.join(' ')} ${pts[pts.length - 1].split(',')[0]},${H - B}" fill="url(#gl)"/>
      <polyline points="${pts.join(' ')}" fill="none" stroke="#3ddc97" stroke-width="2.6"
        stroke-linejoin="round" stroke-linecap="round"/>` : ''}
    ${sorted.map((e, i) => {
      let a = 0; for (let k = 0; k <= i; k++) a += (+sorted[k].n || 0);
      return `<circle cx="${x(e.date).toFixed(1)}" cy="${y(a).toFixed(1)}" r="3" fill="#3ddc97"/>`;
    }).join('')}
    <text x="${P}" y="${H - 4}" fill="#8d95a8" font-size="10">${fmtMD(start)}</text>
    <text x="${W - P}" y="${H - 4}" fill="#8d95a8" font-size="10" text-anchor="end">${g.deadline ? fmtMD(g.deadline) : '現在'}</text>
  </svg>`;
}

function openGoalEntry(goalId) {
  const g = S.goals.find(x => x.id === goalId);
  if (!g) return;
  ge = { goalId, n: 1, note: '' };
  const st = goalStats(g);
  $('#modal-body').innerHTML = `
    <div class="mhead">
      <div><div class="mh-d">${esc(g.title)}</div>
           <div class="mh-s">目前 ${st.cur} / ${g.target} ${esc(g.unit || '')}　·　還差 ${st.left}</div></div>
      <button class="icobtn" id="ge-x">✕</button>
    </div>
    <label class="fld"><span>這次完成了幾${esc(g.unit || '次')}</span>
      <input id="ge-n" type="number" min="1" max="10000" value="1"></label>
    <label class="fld"><span>備註（之後回頭看會很有感）</span>
      <input id="ge-note" placeholder="例如：第 3 本《被討厭的勇氣》" maxlength="60"></label>
    <div class="row" style="margin-top:20px">
      <button class="btn ghost" id="ge-cancel">取消</button>
      <button class="btn" id="ge-save">記下來</button>
    </div>`;
  $('#modal').classList.add('show');
  $('#ge-x').addEventListener('click', closeModal);
  $('#ge-cancel').addEventListener('click', closeModal);
  $('#ge-save').addEventListener('click', () => {
    const n = Math.max(1, parseInt($('#ge-n').value, 10) || 1);
    const note = $('#ge-note').value;
    const id = ge.goalId;
    closeModal();
    addGoalEntry(id, n, note);
  });
  const el = $('#ge-note'); if (el && el.focus) el.focus();
}

function openGoalLog(goalId) {
  const g = S.goals.find(x => x.id === goalId);
  if (!g) return;
  ge = { goalId };
  const rows = (g.entries || []).slice().reverse();
  $('#modal-body').innerHTML = `
    <div class="mhead">
      <div><div class="mh-d">${esc(g.title)}</div>
           <div class="mh-s">共 ${rows.length} 筆紀錄</div></div>
      <button class="icobtn" id="gl-x">✕</button>
    </div>
    <div class="gtimeline full">
      ${rows.length ? rows.map(e => `<div class="ge">
        <span class="ge-d">${e.date}</span>
        <span class="ge-n">+${e.n}</span>
        <span class="ge-t">${e.note ? esc(e.note) : '<span class="dim">（沒有備註）</span>'}</span>
        <button class="icobtn del sm" data-gedel="${e.id}">✕</button>
      </div>`).join('') : `<div class="empty">還沒有紀錄</div>`}
    </div>
    <button class="btn ghost" id="gl-close" style="margin-top:18px">關閉</button>`;
  $('#modal').classList.add('show');
  $('#gl-x').addEventListener('click', closeModal);
  $('#gl-close').addEventListener('click', closeModal);
  $$('[data-gedel]').forEach(b => b.addEventListener('click', () => {
    g.entries = g.entries.filter(e => e.id !== b.dataset.gedel);
    save(); openGoalLog(goalId); render();
  }));
}

/* ---------- 建表語法（貼到 Supabase） ---------- */

function openSqlHelp() {
  const sql = syncSql();
  ge = { text: true };
  $('#modal-body').innerHTML = `
    <div class="mhead">
      <div><div class="mh-d">建立資料表</div>
           <div class="mh-s">每個 Supabase 專案只要做一次</div></div>
      <button class="icobtn" id="sq-x">✕</button>
    </div>
    <p class="hint" style="margin-top:0">
      1. 打開 supabase.com → 你的專案<br>
      2. 左邊選單找 <b>SQL Editor</b>（終端機圖示 <code>&gt;_</code>）→ <b>New query</b><br>
      3. 把下面整段貼進去 → 按右上角綠色的 <b>Run</b><br>
      4. 看到 <b>Success</b> 就完成了，回來按「連線」
    </p>
    <textarea id="sq-area" readonly spellcheck="false"
      style="height:190px;font-family:monospace;font-size:11.5px;line-height:1.5;resize:none">${esc(sql)}</textarea>
    <button class="btn" id="sq-copy" style="margin-top:12px">📋 複製語法</button>
    <p class="hint">這段的意思：建一張表存你的資料，用「同步代碼」當鑰匙。
    另外兩個 App（Kotoba、Echo）用的是各自不同的表，彼此不會衝突。</p>`;
  $('#modal').classList.add('show');
  $('#sq-x').addEventListener('click', closeModal);
  $('#sq-copy').addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(sql); toast('✅ 已複製，去 Supabase 貼上'); }
    catch (e) {
      const a = $('#sq-area');
      try { a.removeAttribute('readonly'); a.focus(); a.setSelectionRange(0, a.value.length);
            document.execCommand('copy'); a.setAttribute('readonly', 'readonly'); toast('✅ 已複製'); }
      catch (e2) { toast('請手動選取框內文字複製'); }
    }
  });
}

/* ---------- 文字備份（iPhone 最可靠） ---------- */

function openTextBackup() {
  const txt = JSON.stringify(S);
  const n = (S.tasks || []).filter(t => !t.archived).length;
  const d = Object.keys(S.log || {}).length;
  const g = (S.goals || []).length;
  ge = { text: true };
  $('#modal-body').innerHTML = `
    <div class="mhead">
      <div><div class="mh-d">備份文字</div>
           <div class="mh-s">${n} 件事・${d} 天紀錄・${g} 個目標</div></div>
      <button class="icobtn" id="tb-x">✕</button>
    </div>
    <textarea id="tb-area" readonly spellcheck="false"
      style="height:150px;font-family:monospace;font-size:11px;line-height:1.4;resize:none">${esc(txt)}</textarea>
    <button class="btn" id="tb-copy" style="margin-top:12px">📋 複製全部</button>
    <p class="hint">複製之後貼到「備忘錄」或用 LINE 傳給自己，就是一份完整備份。<br>
    要還原的時候，在另一台裝置用「📥 從文字還原」貼回去即可。<br><br>
    複製鈕沒反應的話：點一下上面的框，全選（長按 → 全選）再複製。</p>`;
  $('#modal').classList.add('show');
  $('#tb-x').addEventListener('click', closeModal);
  $('#tb-copy').addEventListener('click', async () => {
    const area = $('#tb-area');
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(txt);
      } else { throw new Error('no clipboard'); }
      toast('✅ 已複製，快去貼到備忘錄');
    } catch (e) {
      try {
        area.removeAttribute('readonly');
        area.focus(); area.setSelectionRange(0, area.value.length);
        document.execCommand('copy');
        area.setAttribute('readonly', 'readonly');
        toast('✅ 已複製');
      } catch (e2) { toast('複製失敗，請手動長按框內文字 → 全選 → 拷貝'); }
    }
  });
}

function openTextRestore() {
  ge = { text: true };
  $('#modal-body').innerHTML = `
    <div class="mhead">
      <div><div class="mh-d">從文字還原</div>
           <div class="mh-s">把備份文字整段貼進來</div></div>
      <button class="icobtn" id="tr-x">✕</button>
    </div>
    <textarea id="tr-area" placeholder='{"version":3,"profile":...' spellcheck="false"
      style="height:150px;font-family:monospace;font-size:11px;line-height:1.4;resize:none"></textarea>
    <div class="row" style="margin-top:14px">
      <button class="btn ghost" id="tr-cancel">取消</button>
      <button class="btn" id="tr-ok">還原</button>
    </div>
    <p class="hint">⚠️ 還原會覆蓋這台裝置目前的所有資料。<br>
    如果已經開了雲端同步，還原完會自動上傳到雲端。</p>`;
  $('#modal').classList.add('show');
  $('#tr-x').addEventListener('click', closeModal);
  $('#tr-cancel').addEventListener('click', closeModal);
  $('#tr-ok').addEventListener('click', () => {
    const raw = ($('#tr-area').value || '').trim();
    if (!raw) return toast('請先貼上備份文字');
    let o;
    try { o = JSON.parse(raw); } catch (e) { return toast('❌ 文字格式不對，請確認整段都有複製到'); }
    if (!o || !o.profile || !Array.isArray(o.tasks)) return toast('❌ 這不是每日任務的備份檔');
    const n = o.tasks.filter(t => !t.archived).length;
    const d = Object.keys(o.log || {}).length;
    if (!confirm(`要用這份資料覆蓋嗎？\n\n${n} 件事、${d} 天紀錄\n\n這台目前的資料會被取代。`)) return;
    closeModal();
    S = migrate(o);
    S.updatedAt = new Date().toISOString();
    save();
    render();
    toast(`✅ 已還原 ${n} 件事、${d} 天紀錄`);
  });
}

/* ---------- 設定 ---------- */

function viewSettings() {
  return `
    <div class="card">
      <h2>個人資料</h2>
      <label class="fld"><span>你的名字</span>
        <input id="s-name" value="${esc(S.profile.name)}" maxlength="16"></label>
      <button class="btn ghost" id="s-savename">儲存</button>
    </div>
    <div class="card">
      <h2>每日提醒</h2>
      <div class="timelist" id="s-times">
        ${S.settings.reminders.map(t => `<span class="tchip">${t}<button data-rmt="${t}">✕</button></span>`).join('')
          || '<span class="dim">尚未設定</span>'}
      </div>
      <div class="row" style="margin-top:13px">
        <input type="time" id="s-newtime" value="21:00" style="flex:1">
        <button class="btn sm" id="s-addtime" style="flex:0 0 auto">新增</button>
      </div>
      <button class="btn ghost" id="s-notify" style="margin-top:11px">🔔 開啟系統通知</button>
      <p class="hint">用檔案直接開啟時瀏覽器會擋掉系統通知，這時 App 會改用畫面上方的橫幅（需要視窗開著）。</p>
    </div>
    <div class="card">
      <h2>☁️ 雲端同步<span class="sub">電腦與手機共用同一份資料</span></h2>
      <div id="sync-line" class="syncline">${syncStatusHtml()}</div>

      ${!syncReady() ? `
        <p class="hint" style="margin-top:0">
          不需要帳號密碼。填好專案資料、產生一組<b>同步代碼</b>，另一台裝置填同一組就會同步。
        </p>
        <label class="fld" style="margin-top:14px"><span>Project URL</span>
          <input id="sy-url" value="${esc(sync.url)}" placeholder="https://xxxxxxxx.supabase.co" spellcheck="false"></label>
        <label class="fld"><span>anon public key</span>
          <input id="sy-key" value="${esc(sync.key)}" placeholder="eyJhbGciOi..." spellcheck="false"></label>

        <button class="btn ghost sm" id="sy-sql" style="width:100%;margin-bottom:14px">📋 顯示要貼到 Supabase 的建表語法</button>

        <label class="fld"><span>同步代碼<span style="font-weight:600"> — 兩台裝置要填一模一樣</span></span>
          <input id="sy-code" value="${esc(sync.code)}" placeholder="DQ-XXXX-XXXX-XXXX" spellcheck="false"
                 style="font-family:monospace;letter-spacing:.5px"></label>
        <div class="row" style="margin-bottom:14px">
          <button class="btn ghost sm" style="width:100%" id="sy-gen">🎲 產生新代碼</button>
          <button class="btn ghost sm" style="width:100%" id="sy-paste">📥 我已經有代碼了</button>
        </div>
        <button class="btn" id="sy-connect">連線</button>
        ${syncConfigured() ? `<button class="btn danger sm" id="sy-forget" style="margin-top:12px;width:auto">清除設定</button>` : ''}
      ` : `
        <div class="codebox">
          <div class="cb-lab">你的同步代碼</div>
          <div class="cb-code" id="sy-showcode">${esc(sync.code)}</div>
          <button class="btn ghost sm" id="sy-copycode" style="margin-top:10px">📋 複製代碼</button>
        </div>
        <p class="hint">另一台裝置：設定 → 雲端同步 → 填一樣的 Project URL、anon key 和<b>這組代碼</b> → 連線。</p>
        <div class="row" style="margin-top:10px">
          <button class="btn" id="sy-now">🔄 立即同步</button>
          <button class="btn ghost" style="flex:0 0 90px" id="sy-out">停用</button>
        </div>
        <p class="hint">兩邊的變更會<b>自動合併</b>：電腦新增的任務、手機勾掉的紀錄都會保留，不會互相覆蓋。</p>
        <hr class="sep">
        <div class="ew-t" style="font-size:13px">兩邊真的對不起來的時候</div>
        <div class="row" style="margin-top:10px">
          <button class="btn ghost sm" style="width:100%" id="sy-force-local">⬆ 以這台為準<br><span class="dim" style="font-weight:600">覆蓋雲端</span></button>
          <button class="btn ghost sm" style="width:100%" id="sy-force-remote">⬇ 以雲端為準<br><span class="dim" style="font-weight:600">覆蓋這台</span></button>
        </div>
        <p class="hint">⚠️ 這兩個是「整份覆蓋」，被蓋掉的那一份會先自動存成快照，可以在下面的 🕘 自動快照 救回來。<br>
        🔒 代碼就是鑰匙，不要貼到公開的地方。</p>
      `}
    </div>

    ${(() => {
      const snaps = listSnapshots();
      if (!snaps.length) return '';
      return `<div class="card">
        <h2>🕘 自動快照<span class="sub">被雲端覆蓋前會自動留一份</span></h2>
        ${snaps.map((s, i) => {
          const d = new Date(s.at);
          const p = (n) => String(n).padStart(2, '0');
          const n = (s.data.tasks || []).filter(t => !t.archived).length;
          const g = (s.data.goals || []).length;
          const dd = Object.keys(s.data.log || {}).length;
          return `<div class="mrow">
            <div class="m-main">
              <div class="m-name">${d.getMonth() + 1}/${d.getDate()} ${p(d.getHours())}:${p(d.getMinutes())}</div>
              <div class="t-meta"><span class="dim">${esc(s.reason)}</span>
                <span class="dim">${n} 件事・${dd} 天紀錄・${g} 個目標</span></div>
            </div>
            <button class="btn sm ghost" data-snap="${i}">還原</button>
          </div>`;
        }).join('')}
        <p class="hint">如果哪次同步之後發現東西不見了，從這裡挑一個時間點還原回來，還原後會自動蓋回雲端。</p>
      </div>`;
    })()}

    <div class="card">
      <h2>備份與還原</h2>
      <div class="row">
        <button class="btn ghost" id="s-export">⬇ 匯出檔案</button>
        <button class="btn ghost" id="s-import">⬆ 匯入檔案</button>
      </div>
      <div class="row" style="margin-top:9px">
        <button class="btn ghost" id="s-copy">📋 複製成文字</button>
        <button class="btn ghost" id="s-paste">📥 從文字還原</button>
      </div>
      <input type="file" id="s-file" accept="application/json,.json,text/plain" style="display:none">
      <p class="hint"><b>手機建議用「複製成文字」</b>——iPhone 下載檔案常常失敗，複製文字最保險（可以貼到備忘錄、LINE 傳給自己）。<br>
      資料存在這台裝置的瀏覽器裡，清除瀏覽器資料會一併清掉紀錄。</p>
    </div>
    <div class="card">
      <h2>其他</h2>
      <button class="btn ghost" id="s-demo" style="margin-bottom:10px">載入 3 個範例任務</button>
      <button class="btn danger" id="s-reset">清除所有資料</button>
      <p class="hint" style="text-align:center;margin-top:14px">
        版本 ${typeof APPVER !== 'undefined' ? esc(APPVER) : '本機檔案'}
        ${typeof location !== 'undefined' && location.host ? `　·　${esc(location.host)}` : ''}
      </p>
    </div>`;
}

/* =========================================================
   拖曳（滑鼠與觸控通用）
   ·同一天內上下拖 → 調整順序
   ·拖到別天       → 改到那天
   ========================================================= */

let drag = null;

function initDrag() {
  if (typeof document === 'undefined' || initDrag._done) return;
  initDrag._done = true;
  document.addEventListener('pointerdown', onDragDown, { passive: false });
  document.addEventListener('pointermove', onDragMove, { passive: false });
  document.addEventListener('pointerup', onDragUp);
  document.addEventListener('pointercancel', onDragCancel);
}

function onDragDown(e) {
  if (e.button !== undefined && e.button !== 0) return;
  const el = e.target.closest && e.target.closest('[data-drag]');
  if (!el) return;
  const touch = e.pointerType === 'touch' || e.pointerType === 'pen';
  drag = {
    id: el.dataset.drag,
    from: el.dataset.dragdate || ymd(),
    el, startX: e.clientX, startY: e.clientY,
    active: false, ghost: null, lastDay: null, touch,
    timer: touch ? setTimeout(() => beginDrag(e), 320) : null,
  };
}

function beginDrag(e) {
  if (!drag || drag.active) return;
  const t = S.tasks.find(x => x.id === drag.id);
  if (!t) { drag = null; return; }
  drag.active = true;
  drag.el.classList.add('dragging');
  document.body.classList.add('dragging-now');

  const g = document.createElement('div');
  g.className = 'drag-ghost';
  const p = PRIO[prioOf(t)];
  g.innerHTML = `<span style="color:${p.color}">${p.icon}</span> ${esc(t.title)}`;
  document.body.appendChild(g);
  drag.ghost = g;
  moveGhost(drag.startX, drag.startY);
  if (navigator.vibrate) { try { navigator.vibrate(12); } catch (err) {} }
}

function moveGhost(x, y) {
  if (!drag || !drag.ghost) return;
  drag.ghost.style.left = x + 'px';
  drag.ghost.style.top = y + 'px';
}

function onDragMove(e) {
  if (!drag) return;
  const dx = Math.abs(e.clientX - drag.startX), dy = Math.abs(e.clientY - drag.startY);

  if (!drag.active) {
    if (drag.touch) {
      if (dx > 12 || dy > 12) { clearTimeout(drag.timer); drag = null; }   // 手指是在捲動
      return;
    }
    if (dx > 5 || dy > 5) beginDrag(e); else return;
  }

  e.preventDefault();
  moveGhost(e.clientX, e.clientY);

  const under = document.elementFromPoint(e.clientX, e.clientY);
  $$('.wday.drop-on, .tasklist.drop-on').forEach(n => n.classList.remove('drop-on'));
  $$('.drop-before').forEach(n => n.classList.remove('drop-before'));
  if (!under) return;

  const dayEl = under.closest('[data-wday]');
  if (dayEl) {
    dayEl.classList.add('drop-on');
    drag.lastDay = dayEl.dataset.wday;
  } else {
    const listEl = under.closest('.tasklist');
    if (listEl) { listEl.classList.add('drop-on'); drag.lastDay = drag.from; }
    else drag.lastDay = null;
  }

  const overItem = under.closest('[data-drag]');
  drag.overId = null;
  if (overItem && overItem.dataset.drag !== drag.id) {
    const r = overItem.getBoundingClientRect();
    const before = e.clientY < r.top + r.height / 2;
    overItem.classList.add('drop-before');
    drag.overId = overItem.dataset.drag;
    drag.overBefore = before;
  }
}

function onDragCancel() {
  if (!drag) return;
  clearTimeout(drag.timer);
  if (drag.ghost) drag.ghost.remove();
  if (drag.el) drag.el.classList.remove('dragging');
  document.body.classList.remove('dragging-now');
  $$('.drop-on').forEach(n => n.classList.remove('drop-on'));
  $$('.drop-before').forEach(n => n.classList.remove('drop-before'));
  drag = null;
}

function onDragUp(e) {
  if (!drag) return;
  const d = drag;
  const wasActive = d.active;
  onDragCancel();
  if (!wasActive) return;          // 只是點一下，交給 click 處理
  lastDragEnd = Date.now();
  e.preventDefault();

  const t = S.tasks.find(x => x.id === d.id);
  if (!t) return;

  // 1) 換天
  if (d.lastDay && d.lastDay !== d.from) {
    if (moveTaskToDay(t, d.from, d.lastDay)) { save(); render(); }
    return;
  }
  // 2) 同一天內調整順序
  if (d.overId) {
    const list = sortTasks(dayTasks(d.from), doneIdsOf(dayTasks(d.from), d.from), d.from);
    const fromIdx = list.findIndex(x => x.id === d.id);
    let toIdx = list.findIndex(x => x.id === d.overId);
    if (fromIdx < 0 || toIdx < 0) return;
    if (!d.overBefore && toIdx < fromIdx) toIdx++;
    if (d.overBefore && toIdx > fromIdx) toIdx--;
    if (reorderWithin(list, fromIdx, toIdx, d.from)) { save(); render(); }
  }
}

/* 把一件事從 from 那天搬到 to 那天 */
function moveTaskToDay(t, from, to) {
  const sc = t.schedule || { type: 'daily' };
  const today = ymd();

  if (sc.type === 'once') {
    if (sc.date === to) return false;
    t.schedule = { type: 'once', date: to };
    delete t.segs;
    toast(`📅 已改到 ${fmtMD(to)}（週${WEEK[parseYmd(to).getDay()]}）`);
    return true;
  }

  if (sc.type === 'weekly') {
    const fromW = parseYmd(from).getDay(), toW = parseYmd(to).getDay();
    if (fromW === toW) return false;
    const days = (scheduleAt(t, from).days || []).slice();
    const i = days.indexOf(fromW);
    if (i < 0) return false;
    if (days.includes(toW)) days.splice(i, 1);
    else days[i] = toW;
    const newSc = { type: 'weekly', days: days.sort((a, b) => a - b) };
    changeScheduleFrom(t, newSc, today);
    toast(`📆 從今天起改成每週 ${newSc.days.map(d => WEEK[d]).join('、')}（過去維持原樣）`);
    return true;
  }

  if (sc.type === 'todo') {
    t.schedule = { type: 'once', date: to };
    toast(`📅 已排到 ${fmtMD(to)}`);
    return true;
  }

  toast('「每天重複」的事情每天都會出現，不用搬。想改排程請按 ✏️ 編輯');
  return false;
}

/* =========================================================
   事件
   ========================================================= */

/* 剛剛拖曳完的那一下不要被當成點擊 */
let lastDragEnd = 0;
function justDragged() { return Date.now() - lastDragEnd < 350; }

function wire() {
  // 今日／月檢視明細：勾選
  $$('[data-toggle]').forEach(el => el.addEventListener('click', (e) => {
    if (justDragged()) return;
    toggleTask(el.dataset.toggle, e, el.dataset.tdate);
  }));

  // 首頁的目標小卡 → 跳到目標分頁
  $$('[data-gotab]').forEach(el => el.addEventListener('click', () => { TAB = 'goals'; render(); }));

  // 主畫面同步標籤 → 立刻同步
  if ($('#hero-sync')) $('#hero-sync').addEventListener('click', async () => {
    if (!syncReady()) return;
    flushPush();
    await pullNow();
    toast('☁️ 已同步');
  });

  // 行事曆
  $$('.modebar [data-mode]').forEach(b => b.addEventListener('click', () => { calMode = b.dataset.mode; calSel = null; render(); }));
  if ($('#wk-prev')) $('#wk-prev').addEventListener('click', () => { weekStart = addDays(weekStart, -7); render(); });
  if ($('#wk-next')) $('#wk-next').addEventListener('click', () => { weekStart = addDays(weekStart, 7); render(); });
  if ($('#wk-now'))  $('#wk-now').addEventListener('click',  () => { weekStart = thisWeekStart(); render(); });
  $$('[data-wday]').forEach(el => el.addEventListener('dblclick', (e) => {
    if (e.target.closest('[data-wtoggle]')) return;
    openQuickAdd(el.dataset.wday);
  }));
  $$('[data-add]').forEach(b => b.addEventListener('click', (e) => { e.stopPropagation(); openQuickAdd(b.dataset.add); }));
  $$('[data-wtoggle]').forEach(el => el.addEventListener('click', (e) => {
    e.stopPropagation();
    if (justDragged()) return;
    toggleTask(el.dataset.wtoggle, e, el.dataset.wdate);
  }));
  if ($('#cal-prev')) $('#cal-prev').addEventListener('click', () => { calYM.m--; if (calYM.m < 0) { calYM.m = 11; calYM.y--; } calSel = null; render(); });
  if ($('#cal-next')) $('#cal-next').addEventListener('click', () => { calYM.m++; if (calYM.m > 11) { calYM.m = 0; calYM.y++; } calSel = null; render(); });
  if ($('#cal-today')) $('#cal-today').addEventListener('click', () => {
    const n = new Date(); calYM = { y: n.getFullYear(), m: n.getMonth() }; calSel = ymd(); render();
  });
  $$('[data-cal]').forEach(el => el.addEventListener('click', () => {
    calSel = (calSel === el.dataset.cal) ? null : el.dataset.cal; render();
  }));

  // 統計期間
  $$('.modebar [data-range]').forEach(b => b.addEventListener('click', () => { statRange = b.dataset.range; render(); }));

  // 科目篩選（今日／我的事情共用）
  $$('[data-subjf]').forEach(b => b.addEventListener('click', () => { subjFilter = b.dataset.subjf; render(); }));

  // 新增任務表單
  const keep = () => {
    const i = $('#f-title'); if (i && typeof i.value === 'string') draft.title = i.value;
    const s = $('#f-subject'); if (s && typeof s.value === 'string') draft.subject = s.value;
  };
  $$('#f-prio .chip').forEach(b => b.addEventListener('click', () => { keep(); draft.priority = b.dataset.prio; render(); }));
  $$('#f-sched .chip').forEach(b => b.addEventListener('click', () => {
    keep(); draft.schedType = b.dataset.sch;
    if (draft.schedType === 'once' && draft.date < ymd()) draft.date = addDays(ymd(), 1);
    render();
  }));
  $$('#f-days .chip').forEach(b => b.addEventListener('click', () => {
    keep(); const d = +b.dataset.day; const i = draft.days.indexOf(d);
    i >= 0 ? draft.days.splice(i, 1) : draft.days.push(d); render();
  }));
  $$('#f-quick .chip').forEach(b => b.addEventListener('click', () => { keep(); draft.date = addDays(ymd(), +b.dataset.quick); render(); }));
  if ($('#f-date')) $('#f-date').addEventListener('change', e => { keep(); draft.date = e.target.value; render(); });
  if ($('#f-add')) $('#f-add').addEventListener('click', addTask);
  if ($('#f-title')) $('#f-title').addEventListener('keydown', e => { if (e.key === 'Enter') addTask(); });

  // 隨手待辦
  if ($('#td-add')) $('#td-add').addEventListener('click', addQuickTodo);
  if ($('#td-title')) $('#td-title').addEventListener('keydown', e => { if (e.key === 'Enter') addQuickTodo(); });

  $$('[data-prioup]').forEach(b => b.addEventListener('click', () => {
    const t = S.tasks.find(x => x.id === b.dataset.prioup);
    if (!t) return;
    t.priority = PRIO_ORDER[(PRIO_ORDER.indexOf(prioOf(t)) + 1) % PRIO_ORDER.length];
    save(); render(); toast(`「${t.title}」→ ${PRIO[t.priority].name}`);
  }));
  $$('[data-edit]').forEach(b => b.addEventListener('click', () => openTaskEdit(b.dataset.edit)));
  if ($('#m-resort')) $('#m-resort').addEventListener('click', () => {
    resortByPriority(); save(); render(); toast('已依重要程度重新排序');
  });
  $$('[data-del]').forEach(b => b.addEventListener('click', (e) => {
    e.stopPropagation();
    if (!confirm('確定刪除？過去的紀錄與成績會保留。')) return;
    const t = S.tasks.find(x => x.id === b.dataset.del);
    if (t) t.archived = true;
    save(); render();
  }));

  // 課表
  $$('[data-scadd]').forEach(el => el.addEventListener('click', () => {
    const [day, period] = el.dataset.scadd.split('|');
    openCourseEdit(+day, period);
  }));
  $$('[data-scedit]').forEach(el => el.addEventListener('click', () => openCourseEdit(null, null, el.dataset.scedit)));

  // 長期目標
  $$('[data-ginc]').forEach(b => b.addEventListener('click', () => openGoalEntry(b.dataset.ginc)));
  $$('[data-glog]').forEach(b => b.addEventListener('click', () => openGoalLog(b.dataset.glog)));
  $$('[data-gdel]').forEach(b => b.addEventListener('click', () => {
    if (!confirm('確定刪除這個目標？所有進度紀錄會一起刪掉。')) return;
    const g = S.goals.find(x => x.id === b.dataset.gdel);
    if (g) g.archived = true;   // 用封存標記而非真的刪掉，雲端同步時才不會被另一台裝置的舊資料救回來
    save(); render();
  }));
  $$('[data-gdl]').forEach(b => b.addEventListener('click', () => {
    const k = b.dataset.gdl;
    gdraft.title = ($('#g-title') || {}).value || gdraft.title;
    gdraft.target = ($('#g-target') || {}).value || gdraft.target;
    gdraft.unit = ($('#g-unit') || {}).value || gdraft.unit;
    gdraft.deadline = k === 'yearend' ? `${new Date().getFullYear()}-12-31` : addDays(ymd(), +k);
    render();
  }));
  if ($('#g-add')) $('#g-add').addEventListener('click', addGoal);

  // 雲端同步
  if ($('#sy-gen')) $('#sy-gen').addEventListener('click', () => {
    $('#sy-code').value = makeSyncCode();
    toast('已產生代碼，記得抄下來給另一台裝置用');
  });
  if ($('#sy-paste')) $('#sy-paste').addEventListener('click', () => {
    const el = $('#sy-code');
    if (el && el.focus) el.focus();
    toast('把另一台裝置的代碼貼到「同步代碼」欄位');
  });
  if ($('#sy-sql')) $('#sy-sql').addEventListener('click', () => openSqlHelp());
  if ($('#sy-connect')) $('#sy-connect').addEventListener('click', async () => {
    const u = $('#sy-url').value.trim().replace(/\/+$/, '');
    const k = $('#sy-key').value.trim();
    const c = $('#sy-code').value.trim().toUpperCase();
    if (!/^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(u)) return toast('Project URL 應該長得像 https://xxxx.supabase.co');
    if (k.length < 40) return toast('anon key 看起來不完整，請整串複製');
    if (c.length < 8) return toast('請先按「產生新代碼」，或貼上另一台的代碼');

    const prev = { ...sync };
    sync.url = u; sync.key = k; sync.code = c;
    setSyncStatus('syncing');
    const t = await syncSelfTest().catch(() => ({ ok: false, msg: '連不上網路' }));
    if (!t.ok) {
      sync = prev;
      setSyncStatus('error', t.msg);
      toast('❌ ' + t.msg);
      return render();
    }
    saveSync();
    render();
    await firstSync();
    render();
  });
  if ($('#sy-copycode')) $('#sy-copycode').addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(sync.code); toast('✅ 已複製代碼'); }
    catch (e) { toast('請長按上面的代碼手動複製'); }
  });
  if ($('#sy-forget')) $('#sy-forget').addEventListener('click', () => {
    if (!confirm('清除設定？本機資料不會被刪除。')) return;
    sync = { url: '', key: '', code: '', lastAt: null, status: 'off', error: '' };
    saveSync(); render();
  });
  if ($('#sy-now')) $('#sy-now').addEventListener('click', async () => {
    flushPush();
    const okp = await pullNow();
    if (okp) toast('☁️ 已同步');
  });
  if ($('#sy-force-local')) $('#sy-force-local').addEventListener('click', async () => {
    if (!confirm('用「這台」的資料完整覆蓋雲端？\n\n雲端上另一台獨有的東西會消失。\n覆蓋前會先存一份快照。')) return;
    pushSnapshot('覆蓋雲端前');
    await pullNow({ force: 'local' });
    render();
  });
  if ($('#sy-force-remote')) $('#sy-force-remote').addEventListener('click', async () => {
    if (!confirm('用「雲端」的資料完整覆蓋這台？\n\n這台獨有的東西會消失。\n覆蓋前會先存一份快照。')) return;
    await pullNow({ force: 'remote' });
    render();
  });
  if ($('#sy-out')) $('#sy-out').addEventListener('click', () => {
    if (!confirm('停用同步？這台的資料會留著，只是不再自動上傳下載。\n代碼會保留，隨時可以再連線。')) return;
    sync.code = '';
    saveSync(); setSyncStatus('off'); render();
  });

  // 設定
  if ($('#s-savename')) $('#s-savename').addEventListener('click', () => {
    S.profile.name = $('#s-name').value.trim() || '你'; save(); render(); toast('已儲存');
  });
  if ($('#s-addtime')) $('#s-addtime').addEventListener('click', () => {
    const t = $('#s-newtime').value;
    if (t && !S.settings.reminders.includes(t)) {
      S.settings.reminders.push(t); S.settings.reminders.sort();
      save(); scheduleReminders(); render(); toast(`已新增 ${t} 提醒`);
    }
  });
  $$('[data-rmt]').forEach(b => b.addEventListener('click', () => {
    S.settings.reminders = S.settings.reminders.filter(x => x !== b.dataset.rmt);
    save(); scheduleReminders(); render();
  }));
  if ($('#s-notify')) $('#s-notify').addEventListener('click', async () => {
    if (!('Notification' in window)) return toast('這個環境不支援系統通知');
    try {
      const p = await Notification.requestPermission();
      S.settings.notify = (p === 'granted'); save();
      toast(p === 'granted' ? '✅ 通知已開啟' : '通知被拒絕，將改用畫面橫幅');
    } catch { toast('無法開啟通知，將改用畫面橫幅'); }
  });
  if ($('#s-export')) $('#s-export').addEventListener('click', () => {
    const blob = new Blob([JSON.stringify(S, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `每日任務備份_${ymd()}.json`;
    a.click(); URL.revokeObjectURL(a.href);
    toast('已匯出備份');
  });
  $$('[data-snap]').forEach(b => b.addEventListener('click', () => {
    const i = +b.dataset.snap;
    const s = listSnapshots()[i];
    if (!s) return;
    const n = (s.data.tasks || []).filter(t => !t.archived).length;
    if (!confirm(`還原到這個時間點？\n\n${n} 件事、${Object.keys(s.data.log || {}).length} 天紀錄\n\n目前的資料會先自動存成新的快照，不會不見。`)) return;
    if (restoreSnapshot(i)) toast('✅ 已還原，並會蓋回雲端');
  }));

  if ($('#s-copy')) $('#s-copy').addEventListener('click', () => openTextBackup());
  if ($('#s-paste')) $('#s-paste').addEventListener('click', () => openTextRestore());
  if ($('#s-import')) $('#s-import').addEventListener('click', () => $('#s-file').click());
  if ($('#s-file')) $('#s-file').addEventListener('change', (e) => {
    const f = e.target.files[0]; if (!f) return;
    const rd = new FileReader();
    rd.onload = () => {
      try {
        const o = JSON.parse(rd.result);
        if (!o.profile || !Array.isArray(o.tasks)) throw new Error('格式不符');
        if (!confirm('匯入會覆蓋目前所有資料，確定嗎？')) return;
        S = migrate(o); save(); render(); toast('✅ 匯入成功');
      } catch (err) { toast('匯入失敗：檔案格式不正確'); }
    };
    rd.readAsText(f);
  });
  if ($('#s-demo')) $('#s-demo').addEventListener('click', () => {
    STARTER_TASKS.forEach(t => S.tasks.push({ ...t, id: uid(), createdAt: ymd(), archived: false }));
    save(); TAB = 'today'; render(); toast('已載入範例任務');
  });
  if ($('#s-reset')) $('#s-reset').addEventListener('click', () => {
    if (!confirm('這會刪除所有事情、目標與紀錄，無法復原。確定嗎？')) return;
    if (!confirm('再確認一次：真的要全部清除？')) return;
    localStorage.removeItem(KEY); S = blankState(); save(); TAB = 'today'; render();
  });
}

function addTask() {
  const el = $('#f-title'); if (!el) return;
  const title = el.value.trim();
  if (!title) return toast('請輸入名稱');
  const sc = { type: draft.schedType };
  if (draft.schedType === 'weekly') {
    if (!draft.days.length) return toast('請至少選一個星期');
    sc.days = draft.days.slice();
  }
  if (draft.schedType === 'once') sc.date = ($('#f-date') || {}).value || draft.date;
  const subject = (($('#f-subject') || {}).value || draft.subject || '').trim();

  S.tasks.push({
    id: uid(), title, priority: draft.priority, order: nextOrder(draft.priority),
    schedule: sc, subject, createdAt: ymd(), archived: false,
  });
  draft.title = ''; draft.subject = '';
  save(); render();
  const extra = sc.type === 'once'
    ? `（${fmtMD(sc.date)}，${daysBetween(ymd(), sc.date) === 0 ? '就是今天' : daysBetween(ymd(), sc.date) + ' 天後'}）`
    : sc.type === 'daily' ? '（每天自動出現）' : '';
  toast(`✅ 已新增「${title}」${extra}`);
}

function addQuickTodo() {
  const el = $('#td-title'); if (!el) return;
  const title = el.value.trim();
  if (!title) return toast('請輸入名稱');
  S.tasks.push({
    id: uid(), title, priority: 'normal', order: nextOrder('normal'),
    schedule: { type: 'todo' }, createdAt: ymd(), archived: false,
  });
  save(); render();
  toast(`✅ 已加入「${title}」`);
}

function addGoal() {
  const title = $('#g-title').value.trim();
  const target = Math.max(1, parseInt($('#g-target').value, 10) || 0);
  const unit = $('#g-unit').value.trim();
  const deadline = $('#g-deadline').value || '';
  if (!title) return toast('請輸入目標名稱');
  if (!target) return toast('請輸入目標數量');
  if (deadline && deadline <= ymd()) return toast('期限要設在今天之後');
  S.goals.push({
    id: uid(), title, target, unit, deadline: deadline || null,
    createdAt: ymd(), startDate: ymd(), entries: [], archived: false,
  });
  gdraft.title = ''; gdraft.deadline = '';
  save(); render();
  toast(`🎯 目標「${title}」已建立`);
}

/* =========================================================
   雲端同步（Supabase）
   資料整份上傳／下載，以「最後修改時間」決定誰是最新。
   沒設定的話完全不影響離線使用。
   ========================================================= */

const SYNC_KEY = 'daily_quest_sync';
const SYNC_TABLE = 'daily_sync';

let sync = {
  url: '', key: '',            // Supabase 專案網址與 anon key
  code: '',                    // 同步代碼：兩台裝置填同一組就會同步
  lastAt: null,                // 上次成功同步時間
  status: 'off',               // off | ready | syncing | ok | error | offline
  error: '',
};

/* 產生一組夠長、不會被猜到、也不會看錯字的代碼 */
function makeSyncCode() {
  const AB = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';   // 去掉 I O 0 1，避免看錯
  const pick = (n) => {
    let s = '';
    const buf = (typeof crypto !== 'undefined' && crypto.getRandomValues)
      ? crypto.getRandomValues(new Uint32Array(n)) : null;
    for (let i = 0; i < n; i++) {
      const r = buf ? buf[i] : Math.floor(Math.random() * 4294967296);
      s += AB[r % AB.length];
    }
    return s;
  };
  return `DQ-${pick(4)}-${pick(4)}-${pick(4)}`;
}

function loadSync() {
  try {
    const o = JSON.parse(localStorage.getItem(SYNC_KEY) || 'null');
    if (!o) return;
    // 舊版是用信箱＋密碼登入的，那些欄位不再需要；專案網址與金鑰可以留著繼續用
    sync = {
      url: o.url || '', key: o.key || '', code: o.code || '',
      lastAt: o.lastAt || null, status: 'off', error: '',
    };
  } catch (e) { /* ignore */ }
}
function saveSync() {
  try { localStorage.setItem(SYNC_KEY, JSON.stringify(sync)); } catch (e) { /* ignore */ }
}
function syncConfigured() { return !!(sync.url && sync.key); }
function syncReady() { return !!(sync.url && sync.key && sync.code); }

/* 要貼到 Supabase SQL Editor 的建表語法 */
function syncSql() {
  return `create table if not exists ${SYNC_TABLE} (
  code       text primary key,
  data       jsonb not null,
  updated_at timestamptz not null default now()
);
alter table ${SYNC_TABLE} enable row level security;
drop policy if exists ${SYNC_TABLE}_all on ${SYNC_TABLE};
create policy ${SYNC_TABLE}_all on ${SYNC_TABLE}
  for all using (true) with check (true);`;
}

function setSyncStatus(s, err) {
  sync.status = s; sync.error = err || '';
  const el = typeof document !== 'undefined' ? $('#sync-line') : null;
  if (el) el.innerHTML = syncStatusHtml();
  refreshHeroSync();
}

/* 主畫面上的小標籤 */
function heroSyncLabel() {
  const t = sync.lastAt ? new Date(sync.lastAt) : null;
  const ago = t ? Math.round((Date.now() - t.getTime()) / 1000) : null;
  const when = ago === null ? ''
    : ago < 60 ? '剛剛'
    : ago < 3600 ? Math.floor(ago / 60) + ' 分前'
    : Math.floor(ago / 3600) + ' 小時前';
  if (sync.status === 'syncing') return '☁️ 同步中…';
  if (sync.status === 'offline') return '☁️ 離線';
  if (sync.status === 'error')   return '⚠️ 同步失敗';
  return `☁️ ${when || '已連線'}`;
}

function refreshHeroSync() {
  if (typeof document === 'undefined') return;
  const el = $('#hero-sync');
  if (!el) return;
  el.textContent = heroSyncLabel();
  el.className = 'chipx sy sy-' + sync.status;
}

function syncStatusHtml() {
  const t = sync.lastAt ? new Date(sync.lastAt) : null;
  const when = t ? `${String(t.getHours()).padStart(2, '0')}:${String(t.getMinutes()).padStart(2, '0')}` : '—';
  const map = {
    off:     ['dim',  '未連線'],
    ready:   ['dim',  '準備中'],
    syncing: ['warn', '同步中…'],
    ok:      ['good', `已同步　最後 ${when}`],
    offline: ['warn', `離線，稍後自動重試　最後 ${when}`],
    error:   ['bad',  `同步失敗：${esc(sync.error || '未知錯誤')}`],
  };
  const [cls, txt] = map[sync.status] || map.off;
  return `<span class="${cls}">●</span> ${txt}`;
}

async function sbFetch(path, opts = {}) {
  const base = sync.url.replace(/\/+$/, '');
  return fetch(base + path, {
    ...opts,
    keepalive: !!opts.keepalive,
    headers: {
      'apikey': sync.key,
      'Authorization': 'Bearer ' + sync.key,
      'Content-Type': 'application/json',
      ...(opts.headers || {}),
    },
  });
}

/* 連線測試：確認網址、金鑰、資料表都設定好了 */
async function syncSelfTest() {
  const res = await sbFetch(`/rest/v1/${SYNC_TABLE}?select=code&limit=1`);
  if (res.ok) return { ok: true };
  const t = await res.text().catch(() => '');
  if (res.status === 401) return { ok: false, msg: 'anon key 不對或不完整，請整串重新複製' };
  if (res.status === 404 || /does not exist|relation/i.test(t)) {
    return { ok: false, msg: `找不到資料表 ${SYNC_TABLE}，請先到 Supabase 的 SQL Editor 貼上建表語法` };
  }
  return { ok: false, msg: `連線失敗 ${res.status} ${t.slice(0, 80)}` };
}

async function pushNow(opts = {}) {
  if (!syncReady()) return false;
  pendingPush = false;
  setSyncStatus('syncing');
  try {
    const res = await sbFetch(`/rest/v1/${SYNC_TABLE}`, {
      method: 'POST',
      keepalive: !!opts.keepalive,
      headers: { 'Prefer': 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify({ code: sync.code, data: S, updated_at: S.updatedAt }),
    });
    if (!res.ok) {
      const t = await res.text().catch(() => '');
      pendingPush = true;                       // 失敗 → 留著下次補送
      setSyncStatus('error', `上傳失敗 ${res.status} ${t.slice(0, 90)}`);
      return false;
    }
    sync.lastAt = new Date().toISOString();
    saveSync();
    setSyncStatus('ok');
    return true;
  } catch (e) {
    pendingPush = true;                         // 離線 → 留著下次補送
    setSyncStatus('offline');
    return false;
  }
}

/* ---------------- 合併 ----------------
   以前是「整份覆蓋」，兩邊各改各的時只有一邊活得下來。
   現在改成逐項合併：任務用 id 聯集、目標的進度紀錄用 id 聯集、
   每日勾選以「那一天最後被改動的時間」為準。這樣兩邊的東西都留得住。 */

const clone = (o) => JSON.parse(JSON.stringify(o));

/* 拿來比對「內容有沒有變」，不含版本號與時間戳 */
function contentSig(st) {
  return JSON.stringify({
    tasks: st.tasks, goals: st.goals, log: st.log, dayOrder: st.dayOrder,
    name: st.profile && st.profile.name, settings: st.settings,
    streak: st.streak,
  });
}

/* 完成數與全清天數一律從紀錄重算，避免合併後重複累加 */
function recomputeStats(st) {
  let done = 0, perfect = 0;
  for (const d of Object.keys(st.log || {})) {
    const l = st.log[d] || {};
    done += (l.done || []).length;
    if (l.perfect) perfect++;
  }
  st.stats = st.stats || {};
  st.stats.totalDone = done;
  st.stats.perfectDays = perfect;
}

function mergeStates(local, remote) {
  const lRev = +local.rev || 0, rRev = +remote.rev || 0;
  // 版本號大的當主，平手時以本機為主
  const primary = rRev > lRev ? remote : local;
  const secondary = primary === remote ? local : remote;
  const out = clone(primary);

  // 任務：以 id 聯集，兩邊都有的取主要那份（刪除是用 archived 標記，所以不會復活）
  const tMap = new Map();
  for (const t of (secondary.tasks || [])) tMap.set(t.id, t);
  for (const t of (primary.tasks || [])) {
    const old = tMap.get(t.id);
    const n = clone(t);
    if (old && old.archived && !n.archived) n.archived = true;   // 任一邊刪掉就是刪掉
    tMap.set(t.id, n);
  }
  out.tasks = Array.from(tMap.values());

  // 目標：以 id 聯集；進度紀錄只會新增，所以也用 id 聯集，兩邊記的都留著
  const gMap = new Map();
  for (const g of (secondary.goals || [])) gMap.set(g.id, clone(g));
  for (const g of (primary.goals || [])) {
    const ex = gMap.get(g.id);
    const ng = clone(g);
    if (ex) {
      const eMap = new Map();
      for (const e of (ex.entries || [])) eMap.set(e.id, e);
      for (const e of (ng.entries || [])) eMap.set(e.id, e);
      ng.entries = Array.from(eMap.values())
        .sort((a, b) => (a.date || '').localeCompare(b.date || ''));
      if (ex.archived && !ng.archived) ng.archived = true;   // 任一邊刪掉就是刪掉，跟任務/課表一致
    }
    gMap.set(g.id, ng);
  }
  out.goals = Array.from(gMap.values());

  // 課表：以 id 聯集，刪除一樣用 archived 標記，不會被合併救回來
  const cMap = new Map();
  for (const c of (secondary.courses || [])) cMap.set(c.id, c);
  for (const c of (primary.courses || [])) {
    const old = cMap.get(c.id);
    const n = clone(c);
    if (old && old.archived && !n.archived) n.archived = true;
    cMap.set(c.id, n);
  }
  out.courses = Array.from(cMap.values());

  // 課程顏色：聯集，同一個名稱兩邊都設過的話取主要那份
  out.courseColors = { ...(secondary.courseColors || {}), ...(primary.courseColors || {}) };

  // 每日勾選：一天一天比，取那天比較晚被改動的版本
  const log = {};
  const days = new Set([...Object.keys(local.log || {}), ...Object.keys(remote.log || {})]);
  for (const d of days) {
    const a = (local.log || {})[d], b = (remote.log || {})[d];
    if (!a) { log[d] = clone(b); continue; }
    if (!b) { log[d] = clone(a); continue; }
    const ta = new Date(a.t || 0).getTime(), tb = new Date(b.t || 0).getTime();
    if (ta === tb) log[d] = clone(primary === remote ? b : a);
    else log[d] = clone(ta > tb ? a : b);
  }
  out.log = log;

  // 每天的手動順序：聯集，重複的取主要那份
  out.dayOrder = { ...(secondary.dayOrder || {}), ...(primary.dayOrder || {}) };

  // 連續天數：最佳紀錄取兩邊較大的
  out.streak = clone(primary.streak || {});
  out.streak.best = Math.max(+((local.streak || {}).best) || 0, +((remote.streak || {}).best) || 0);
  out.streak.current = Math.max(+((local.streak || {}).current) || 0, +((remote.streak || {}).current) || 0);

  recomputeStats(out);
  out.rev = Math.max(lRev, rRev) + 1;
  out.updatedAt = new Date().toISOString();
  return out;
}

async function pullNow(opts = {}) {
  if (!syncReady()) return false;

  setSyncStatus('syncing');
  try {
    const res = await sbFetch(`/rest/v1/${SYNC_TABLE}?select=data,updated_at&code=eq.${encodeURIComponent(sync.code)}`);
    if (!res.ok) {
      const t = await res.text().catch(() => '');
      setSyncStatus('error', `下載失敗 ${res.status} ${t.slice(0, 90)}`);
      return false;
    }
    const rows = await res.json();
    if (!rows.length) return pushNow();

    const remote = rows[0];
    const rState = migrate(remote.data || {});

    // 明確指定要哪一邊（設定頁的兩顆覆蓋按鈕）
    if (opts.force === 'remote') {
      adoptRemote(remote);
      sync.lastAt = new Date().toISOString(); saveSync();
      setSyncStatus('ok');
      if (opts.quiet !== true) toast('☁️ 已改用雲端的資料');
      return true;
    }
    if (opts.force === 'local') {
      S.rev = Math.max(+S.rev || 0, +rState.rev || 0) + 1;
      save(false);
      const okp = await pushNow();
      if (okp && opts.quiet !== true) toast('☁️ 已用這台的資料覆蓋雲端');
      return okp;
    }

    const lSig = contentSig(S), rSig = contentSig(rState);

    // 內容完全一樣 → 只要把版本號對齊就好
    if (lSig === rSig) {
      const maxRev = Math.max(+S.rev || 0, +rState.rev || 0);
      if ((+S.rev || 0) !== maxRev) { S.rev = maxRev; save(false); }
      sync.lastAt = new Date().toISOString(); saveSync();
      setSyncStatus('ok');
      return true;
    }

    // 不一樣 → 合併，兩邊的東西都留下來
    const merged = mergeStates(S, rState);
    const mSig = contentSig(merged);

    if (mSig !== lSig) {
      pushSnapshot('雲端合併前');
      S = merged;
      save(false);
      if (typeof document !== 'undefined') render();
      if (opts.quiet !== true) toast('☁️ 已與雲端合併');
    } else {
      S.rev = merged.rev;
      save(false);
    }
    if (mSig !== rSig) await pushNow();
    else { sync.lastAt = new Date().toISOString(); saveSync(); setSyncStatus('ok'); }
    return true;
  } catch (e) {
    setSyncStatus('offline');
    return false;
  }
}

function adoptRemote(remote) {
  // 被雲端覆蓋之前先留一份快照，任何情況都救得回來
  if (!stateIsEmpty(S)) pushSnapshot('採用雲端版本前');
  S = migrate(remote.data || {});
  S.updatedAt = remote.updated_at || new Date().toISOString();
  save(false);
  if (typeof document !== 'undefined') render();
}

let pushTimer = null;
let pendingPush = false;

function schedulePush() {
  pendingPush = true;
  clearTimeout(pushTimer);
  pushTimer = setTimeout(() => { pushNow().catch(() => {}); }, 900);
}

/* 離開／切走前把還沒送出去的那筆立刻送掉。
   keepalive 讓瀏覽器就算頁面關掉也會把請求送完。 */
function flushPush() {
  if (!pendingPush || !syncReady()) return;
  clearTimeout(pushTimer);
  pushNow({ keepalive: true }).catch(() => {});
}

function stateIsEmpty(s) {
  return (!s.tasks || s.tasks.length === 0) && Object.keys(s.log || {}).length === 0
      && (!s.goals || s.goals.length === 0);
}

/* 第一次連線：雲端和本機都有資料時，讓使用者決定留哪一份 */
async function firstSync() {
  if (!syncReady()) return;
  setSyncStatus('syncing');
  try {
    const res = await sbFetch(`/rest/v1/${SYNC_TABLE}?select=data,updated_at&code=eq.${encodeURIComponent(sync.code)}`);
    if (!res.ok) { setSyncStatus('error', `連線失敗 ${res.status}`); return; }
    const rows = await res.json();
    if (!rows.length) { await pushNow(); toast('☁️ 已把這台的資料上傳到雲端'); return; }
    const remote = rows[0];
    if (stateIsEmpty(S)) { adoptRemote(remote); sync.lastAt = new Date().toISOString(); saveSync(); setSyncStatus('ok'); toast('☁️ 已從雲端取回資料'); return; }
    if (stateIsEmpty(migrate(remote.data || {}))) { await pushNow(); toast('☁️ 已把這台的資料上傳到雲端'); return; }
    askWhichWins(remote);
  } catch (e) { setSyncStatus('offline'); }
}

function askWhichWins(remote) {
  const r = migrate(remote.data || {});
  const rt = new Date(remote.updated_at || 0);
  const lt = new Date(S.updatedAt || 0);
  const fmt = (d) => d.getTime() ? `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}` : '未知';
  const sum = (s) => `${(s.tasks || []).filter(t => !t.archived).length} 件事、${Object.keys(s.log || {}).length} 天紀錄、${(s.goals || []).length} 個目標`;
  ge = { pick: true };
  $('#modal-body').innerHTML = `
    <div class="mhead">
      <div><div class="mh-d">兩邊都有資料</div>
           <div class="mh-s">這是第一次連線，請選一份留下來（另一份會被覆蓋）</div></div>
    </div>
    <div class="pickbox">
      <div class="pk-t">☁️ 雲端的資料</div>
      <div class="pk-s">${sum(r)}<br>最後修改：${fmt(rt)}</div>
      <button class="btn ghost" id="pk-remote" style="margin-top:10px">用雲端這份</button>
    </div>
    <div class="pickbox" style="margin-top:11px">
      <div class="pk-t">💻 這台裝置的資料</div>
      <div class="pk-s">${sum(S)}<br>最後修改：${fmt(lt)}</div>
      <button class="btn" id="pk-local" style="margin-top:10px">用這台這份</button>
    </div>
    <p class="hint">選錯也不用怕：兩邊都可以先到設定頁「⬇ 匯出備份」存一份再決定。</p>`;
  $('#modal').classList.add('show');
  $('#pk-remote').addEventListener('click', () => { closeModal(); adoptRemote(remote); sync.lastAt = new Date().toISOString(); saveSync(); setSyncStatus('ok'); toast('☁️ 已改用雲端資料'); });
  $('#pk-local').addEventListener('click', async () => { closeModal(); S.updatedAt = new Date().toISOString(); save(false); await pushNow(); toast('☁️ 已用這台的資料覆蓋雲端'); render(); });
}

let lastPullAt = 0;

/* 太密集的話不重複打，最短間隔 3 秒 */
function pullSoon(force) {
  if (!syncReady()) return;
  const now = Date.now();
  if (!force && now - lastPullAt < 3000) return;
  lastPullAt = now;
  pullNow({ quiet: true }).catch(() => {});
}

function startSyncLoop() {
  if (typeof document === 'undefined') return;

  // 切回這個畫面 → 立刻抓最新；切走 → 立刻把還沒送的送出去
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) flushPush();
    else pullSoon();
  });
  // 視窗重新取得焦點（電腦上在多個程式之間切換時最常觸發）
  window.addEventListener('focus', () => pullSoon());
  window.addEventListener('blur', () => flushPush());
  // 從 iOS 的返回快取叫回來
  window.addEventListener('pageshow', (e) => { if (e.persisted) pullSoon(true); });
  window.addEventListener('pagehide', () => flushPush());
  window.addEventListener('online', () => pullSoon(true));

  // 前景時每 20 秒背景檢查一次
  setInterval(() => { if (!document.hidden) pullSoon(true); }, 20000);
  // 還沒送出去的定期補送（離線恢復後會補上）
  setInterval(() => { if (pendingPush && !document.hidden) pushNow().catch(() => {}); }, 15000);
}

/* =========================================================
   提醒
   ========================================================= */

let reminderTimers = [];

function scheduleReminders() {
  reminderTimers.forEach(clearTimeout);
  reminderTimers = [];
  for (const t of S.settings.reminders) {
    const [h, m] = t.split(':').map(Number);
    const now = new Date(), at = new Date();
    at.setHours(h, m, 0, 0);
    if (at <= now) at.setDate(at.getDate() + 1);
    const ms = at - now;
    if (ms > 0 && ms < 2147483647) {
      reminderTimers.push(setTimeout(() => { fireReminder(); scheduleReminders(); }, ms));
    }
  }
}

function fireReminder() {
  const today = ymd();
  const rest = todaysTasks().filter(t => !isTaskDone(t, today));
  const od = overdueTasks().filter(t => !isTaskDone(t, today));
  const exam = rest.filter(t => prioOf(t) === 'exam');
  const crit = rest.filter(t => prioOf(t) === 'must');
  const imp  = rest.filter(t => prioOf(t) === 'important');
  const odTail = od.length ? `　另有 ${od.length} 件逾期：${od.map(t => t.title).join('、')}` : '';
  let msg;
  if (exam.length)       msg = `📕🚨 今天有考試：${exam.map(t => t.title).join('、')}！`;
  else if (crit.length)      msg = `🔴 今天有「必做」還沒完成：${crit.map(t => t.title).join('、')}${odTail}`;
  else if (od.length)   msg = `⚠️ 有 ${od.length} 件逾期還沒處理：${od.map(t => t.title).join('、')}`;
  else if (imp.length)  msg = `🟠 別忘了：${imp.map(t => t.title).join('、')}（今天還有 ${rest.length} 件）`;
  else if (rest.length) msg = `還有 ${rest.length} 件事，連續 ${S.streak.current} 天別斷在今天 🔥`;
  else                  msg = `今天全部完成了 🏁`;
  if (S.settings.notify && 'Notification' in window && Notification.permission === 'granted') {
    try { new Notification('每日任務', { body: msg }); return; } catch (e) { /* fallthrough */ }
  }
  showBanner(msg);
}

function showBanner(msg) {
  const b = $('#banner');
  $('#banner-txt').textContent = msg;
  b.classList.add('show');
  clearTimeout(showBanner._t);
  showBanner._t = setTimeout(() => b.classList.remove('show'), 12000);
}

function watchMidnight() {
  setInterval(() => {
    if (S.lastOpen !== ymd()) {
      S.lastOpen = ymd();
      weekStart = thisWeekStart();
      maintainStreak(); save(); render();
    }
  }, 60000);
}

/* =========================================================
   啟動
   ========================================================= */

function init() {
  loadSync();
  S = load();
  const fresh = !S;
  if (fresh) {
    S = blankState();
    STARTER_TASKS.forEach(t => S.tasks.push({ ...t, id: uid(), createdAt: ymd(), archived: false }));
  }
  maintainStreak();
  pruneDayOrder();
  S.lastOpen = ymd();
  weekStart = thisWeekStart();
  save();

  $$('.tabs button').forEach(b => b.addEventListener('click', () => {
    TAB = b.dataset.tab; window.scrollTo({ top: 0, behavior: 'smooth' }); render();
  }));
  $('#cel-close').addEventListener('click', () => $('#celebrate').classList.remove('show'));
  $('#celebrate').addEventListener('click', e => { if (e.target.id === 'celebrate') $('#celebrate').classList.remove('show'); });
  $('#banner-x').addEventListener('click', () => $('#banner').classList.remove('show'));
  $('#modal').addEventListener('click', e => { if (e.target.id === 'modal') closeModal(); });

  /* 同一台電腦如果開了兩個視窗（App 視窗＋瀏覽器分頁），
     另一個視窗改了資料時要立刻跟上，否則舊的那個會把新的蓋掉 */
  window.addEventListener('storage', (e) => {
    if (e.key !== KEY || !e.newValue) return;
    try {
      const o = migrate(JSON.parse(e.newValue));
      if ((+o.rev || 0) >= (+S.rev || 0)) { S = o; render(); }
    } catch (err) { /* ignore */ }
  });
  document.addEventListener('keydown', e => {
    if (e.key !== 'Escape') return;
    if (qa || ge || ed) closeModal(); else $('#celebrate').classList.remove('show');
  });

  render();
  initDrag();
  scheduleReminders();
  watchMidnight();
  startSyncLoop();
  if (syncReady()) { setSyncStatus('ready'); pullNow({ quiet: true }).catch(() => {}); }

  if (fresh) setTimeout(() => celebrate('🌱', '開始了', '先放了 3 個範例，完成一個試試看'), 500);
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
}

/* 測試用 */
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    ymd, parseYmd, addDays, daysBetween, fmtMD, hashStr, clamp,
    PRIO, PRIO_ORDER, WEEK, blankState, migrate, uid,
    isPlanned, dayTasks, calendarTasks, todaysTasks, overdueDays, daysUntil, prioOf, sortTasks,
    isTaskDone, doneIdsOf, overdueTasks, overdueCard,
    scheduleAt, changeScheduleFrom, changeScheduleAll, schedText, scEqual,
    orderOf, nextOrder, resortByPriority, reorderWithin, moveTaskToDay,
    dayOrderOf, setDayOrder, pruneDayOrder,
    taskReport, overallReport, doneEver, doneOn, dayLog,
    maintainStreak, bumpStreak,
    toggleTask, goalProgress, goalStats, addGoalEntry, thisWeekStart,
    views: { viewToday, viewCalendar, viewManage, viewSchedule, viewStats, viewGoals, viewSettings },
    courseAt, courseColor, PERIODS, SCHOOL_DAYS,
    viewWeek, viewMonth, goalCard, goalChart, lineChart,
    setState: (s) => { S = s; }, getState: () => S,
    stateIsEmpty, syncStatusHtml, adoptRemote, openTextBackup, openTextRestore, openSqlHelp,
    mergeStates, contentSig, recomputeStats, touchDay,
    getSync: () => sync, setSync: (o) => { sync = { ...sync, ...o }; },
    syncReady, syncConfigured, pushNow, pullNow, firstSync, save,
    makeSyncCode, syncSql, syncSelfTest, SYNC_TABLE,
    flushPush, heroSyncLabel, isPendingPush: () => pendingPush,
    listSnapshots, pushSnapshot, restoreSnapshot, SNAP_KEY,
    setCalMode: (m) => { calMode = m; }, setWeekStart: (d) => { weekStart = d; },
    setStatRange: (r) => { statRange = r; },
  };
}
