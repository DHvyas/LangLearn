import { deriveKey, verifyCheck, encryptBytes, decryptBytes, bytesToB64, b64ToBytes } from './crypto.js';
import * as store from './store.js';

// ---------- people & languages ----------

const PEOPLE = {
  dhruv: { id: 'dhruv', name: 'Dhruv', native: 'gu', learns: 'bn', photo: 'avatar-dhruv' },
  sohini: { id: 'sohini', name: 'Sohini', native: 'bn', learns: 'gu', photo: 'avatar-sohini' },
};
const LANGS = {
  gu: { id: 'gu', name: 'Gujarati', teacher: 'dhruv', tts: 'gu', cheer: 'Shabash!', cheerMeaning: 'well done' },
  bn: { id: 'bn', name: 'Bengali', teacher: 'sohini', tts: 'bn', cheer: 'Darun!', cheerMeaning: 'amazing' },
};
const GALLERY = ['s3', 'd1', 's1', 'd2', 's2'];
const EMOJIS = ['💬', '❤️', '🍛', '☕', '😂', '🌙', '☀️', '🛍️', '🙏', '😴', '🎉', '🥺', '🏠', '🚗', '📞', '🌧️'];
const INTERVALS = [0, 1, 2, 4, 8, 16, 32, 64];
const other = (id) => (id === 'dhruv' ? 'sohini' : 'dhruv');

const S = { meta: null, key: null, me: null, phrases: [], view: 'today', revealed: new Set(), practiceLang: null, filter: 'all', q: '', loadedAt: 0 };

// ---------- tiny helpers ----------

