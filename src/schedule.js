/*
 * Schedule logic shared by the UI and the alarm builder.
 *
 * Global servers (NA, EU, SA, Asia) run their events on the region's LOCAL
 * clock, while the daily/weekly resets happen at one moment worldwide
 * (16:00 KST). Korea and Taiwan run everything on their own clock.
 * Each event is evaluated in a real IANA time zone, so DST is handled.
 *
 * Event times: community-sourced from shugo.gg/timers (NCSOFT has not
 * published official Global event times).
 */

const MIN = 60 * 1000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;
const KST = 'Asia/Seoul';

const REGIONS = {
  'na-east': { tz: 'America/New_York', kind: 'global' },
  'na-west': { tz: 'America/Los_Angeles', kind: 'global' },
  'eu': { tz: 'Europe/Berlin', kind: 'global' },
  'sa': { tz: 'America/Sao_Paulo', kind: 'global' },
  'asia': { tz: KST, kind: 'global' },
  'kr': { tz: KST, kind: 'kr' },
  'tw': { tz: 'Asia/Taipei', kind: 'tw' }
};
const REGION_IDS = Object.keys(REGIONS);
const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6];

// Default event catalogue for a region. Custom events never use these ids.
function buildDefaultEvents(regionId) {
  const kind = (REGIONS[regionId] || REGIONS.sa).kind;
  const global = kind === 'global';
  const resetTz = global ? KST : undefined;   // undefined → region clock
  const resetAt = global ? '16:00' : '05:00';
  const ev = (o) => ({ enabled: true, note: '', ...o });
  return [
    ev({ id: 'daily-reset', name: 'Daily Reset', category: 'Reset', type: 'weekly', days: ALL_DAYS, times: [resetAt], tz: resetTz, noteKey: 'daily-reset' }),
    ev({ id: 'weekly-reset', name: 'Weekly Reset', category: 'Reset', type: 'weekly', days: [3], times: [resetAt], tz: resetTz, noteKey: 'weekly-reset' }),
    ev({ id: 'spacetime-rift', name: 'Spacetime Rift', category: 'Rift', type: 'interval', anchor: '02:00', every: 180, duration: 60, noteKey: 'rift' }),
    ev({ id: 'watcher-kaira', name: 'Watcher Kaira', category: 'Abyss Boss', type: 'interval', anchor: global ? '01:00' : '00:00', every: global ? 180 : 240, duration: 30, noteKey: 'kaira' }),
    ev({
      id: 'artifact-siege', name: 'Artifact Siege', category: 'Siege', type: 'weekly', duration: 30,
      days: global ? [1, 4, 6] : [3, 6], times: [global ? '21:00' : kind === 'kr' ? '21:20' : '21:30'],
      noteKey: kind === 'kr' ? 'kr-siege' : 'artifact-siege'
    }),
    ev({
      id: 'siege-bosses', name: 'Siege Bosses', category: 'Siege', type: 'weekly', duration: 30,
      days: global ? [1, 4, 6] : [3, 6], times: [global ? '21:30' : '21:45'],
      noteKey: kind === 'kr' ? 'kr-siege-bosses' : 'siege-bosses'
    }),
    ev({
      id: 'nahma', name: 'Guardian Lord Nahma', category: 'Abyss Boss', type: 'weekly', duration: 30,
      days: [0, 5], times: [global ? '21:00' : '22:00'], noteKey: kind === 'kr' ? 'kr-nahma' : 'nahma'
    }),
    ev({ id: 'shugo-festival', name: 'Shugo Festival', category: 'Field Event', type: 'interval', anchor: '00:00', every: 60, duration: 10, enabled: false, noteKey: 'shugo' }),
    ev({ id: 'dimensional-invasion', name: 'Dimensional Invasion', category: 'Field Event', type: 'interval', anchor: '00:30', every: 60, duration: 15, enabled: false, noteKey: 'invasion' })
  ];
}

// Pick a region from the computer's time zone.
function detectRegion() {
  let tz = '';
  try { tz = Intl.DateTimeFormat().resolvedOptions().timeZone || ''; } catch (e) { /* ignore */ }
  if (tz === 'Asia/Taipei') return 'tw';
  if (tz === 'Asia/Seoul') return 'kr';
  if (tz.startsWith('Europe/') || tz.startsWith('Africa/')) return 'eu';
  if (tz.startsWith('Asia/') || tz.startsWith('Australia/') || tz.startsWith('Pacific/')) return 'asia';
  if (/America\/(Sao_Paulo|Argentina|Montevideo|Santiago|Bogota|Lima|Caracas|Asuncion|La_Paz|Fortaleza|Recife|Bahia|Belem|Manaus|Cuiaba|Campo_Grande|Porto_Velho|Boa_Vista|Rio_Branco|Maceio|Araguaina|Santarem|Noronha|Guayaquil)/.test(tz)) return 'sa';
  if (/America\/(Los_Angeles|Vancouver|Tijuana|Phoenix|Denver|Boise|Edmonton|Anchorage)/.test(tz) || tz.startsWith('Pacific/Honolulu')) return 'na-west';
  if (tz.startsWith('America/')) return 'na-east';
  return 'sa';
}

const DEFAULT_REGION = detectRegion();

