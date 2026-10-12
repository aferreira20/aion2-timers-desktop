/* Overlay window: shows alert cards pushed by the Rust scheduler, then hides itself. */
const tauri = window.__TAURI__;
const stack = document.getElementById('stack');
const MAX_CARDS = 4;

function setPosition(position) {
  const [v, h] = (position || 'top-right').split('-');
  stack.className = `${v === 'bottom' ? 'bottom' : 'top'} ${h || 'right'}`;
}

function removeCard(card) {
  if (!card.isConnected || card.classList.contains('leaving')) return;
  card.classList.add('leaving');
  setTimeout(() => {
    card.remove();
    if (!stack.children.length && tauri) tauri.core.invoke('overlay_hide');
  }, 300);
}

function push(alert) {
  setPosition(alert.position);
  const card = document.createElement('div');
  card.className = `card ${alert.kind || 'warn'}`;

  const img = document.createElement('img');
  img.src = 'icons/icon48.png';
  img.alt = '';
  const title = document.createElement('div');
  title.className = 'title';
  title.textContent = alert.title;
  const body = document.createElement('div');
  body.className = 'body';
  body.textContent = alert.body;
  const bar = document.createElement('div');
  bar.className = 'bar';
  const seconds = Math.max(3, alert.seconds || 12);
  bar.style.animationDuration = `${seconds}s`;

  card.append(img, title, body, bar);
  // Newest card nearest the screen edge it is anchored to.
  if (stack.classList.contains('bottom')) stack.append(card); else stack.prepend(card);
  while (stack.children.length > MAX_CARDS) {
    stack.classList.contains('bottom') ? stack.firstElementChild.remove() : stack.lastElementChild.remove();
  }
  setTimeout(() => removeCard(card), seconds * 1000);
}

if (tauri) {
  tauri.event.listen('overlay:push', (e) => push(e.payload));
} else {
  // Opened in a normal browser: show a sample so the layout can be checked.
  push({ title: 'Guardian Lord Nahma in 5 min', body: 'Abyss Boss at 09:00. Lower Reshanta', kind: 'warn', seconds: 60 });
  push({ title: 'Executor Bosses — now!', body: 'Abyss Boss.', kind: 'start', seconds: 60 });
}
