/* Main window UI controller (ported from the extension popup). */
let state;
let editingId = null;

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function fmtLocal(ms) {
  const d = new Date(ms);
  const today = new Date();
  const tomorrow = new Date(); tomorrow.setDate(today.getDate() + 1);
  const time = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  if (d.toDateString() === today.toDateString()) return `Today ${time}`;
  if (d.toDateString() === tomorrow.toDateString()) return `Tomorrow ${time}`;
  return `${d.toLocaleDateString([], { weekday: 'short', day: '2-digit', month: 'short' })} ${time}`;
}

async function persist() {
  await saveState(state);
  await pushAlarms(state);
}

/* ---------- Tabs ---------- */
$$('.tab').forEach(btn => btn.addEventListener('click', () => {
  $$('.tab').forEach(b => b.classList.toggle('active', b === btn));
  $$('.panel').forEach(p => p.classList.toggle('active', p.id === 'tab-' + btn.dataset.tab));
  try { localStorage.setItem('tab', btn.dataset.tab); } catch (e) { /* ignore */ }
}));

/* ---------- Clocks ---------- */
function renderClocks() {
  const now = Date.now();
  const p = serverParts(now, state.settings.serverOffset);
  $('#serverClock').textContent = `${DAY_NAMES[p.dow]} ${fmtHM(p.mins)}`;
  $('#localClock').textContent = new Date(now).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

/* ---------- Upcoming ---------- */
function renderUpcoming() {
  const now = Date.now();
  const rows = [];
  for (const ev of state.events) {
    const next = nextOccurrence(ev, now, state.settings.serverOffset);
    if (next) rows.push({ kind: 'event', ev, at: next });
  }
  for (const t of state.timers) {
    if (!t.done && t.endsAt > now) rows.push({ kind: 'timer', t, at: t.endsAt });
  }
  // Enabled items first, muted events last; each group by time.
  const muted = (r) => (r.kind === 'event' && !r.ev.enabled ? 1 : 0);
  rows.sort((a, b) => muted(a) - muted(b) || a.at - b.at);

  if (!rows.length) {
    $('#upcomingList').innerHTML = '<li class="empty">No events enabled.</li>';
    return;
  }

  $('#upcomingList').innerHTML = rows.map(r => {
    const left = r.at - now;
    const cls = ['item'];
    if (left < 5 * MIN) cls.push('imminent'); else if (left < 30 * MIN) cls.push('soon');
    if (r.kind === 'event') {
      const ev = r.ev;
      if (!ev.enabled) cls.push('muted-ev');
      return `<li class="${cls.join(' ')}">
        <div class="name"><span class="t" title="${esc(ev.note)}">${esc(ev.name)}</span><span class="chip" data-c="${esc(ev.category)}">${esc(ev.category)}</span></div>
        <div class="cd">${fmtCountdown(left)}</div>
        <div class="meta">${fmtLocal(r.at)} · ${esc(describeSchedule(ev))}</div>
        <div class="actions"><button class="icon-btn" data-bell="${esc(ev.id)}" title="${ev.enabled ? 'Mute' : 'Unmute'}">${ev.enabled ? '🔔' : '🔕'}</button></div>
      </li>`;
    }
    const t = r.t;
    return `<li class="${cls.join(' ')}">
      <div class="name"><span class="t">${esc(t.name)}</span><span class="chip" data-c="Timer">Timer${t.repeat ? ' ↻' : ''}</span></div>
      <div class="cd">${fmtCountdown(left)}</div>
      <div class="meta">${fmtLocal(r.at)}</div>
      <div class="actions"></div>
    </li>`;
  }).join('');
}

$('#upcomingList').addEventListener('click', async (e) => {
  const id = e.target.closest('[data-bell]')?.dataset.bell;
  if (!id) return;
  const ev = state.events.find(x => x.id === id);
  ev.enabled = !ev.enabled;
  await persist();
  renderUpcoming();
  renderEvents();
});

/* ---------- Odyle ---------- */
function renderOdyle() {
  const o = state.odyle;
  $('#odyleGainLbl').textContent = o.gain;
  const st = odyleStatus(o, Date.now());
  if (!st) {
    $('#odyleNow').textContent = '—';
    $('#odyleBar').style.width = '0';
    ['#odyleNext', '#odyleFull', '#odyleLeft'].forEach(s => { $(s).textContent = 'Set your energy below'; });
    return;
  }
  $('#odyleNow').textContent = `${st.current} / ${o.cap}`;
  const bar = $('#odyleBar');
  bar.style.width = Math.min(100, (st.current / o.cap) * 100) + '%';
  bar.classList.toggle('full', st.full);
  const now = Date.now();
  $('#odyleNext').textContent = st.nextTick ? `${fmtLocal(st.nextTick)} (${fmtCountdown(st.nextTick - now)})` : '—';
  $('#odyleFull').textContent = st.full ? 'FULL — spend it!' : fmtLocal(st.capAt);
  $('#odyleLeft').textContent = st.full ? '0' : fmtCountdown(st.capAt - now);
}

function fillOdyleForm() {
  const o = state.odyle;
  $('#odyleCap').value = o.cap;
  $('#odyleGain').value = o.gain;
  $('#odyleEvery').value = o.everyMin;
  $('#odyleNotify').checked = o.notify;
}

$('#odyleSave').addEventListener('click', async () => {
  const o = state.odyle;
  o.cap = Math.max(1, +$('#odyleCap').value || 560);
  o.gain = Math.max(1, +$('#odyleGain').value || 15);
  o.everyMin = Math.max(1, +$('#odyleEvery').value || 180);
  o.notify = $('#odyleNotify').checked;
  const raw = $('#odyleInput').value.trim();
  if (raw !== '') {
    o.value = Math.min(o.cap, Math.max(0, Math.floor(+raw)));
    o.setAt = Date.now();
    $('#odyleInput').value = '';
  }
  await persist();
  renderOdyle();
});

/* ---------- Custom timers ---------- */
$$('.presets button').forEach(b => b.addEventListener('click', () => { $('#timerMin').value = b.dataset.min; }));

$('#timerAdd').addEventListener('click', async () => {
  const mins = Math.max(1, Math.floor(+$('#timerMin').value || 0));
  const name = $('#timerName').value.trim() || `${mins} min timer`;
  state.timers.push({
    id: 't' + Date.now().toString(36),
    name, durationMin: mins, endsAt: Date.now() + mins * MIN,
    repeat: $('#timerRepeat').checked, done: false
  });
  $('#timerName').value = '';
  await persist();
  renderTimers(); renderUpcoming();
});

function renderTimers() {
  const now = Date.now();
  if (!state.timers.length) {
    $('#timerList').innerHTML = '<li class="empty">No custom timers yet.</li>';
    return;
  }
  $('#timerList').innerHTML = state.timers.map(t => {
    const running = !t.done && t.endsAt > now;
    return `<li class="item ${running && t.endsAt - now < 5 * MIN ? 'imminent' : ''}">
      <div class="name"><span class="t">${esc(t.name)}</span><span class="chip" data-c="Timer">${t.durationMin}m${t.repeat ? ' ↻' : ''}</span></div>
      <div class="cd">${running ? fmtCountdown(t.endsAt - now) : 'done'}</div>
      <div class="meta">${running ? 'Ends ' + fmtLocal(t.endsAt) : 'Finished'}</div>
      <div class="actions">
        <button class="icon-btn" data-restart="${t.id}" title="Restart">↺</button>
        <button class="icon-btn" data-remove="${t.id}" title="Remove">✕</button>
      </div>
    </li>`;
  }).join('');
}

$('#timerList').addEventListener('click', async (e) => {
  const restart = e.target.closest('[data-restart]')?.dataset.restart;
  const remove = e.target.closest('[data-remove]')?.dataset.remove;
  if (restart) {
    const t = state.timers.find(x => x.id === restart);
    t.endsAt = Date.now() + t.durationMin * MIN; t.done = false;
  } else if (remove) {
    state.timers = state.timers.filter(x => x.id !== remove);
  } else return;
  await persist();
  renderTimers(); renderUpcoming();
});

/* ---------- Settings ---------- */
function fillSettings() {
  const sel = $('#serverOffset');
  if (!sel.options.length) {
    for (let h = -12; h <= 14; h += 0.5) {
      const sign = h >= 0 ? '+' : '-';
      const abs = Math.abs(h);
      const label = `UTC${sign}${Math.floor(abs)}${abs % 1 ? ':30' : ''}`;
      const extra = h === 9 ? ' (KST — default)' : '';
      sel.add(new Option(label + extra, h));
    }
  }
  const s = state.settings;
  sel.value = s.serverOffset;
  $('#leadMinutes').value = s.leadMinutes;
  $('#notifyAtStart').checked = s.notifyAtStart;
  $('#overlay').checked = s.overlay;
  $('#overlaySeconds').value = s.overlaySeconds;
  $('#overlayPosition').value = s.overlayPosition;
  $('#sound').checked = s.sound;
  $('#toast').checked = s.toast;
  autostart.isEnabled().then(on => { $('#autostart').checked = on; });
}

['serverOffset', 'leadMinutes', 'notifyAtStart', 'overlay', 'overlaySeconds', 'overlayPosition', 'sound', 'toast'].forEach(id => {
  $('#' + id).addEventListener('change', async (e) => {
    const el = e.target;
    const s = state.settings;
    if (id === 'serverOffset') s.serverOffset = parseFloat(el.value);
    else if (id === 'leadMinutes') s.leadMinutes = Math.max(0, Math.min(120, Math.floor(+el.value || 0)));
    else if (id === 'overlaySeconds') s.overlaySeconds = Math.max(3, Math.min(300, Math.floor(+el.value || 12)));
    else if (id === 'overlayPosition') s.overlayPosition = el.value;
    else s[id] = el.checked;
    await persist();
    renderAll();
  });
});

$('#autostart').addEventListener('change', async (e) => {
  try { await autostart.set(e.target.checked); } catch (err) { e.target.checked = !e.target.checked; }
});

$('#testAlert').addEventListener('click', async () => {
  await persist(); // make sure Rust has the current alert options
  await invoke('test_alert');
});

function renderEvents() {
  $('#eventList').innerHTML = state.events.map(ev => `
    <li class="item" data-id="${esc(ev.id)}">
      <div class="name"><span class="t">${esc(ev.name)}</span><span class="chip" data-c="${esc(ev.category)}">${esc(ev.category)}</span></div>
      <div class="cd" style="color:var(--muted)">
        <label class="switch" title="Enabled"><input type="checkbox" data-toggle="${esc(ev.id)}" ${ev.enabled ? 'checked' : ''}><span></span></label>
      </div>
      <div class="meta">${esc(describeSchedule(ev))}${ev.note ? ' · ' + esc(ev.note) : ''}</div>
      <div class="actions"><button class="icon-btn" data-edit="${esc(ev.id)}" title="Edit">✎</button></div>
    </li>`).join('');
  if (editingId) openEditor(editingId);
}

function openEditor(id) {
  const li = $(`#eventList li[data-id="${CSS.escape(id)}"]`);
  if (!li) return;
  const ev = state.events.find(e => e.id === id);
  const node = $('#eventEditor').content.firstElementChild.cloneNode(true);
  $('.e-name', node).value = ev.name;
  $('.e-cat', node).value = ev.category;
  $('.e-type', node).value = ev.type;
  $('.e-times', node).value = (ev.times || []).join(', ');
  $('.e-anchor', node).value = ev.anchor || '00:00';
  $('.e-every', node).value = ev.every || 180;
  $('.e-note', node).value = ev.note || '';
  const days = $('.days', node);
  DAY_NAMES.forEach((d, i) => {
    const on = (ev.days || []).includes(i);
    const lab = document.createElement('label');
    lab.className = on ? 'on' : '';
    lab.innerHTML = `<input type="checkbox" value="${i}" ${on ? 'checked' : ''}>${d}`;
    lab.querySelector('input').addEventListener('change', (e) => lab.classList.toggle('on', e.target.checked));
    days.appendChild(lab);
  });
  const syncType = () => {
    const weekly = $('.e-type', node).value === 'weekly';
    $('.weekly-fields', node).style.display = weekly ? '' : 'none';
    $('.interval-fields', node).style.display = weekly ? 'none' : '';
  };
  $('.e-type', node).addEventListener('change', syncType);
  syncType();

  $('.e-save', node).addEventListener('click', async () => {
    const type = $('.e-type', node).value;
    const upd = {
      name: $('.e-name', node).value.trim() || 'Untitled event',
      category: $('.e-cat', node).value.trim() || 'Event',
      type,
      note: $('.e-note', node).value.trim()
    };
    if (type === 'weekly') {
      upd.days = $$('.days input:checked', node).map(i => +i.value);
      upd.times = $('.e-times', node).value.split(',').map(s => s.trim()).filter(s => parseHM(s) !== null)
        .map(s => fmtHM(parseHM(s)));
      if (!upd.days.length || !upd.times.length) { alert('Pick at least one day and one valid HH:MM time.'); return; }
    } else {
      const a = parseHM($('.e-anchor', node).value);
      const every = Math.floor(+$('.e-every', node).value);
      if (a === null || !(every >= 5)) { alert('Enter a valid HH:MM start and an interval of at least 5 minutes.'); return; }
      upd.anchor = fmtHM(a); upd.every = every;
    }
    Object.assign(ev, upd);
    editingId = null;
    await persist();
    renderEvents(); renderUpcoming();
  });
  $('.e-cancel', node).addEventListener('click', () => { editingId = null; renderEvents(); });
  $('.e-delete', node).addEventListener('click', async () => {
    if (!confirm(`Delete "${ev.name}"?`)) return;
    state.events = state.events.filter(e => e.id !== id);
    editingId = null;
    await persist();
    renderEvents(); renderUpcoming();
  });
  li.appendChild(node);
}

$('#eventList').addEventListener('click', (e) => {
  const id = e.target.closest('[data-edit]')?.dataset.edit;
  if (!id) return;
  editingId = editingId === id ? null : id;
  renderEvents();
});

$('#eventList').addEventListener('change', async (e) => {
  const id = e.target.dataset.toggle;
  if (!id) return;
  state.events.find(x => x.id === id).enabled = e.target.checked;
  await persist();
  renderUpcoming();
});

$('#addEvent').addEventListener('click', async () => {
  const id = 'u' + Date.now().toString(36);
  state.events.push({
    id, name: 'New event', category: 'Custom', type: 'weekly',
    days: [0, 1, 2, 3, 4, 5, 6], times: ['20:00'], enabled: true, note: ''
  });
  editingId = id;
  await persist();
  renderEvents(); renderUpcoming();
});

$('#resetEvents').addEventListener('click', async () => {
  if (!confirm('Restore the default event list? Your custom events will be removed.')) return;
  state.events = deepClone(DEFAULT_EVENTS);
  editingId = null;
  await persist();
  renderEvents(); renderUpcoming();
});

/* ---------- Boot ---------- */
function renderAll() {
  renderClocks(); renderUpcoming(); renderOdyle(); renderTimers();
}

// Roll finished timers and refresh the alarm list sent to Rust.
async function tick() {
  if (rollTimers(state, Date.now())) {
    await saveState(state);
    renderTimers();
  }
  await pushAlarms(state);
}

(async function init() {
  state = await loadState();
  fillSettings();
  fillOdyleForm();
  renderEvents();
  renderAll();
  await tick();
  // Live countdowns only while visible; alarms keep their own 1-minute refresh.
  setInterval(() => { if (document.visibilityState === 'visible') renderAll(); }, 1000);
  setInterval(tick, 60 * 1000);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') renderAll(); });
  if (tauri) tauri.event.listen('alarms-fired', () => tick().then(renderAll));
  try {
    const tab = localStorage.getItem('tab');
    if (tab) $(`.tab[data-tab="${tab}"]`)?.click();
  } catch (e) { /* ignore */ }
})();