const DEFAULT_STATE = {
  settings: {
    lang: 'auto',           // 'auto' | 'en' | 'pt-BR'
    region: DEFAULT_REGION, // key of REGIONS
    leadMinutes: 5,         // warning before each event
    notifyAtStart: true,
    overlay: true,          // always-on-top, click-through card over the game
    overlaySeconds: 12,     // how long each overlay card stays on screen
    overlayPosition: 'top-right', // top|bottom - left|center|right
    sound: true,            // chime on every alert
    toast: false            // Windows notification (hidden by Focus Assist while gaming)
  },
  events: buildDefaultEvents(DEFAULT_REGION),
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

/* ---------- Time zones ---------- */

const WEEKDAY = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
const fmtCache = {};

function zoneFmt(tz) {
  if (!fmtCache[tz]) {
    fmtCache[tz] = new Intl.DateTimeFormat('en-US', {
      timeZone: tz, hourCycle: 'h23', weekday: 'short',
      year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric'
    });
  }
  return fmtCache[tz];
}

// Wall-clock parts of a UTC instant in a time zone (+ the zone's UTC offset in minutes).
function zoneParts(ms, tz) {
  const p = {};
  for (const x of zoneFmt(tz).formatToParts(ms)) p[x.type] = x.value;
  const y = +p.year, m = +p.month - 1, d = +p.day, h = +p.hour % 24, mi = +p.minute;
  const offsetMin = Math.round((Date.UTC(y, m, d, h, mi) - Math.floor(ms / MIN) * MIN) / MIN);
  return { y, m, d, dow: WEEKDAY[p.weekday], mins: h * 60 + mi, offsetMin };
}

// UTC instant of a wall-clock time in a time zone.
function zoneToUtc(y, m, d, mins, tz) {
  const guess = Date.UTC(y, m, d, 0, mins);
  const off1 = zoneParts(guess, tz).offsetMin;
  let t = guess - off1 * MIN;
  const off2 = zoneParts(t, tz).offsetMin;
  if (off2 !== off1) t = guess - off2 * MIN;
  return t;
}

const regionTz = (regionId) => (REGIONS[regionId] || REGIONS.sa).tz;
const eventTz = (ev, regionId) => ev.tz || regionTz(regionId);

/* ---------- Occurrences ---------- */

// Minutes-of-day at which the event fires on a given weekday (event clock).
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
    for (let m = anchor % every; m < 1440; m += every) out.push(m);
    return out;
  }
  return [];
}

// All occurrences (UTC ms) of an event strictly after fromMs, up to fromMs + horizon.
function occurrences(ev, fromMs, regionId, horizonMs = 8 * DAY) {
  const tz = eventTz(ev, regionId);
  const out = new Set();
  const seen = new Set();
  // Step 12 h so no calendar date is skipped around DST changes.
  for (let s = fromMs - DAY; s <= fromMs + horizonMs + DAY; s += 12 * HOUR) {
    const p = zoneParts(s, tz);
    const key = `${p.y}-${p.m}-${p.d}`;
    if (seen.has(key)) continue;
    seen.add(key);
    for (const mins of minutesForDay(ev, p.dow)) {
      const at = zoneToUtc(p.y, p.m, p.d, mins, tz);
      if (at > fromMs && at <= fromMs + horizonMs) out.add(at);
    }
  }
  return [...out].sort((a, b) => a - b);
}

function nextOccurrence(ev, fromMs, regionId) {
  const list = occurrences(ev, fromMs, regionId);
  return list.length ? list[0] : null;
}

// If the event is running right now, the moment it ends; otherwise null.
function activeUntil(ev, now, regionId) {
  const dur = +ev.duration || 0;
  if (!dur) return null;
  const starts = occurrences(ev, now - dur * MIN, regionId, dur * MIN);
  if (!starts.length) return null;
  const end = starts[starts.length - 1] + dur * MIN;
  return end > now ? end : null;
}

function describeSchedule(ev) {
  let s;
  if (ev.type === 'interval') s = t('everyFrom', { every: ev.every, anchor: ev.anchor });
  else {
    const days = ev.days.length === 7 ? t('daily') : ev.days.map(d => dayNames()[d]).join(', ');
    s = `${days} · ${(ev.times || []).join(', ')}`;
  }
  if (ev.tz === KST) s += ' KST';
  if (ev.duration) s += ` · ${t('lasts', { min: ev.duration })}`;
  return s;
}

/* ---------- Odyle ---------- */

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

/* ---------- Storage ---------- */

const STORAGE_KEY = 'aion2-timers-state';
const isCustom = (ev) => !buildDefaultEvents('sa').some(d => d.id === ev.id) && !LEGACY_IDS.includes(ev.id);
// Ids from v1.0–1.2 catalogues (KST-based) → their replacement.
const LEGACY_IDS = ['executors', 'rift-contest'];
const LEGACY_MAP = { executors: 'siege-bosses' };

// Region catalogue + the user's on/off choices + their custom events.
function mergeCatalog(regionId, existing) {
  const enabled = {};
  for (const ev of existing || []) enabled[LEGACY_MAP[ev.id] || ev.id] = ev.enabled;
  const defaults = buildDefaultEvents(regionId).map(ev =>
    (ev.id in enabled ? { ...ev, enabled: enabled[ev.id] } : ev));
  const custom = (existing || []).filter(isCustom);
  return [...defaults, ...custom];
}

async function loadState() {
  let state = null;
  try { state = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null'); } catch (e) { state = null; }
  if (!state) return deepClone(DEFAULT_STATE);
  const settings = { ...DEFAULT_STATE.settings, ...(state.settings || {}) };
  let events = state.events || deepClone(DEFAULT_STATE.events);
  // v1.2 and earlier stored everything on a single KST offset: move to regions.
  if (!state.settings || !state.settings.region) {
    settings.region = DEFAULT_REGION;
    events = mergeCatalog(settings.region, events);
  }
  delete settings.serverOffset;
  return {
    settings,
    events,
    timers: state.timers || [],
    odyle: { ...DEFAULT_STATE.odyle, ...(state.odyle || {}) }
  };
}

async function saveState(state) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (e) { /* storage unavailable */ }
}
