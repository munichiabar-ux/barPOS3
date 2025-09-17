// ==== Konfiguration ====
const API = "https://script.google.com/macros/s/AKfycbwqGKgtD9TD27uSIdgZi3F5qs_gqUFH4GO0AbbZxIJM2JCdFj-8LL1YRgbD69Z7MUm-/exec";
const SECRET = "MachVollFodseAberZahlAuchDuKackBuxe";
const CLIENT_UUID = localStorage.getItem('client_uuid') || (() => {
  const u = crypto.randomUUID();
  localStorage.setItem('client_uuid', u);
  return u;
})();

// ==== Referenzen auf HTML-Elemente ====
const dots = { api: document.getElementById('dot-api'), webhook: document.getElementById('dot-webhook') };
const grid = document.getElementById('grid');
const toast = document.getElementById('toast');
const modeSpan = document.getElementById('mode');
const btnMode = document.getElementById('btn-mode');
const btnLeaderboard = document.getElementById('btn-leaderboard');

let seq = Number(localStorage.getItem('seq') || 0);
let queue = JSON.parse(localStorage.getItem('queue') || '[]');

// ==== Hilfsfunktionen ====
function longPress(el, cb) {
  let t; el.addEventListener('pointerdown', () => t = setTimeout(cb, 600));
  ['pointerup', 'pointerleave', 'pointercancel'].forEach(ev => el.addEventListener(ev, () => clearTimeout(t)));
}

function show(msg) {
  toast.textContent = msg;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 1200);
}

function persistQueue() { localStorage.setItem('queue', JSON.stringify(queue)); }

// ==== API-Aufrufe ====
async function apiGet(path, params = {}) {
  const url = new URL(API);
  url.searchParams.set('path', path);
  url.searchParams.set('secret', SECRET);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const r = await fetch(url.toString(), { cache: 'no-store' });
  if (!r.ok) throw new Error('API ' + path + ' ' + r.status);
  return r.json();
}

async function apiPost(path, body = {}) {
  const url = new URL(API);
  url.searchParams.set('path', path);
  if (path !== 'paypal-webhook') url.searchParams.set('secret', SECRET);
  const r = await fetch(url.toString(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  if (!r.ok) throw new Error('API ' + path + ' ' + r.status);
  return r.json();
}

// ==== Mitglieder-UI rendern ====
function renderMembers(members) {
  grid.innerHTML = '';
  const tpl = document.getElementById('row-tpl');
  for (const member of members) {
    const node = tpl.content.cloneNode(true);
    node.querySelector('.name').textContent = member.name;
    const btnW = node.querySelector('.white');
    const btnB = node.querySelector('.black');
    btnW.addEventListener('click', () => tap(member.id, 'soft', 1));
    btnB.addEventListener('click', () => tap(member.id, 'beer', 1));
    longPress(btnW, () => tap(member.id, 'soft', -1));
    longPress(btnB, () => tap(member.id, 'beer', -1));
    grid.appendChild(node);
  }
}

// ==== Taps (Knopfdrucks) ====
async function tap(member_id, type, qty) {
  const payload = { member_id, type, qty, client_uuid: CLIENT_UUID, seq: ++seq };
  localStorage.setItem('seq', String(seq));
  try {
    await apiPost('tap', payload);
    show(`${qty > 0 ? '+' : ''}${qty} ${type === 'beer' ? 'Bier' : 'Soft'}`);
  } catch (err) {
    queue.push({ path: 'tap', payload }); persistQueue();
    show('Offline – Vorgang wird nachgereicht');
  }
}

// ==== Queue abarbeiten ====
async function flushQueue() {
  if (!navigator.onLine || queue.length === 0) return;
  const pending = [...queue]; queue = [];
  for (const q of pending) {
    try { await apiPost(q.path, q.payload); }
    catch { queue.push(q); break; }
  }
  persistQueue();
}

// ==== Status-Check ====
async function refreshStatus() {
  try {
    const status = await apiGet('status');
    dots.api.classList.add(status.ok ? 'ok' : 'bad');
    modeSpan.textContent = `Modus: ${status.mode}`;
  } catch { }
}

// ==== Buttons ====
btnMode.addEventListener('click', async () => {
  const pin = prompt('Admin-PIN?');
  if (pin !== '1883') return;
  const cur = modeSpan.textContent.includes('kiosk') ? 'kiosk' : 'maintenance';
  const next = cur === 'kiosk' ? 'maintenance' : 'kiosk';
  await apiPost('mode', { mode: next });
  await refreshStatus();
});

btnLeaderboard.addEventListener('click', async () => {
  const { month, leaderboard } = await apiGet('leaderboard', { yyyy_mm: currentMonthKey() });
  alert('Leaderboard ' + month + '\n\n' + leaderboard.map((r, i) => `${i + 1}. ${r.name} – ${r.total_qty}`).join('\n'));
});

function currentMonthKey() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

// ==== Initialisierung ====
async function init() {
  try {
    const status = await apiGet('status');
    dots.api.classList.add(status.ok ? 'ok' : 'bad');
    modeSpan.textContent = `Modus: ${status.mode}`;
  } catch {
    dots.api.classList.add('bad');
  }

  try {
    const m = await apiGet('members');
    renderMembers(m.members);
  } catch (err) {
    show('Mitglieder laden fehlgeschlagen');
  }

  // Service Worker
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js');
  }

  // Status alle 30s
  setInterval(refreshStatus, 30000);

  // Queue bei Online flushen
  window.addEventListener('online', flushQueue);
  flushQueue();
}

// Start
init();