const $ = (s, r = document) => r.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const localDate = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const today = () => localDate(new Date());
const addDays = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return localDate(d); };
const fmtDate = (s) => new Date(s + 'T12:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
const fmtMonth = (s) => new Date(s + 'T12:00').toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
const shuffle = (a) => { a = [...a]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const uid = (p) => p + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const byId = (id) => S.phrases.find((p) => p.id === id);
const vibrate = (p) => { try { navigator.vibrate?.(p); } catch {} };
const norm = (s) => s.toLowerCase().replace(/[^\p{L}\p{N} ]/gu, '').replace(/\s+/g, ' ').trim();

const ls = {
  get(k, d = null) { try { const v = localStorage.getItem('kc.' + k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem('kc.' + k, JSON.stringify(v)); } catch {} },
  del(k) { try { localStorage.removeItem('kc.' + k); } catch {} },
};

function idb() {
  return new Promise((res, rej) => {
    const r = indexedDB.open('kemcho', 1);
    r.onupgradeneeded = () => r.result.createObjectStore('kv');
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}
async function idbDo(mode, fn) {
  const db = await idb();
  return new Promise((res, rej) => {
    const q = fn(db.transaction('kv', mode).objectStore('kv'));
    q.onsuccess = () => res(q.result);
    q.onerror = () => rej(q.error);
  });
}
const idbGet = (k) => idbDo('readonly', (s) => s.get(k));
const idbSet = (k, v) => idbDo('readwrite', (s) => s.put(v, k));
const idbDel = (k) => idbDo('readwrite', (s) => s.delete(k));

const ICON = {
  sun: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>',
  spark: '<svg viewBox="0 0 24 24"><path d="M12 3l2.2 5.6L20 11l-5.8 2.4L12 19l-2.2-5.6L4 11l5.8-2.4z"/></svg>',
  plus: '<svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>',
  book: '<svg viewBox="0 0 24 24"><path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z"/><path d="M4 19V5M8 7h7"/></svg>',
  heart: '<svg viewBox="0 0 24 24"><path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/></svg>',
  gear: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg>',
  play: '<svg viewBox="0 0 24 24" class="fill"><path d="M8 5.5v13l11-6.5z"/></svg>',
  mic: '<svg viewBox="0 0 24 24"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/></svg>',
  stop: '<svg viewBox="0 0 24 24" class="fill"><rect x="7" y="7" width="10" height="10" rx="2"/></svg>',
  x: '<svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg>',
  edit: '<svg viewBox="0 0 24 24"><path d="M4 20h4L19 9l-4-4L4 16z"/></svg>',
  trash: '<svg viewBox="0 0 24 24"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/></svg>',
  search: '<svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="6"/><path d="M20 20l-4.5-4.5"/></svg>',
  lock: '<svg viewBox="0 0 24 24"><rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>',
  back: '<svg viewBox="0 0 24 24"><path d="M15 6l-6 6 6 6"/></svg>',
  ear: '<svg viewBox="0 0 24 24"><path d="M7 9a5 5 0 0 1 10 0c0 3-3 4-3 7a3 3 0 0 1-6 0"/><path d="M10 9a2 2 0 0 1 4 0"/></svg>',
  cards: '<svg viewBox="0 0 24 24"><rect x="3" y="6" width="13" height="15" rx="2"/><path d="M8 3h11a2 2 0 0 1 2 2v12"/></svg>',
  grid: '<svg viewBox="0 0 24 24"><rect x="4" y="4" width="7" height="7" rx="1.5"/><rect x="13" y="4" width="7" height="7" rx="1.5"/><rect x="4" y="13" width="7" height="7" rx="1.5"/><rect x="13" y="13" width="7" height="7" rx="1.5"/></svg>',
  quiz: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.6v.6M12 17h.01"/></svg>',
  blocks: '<svg viewBox="0 0 24 24"><rect x="3" y="14" width="8" height="6" rx="1.5"/><rect x="13" y="14" width="8" height="6" rx="1.5"/><rect x="8" y="5" width="8" height="6" rx="1.5"/></svg>',
};

// ---------- toast, confetti, sheets ----------

let toastTimer;
function toast(msg, ms = 2600) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  if (ms) toastTimer = setTimeout(() => t.classList.remove('show'), ms);
}

function confetti() {
  const c = $('#confetti');
  const x = c.getContext('2d');
  const dpr = devicePixelRatio || 1;
  c.width = innerWidth * dpr;
  c.height = innerHeight * dpr;
  x.scale(dpr, dpr);
  const colors = ['#E39B12', '#C8283D', '#F6C453', '#F28CA0', '#5B2A63', '#2FA58A'];
  const parts = Array.from({ length: 140 }, () => ({
    x: innerWidth / 2 + (Math.random() - 0.5) * 80, y: innerHeight * 0.45,
    vx: (Math.random() - 0.5) * 13, vy: -Math.random() * 15 - 4,
    r: Math.random() * Math.PI, vr: (Math.random() - 0.5) * 0.4,
    w: 6 + Math.random() * 6, h: 8 + Math.random() * 8, c: colors[(Math.random() * colors.length) | 0],
  }));
  const t0 = performance.now();
  (function frame(t) {
    x.clearRect(0, 0, innerWidth, innerHeight);
    for (const p of parts) {
      p.vy += 0.38; p.vx *= 0.99; p.x += p.vx; p.y += p.vy; p.r += p.vr;
      x.save(); x.translate(p.x, p.y); x.rotate(p.r); x.fillStyle = p.c; x.fillRect(-p.w / 2, -p.h / 2, p.w, p.h * Math.cos(p.r * 2)); x.restore();
    }
    if (t - t0 < 2600) requestAnimationFrame(frame);
    else x.clearRect(0, 0, innerWidth, innerHeight);
  })(t0);
  vibrate([20, 40, 20]);
}

const sheets = [];
function openSheet({ cls = '', full = false } = {}) {
  const wrap = document.createElement('div');
  wrap.className = `sheet-wrap ${full ? 'full' : ''}`;
  wrap.innerHTML = `<div class="sheet-backdrop"></div><section class="sheet ${cls}" role="dialog" aria-modal="true">
    <button class="icon-btn sheet-close" aria-label="Close">${ICON.x}</button><div class="sheet-body"></div></section>`;
  $('#sheet-root').appendChild(wrap);
  document.body.classList.add('locked-scroll');
  const sh = { el: wrap, body: $('.sheet-body', wrap), refresh: null, onClose: null };
  sh.close = () => {
    sh.onClose?.();
    wrap.classList.remove('open');
    setTimeout(() => wrap.remove(), 260);
    sheets.splice(sheets.indexOf(sh), 1);
    if (!sheets.length) document.body.classList.remove('locked-scroll');
  };
  $('.sheet-backdrop', wrap).onclick = sh.close;
  $('.sheet-close', wrap).onclick = sh.close;
  sheets.push(sh);
  requestAnimationFrame(() => wrap.classList.add('open'));
  return sh;
}
function refreshAll() {
  if (S.me) render();
  for (const sh of sheets) sh.refresh?.();
}

// ---------- photos ----------

const photoURLs = {};
const photo = (name, cls = '') => `<img class="${cls}" data-photo="${name}" alt="" ${photoURLs[name] ? `src="${photoURLs[name]}"` : ''}>`;
function avatar(id, size = 36) {
  return `<span class="av av-${id}" style="--s:${size}px"><b>${PEOPLE[id].name[0]}</b>${photo(PEOPLE[id].photo)}</span>`;
}
function hydratePhotos(root = document) {
  for (const img of root.querySelectorAll('img[data-photo]:not([src])')) {
    const n = img.dataset.photo;
    store.blobURL(`data/photos/${n}.enc`, 'image/jpeg').then((u) => {
      photoURLs[n] = u;
      document.querySelectorAll(`img[data-photo="${n}"]`).forEach((i) => { i.src = u; });
    }).catch(() => {});
  }
}

// ---------- audio: recordings + text-to-speech ----------

const player = new Audio();
function toDevanagari(s) {
  // Gujarati (U+0A80) and Bengali (U+0980) share the ISCII layout with Devanagari (U+0900).
  return [...s].map((ch) => {
    const c = ch.codePointAt(0);
    if ((c >= 0x0980 && c <= 0x09ff) || (c >= 0x0a80 && c <= 0x0aff)) return String.fromCodePoint(0x0900 + (c & 0x7f));
    return ch;
  }).join('');
}
function pickVoice(lang) {
  const voices = speechSynthesis.getVoices();
  const find = (pre) => voices.find((v) => v.lang.toLowerCase().replace('_', '-').startsWith(pre));
  return { native: find(LANGS[lang].tts + '-') || find(LANGS[lang].tts), hindi: find('hi-'), en: find('en-in') };
}
function speak(p, lang) {
  if (!('speechSynthesis' in window)) return toast('This browser has no voice. Ask for a recording!');
  const e = p[lang];
  const v = pickVoice(lang);
  let text = e.script || e.roman;
  let voice = v.native;
  if (!voice && e.script && v.hindi) { voice = v.hindi; text = toDevanagari(e.script); }
  if (!voice) { voice = v.en; text = e.roman; }
  const u = new SpeechSynthesisUtterance(text);
  if (voice) { u.voice = voice; u.lang = voice.lang; } else u.lang = LANGS[lang].tts + '-IN';
  u.rate = 0.82;
  speechSynthesis.cancel();
  speechSynthesis.speak(u);
}
async function playPath(path, mime) {
  try {
    player.src = await store.blobURL(path, mime);
    await player.play();
  } catch (e) {
    console.error(e);
    toast("Couldn't play that recording");
  }
}
function playPhrase(p, lang) {
  const a = p.audio?.[lang];
  if (a) playPath(a.path, a.mime);
  else speak(p, lang);
}
function playBtn(p, lang, big = false) {
  const rec = p.audio?.[lang];
  const label = rec ? `${PEOPLE[LANGS[lang].teacher].name}'s voice` : 'Listen';
  return `<button class="play ${lang} ${big ? 'big' : ''} ${rec ? 'has-rec' : ''}" data-act="play" data-id="${p.id}" data-lang="${lang}" aria-label="Play">${ICON.play}${big ? '' : `<span>${label}</span>`}</button>`;
}

// ---------- spaced repetition (per phone, per person) ----------

const srsGet = (lang) => ls.get(`srs.${S.me}.${lang}`, {});
const srsSet = (lang, d) => ls.set(`srs.${S.me}.${lang}`, d);
const pool = (lang) => S.phrases.filter((p) => p.english && p[lang]?.roman);
const dueList = (lang) => { const d = srsGet(lang), t = today(); return pool(lang).filter((p) => d[p.id] && d[p.id].due <= t); };
const learnedCount = (lang) => { const d = srsGet(lang); return pool(lang).filter((p) => (d[p.id]?.box || 0) >= 3).length; };

function markPracticed() {
  const days = ls.get(`practice.${S.me}`, []);
  if (!days.includes(today())) { days.push(today()); ls.set(`practice.${S.me}`, days.slice(-400)); }
}
function runStreak(dates) {
  const set = new Set(dates);
  const d = new Date();
  if (!set.has(localDate(d))) d.setDate(d.getDate() - 1);
  let n = 0;
  while (set.has(localDate(d))) { n++; d.setDate(d.getDate() - 1); }
  return n;
}

// ---------- boot & lock ----------

async function boot() {
  try {
    S.meta = await (await fetch('data/meta.json?t=' + Date.now(), { cache: 'no-store' })).json();
  } catch {
    $('#app').innerHTML = '<div class="fatal">Couldn\'t reach the site. Check your connection and refresh.</div>';
    return;
  }
  let k = null;
  try { k = await idbGet('key'); } catch {}
  if (k && (await verifyCheck(k, S.meta.check))) return unlocked(k, false);
  renderLock();
}

function renderLock() {
  let pin = '';
  let busy = false;
  $('#app').innerHTML = `
  <div class="lock">
    <div class="lock-glow"></div>
    <div class="lock-art" aria-hidden="true"><span class="glyph gu">ક</span><span class="bridge"></span><span class="glyph bn">ক</span></div>
    <h1 class="lock-title"><span class="gu-t">Kem cho?</span> <span class="bn-t">Kemon acho?</span></h1>
    <p class="lock-sub">A little place just for D &amp; S</p>
    <div class="dots" aria-live="polite">${'<i></i>'.repeat(6)}</div>
    <div class="keypad">
      ${[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => `<button data-k="${n}">${n}</button>`).join('')}
      <span></span><button data-k="0">0</button><button data-k="del" aria-label="Delete">⌫</button>
    </div>
    <label class="remember"><input type="checkbox" id="remember" checked> Keep me unlocked on this device</label>
  </div>`;
  const dots = [...document.querySelectorAll('.dots i')];
  const paint = () => dots.forEach((d, i) => d.classList.toggle('on', i < pin.length));
  async function press(k) {
    if (busy) return;
    if (k === 'del') pin = pin.slice(0, -1);
    else if (pin.length < 6) pin += k;
    vibrate(8);
    paint();
    if (pin.length === 6) {
      busy = true;
      $('.lock').classList.add('busy');
      const key = await deriveKey(pin, S.meta.salt, S.meta.iterations);
      if (await verifyCheck(key, S.meta.check)) {
        $('.lock').classList.add('success');
        vibrate([10, 30, 10]);
        setTimeout(() => unlocked(key, $('#remember').checked), 450);
      } else {
        $('.lock').classList.remove('busy');
        $('.dots').classList.add('shake');
        vibrate([60, 40, 60]);
        setTimeout(() => { $('.dots').classList.remove('shake'); pin = ''; paint(); busy = false; }, 500);
      }
    }
  }
  $('.keypad').onclick = (e) => { const b = e.target.closest('[data-k]'); if (b) press(b.dataset.k); };
  document.onkeydown = (e) => {
    if (!$('.lock')) return;
    if (/^\d$/.test(e.key)) press(e.key);
    else if (e.key === 'Backspace') press('del');
  };
}

async function unlocked(key, remember) {
  S.key = key;
  store.setKey(key);
  if (remember) { try { await idbSet('key', key); } catch {} }
  const tok = ls.get('token');
  if (tok) { try { store.setToken(new TextDecoder().decode(await decryptBytes(key, b64ToBytes(tok)))); } catch {} }
  S.me = ls.get('me');
  if (!S.me) return renderWho();
  start();
}

function renderWho() {
  $('#app').innerHTML = `
  <div class="who">
    <h1>Who's here?</h1>
    <p>This phone will remember you. You can switch anytime in settings.</p>
    <div class="who-grid">
      ${['dhruv', 'sohini'].map((id) => `
        <button class="who-card ${id}" data-who="${id}">
          ${photo(PEOPLE[id].photo, 'who-photo')}
          <strong>I'm ${PEOPLE[id].name}</strong>
          <span>Learning ${LANGS[PEOPLE[id].learns].name}</span>
        </button>`).join('')}
    </div>
  </div>`;
  hydratePhotos();
  $('.who-grid').onclick = (e) => {
    const b = e.target.closest('[data-who]');
    if (!b) return;
    S.me = b.dataset.who;
    ls.set('me', S.me);
    start();
  };
}

async function start() {
  $('#app').innerHTML = `<div class="loading"><div class="lock-art small"><span class="glyph gu">ક</span><span class="bridge"></span><span class="glyph bn">ক</span></div><p>Opening your phrasebook…</p></div>`;
  try {
    await reload();
  } catch (e) {
    console.error(e);
    $('#app').innerHTML = `<div class="fatal">Couldn't open the phrasebook.<br><small>${esc(e.message)}</small><br><button class="btn" onclick="location.reload()">Try again</button></div>`;
    return;
  }
  render();
}

async function reload() {
  S.phrases = await store.loadPhrases();
  S.loadedAt = Date.now();
}

document.addEventListener('visibilitychange', async () => {
  if (document.visibilityState !== 'visible' || !S.me || Date.now() - S.loadedAt < 30000) return;
  try { await reload(); refreshAll(); } catch {}
});

// ---------- shell ----------

const TABS = [['today', 'Today', ICON.sun], ['practice', 'Practice', ICON.spark], ['add', 'Add', ICON.plus], ['journey', 'Journey', ICON.book], ['us', 'Us', ICON.heart]];

function render() {
  $('#app').innerHTML = `
  <div class="shell">
    <header class="top">
      <button class="couple" data-act="tab" data-tab="us" aria-label="Us">${avatar('dhruv', 34)}${avatar('sohini', 34)}</button>
      <div class="brand"><span class="gu-t">Kem cho</span><i>×</i><span class="bn-t">Kemon acho</span></div>
      <button class="icon-btn" data-act="settings" aria-label="Settings">${ICON.gear}</button>
    </header>
    ${store.hasToken() ? '' : `<button class="banner" data-act="settings">Read-only on this phone. <u>Connect GitHub</u> to add phrases and voices.</button>`}
    <main class="view view-${S.view}">${VIEWS[S.view]()}</main>
    <nav class="tabs">
      ${TABS.map(([id, label, icon]) => id === 'add'
        ? `<button class="tab-add" data-act="add" aria-label="Add a phrase">${icon}</button>`
        : `<button class="tab ${S.view === id ? 'on' : ''}" data-act="tab" data-tab="${id}">${icon}<span>${label}</span></button>`).join('')}
    </nav>
  </div>`;
  hydratePhotos();
}

// ---------- views ----------

function greeting() {
  const h = new Date().getHours();
  const slot = h < 12 ? 0 : h < 17 ? 1 : h < 21 ? 2 : 3;
  const lang = PEOPLE[S.me].learns;
  const words = {
    bn: ['Shubho sokal', 'Shubho dupur', 'Shubho shondhya', 'Shubho ratri'],
    gu: ['Suprabhat', 'Shubh bapor', 'Shubh saanj', 'Shubh ratri'],
  }[lang];
  const meaning = ['Good morning', 'Good afternoon', 'Good evening', 'Good night'][slot];
  return { text: words[slot], meaning, lang };
}

function inboxItems() {
  const me = S.me, partner = other(me), mine = PEOPLE[me].native, seen = new Set(ls.get('seenReactions', []));
  const items = [];
  for (const p of S.phrases) {
    for (const a of p.attempts || []) {
      if (a.by === partner && !a.reaction) items.push({ type: 'attempt', p, a });
      if (a.by === me && a.reaction && !seen.has(a.id)) items.push({ type: 'reaction', p, a });
    }
    if (p.english && !p[mine]?.roman) items.push({ type: 'fill', p });
  }
  const needVoice = S.phrases.filter((p) => p[mine]?.roman && !p.audio?.[mine]);
  needVoice.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  if (needVoice.length) items.push({ type: 'voice', list: needVoice });
  return items;
}

function inboxHTML() {
  const partner = PEOPLE[other(S.me)];
  const mine = LANGS[PEOPLE[S.me].native];
  const items = inboxItems();
  if (!items.length) return '';
  return `<section class="inbox"><h3 class="sec-title">For you</h3>${items.map((it) => {
    if (it.type === 'attempt') return `
      <div class="inbox-item attempt">
        ${avatar(partner.id, 40)}
        <div class="ii-text"><strong>${partner.name} tried your ${mine.name}!</strong><span>"${esc(it.p[it.a.lang]?.roman)}"</span></div>
        <div class="ii-actions">
          <button class="play mini" data-act="play-attempt" data-id="${it.p.id}" data-aid="${it.a.id}" aria-label="Listen">${ICON.play}</button>
          <button class="btn small" data-act="react" data-id="${it.p.id}" data-aid="${it.a.id}" data-r="shabash">Shabash 👏</button>
          <button class="btn small ghost" data-act="react" data-id="${it.p.id}" data-aid="${it.a.id}" data-r="again">Again 🔁</button>
        </div>
      </div>`;
    if (it.type === 'reaction') return `
      <button class="inbox-item reaction ${it.a.reaction}" data-act="seen-reaction" data-aid="${it.a.id}">
        ${avatar(partner.id, 40)}
        <div class="ii-text"><strong>${it.a.reaction === 'shabash' ? `${partner.name} says Shabash! 🎉` : `${partner.name} says: almost, try again 🔁`}</strong><span>on your "${esc(it.p[it.a.lang]?.roman)}"</span></div>
        <span class="ii-x">${ICON.x}</span>
      </button>`;
    if (it.type === 'fill') return `
      <button class="inbox-item fill" data-act="edit" data-id="${it.p.id}">
        <span class="ii-emoji">${esc(it.p.emoji || '✍️')}</span>
        <div class="ii-text"><strong>How do you say this in ${mine.name}?</strong><span>"${esc(it.p.english)}" · ${partner.name} is waiting</span></div>
      </button>`;
    return `
      <button class="inbox-item voice" data-act="open" data-id="${it.list[0].id}">
        <span class="ii-emoji">🎙️</span>
        <div class="ii-text"><strong>${it.list.length} phrase${it.list.length > 1 ? 's' : ''} need your voice</strong><span>${partner.name} learns best hearing you. Start with "${esc(it.list[0].english)}"</span></div>
      </button>`;
  }).join('')}</section>`;
}

function viewToday() {
  const me = PEOPLE[S.me], partner = PEOPLE[other(S.me)];
  const g = greeting();
  const tp = S.phrases.find((p) => p.date === today());
  const dated = S.phrases.filter((p) => p.date).sort((a, b) => a.date.localeCompare(b.date));
  const last = dated[dated.length - 1];
  const turn = last ? other(last.addedBy) : S.me;
  const streak = runStreak(dated.map((p) => p.date));
  const due = dueList(me.learns).length;
  let hero;
  if (tp) hero = phraseCard(tp, { hero: true });
  else {
    const starter = shuffle(S.phrases.filter((p) => p.starter && !srsGet(me.learns)[p.id]))[0] || S.phrases[0];
    hero = `<article class="pcard hero empty">
      <div class="turn">${avatar(turn, 64)}</div>
      <h2 class="english">${turn === S.me ? "It's your turn to pick today's phrase" : `${partner.name}'s turn to pick today's phrase`}</h2>
      <p class="muted">${turn === S.me ? `Something you'd actually say to ${partner.name} today. Add your ${LANGS[me.native].name}; ${partner.name} adds the ${LANGS[me.learns].name}.` : `Nudge ${partner.name} 😉 or go ahead and add one yourself.`}</p>
      <button class="btn wide" data-act="add">Add today's phrase</button>
      ${starter ? `<button class="mini-starter" data-act="open" data-id="${starter.id}"><span>${esc(starter.emoji)}</span><div><small>While you wait, try</small><b>${esc(starter.english)}</b><i class="${me.learns}-t">${esc(starter[me.learns]?.roman)}</i></div></button>` : ''}
    </article>`;
  }
  return `
    <section class="hello">
      <p class="hello-kicker">${g.meaning} in ${LANGS[g.lang].name}, from ${partner.name}</p>
      <h1 class="hello-title"><span class="${g.lang}-t">${g.text}</span>, ${me.name}!</h1>
      <div class="chips">
        <span class="stat"><b>${streak}</b> day streak 🔥</span>
        <span class="stat"><b>${dated.length}</b> shared phrases</span>
        <button class="stat link" data-act="tab" data-tab="practice"><b>${due}</b> to review</button>
      </div>
    </section>
    ${hero}
    ${inboxHTML()}
    <button class="practice-cta" data-act="tab" data-tab="practice">
      <div><b>Five minutes of ${LANGS[me.learns].name}?</b><span>${due ? `${due} card${due > 1 ? 's' : ''} ready for review` : 'Play a quick game together with the phrases'}</span></div>
      <span class="cta-arrow">→</span>
    </button>`;
}

function phraseCard(p, { hero = false } = {}) {
  const me = PEOPLE[S.me];
  const halves = [me.learns, me.native].map((lang) => half(p, lang, hero && lang === me.learns && !S.revealed.has(p.id))).join('');
  const tag = p.date ? (p.date === today() ? "Today's phrase" : fmtDate(p.date)) : 'Starter pack';
  const by = p.addedBy ? ` · picked by ${p.addedBy === S.me ? 'you' : PEOPLE[p.addedBy].name}` : '';
  return `<article class="pcard ${hero ? 'hero' : ''}">
    <div class="pcard-top"><span class="emoji">${esc(p.emoji || '💬')}</span><span class="chip">${tag}${by}</span></div>
    <h2 class="english">${esc(p.english)}</h2>
    <div class="halves">${halves}</div>
    ${p.note ? `<p class="note"><span>✨</span>${esc(p.note)}</p>` : ''}
    <div class="card-actions">${cardActions(p)}</div>
  </article>`;
}

function half(p, lang, hidden) {
  const t = LANGS[lang].teacher, e = p[lang];
  const label = `${avatar(t, 22)}<span>${PEOPLE[t].name}'s ${LANGS[lang].name}</span>`;
  if (!e?.roman) {
    return `<div class="half ${lang} missing"><div class="half-label">${label}</div>${t === S.me
      ? `<button class="btn small" data-act="edit" data-id="${p.id}">✍️ Add your ${LANGS[lang].name}</button>`
      : `<div class="waiting">Waiting for ${PEOPLE[t].name} to add it ✍️</div>`}</div>`;
  }
  return `<div class="half ${lang} ${hidden ? 'hidden' : ''}" ${hidden ? `data-act="reveal" data-id="${p.id}"` : ''}>
    <div class="half-label">${label}</div>
    <div class="roman">${esc(e.roman)}</div>
    ${hidden ? '<div class="reveal-hint">Guess first, then tap to reveal</div>' : playBtn(p, lang)}
  </div>`;
}

function cardActions(p) {
  const me = PEOPLE[S.me], partner = PEOPLE[other(S.me)], out = [];
  if (p[me.native]?.roman) {
    out.push(p.audio?.[me.native]
      ? `<button class="btn small ghost" data-act="record" data-id="${p.id}" data-lang="${me.native}" data-kind="teach">${ICON.mic} Re-record</button>`
      : `<button class="btn small ${me.native}" data-act="record" data-id="${p.id}" data-lang="${me.native}" data-kind="teach">${ICON.mic} Record it for ${partner.name}</button>`);
  }
  if (p[me.learns]?.roman) out.push(`<button class="btn small ${me.learns}" data-act="record" data-id="${p.id}" data-lang="${me.learns}" data-kind="attempt">🗣️ Try saying it</button>`);
  return out.join('');
}

function viewPractice() {
  const lang = S.practiceLang || PEOPLE[S.me].learns;
  const total = pool(lang).length, learned = learnedCount(lang), due = dueList(lang).length;
  const pct = total ? Math.round((learned / total) * 100) : 0;
  const pdays = ls.get(`practice.${S.me}`, []);
  const modes = [
    ['flash', ICON.cards, 'Flashcards', due ? `${due} due · spaced repetition` : 'Smart review that remembers what you forget'],
    ['match', ICON.grid, 'Match pairs', `Race the clock${ls.get(`best.${S.me}.${lang}`) ? ` · best ${ls.get(`best.${S.me}.${lang}`)}s` : ''}`],
    ['quiz', ICON.quiz, 'Quick quiz', '8 questions, both directions'],
    ['build', ICON.blocks, 'Build it', 'Put the words in the right order'],
    ['listen', ICON.ear, 'Listen & guess', `Tune your ear to ${PEOPLE[LANGS[lang].teacher].name}'s voice`],
  ];
  return `
    <section class="practice-hero ${lang}">
      <div class="seg">
        ${['bn', 'gu'].map((l) => `<button class="${l === lang ? 'on' : ''}" data-act="plang" data-lang="${l}">${LANGS[l].name}</button>`).join('')}
      </div>
      <div class="ring" style="--p:${pct}"><div><b>${learned}</b><span>of ${total}</span></div></div>
      <h2>${learned ? `${LANGS[lang].cheer} You know ${learned} ${LANGS[lang].name} phrase${learned > 1 ? 's' : ''}` : `Let's start your ${LANGS[lang].name}`}</h2>
      <p class="muted">${runStreak(pdays)} day practice streak · a phrase counts as known after 3 good reviews</p>
    </section>
    <section class="modes">
      ${modes.map(([id, icon, title, sub]) => `
        <button class="mode m-${id}" data-act="game" data-game="${id}">
          <span class="mode-icon">${icon}</span>
          <span class="mode-text"><b>${title}</b><small>${sub}</small></span>
        </button>`).join('')}
    </section>`;
}

function viewJourney() {
  return `
    <section class="journey-head">
      <h1>Our phrasebook</h1>
      <label class="search">${ICON.search}<input id="q" type="search" placeholder="Search in any language…" value="${esc(S.q)}"></label>
      <div class="filters">
        ${[['all', 'All'], ['daily', 'Our daily phrases'], ['starter', 'Starter pack'], ['voice', 'Needs a voice']].map(([id, l]) => `<button class="${S.filter === id ? 'on' : ''}" data-act="filter" data-f="${id}">${l}</button>`).join('')}
      </div>
    </section>
    <section class="timeline">${timelineHTML()}</section>`;
}

function timelineHTML() {
  const q = norm(S.q || '');
  const me = PEOPLE[S.me];
  let list = S.phrases.filter((p) => {
    if (S.filter === 'daily' && !p.date) return false;
    if (S.filter === 'starter' && !p.starter) return false;
    if (S.filter === 'voice' && p.audio?.gu && p.audio?.bn) return false;
    if (!q) return true;
    return norm([p.english, p.gu?.roman, p.bn?.roman, p.note].join(' ')).includes(q);
  });
  const daily = list.filter((p) => p.date).sort((a, b) => b.date.localeCompare(a.date) || (b.createdAt || '').localeCompare(a.createdAt || ''));
  const starters = list.filter((p) => !p.date);
  const groups = [];
  for (const p of daily) {
    const m = fmtMonth(p.date);
    if (groups[groups.length - 1]?.m !== m) groups.push({ m, items: [] });
    groups[groups.length - 1].items.push(p);
  }
  const srs = srsGet(me.learns);
  const row = (p) => `
    <button class="jrow ${p.addedBy || 'starter'}" data-act="open" data-id="${p.id}">
      <span class="jdot">${p.addedBy ? avatar(p.addedBy, 30) : `<span class="jemoji">${esc(p.emoji || '💬')}</span>`}</span>
      <span class="jbody">
        <span class="jtop">${p.date ? `<em>${fmtDate(p.date)}</em>` : ''}<b>${esc(p.english)}</b></span>
        <span class="jlangs"><span class="gu-t">${esc(p.gu?.roman || '…')}</span><span class="bn-t">${esc(p.bn?.roman || '…')}</span></span>
      </span>
      <span class="jmeta">
        <span class="mastery" title="How well you know it">${[1, 2, 3].map((i) => `<i class="${(srs[p.id]?.box || 0) >= i ? 'on' : ''}"></i>`).join('')}</span>
        <span class="mics">${p.audio?.gu ? '<i class="gu"></i>' : ''}${p.audio?.bn ? '<i class="bn"></i>' : ''}</span>
      </span>
    </button>`;
  return `
      ${groups.map((g) => `<h3 class="sec-title">${g.m}</h3>${g.items.map(row).join('')}`).join('')}
      ${starters.length ? `<h3 class="sec-title">Starter pack <small>Edit these to sound like home</small></h3>${starters.map(row).join('')}` : ''}
      ${!list.length ? '<p class="empty-note">Nothing matches. Maybe it\'s tomorrow\'s phrase? 😉</p>' : ''}`;
}

function viewUs() {
  const stats = (id) => {
    let voices = 0, tries = 0, shabash = 0;
    for (const p of S.phrases) {
      for (const a of Object.values(p.audio || {})) if (a.by === id) voices++;
      for (const a of p.attempts || []) if (a.by === id) { tries++; if (a.reaction === 'shabash') shabash++; }
    }
    return { picked: S.phrases.filter((p) => p.addedBy === id).length, voices, tries, shabash };
  };
  const dated = S.phrases.filter((p) => p.date).map((p) => p.date).sort();
  const days = dated.length ? Math.round((new Date(today()) - new Date(dated[0])) / 864e5) + 1 : 0;
  const bios = {
    dhruv: 'Gujarati at heart, grew up in Kuwait',
    sohini: 'Bengali through and through, grew up in Bengal',
  };
  return `
    <section class="us-hero">
      <figure class="polaroid big" data-act="photo" data-photo-name="us">${photo('us')}<figcaption>Dhruv &amp; Sohini</figcaption></figure>
      <p class="us-line">One Gujarati from Kuwait. One Bengali from Bengal.<br><span>In Bengali, love is <i>bhalobasha</i>: literally a good place to live.</span></p>
      ${days ? `<p class="muted center">${days} day${days > 1 ? 's' : ''} of learning each other's languages</p>` : ''}
    </section>
    <section class="people">
      ${['dhruv', 'sohini'].map((id) => { const s = stats(id); return `
        <div class="person ${id}">
          ${avatar(id, 72)}
          <h3>${PEOPLE[id].name}</h3>
          <p class="muted">${bios[id]}</p>
          <p class="teaches">Teaches <b>${LANGS[PEOPLE[id].native].name}</b> · learning <b>${LANGS[PEOPLE[id].learns].name}</b></p>
          <dl>
            <div><dt>${s.picked}</dt><dd>phrases picked</dd></div>
            <div><dt>${s.voices}</dt><dd>voice notes</dd></div>
            <div><dt>${s.tries}</dt><dd>tries</dd></div>
            <div><dt>${s.shabash}</dt><dd>shabash 👏</dd></div>
          </dl>
        </div>`; }).join('')}
    </section>
    <section class="gallery">
      ${GALLERY.map((n, i) => `<figure class="polaroid tilt${i % 3}" data-act="photo" data-photo-name="${n}">${photo(n)}</figure>`).join('')}
    </section>
    <button class="btn ghost wide" data-act="settings">${ICON.gear} Settings</button>`;
}

const VIEWS = { today: viewToday, practice: viewPractice, journey: viewJourney, us: viewUs };

// ---------- writes ----------

function needToken() {
  if (store.hasToken()) return false;
  toast('Connect GitHub in settings first, so changes reach both phones');
  openSettings();
  return true;
}

async function save(fn, message, okMsg = 'Saved ✓') {
  toast('Saving…', 0);
  try {
    S.phrases = await store.mutatePhrases(fn, message);
    S.loadedAt = Date.now();
    toast(okMsg);
    refreshAll();
    return true;
  } catch (e) {
    console.error(e);
    toast(e.message === 'NO_TOKEN' ? 'Connect GitHub in settings first' : `Couldn't save: ${e.message}`, 4000);
    return false;
  }
}

// ---------- sheets: phrase detail, form, recorder, settings ----------

function openPhrase(id) {
  const sh = openSheet({ cls: 'detail' });
  sh.refresh = () => {
    const p = byId(id);
    if (!p) return sh.close();
    const me = PEOPLE[S.me], partner = PEOPLE[other(S.me)];
    const box = srsGet(me.learns)[p.id]?.box || 0;
    const attempts = (p.attempts || []).slice().reverse();
    sh.body.innerHTML = `
      ${phraseCard(p)}
      <div class="detail-meta">
        <span>Your ${LANGS[me.learns].name}: <span class="mastery">${[1, 2, 3].map((i) => `<i class="${box >= i ? 'on' : ''}"></i>`).join('')}</span> ${box >= 3 ? 'known 🎉' : box ? 'getting there' : 'new'}</span>
      </div>
      ${attempts.length ? `<h3 class="sec-title">Tries</h3><div class="attempts">${attempts.map((a) => `
        <div class="attempt-row">
          ${avatar(a.by, 32)}
          <div class="ar-text"><b>${a.by === S.me ? 'You' : PEOPLE[a.by].name}</b> tried the ${LANGS[a.lang].name}<small>${fmtDate(a.at.slice(0, 10))}${a.reaction ? ` · ${a.reaction === 'shabash' ? 'Shabash 👏' : 'try again 🔁'}` : ''}</small></div>
          <button class="play mini" data-act="play-attempt" data-id="${p.id}" data-aid="${a.id}" aria-label="Listen">${ICON.play}</button>
          ${a.by === partner.id && !a.reaction ? `<button class="btn small" data-act="react" data-id="${p.id}" data-aid="${a.id}" data-r="shabash">👏</button>` : ''}
        </div>`).join('')}</div>` : ''}
      <div class="detail-actions">
        <button class="btn ghost" data-act="edit" data-id="${p.id}">${ICON.edit} Edit</button>
        <button class="btn ghost danger" data-act="delete" data-id="${p.id}">${ICON.trash} Delete</button>
      </div>`;
    hydratePhotos(sh.el);
  };
  sh.refresh();
}

function openForm(id = null) {
  if (needToken()) return;
  const p = id ? byId(id) : null;
  const me = PEOPLE[S.me], partner = PEOPLE[other(S.me)];
  const noToday = !S.phrases.some((x) => x.date === today());
  const sh = openSheet({ cls: 'form' });
  let emoji = p?.emoji || '💬';
  const langField = (lang) => {
    const t = PEOPLE[LANGS[lang].teacher];
    const isMine = t.id === S.me;
    return `<label class="field ${lang}">
      <span class="field-label">${avatar(t.id, 22)} ${LANGS[lang].name} <small>${isMine ? 'your language' : `${t.name}'s language`}</small></span>
      <input name="${lang}" autocomplete="off" autocapitalize="sentences" value="${esc(p?.[lang]?.roman)}" placeholder="${isMine ? (lang === 'gu' ? 'e.g. Kem cho?' : 'e.g. Kemon acho?') : `Leave blank and ${t.name} fills it in`}">
    </label>`;
  };
  sh.body.innerHTML = `
    <form class="phrase-form">
      <h2>${p ? 'Edit phrase' : noToday ? "Today's phrase" : 'New phrase'}</h2>
      <label class="field">
        <span class="field-label">In English</span>
        <input name="english" required autocomplete="off" value="${esc(p?.english)}" placeholder="What do you want to say?">
      </label>
      <div class="emoji-pick">${EMOJIS.map((e) => `<button type="button" class="${e === emoji ? 'on' : ''}" data-e="${e}">${e}</button>`).join('')}</div>
      ${langField(me.native)}
      ${langField(me.learns)}
      <label class="field">
        <span class="field-label">A little note <small>optional · usage, story, inside joke</small></span>
        <textarea name="note" rows="2" placeholder="e.g. Ma says this every time I call">${esc(p?.note)}</textarea>
      </label>
      <details class="script-box">
        <summary>Native script for the computer voice <small>optional, never shown on cards</small></summary>
        <label class="field"><span class="field-label">Gujarati script</span><input name="gu_script" lang="gu" value="${esc(p?.gu?.script)}" placeholder="કેમ છો?"></label>
        <label class="field"><span class="field-label">Bengali script</span><input name="bn_script" lang="bn" value="${esc(p?.bn?.script)}" placeholder="কেমন আছো?"></label>
      </details>
      ${!p ? `<label class="check"><input type="checkbox" name="today" ${noToday ? 'checked' : ''}> Make this today's phrase</label>` : ''}
      <button class="btn wide" type="submit">${p ? 'Save changes' : `Add${noToday ? ' & share with ' + partner.name : ''}`}</button>
    </form>`;
  hydratePhotos(sh.el);
  $('.emoji-pick', sh.el).onclick = (e) => {
    const b = e.target.closest('[data-e]');
    if (!b) return;
    emoji = b.dataset.e;
    sh.el.querySelectorAll('.emoji-pick button').forEach((x) => x.classList.toggle('on', x === b));
  };
  $('form', sh.el).onsubmit = async (e) => {
    e.preventDefault();
    const f = new FormData(e.target);
    const val = (k) => (f.get(k) || '').toString().trim();
    if (!val('gu') && !val('bn')) return toast('Add at least one language');
    const entry = (lang) => (val(lang) ? { roman: val(lang), ...(val(lang + '_script') ? { script: val(lang + '_script') } : {}) } : null);
    const fields = { english: val('english'), emoji, note: val('note'), gu: entry('gu'), bn: entry('bn') };
    const newId = uid('p');
    const ok = await save((list) => {
      if (p) {
        const t = list.find((x) => x.id === p.id);
        if (t) Object.assign(t, fields, { editedAt: new Date().toISOString() });
      } else {
        list.push({ id: newId, ...fields, date: f.get('today') ? today() : null, addedBy: S.me, createdAt: new Date().toISOString(), starter: false, audio: {}, attempts: [] });
      }
    }, p ? 'Edit a phrase' : 'Add a phrase', p ? 'Saved ✓' : 'Added! 💌');
    if (ok) {
      sh.close();
      if (!p) { confetti(); openPhrase(newId); }
    }
  };
}

function openRecorder(id, lang, kind) {
  if (needToken()) return;
  const p = byId(id);
  if (!p) return;
  const partner = PEOPLE[other(S.me)];
  const sh = openSheet({ cls: `recorder ${lang}` });
  let rec = null, stream = null, chunks = [], blob = null, url = null, timer = null, raf = null, actx = null, t0 = 0;
  const MAX = 15;
  const stopAll = () => {
    clearTimeout(timer); cancelAnimationFrame(raf);
    stream?.getTracks().forEach((t) => t.stop());
    actx?.close().catch(() => {});
  };
  sh.onClose = () => { stopAll(); if (rec?.state === 'recording') rec.stop(); };
  const draw = (state) => {
    sh.body.innerHTML = `
      <p class="rec-kicker">${kind === 'teach' ? `Teach ${partner.name}` : `Your turn: try it in ${LANGS[lang].name}`}</p>
      <h2 class="rec-phrase">${esc(p[lang].roman)}</h2>
      <p class="muted center">"${esc(p.english)}"</p>
      ${kind === 'attempt' ? `<div class="center listen-first">${playBtn(p, lang)}</div>` : ''}
      <div class="mic-wrap ${state}">
        <span class="pulse"></span>
        <button class="mic" data-r="${state === 'recording' ? 'stop' : 'start'}" aria-label="${state === 'recording' ? 'Stop' : 'Record'}">${state === 'recording' ? ICON.stop : ICON.mic}</button>
      </div>
      <p class="rec-status center">${state === 'recording' ? `<span class="rec-time">0s</span> · tap to stop` : state === 'done' ? 'Listen back, then send' : 'Tap the mic and say it out loud'}</p>
      ${state === 'done' ? `<div class="rec-actions">
        <button class="btn ghost" data-r="preview">${ICON.play} Play</button>
        <button class="btn ghost" data-r="start">Redo</button>
        <button class="btn" data-r="send">${kind === 'teach' ? 'Save for ' + partner.name : 'Send to ' + partner.name}</button>
      </div>` : ''}`;
  };
  draw('idle');
  sh.body.onclick = async (e) => {
    const b = e.target.closest('[data-r]');
    if (!b) return;
    const r = b.dataset.r;
    if (r === 'start') {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      } catch {
        return toast('Microphone permission is needed to record');
      }
      const mime = ['audio/webm;codecs=opus', 'audio/mp4', 'audio/webm', 'audio/ogg'].find((m) => window.MediaRecorder?.isTypeSupported?.(m));
      rec = new MediaRecorder(stream, mime ? { mimeType: mime } : {});
      chunks = [];
      rec.ondataavailable = (ev) => ev.data.size && chunks.push(ev.data);
      rec.onstop = () => {
        stopAll();
        blob = new Blob(chunks, { type: rec.mimeType || mime || 'audio/webm' });
        if (url) URL.revokeObjectURL(url);
        url = URL.createObjectURL(blob);
        draw('done');
      };
      rec.start();
      t0 = Date.now();
      draw('recording');
      vibrate(15);
      timer = setTimeout(() => rec.state === 'recording' && rec.stop(), MAX * 1000);
      try {
        actx = new AudioContext();
        const an = actx.createAnalyser();
        an.fftSize = 256;
        actx.createMediaStreamSource(stream).connect(an);
        const buf = new Uint8Array(an.frequencyBinCount);
        const tick = () => {
          an.getByteTimeDomainData(buf);
          let peak = 0;
          for (const v of buf) peak = Math.max(peak, Math.abs(v - 128));
          const pulse = $('.pulse', sh.el), time = $('.rec-time', sh.el);
          if (pulse) pulse.style.transform = `scale(${1 + peak / 40})`;
          if (time) time.textContent = `${Math.floor((Date.now() - t0) / 1000)}s`;
          raf = requestAnimationFrame(tick);
        };
        tick();
      } catch {}
    } else if (r === 'stop') {
      if (rec?.state === 'recording') rec.stop();
    } else if (r === 'preview') {
      player.src = url;
      player.play();
    } else if (r === 'send') {
      b.disabled = true;
      const mimeBase = blob.type.split(';')[0];
      const path = `data/audio/${uid('a')}.enc`;
      toast('Uploading your voice…', 0);
      try {
        await store.uploadBlob(path, new Uint8Array(await blob.arrayBuffer()), kind === 'teach' ? 'Add a voice note' : 'Add a try');
      } catch (err) {
        b.disabled = false;
        return toast(`Upload failed: ${err.message}`, 4000);
      }
      store.primeBlob(path, url);
      url = null;
      const at = new Date().toISOString();
      const ok = await save((list) => {
        const t = list.find((x) => x.id === id);
        if (!t) return;
        if (kind === 'teach') { t.audio = t.audio || {}; t.audio[lang] = { path, mime: mimeBase, by: S.me, at }; }
        else { t.attempts = t.attempts || []; t.attempts.push({ id: uid('t'), by: S.me, lang, path, mime: mimeBase, at }); }
      }, kind === 'teach' ? 'Add a voice note' : 'Add a try', kind === 'teach' ? `Saved! ${partner.name} can hear you now 🎧` : `Sent! ${partner.name} will let you know 💌`);
      if (ok) { sh.close(); if (kind === 'attempt') confetti(); }
      else b.disabled = false;
    }
  };
}

function openSettings() {
  const sh = openSheet({ cls: 'settings' });
  sh.refresh = () => {
    const v = 'speechSynthesis' in window ? { gu: pickVoice('gu'), bn: pickVoice('bn') } : null;
    const vLabel = (x) => (!v ? 'not available' : x.native ? `native voice (${esc(x.native.name)})` : x.hindi ? 'Hindi voice reading it (approximate)' : 'English voice reading the romanized text');
    sh.body.innerHTML = `
      <h2>Settings</h2>
      <div class="set-group">
        <h4>Who's using this phone?</h4>
        <div class="seg">${['dhruv', 'sohini'].map((id) => `<button class="${S.me === id ? 'on' : ''}" data-s="me" data-id="${id}">${PEOPLE[id].name}</button>`).join('')}</div>
      </div>
      <div class="set-group">
        <h4>GitHub connection ${store.hasToken() ? '<span class="ok">connected ✓</span>' : '<span class="warn">not connected</span>'}</h4>
        <p class="muted">Lets this phone save phrases and voice notes to your repo, so both of you see them.</p>
        <form class="token-form"><input type="password" name="t" placeholder="${store.hasToken() ? 'Paste a new token to replace' : 'Paste your GitHub token'}" autocomplete="off"><button class="btn small">Save</button></form>
        <details class="howto"><summary>How do I get a token?</summary><ol>
          <li><b>Dhruv</b>, on a computer, open <a href="https://github.com/settings/personal-access-tokens/new" target="_blank" rel="noopener">github.com/settings/personal-access-tokens/new</a></li>
          <li>Name it <i>Kem cho</i>, set expiration to 1 year.</li>
          <li><b>Repository access:</b> Only select repositories → <i>LangLearn</i>.</li>
          <li><b>Permissions → Repository → Contents:</b> Read and write. Nothing else.</li>
          <li>Generate, copy, paste it here. Then send it privately to Sohini so she can paste it on her phone.</li>
        </ol><p class="muted">The token is stored on this phone only, encrypted with your PIN.</p></details>
      </div>
      <div class="set-group">
        <h4>Computer voice on this phone</h4>
        <p class="muted">Gujarati: ${vLabel(v?.gu)}<br>Bengali: ${vLabel(v?.bn)}</p>
        <p class="muted">Your own recordings always play first. They're the real teachers.</p>
      </div>
      <div class="set-group row">
        <button class="btn ghost" data-s="lock">${ICON.lock} Lock now</button>
        <button class="btn ghost danger" data-s="forget">Forget this phone</button>
      </div>
      <p class="fineprint">Everything (phrases, photos, voices) is encrypted with AES-256 using your PIN before it leaves this phone. The site and repo only ever hold scrambled data.</p>`;
    hydratePhotos(sh.el);
    $('.token-form', sh.el).onsubmit = async (e) => {
      e.preventDefault();
      const t = new FormData(e.target).get('t').toString().trim();
      if (!t) return;
      toast('Checking token…', 0);
      const res = await store.testToken(t);
      if (!res.ok) return toast(res.reason, 5000);
      ls.set('token', bytesToB64(await encryptBytes(S.key, new TextEncoder().encode(t))));
      store.setToken(t);
      toast('Connected! ✓');
      try { await reload(); } catch {}
      refreshAll();
    };
  };
  sh.body.onclick = async (e) => {
    const b = e.target.closest('[data-s]');
    if (!b) return;
    if (b.dataset.s === 'me') { S.me = b.dataset.id; ls.set('me', S.me); refreshAll(); }
    if (b.dataset.s === 'lock') { try { await idbDel('key'); } catch {} location.reload(); }
    if (b.dataset.s === 'forget' && confirm('Remove the PIN, token and practice progress from this phone?')) {
      try { await idbDel('key'); } catch {}
      try { Object.keys(localStorage).filter((k) => k.startsWith('kc.')).forEach((k) => localStorage.removeItem(k)); } catch {}
      location.reload();
    }
  };
  sh.refresh();
  if ('speechSynthesis' in window) speechSynthesis.onvoiceschanged = () => sh.refresh?.();
}

function openPhoto(name) {
  const sh = openSheet({ cls: 'lightbox', full: true });
  sh.body.innerHTML = photo(name, 'lightbox-img');
  hydratePhotos(sh.el);
}

// ---------- games ----------

function needPool(lang, n) {
  if (pool(lang).length >= n) return false;
  toast(`Add a few more ${LANGS[lang].name} phrases first`);
  return true;
}

function gameHead(title, i, n) {
  return `<div class="g-head"><span>${title}</span><div class="g-prog"><i style="width:${(i / n) * 100}%"></i></div></div>`;
}

function doneScreen(sh, lang, title, sub, again) {
  markPracticed();
  sh.body.innerHTML = `<div class="done">
    <div class="done-emoji">🎉</div>
    <h2><span class="${lang}-t">${LANGS[lang].cheer}</span></h2>
    <p class="muted">${LANGS[lang].cheer} means "${LANGS[lang].cheerMeaning}"</p>
    <h3>${title}</h3><p>${sub}</p>
    <div class="rec-actions"><button class="btn ghost" data-g="close">Done</button><button class="btn" data-g="again">Play again</button></div>
  </div>`;
  confetti();
  sh.body.onclick = (e) => {
    const b = e.target.closest('[data-g]');
    if (!b) return;
    if (b.dataset.g === 'close') sh.close();
    else { sh.close(); again(); }
  };
  sh.onClose = () => render();
}

function playFlash(lang) {
  if (needPool(lang, 1)) return;
  const d = srsGet(lang), t = today(), all = pool(lang);
  const due = shuffle(all.filter((p) => d[p.id] && d[p.id].due <= t));
  const fresh = shuffle(all.filter((p) => !d[p.id])).slice(0, Math.max(0, 10 - due.length));
  let q = due.concat(fresh);
  let extra = false;
  if (!q.length) { q = shuffle(all).slice(0, 10); extra = true; }
  const total = q.length;
  let i = 0, known = 0;
  const sh = openSheet({ cls: `game flash-game ${lang}`, full: true });
  sh.onClose = () => render();
  const draw = () => {
    if (i >= q.length) return doneScreen(sh, lang, `${known} of ${total} remembered`, extra ? 'Extra practice, nothing was due today.' : 'Your cards are scheduled. Come back tomorrow!', () => playFlash(lang));
    const p = q[i];
    sh.body.innerHTML = `${gameHead(`Flashcards · ${LANGS[lang].name}`, i, q.length)}
      <div class="flash" data-g="flip">
        <div class="flash-inner">
          <div class="face front"><div class="emoji-xl">${esc(p.emoji || '💬')}</div><div class="eng-xl">${esc(p.english)}</div><div class="hint">Say it in ${LANGS[lang].name}, then tap</div></div>
          <div class="face back"><div class="roman-xl">${esc(p[lang].roman)}</div>${playBtn(p, lang)}${p.note ? `<p class="note small">${esc(p.note)}</p>` : ''}</div>
        </div>
      </div>
      <div class="g-actions"><button class="btn wide" data-g="flip">Show answer</button></div>`;
  };
  const grade = (delta) => {
    const p = q[i];
    const c = d[p.id] || { box: 0 };
    const box = delta < 0 ? 0 : Math.min(c.box + delta, INTERVALS.length - 1);
    d[p.id] = { box, due: delta < 0 ? t : addDays(INTERVALS[box]) };
    srsSet(lang, d);
    if (delta < 0) { if (q.indexOf(p, i + 1) === -1) q.push(p); } else known++;
    i++;
    draw();
  };
  sh.body.onclick = (e) => {
    if (e.target.closest('[data-act]')) return;
    const b = e.target.closest('[data-g]');
    if (!b) return;
    const g = b.dataset.g;
    if (g === 'flip') {
      const card = $('.flash', sh.el);
      if (card.classList.contains('flipped')) return;
      card.classList.add('flipped');
      playPhrase(q[i], lang);
      $('.g-actions', sh.el).innerHTML = `<button class="btn ghost" data-g="again">Forgot</button><button class="btn" data-g="good">Got it</button><button class="btn soft" data-g="easy">Easy!</button>`;
    } else if (g === 'again') grade(-1);
    else if (g === 'good') grade(1);
    else if (g === 'easy') grade(2);
  };
  draw();
}

function playMatch(lang) {
  if (needPool(lang, 3)) return;
  const items = shuffle(pool(lang)).slice(0, 5);
  const left = shuffle(items), right = shuffle(items);
  const done = new Set();
  let selL = null, selR = null, misses = 0, lock = false;
  const t0 = Date.now();
  const sh = openSheet({ cls: `game match-game ${lang}`, full: true });
  sh.onClose = () => render();
  const draw = () => {
    sh.body.innerHTML = `${gameHead(`Match pairs · ${LANGS[lang].name}`, done.size, items.length)}
      <p class="muted center">Tap an English phrase, then its ${LANGS[lang].name} twin</p>
      <div class="match">
        <div class="col">${left.map((p) => `<button class="tile ${done.has(p.id) ? 'done' : ''} ${selL === p.id ? 'sel' : ''}" data-side="L" data-id="${p.id}">${esc(p.english)}</button>`).join('')}</div>
        <div class="col">${right.map((p) => `<button class="tile ${lang} ${done.has(p.id) ? 'done' : ''} ${selR === p.id ? 'sel' : ''}" data-side="R" data-id="${p.id}">${esc(p[lang].roman)}</button>`).join('')}</div>
      </div>`;
  };
  sh.body.onclick = (e) => {
    const b = e.target.closest('.tile');
    if (!b || lock || done.has(b.dataset.id)) return;
    if (b.dataset.side === 'L') selL = b.dataset.id; else selR = b.dataset.id;
    draw();
    if (selL && selR) {
      lock = true;
      if (selL === selR) {
        done.add(selL);
        playPhrase(byId(selL), lang);
        vibrate(15);
        selL = selR = null;
        lock = false;
        draw();
        if (done.size === items.length) {
          const secs = Math.round((Date.now() - t0) / 1000);
          const bestKey = `best.${S.me}.${lang}`, best = ls.get(bestKey);
          if (!best || secs < best) ls.set(bestKey, secs);
          setTimeout(() => doneScreen(sh, lang, `${secs} seconds${!best || secs < best ? ' · new best!' : ''}`, misses ? `${misses} wrong guess${misses > 1 ? 'es' : ''} along the way` : 'Not a single mistake!', () => playMatch(lang)), 500);
        }
      } else {
        misses++;
        vibrate([40, 30, 40]);
        sh.el.querySelectorAll('.tile.sel').forEach((x) => x.classList.add('wrong'));
        setTimeout(() => { selL = selR = null; lock = false; draw(); }, 550);
      }
    }
  };
  draw();
}

function playQuiz(lang) {
  if (needPool(lang, 4)) return;
  const P = pool(lang);
  const qs = shuffle(P).slice(0, 8).map((p, k) => ({ p, rev: k % 2 === 1, opts: shuffle([p, ...shuffle(P.filter((x) => x.id !== p.id)).slice(0, 3)]) }));
  let i = 0, score = 0, answered = null;
  const sh = openSheet({ cls: `game quiz-game ${lang}`, full: true });
  sh.onClose = () => render();
  const draw = () => {
    if (i >= qs.length) return doneScreen(sh, lang, `${score} / ${qs.length} correct`, score === qs.length ? 'Perfect score!' : 'Every round makes it stick.', () => playQuiz(lang));
    const { p, rev, opts } = qs[i];
    sh.body.innerHTML = `${gameHead(`Quick quiz · ${LANGS[lang].name}`, i, qs.length)}
      <div class="q-prompt">
        <small>${rev ? 'What does this mean?' : `How do you say it in ${LANGS[lang].name}?`}</small>
        <h2 class="${rev ? `roman-xl ${lang}-t` : 'eng-xl'}">${esc(rev ? p[lang].roman : p.english)}</h2>
        ${rev ? playBtn(p, lang) : ''}
      </div>
      <div class="opts">${opts.map((o) => {
        let cls = '';
        if (answered) cls = o.id === p.id ? 'right' : o.id === answered ? 'wrong' : 'dim';
        return `<button class="opt ${cls}" data-o="${o.id}" ${answered ? 'disabled' : ''}>${esc(rev ? o.english : o[lang].roman)}</button>`;
      }).join('')}</div>
      ${answered ? `<div class="g-actions"><button class="btn wide" data-g="next">${i === qs.length - 1 ? 'See results' : 'Next'}</button></div>` : ''}`;
  };
  sh.body.onclick = (e) => {
    if (e.target.closest('[data-act]')) return;
    const o = e.target.closest('[data-o]');
    if (o && !answered) {
      answered = o.dataset.o;
      const p = qs[i].p;
      if (answered === p.id) { score++; vibrate(15); } else vibrate([40, 30, 40]);
      playPhrase(p, lang);
      draw();
    } else if (e.target.closest('[data-g="next"]')) { i++; answered = null; draw(); }
  };
  draw();
}

function playBuild(lang) {
  const P = pool(lang).filter((p) => p[lang].roman.trim().split(/\s+/).length >= 2);
  if (P.length < 2) return toast(`Add a few longer ${LANGS[lang].name} phrases first`);
  const rounds = shuffle(P).slice(0, 6);
  let i = 0, placed = [], tiles = [], state = 'play', score = 0, firstTry = true;
  const sh = openSheet({ cls: `game build-game ${lang}`, full: true });
  sh.onClose = () => render();
  const setup = () => {
    const words = rounds[i][lang].roman.trim().split(/\s+/);
    do { tiles = shuffle(words.map((w, k) => ({ k, w }))); } while (words.length > 1 && tiles.every((t, k) => t.k === k));
    placed = []; state = 'play'; firstTry = true;
  };
  const draw = () => {
    if (i >= rounds.length) return doneScreen(sh, lang, `${score} of ${rounds.length} on the first try`, 'Word order is the secret sauce of fluency.', () => playBuild(lang));
    const p = rounds[i];
    sh.body.innerHTML = `${gameHead(`Build it · ${LANGS[lang].name}`, i, rounds.length)}
      <div class="q-prompt"><small>Build this in ${LANGS[lang].name}</small><h2 class="eng-xl">${esc(p.english)}</h2></div>
      <div class="slots ${state}">${placed.map((t) => `<button class="tile ${lang}" data-b="out" data-k="${t.k}">${esc(t.w)}</button>`).join('') || '<span class="slot-hint">Tap the words below</span>'}</div>
      <div class="bank">${tiles.filter((t) => !placed.includes(t)).map((t) => `<button class="tile" data-b="in" data-k="${t.k}">${esc(t.w)}</button>`).join('')}</div>
      <div class="g-actions">${state === 'right' ? `<button class="btn wide" data-b="next">Next</button>` : state === 'wrong' ? `<button class="btn ghost" data-b="reset">Try again</button><button class="btn soft" data-b="show">Show me</button>` : ''}</div>`;
  };
  sh.body.onclick = (e) => {
    const b = e.target.closest('[data-b]');
    if (!b) return;
    const a = b.dataset.b, p = rounds[i];
    if (a === 'in' && state === 'play') {
      placed.push(tiles.find((t) => t.k === +b.dataset.k));
      if (placed.length === tiles.length) {
        const ok = norm(placed.map((t) => t.w).join(' ')) === norm(p[lang].roman);
        state = ok ? 'right' : 'wrong';
        if (ok) { if (firstTry) score++; playPhrase(p, lang); vibrate(15); } else { firstTry = false; vibrate([40, 30, 40]); }
      }
    } else if (a === 'out' && state === 'play') placed = placed.filter((t) => t.k !== +b.dataset.k);
    else if (a === 'reset') { placed = []; state = 'play'; }
    else if (a === 'show') { placed = [...tiles].sort((x, y) => x.k - y.k); state = 'right'; playPhrase(p, lang); }
    else if (a === 'next') { i++; if (i < rounds.length) setup(); }
    draw();
  };
  setup();
  draw();
}

function playListen(lang) {
  if (needPool(lang, 4)) return;
  const P = pool(lang);
  const withRec = P.filter((p) => p.audio?.[lang]);
  const base = withRec.length >= 4 ? withRec : P;
  const qs = shuffle(base).slice(0, 6).map((p) => ({ p, opts: shuffle([p, ...shuffle(P.filter((x) => x.id !== p.id)).slice(0, 3)]) }));
  let i = 0, score = 0, answered = null;
  const sh = openSheet({ cls: `game listen-game ${lang}`, full: true });
  sh.onClose = () => render();
  const draw = () => {
    if (i >= qs.length) return doneScreen(sh, lang, `${score} / ${qs.length} by ear`, 'Your ear is getting sharper.', () => playListen(lang));
    const { p, opts } = qs[i];
    sh.body.innerHTML = `${gameHead(`Listen & guess · ${LANGS[lang].name}`, i, qs.length)}
      <div class="q-prompt"><small>What did ${p.audio?.[lang] ? PEOPLE[LANGS[lang].teacher].name : 'you hear'}${p.audio?.[lang] ? ' say' : ''}?</small>
        ${playBtn(p, lang, true)}
        ${answered ? `<h2 class="roman-xl ${lang}-t">${esc(p[lang].roman)}</h2>` : ''}
      </div>
      <div class="opts">${opts.map((o) => {
        let cls = '';
        if (answered) cls = o.id === p.id ? 'right' : o.id === answered ? 'wrong' : 'dim';
        return `<button class="opt ${cls}" data-o="${o.id}" ${answered ? 'disabled' : ''}>${esc(o.english)}</button>`;
      }).join('')}</div>
      ${answered ? `<div class="g-actions"><button class="btn wide" data-g="next">${i === qs.length - 1 ? 'See results' : 'Next'}</button></div>` : ''}`;
    if (!answered) playPhrase(p, lang);
  };
  sh.body.onclick = (e) => {
    if (e.target.closest('[data-act]')) return;
    const o = e.target.closest('[data-o]');
    if (o && !answered) {
      answered = o.dataset.o;
      if (answered === qs[i].p.id) { score++; vibrate(15); } else vibrate([40, 30, 40]);
      draw();
    } else if (e.target.closest('[data-g="next"]')) { i++; answered = null; draw(); }
  };
  draw();
}

const GAMES = { flash: playFlash, match: playMatch, quiz: playQuiz, build: playBuild, listen: playListen };

// ---------- global actions ----------

const ACTIONS = {
  tab: (b) => { S.view = b.dataset.tab; render(); scrollTo({ top: 0, behavior: 'smooth' }); },
  add: () => openForm(),
  settings: () => openSettings(),
  open: (b) => openPhrase(b.dataset.id),
  edit: (b) => openForm(b.dataset.id),
  play: (b) => playPhrase(byId(b.dataset.id), b.dataset.lang),
  reveal: (b) => { S.revealed.add(b.dataset.id); const p = byId(b.dataset.id); render(); playPhrase(p, PEOPLE[S.me].learns); },
  record: (b) => openRecorder(b.dataset.id, b.dataset.lang, b.dataset.kind),
  'play-attempt': (b) => {
    const a = byId(b.dataset.id)?.attempts?.find((x) => x.id === b.dataset.aid);
    if (a) playPath(a.path, a.mime);
  },
  react: (b) => {
    if (needToken()) return;
    const r = b.dataset.r;
    save((list) => {
      const a = list.find((x) => x.id === b.dataset.id)?.attempts?.find((x) => x.id === b.dataset.aid);
      if (a) { a.reaction = r; a.reactedAt = new Date().toISOString(); }
    }, 'React to a try', r === 'shabash' ? 'Shabash sent 👏' : 'Sent. They\'ll give it another go 🔁').then((ok) => ok && r === 'shabash' && confetti());
  },
  'seen-reaction': (b) => { ls.set('seenReactions', [...ls.get('seenReactions', []), b.dataset.aid].slice(-500)); render(); },
  delete: (b) => {
    if (needToken()) return;
    const p = byId(b.dataset.id);
    if (!confirm(`Delete "${p.english}"?`)) return;
    save((list) => { const k = list.findIndex((x) => x.id === p.id); if (k >= 0) list.splice(k, 1); }, 'Delete a phrase', 'Deleted').then((ok) => ok && sheets[sheets.length - 1]?.close());
  },
  plang: (b) => { S.practiceLang = b.dataset.lang; render(); },
  game: (b) => GAMES[b.dataset.game](S.practiceLang || PEOPLE[S.me].learns),
  filter: (b) => { S.filter = b.dataset.f; render(); },
  photo: (b) => openPhoto(b.dataset.photoName),
};

document.addEventListener('click', (e) => {
  const b = e.target.closest('[data-act]');
  if (!b || !ACTIONS[b.dataset.act]) return;
  e.preventDefault();
  ACTIONS[b.dataset.act](b, e);
});

document.addEventListener('input', (e) => {
  if (e.target.id !== 'q') return;
  S.q = e.target.value;
  $('.timeline').innerHTML = timelineHTML();
  hydratePhotos($('.timeline'));
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && sheets.length) sheets[sheets.length - 1].close();
});

boot();
