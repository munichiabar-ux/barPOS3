const API = 'https://script.google.com/macros/s/AKfycbzm7Uy2hqccA7By-UMcftJ1CY1sNj9yN45unXx6YuyjUyOdYbhgHxZ0sn58ZWje4NhnAQ/exec'; // .../exec
const SECRET = 'MachVollFodseAberZahlAuchDuKackBuxe'; // wie in Settings
const CLIENT_UUID = localStorage.getItem('client_uuid') || (()=>{ const u=crypto.randomUUID(); localStorage.setItem('client_uuid',u); return u; })();


const dots = { api: document.getElementById('dot-api'), webhook: document.getElementById('dot-webhook') };
const grid = document.getElementById('grid');
const toast = document.getElementById('toast');
const modeSpan = document.getElementById('mode');
const btnMode = document.getElementById('btn-mode');
const btnLeaderboard = document.getElementById('btn-leaderboard');


let seq = Number(localStorage.getItem('seq')||0);
let queue = JSON.parse(localStorage.getItem('queue')||'[]');


function longPress(el, cb){
let t; el.addEventListener('pointerdown', ()=> t=setTimeout(cb, 600));
['pointerup','pointerleave','pointercancel'].forEach(ev=> el.addEventListener(ev, ()=> clearTimeout(t)));
}


async function tap(member_id, type, qty){
const payload = { member_id, type, qty, client_uuid: CLIENT_UUID, seq: ++seq };
localStorage.setItem('seq', String(seq));
try{
await apiPost('tap', payload);
show(`${qty>0?'+':''}${qty} ${type==='beer'?'Bier':'Soft'}`);
}catch(err){
queue.push({ path:'tap', payload }); persistQueue();
show('Offline – Vorgang wird nachgereicht');
}
}


function persistQueue(){ localStorage.setItem('queue', JSON.stringify(queue)); }


async function flushQueue(){
if (!navigator.onLine || queue.length===0) return;
const pending = [...queue]; queue = [];
for (const q of pending){
try{ await apiPost(q.path, q.payload); }
catch{ queue.push(q); break; }
}
persistQueue();
}


async function refreshStatus(){
try{
const status = await apiGet('status');
dots.api.classList.add(status.ok ? 'ok':'bad');
modeSpan.textContent = `Modus: ${status.mode}`;
}catch{}
}


btnMode.addEventListener('click', async ()=>{
const pin = prompt('Admin-PIN? (nur Zahlen, demo: 1234)');
if (pin !== '1883') return;
const cur = modeSpan.textContent.includes('kiosk') ? 'kiosk':'maintenance';
const next = cur==='kiosk' ? 'maintenance' : 'kiosk';
await apiPost('mode', { mode: next });
await refreshStatus();
});


btnLeaderboard.addEventListener('click', async ()=>{
const { month, leaderboard } = await apiGet('leaderboard', { yyyy_mm: currentMonthKey() });
alert('Leaderboard '+month+'\n\n' + leaderboard.map((r,i)=> `${i+1}. ${r.name} – ${r.total_qty}`).join('\n'));
});


function currentMonthKey(){
const d = new Date();
const y = d.getFullYear();
const m = String(d.getMonth()+1).padStart(2,'0');
return `${y}-${m}`;
}


init();
