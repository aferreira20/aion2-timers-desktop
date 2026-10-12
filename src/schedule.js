/*
 * Shared schedule logic (ported from the Chrome extension).
 * All game schedules are expressed in SERVER time; the server clock is
 * modelled as UTC + settings.serverOffset hours.
 */

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MIN = 60 * 1000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

// Default event catalogue (sources: in-game tooltips as reported by community guides, Oct 2026).
const DEFAULT_EVENTS = [
  {
    id: 'daily-reset', name: 'Daily Reset', category: 'Reset',
    type: 'weekly', days: [0, 1, 2, 3, 4, 5, 6], times: ['16:00'], enabled: true,
    note: 'Duty Missions, Nightmare, event keys refill'
  },
  {
    id: 'weekly-reset', name: 'Weekly Reset', category: 'Reset',
    type: 'weekly', days: [3], times: ['16:00'], enabled: true,
    note: 'Raids, Daily Dungeon (14), Abyss time, Ascension Trial wipe'
  },
  {
    id: 'nahma', name: 'Guardian Lord Nahma', category: 'Abyss Boss',
    type: 'weekly', days: [0, 5], times: ['21:00'], enabled: true,
    note: 'Lower Reshanta + Enraged version in Middle Reshanta'
  },
  {
    id: 'executors', name: 'Executor Bosses', category: 'Abyss Boss',
    type: 'weekly', days: [1, 4, 6], times: ['21:30'], enabled: true,
    note: 'Lower: Tamasa, Kaira, Argo · Middle: Ducal, Marakha, Dramos'
  },
  {
    id: 'watcher-kaira', name: 'Watcher Kaira', category: 'Abyss Boss',
    type: 'interval', anchor: '01:00', every: 180, enabled: true,
    note: 'Lower Reshanta, Black Fragments Area (edit if your region differs)'
  },
  {
    id: 'rift-contest', name: 'Rift of Time & Space Contest', category: 'PvP Event',
    type: 'weekly', days: [1, 4, 6], times: ['20:00', '23:00'], enabled: false,
    note: 'Verteron / Altgard strongholds (KR patch — enable if live on your server)'
  }
];

const DEFAULT_STATE = {
  settings: {
    lang: 'auto',           // 'auto' | 'en' | 'pt-BR'
    serverOffset: 9,        // hours; 16:00 server reset observed at 07:00 UTC => UTC+9
    leadMinutes: 5,         // warning before each event
    notifyAtStart: true,
    overlay: true,          // always-on-top, click-through card over the game
    overlaySeconds: 12,     // how long each overlay card stays on screen
    overlayPosition: 'top-right', // top|bottom - left|center|right
    sound: true,            // chime on every alert
    toast: false            // Windows notification (hidden by Focus Assist while gaming)
  },
  events: DEFAULT_EVENTS,
  timers: [],               // { id, name, durationMin, endsAt, repeat, done }
  odyle: { value: null, setAt: null, cap: 560, gain: 15, everyMin: 180, notify: true }
};

function deepClone(o) { return JSON.parse(JSON.stringify(o)); }

function parseHM(str) {
  const m = /^\s*(\d{1,2}):(\d{2})\s*$/.exec(str || '');
  if (!m) return null;
  const h = +m[1], mi = +m[2];
  if (h > 23 || mi > 59) return null;
  return h * 60 + mi;
}

function fmtHM(mins) {
  const h = Math.floor(mins / 60), m = mins % 60;
  return String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0');
}

// Server-calendar date parts for a UTC timestamp.
function serverParts(ms, offset) {
  const d = new Date(ms + offset * HOUR);
  return {
    y: d.getUTCFullYear(), m: d.getUTCMonth(), d: d.getUTCDate(),
    dow: d.getUTCDay(), mins: d.getUTCHours() * 60 + d.getUTCMinutes()
  };
}

function serverToUtc(y, m, d, mins, offset) {
  return Date.UTC(y, m, d, 0, mins) - offset * HOUR;
}

// Minutes-of-day at which the event fires on a given server weekday.
function minutesForDay(ev, dow) {
  if (ev.type === 'weekly') {
    if (!ev.days || !ev.days.includes(dow)) return [];
    return (ev.times || []).map(parseHM).filter(v => v !== null);
  }
  if (ev.type === 'interval') {
    const anchor = parseHM(ev.anchor);
    const every = Math.max(5, +ev.every || 0);
    if (anchor === null || !every) return [];
    const out = [];
    for (let t = anchor % every; t < 1440; t += every) out.push(t);
    return out;
  }
  return [];
}

// All occurrences (UTC ms) of an event strictly after fromMs, up to fromMs + horizon.
function occurrences(ev, fromMs, offset, horizonMs = 8 * DAY) {
  const out = [];
  const start = fromMs - DAY;
  const days = Math.ceil((horizonMs + DAY) / DAY) + 1;
  for (let i = 0; i <= days; i++) {
    const p = serverParts(start + i * DAY, offset);
    for (const mins of minutesForDay(ev, p.dow)) {
      const t = serverToUtc(p.y, p.m, p.d, mins, offset);
      if (t > fromMs && t <= fromMs + horizonMs) out.push(t);
    }
  }
  return [...new Set(out)].sort((a, b) => a - b);
}

function nextOccurrence(ev, fromMs, offset) {
  const list = occurrences(ev, fromMs, offset);
  return list.length ? list[0] : null;
}

function describeSchedule(ev) {
  if (ev.type === 'interval') return t('everyFrom', { every: ev.every, anchor: ev.anchor });
  const days = ev.days.length === 7 ? t('daily') : ev.days.map(d => dayNames()[d]).join(', ');
  return `${days} · ${(ev.times || []).join(', ')}`;
}

// Odyle Energy: estimated current value and the moment it caps.
function odyleStatus(o, now) {
  if (o.value === null || o.setAt === null) return null;
  const tickMs = o.everyMin * MIN;
  const ticks = Math.floor((now - o.setAt) / tickMs);
  const current = Math.min(o.cap, o.value + ticks * o.gain);
  let capAt = null;
  if (o.value < o.cap) {
    const ticksNeeded = Math.ceil((o.cap - o.value) / o.gain);
    capAt = o.setAt + ticksNeeded * tickMs;
  }
  const nextTick = current >= o.cap ? null : o.setAt + (ticks + 1) * tickMs;
  return { current, capAt, nextTick, full: current >= o.cap };
}

function fmtCountdown(ms) {
  if (ms <= 0) return t('now');
  const s = Math.floor(ms / 1000);
  const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60), sec = s % 60;
  if (d > 0) return `${d}d ${h}h ${String(m).padStart(2, '0')}m`;
  if (h > 0) return `${h}h ${String(m).padStart(2, '0')}m ${String(sec).padStart(2, '0')}s`;
  return `${m}m ${String(sec).padStart(2, '0')}s`;
}

const STORAGE_KEY = 'aion2-timers-state';

async function loadState() {
  let state = null;
  try { state = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null'); } catch (e) { state = null; }
  if (!state) return deepClone(DEFAULT_STATE);
  // Fill in any keys added in later versions.
  return {
    settings: { ...DEFAULT_STATE.settings, ...(state.settings || {}) },
    events: state.events || deepClone(DEFAULT_EVENTS),
    timers: state.timers || [],
    odyle: { ...DEFAULT_STATE.odyle, ...(state.odyle || {}) }
  };
}

async function saveState(state) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (e) { /* storage unavailable */ }
}
