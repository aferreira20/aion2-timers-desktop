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
  const time = d.toLocaleTimeString(LANG, { hour: '2-digit', minute: '2-digit' });
  if (d.toDateString() === today.toDateString()) return `${t('today')} ${time}`;
  if (d.toDateString() === tomorrow.toDateString()) return `${t('tomorrow')} ${time}`;
  return `${d.toLocaleDateString(LANG, { weekday: 'short', day: '2-digit', month: 'short' })} ${time}`;
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
  const p = zoneParts(now, regionTz(state.settings.region));
  $('#serverClock').textContent = `${dayNames()[p.dow]} ${fmtHM(p.mins)}`;
  $('#localClock').textContent = new Date(now).toLocaleTimeString(LANG, { hour: '2-digit', minute: '2-digit' });
}

/* ---------- Upcoming ---------- */
function renderUpcoming() {
  const now = Date.now();
  const rows = [];
  const region = state.settings.region;
  for (const ev of state.events) {
    const until = activeUntil(ev, now, region);
    const next = nextOccurrence(ev, now, region);
    // A running event sorts first and counts down to its end.
    if (until) rows.push({ kind: 'event', ev, at: now, until, next });
    else if (next) rows.push({ kind: 'event', ev, at: next });
  }
  for (const tm of state.timers) {
    if (!tm.done && tm.endsAt > now) rows.push({ kind: 'timer', tm, at: tm.endsAt });
  }
  // Enabled items first, muted events last; each group by time.
  const muted = (r) => (r.kind === 'event' && !r.ev.enabled ? 1 : 0);
  rows.sort((a, b) => muted(a) - muted(b) || a.at - b.at);

  if (!rows.length) {
    $('#upcomingList').innerHTML = `<li class="empty">${esc(t('noEvents'))}</li>`;
    return;
  }

  $('#upcomingList').innerHTML = rows.map(r => {
    const left = r.at - now;
    const cls = ['item'];
    if (left < 5 * MIN) cls.push('imminent'); else if (left < 30 * MIN) cls.push('soon');
    if (r.kind === 'event') {
      const ev = r.ev;
      if (!ev.enabled) cls.push('muted-ev');
      if (r.until) { cls.length = 1; cls.push('active'); if (!ev.enabled) cls.push('muted-ev'); }
      const cd = r.until ? t('activeLeft', { time: fmtCountdown(r.until - now) }) : fmtCountdown(left);
      const when = r.until ? t('activeUntil', { when: fmtLocal(r.until) }) : fmtLocal(r.at);
      return `<li class="${cls.join(' ')}">
        <div class="name"><span class="t" title="${esc(noteLabel(ev))}">${esc(nameLabel(ev))}</span><span class="chip" data-c="${esc(ev.category)}">${esc(catLabel(ev.category))}</span></div>
        <div class="cd">${esc(cd)}</div>
        <div class="meta">${esc(when)} · ${esc(describeSchedule(ev))}</div>
        <div class="actions"><button class="icon-btn" data-bell="${esc(ev.id)}" title="${esc(t(ev.enabled ? 'mute' : 'unmute'))}">${ev.enabled ? '🔔' : '🔕'}</button></div>
      </li>`;
    }
    const tm = r.tm;
    return `<li class="${cls.join(' ')}">
      <div class="name"><span class="t">${esc(tm.name)}</span><span class="chip" data-c="Timer">${esc(t('timer'))}${tm.repeat ? ' ↻' : ''}</span></div>
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
  $('#odyleNextLbl').textContent = t('odyleNext', { gain: o.gain });
  const st = odyleStatus(o, Date.now());
  if (!st) {
    $('#odyleNow').textContent = '—';
    $('#odyleBar').style.width = '0';
    ['#odyleNext', '#odyleFull', '#odyleLeft'].forEach(s => { $(s).textContent = t('odyleSetBelow'); });
    return;
  }
  $('#odyleNow').textContent = `${st.current} / ${o.cap}`;
  const bar = $('#odyleBar');
  bar.style.width = Math.min(100, (st.current / o.cap) * 100) + '%';
  bar.classList.toggle('full', st.full);
  const now = Date.now();
  $('#odyleNext').textContent = st.nextTick ? `${fmtLocal(st.nextTick)} (${fmtCountdown(st.nextTick - now)})` : '—';
  $('#odyleFull').textContent = st.full ? t('odyleFullNow') : fmtLocal(st.capAt);
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
  const name = $('#timerName').value.trim() || t('timerDefaultName', { min: mins });
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
    $('#timerList').innerHTML = `<li class="empty">${esc(t('noTimers'))}</li>`;
    return;
  }
  $('#timerList').innerHTML = state.timers.map(tm => {
    const running = !tm.done && tm.endsAt > now;
    return `<li class="item ${running && tm.endsAt - now < 5 * MIN ? 'imminent' : ''}">
      <div class="name"><span class="t">${esc(tm.name)}</span><span class="chip" data-c="Timer">${tm.durationMin}m${tm.repeat ? ' ↻' : ''}</span></div>
      <div class="cd">${running ? fmtCountdown(tm.endsAt - now) : esc(t('done'))}</div>
      <div class="meta">${running ? esc(t('ends', { when: fmtLocal(tm.endsAt) })) : esc(t('finished'))}</div>
      <div class="actions">
        <button class="icon-btn" data-restart="${tm.id}" title="${esc(t('restart'))}">↺</button>
        <button class="icon-btn" data-remove="${tm.id}" title="${esc(t('remove'))}">✕</button>
      </div>
    </li>`;
  }).join('');
}

$('#timerList').addEventListener('click', async (e) => {
  const restart = e.target.closest('[data-restart]')?.dataset.restart;
  const remove = e.target.closest('[data-remove]')?.dataset.remove;
  if (restart) {
    const tm = state.timers.find(x => x.id === restart);
    tm.endsAt = Date.now() + tm.durationMin * MIN; tm.done = false;
  } else if (remove) {
    state.timers = state.timers.filter(x => x.id !== remove);
  } else return;
  await persist();
  renderTimers(); renderUpcoming();
});

/* ---------- Settings ---------- */
function fillSettings() {
  const s = state.settings;
  $('#lang').value = s.lang || 'auto';
  $('#region').value = s.region;
  $('#leadMinutes').value = s.leadMinutes;
  $('#notifyAtStart').checked = s.notifyAtStart;
  $('#overlay').checked = s.overlay;
  $('#overlaySeconds').value = s.overlaySeconds;
  $('#sound').checked = s.sound;
  $('#toast').checked = s.toast;
  renderCorner();
  autostart.isEnabled().then(on => { $('#autostart').checked = on; });
}

['leadMinutes', 'notifyAtStart', 'overlay', 'overlaySeconds', 'sound', 'toast'].forEach(id => {
  $('#' + id).addEventListener('change', async (e) => {
    const el = e.target;
    const s = state.settings;
    if (id === 'leadMinutes') s.leadMinutes = Math.max(0, Math.min(120, Math.floor(+el.value || 0)));
    else if (id === 'overlaySeconds') s.overlaySeconds = Math.max(3, Math.min(300, Math.floor(+el.value || 12)));
    else s[id] = el.checked;
    await persist();
    renderAll();
  });
});

$('#region').addEventListener('change', async (e) => {
  const region = e.target.value;
  if (!confirm(t('confirmRegion'))) { e.target.value = state.settings.region; return; }
  state.settings.region = region;
  state.events = mergeCatalog(region, state.events);
  editingId = null;
  await persist();
  renderEvents();
  renderAll();
});

$('#lang').addEventListener('change', async (e) => {
  state.settings.lang = e.target.value;
  setLang(state.settings.lang);
  translatePage();
  await persist();
  await pushTrayMenu();
});

/* Overlay corner picker */
function renderCorner() {
  const pos = state.settings.overlayPosition || 'top-right';
  $$('#cornerPicker .spot').forEach(b => {
    const on = b.dataset.pos === pos;
    b.classList.toggle('on', on);
    b.setAttribute('aria-checked', on);
  });
  $('#cornerName').textContent = t('pos_' + pos.replace('-', '_'));
}

$('#cornerPicker').addEventListener('click', async (e) => {
  const pos = e.target.closest('.spot')?.dataset.pos;
  if (!pos) return;
  state.settings.overlayPosition = pos;
  renderCorner();
  await persist();
  // Preview: show the test alert in the chosen corner.
  if (state.settings.overlay) await invoke('test_alert');
});

$('#autostart').addEventListener('change', async (e) => {
  try { await autostart.set(e.target.checked); } catch (err) { e.target.checked = !e.target.checked; }
});

$('#testAlert').addEventListener('click', async () => {
  await persist(); // make sure Rust has the current alert options
  await invoke('test_alert');
});

/* ---------- Scheduled events ---------- */
function renderEvents() {
  $('#eventList').innerHTML = state.events.map(ev => {
    const note = noteLabel(ev);
    return `
    <li class="item" data-id="${esc(ev.id)}">
      <div class="name"><span class="t">${esc(nameLabel(ev))}</span><span class="chip" data-c="${esc(ev.category)}">${esc(catLabel(ev.category))}</span></div>
      <div class="cd" style="color:var(--muted)">
        <label class="switch" title="${esc(t('enabled'))}"><input type="checkbox" data-toggle="${esc(ev.id)}" ${ev.enabled ? 'checked' : ''}><span></span></label>
      </div>
      <div class="meta">${esc(describeSchedule(ev))}${note ? ' · ' + esc(note) : ''}</div>
      <div class="actions"><button class="icon-btn" data-edit="${esc(ev.id)}" title="${esc(t('edit'))}">✎</button></div>
    </li>`;
  }).join('');
  if (editingId) openEditor(editingId);
}

function openEditor(id) {
  const li = $(`#eventList li[data-id="${CSS.escape(id)}"]`);
  if (!li) return;
  const ev = state.events.find(e => e.id === id);
  const node = $('#eventEditor').content.firstElementChild.cloneNode(true);
  applyI18n(node);
  $('.e-name', node).value = nameLabel(ev);
  $('.e-cat', node).value = ev.category;
  $('.e-type', node).value = ev.type;
  $('.e-times', node).value = (ev.times || []).join(', ');
  $('.e-anchor', node).value = ev.anchor || '00:00';
  $('.e-every', node).value = ev.every || 180;
  $('.e-duration', node).value = ev.duration || '';
  $('.e-note', node).value = noteLabel(ev);
  const days = $('.days', node);
  dayNames().forEach((d, i) => {
    const on = (ev.days || []).includes(i);
    const lab = document.createElement('label');
    lab.className = on ? 'on' : '';
    lab.innerHTML = `<input type="checkbox" value="${i}" ${on ? 'checked' : ''}>${esc(d)}`;
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
    const noteIn = $('.e-note', node).value.trim();
    const upd = {
      // An untouched translated name keeps the stored built-in name.
      name: (($('.e-name', node).value.trim() === nameLabel(ev)) ? ev.name : $('.e-name', node).value.trim()) || t('untitled'),
      category: $('.e-cat', node).value.trim() || t('defaultCategory'),
      type,
      duration: Math.max(0, Math.min(1440, Math.floor(+$('.e-duration', node).value || 0))) || undefined,
      // Untouched built-in notes stay translatable; anything typed replaces them.
      note: noteIn === noteLabel(ev) ? ev.note : noteIn
    };
    if (noteIn !== noteLabel(ev) && !noteIn) upd.noteKey = undefined;
    if (type === 'weekly') {
      upd.days = $$('.days input:checked', node).map(i => +i.value);
      upd.times = $('.e-times', node).value.split(',').map(s => s.trim()).filter(s => parseHM(s) !== null)
        .map(s => fmtHM(parseHM(s)));
      if (!upd.days.length || !upd.times.length) { alert(t('errWeekly')); return; }
    } else {
      const a = parseHM($('.e-anchor', node).value);
      const every = Math.floor(+$('.e-every', node).value);
      if (a === null || !(every >= 5)) { alert(t('errInterval')); return; }
      upd.anchor = fmtHM(a); upd.every = every;
    }
    Object.assign(ev, upd);
    editingId = null;
    await persist();
    renderEvents(); renderUpcoming();
  });
  $('.e-cancel', node).addEventListener('click', () => { editingId = null; renderEvents(); });
  $('.e-delete', node).addEventListener('click', async () => {
    if (!confirm(t('confirmDelete', { name: nameLabel(ev) }))) return;
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
    id, name: t('newEvent'), category: t('customCategory'), type: 'weekly',
    days: [0, 1, 2, 3, 4, 5, 6], times: ['20:00'], enabled: true, note: ''
  });
  editingId = id;
  await persist();
  renderEvents(); renderUpcoming();
});

$('#resetEvents').addEventListener('click', async () => {
  if (!confirm(t('confirmRestore'))) return;
  state.events = buildDefaultEvents(state.settings.region);
  editingId = null;
  await persist();
  renderEvents(); renderUpcoming();
});

/* ---------- Boot ---------- */
function renderAll() {
  renderClocks(); renderUpcoming(); renderOdyle(); renderTimers();
}

// Re-render everything that carries text after a language change.
function translatePage() {
  applyI18n();
  renderCorner();
  renderEvents();
  renderAll();
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
  setLang(state.settings.lang);
  applyI18n();
  fillSettings();
  fillOdyleForm();
  renderEvents();
  renderAll();
  await pushTrayMenu();
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
