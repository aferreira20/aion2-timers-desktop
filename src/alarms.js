/*
 * Desktop replacement for the extension's service worker.
 * Builds a flat list of upcoming alerts and hands it to the Rust scheduler,
 * which fires them even while this window is hidden in the tray.
 */

const ALARM_HORIZON = 48 * HOUR;
const MAX_REPEATS = 50;

const tauri = window.__TAURI__ || null;
const invoke = (cmd, args) => (tauri ? tauri.core.invoke(cmd, args) : Promise.resolve(null));

function localTime(ms) {
  return new Date(ms).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function buildAlarms(state, now) {
  const s = state.settings;
  const out = [];

  for (const ev of state.events) {
    if (!ev.enabled) continue;
    for (const at of occurrences(ev, now, s.serverOffset, ALARM_HORIZON)) {
      const note = ev.note ? ` ${ev.note}` : '';
      if (s.leadMinutes > 0) {
        const warnAt = at - s.leadMinutes * MIN;
        if (warnAt > now) {
          out.push({
            id: `warn|${ev.id}|${at}`, at: warnAt, kind: 'warn',
            title: `${ev.name} in ${s.leadMinutes} min`,
            body: `${ev.category} at ${localTime(at)}.${note}`
          });
        }
      }
      if (s.notifyAtStart) {
        out.push({
          id: `start|${ev.id}|${at}`, at, kind: 'start',
          title: `${ev.name} — now!`,
          body: `${ev.category}.${note}`
        });
      }
    }
  }

  for (const t of state.timers) {
    if (t.done) continue;
    let at = t.endsAt;
    for (let n = 0; n < MAX_REPEATS && at <= now + ALARM_HORIZON; n++) {
      if (at > now) {
        out.push({
          id: `timer|${t.id}|${at}`, at, kind: 'timer',
          title: `⏰ ${t.name}`,
          body: t.repeat ? `Restarting (${t.durationMin} min)` : 'Timer finished'
        });
      }
      if (!t.repeat) break;
      at += t.durationMin * MIN;
    }
  }

  const o = odyleStatus(state.odyle, now);
  if (o && state.odyle.notify && o.capAt && o.capAt > now) {
    out.push({
      id: `odyle|cap|${o.capAt}`, at: o.capAt, kind: 'odyle',
      title: 'Odyle Energy is full',
      body: `Reached ${state.odyle.cap}. Spend it before regeneration is wasted.`
    });
  }

  return out.sort((a, b) => a.at - b.at);
}

// Advance finished timers: repeating ones roll forward, one-shots are marked done.
function rollTimers(state, now) {
  let changed = false;
  for (const t of state.timers) {
    if (t.done || t.endsAt > now) continue;
    if (t.repeat) {
      const step = t.durationMin * MIN;
      t.endsAt += Math.ceil((now - t.endsAt + 1) / step) * step;
    } else {
      t.done = true;
    }
    changed = true;
  }
  return changed;
}

function nextUp(state, now) {
  let best = null;
  for (const ev of state.events) {
    if (!ev.enabled) continue;
    const at = nextOccurrence(ev, now, state.settings.serverOffset);
    if (at && (!best || at < best.at)) best = { name: ev.name, at };
  }
  for (const t of state.timers) {
    if (!t.done && t.endsAt > now && (!best || t.endsAt < best.at)) best = { name: t.name, at: t.endsAt };
  }
  return best;
}

async function pushAlarms(state) {
  const now = Date.now();
  const s = state.settings;
  await invoke('set_alarms', {
    alarms: buildAlarms(state, now),
    options: {
      overlay: !!s.overlay,
      overlaySeconds: Math.max(3, Math.min(300, Math.floor(+s.overlaySeconds || 12))),
      position: s.overlayPosition || 'top-right',
      sound: !!s.sound,
      toast: !!s.toast
    }
  });
  const next = nextUp(state, now);
  const tip = next ? `AION 2 Timers\n${next.name} in ${fmtCountdown(next.at - now).replace(/ \d+s$/, '')}` : 'AION 2 Timers';
  await invoke('set_tray_tooltip', { text: tip.slice(0, 120) });
}

/* Start with Windows (tauri-plugin-autostart). */
const autostart = {
  isEnabled: () => invoke('plugin:autostart|is_enabled').then(v => !!v).catch(() => false),
  set: (on) => invoke(on ? 'plugin:autostart|enable' : 'plugin:autostart|disable')
};
