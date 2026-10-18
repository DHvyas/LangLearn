// Data layer: reads encrypted files from the site (or the GitHub API when a token is set)
// and writes changes back as commits to the gh-pages branch.

import { encryptBytes, decryptBytes, encryptJSON, decryptJSON, bytesToB64, b64ToBytes } from './crypto.js';

const REPO = 'DHvyas/LangLearn';
const BRANCH = 'gh-pages';
const API = `https://api.github.com/repos/${REPO}/contents/`;
const PHRASES = 'data/phrases.enc';

let key = null;
let token = null;
let phrasesSha = null;
let phrasesEtag = null;
let siteIv = null;
const blobCache = new Map();

export function setKey(k) { key = k; }
export function setToken(t) { token = t || null; }
export function hasToken() { return !!token; }

function headers(extra = {}) {
  return { Authorization: `Bearer ${token}`, 'X-GitHub-Api-Version': '2022-11-28', ...extra };
}

async function apiGetJSON(path) {
  const r = await fetch(`${API}${path}?ref=${BRANCH}&t=${Date.now()}`, { headers: headers({ Accept: 'application/vnd.github+json' }), cache: 'no-store' });
  if (!r.ok) throw new Error(`GitHub said ${r.status} for ${path}`);
  return r.json();
}

async function apiGetRaw(path) {
  const r = await fetch(`${API}${path}?ref=${BRANCH}`, { headers: headers({ Accept: 'application/vnd.github.raw' }) });
  if (!r.ok) throw new Error(`GitHub said ${r.status} for ${path}`);
  return new Uint8Array(await r.arrayBuffer());
}

async function apiPut(path, bytes, message, sha) {
  const body = { message, content: bytesToB64(bytes), branch: BRANCH };
  if (sha) body.sha = sha;
  const r = await fetch(API + path, { method: 'PUT', headers: headers({ 'Content-Type': 'application/json' }), body: JSON.stringify(body) });
  if (!r.ok) {
    const err = new Error(`GitHub said ${r.status}`);
    err.status = r.status;
    throw err;
  }
  return (await r.json()).content.sha;
}

async function siteGet(path, bust = true) {
  const r = await fetch(bust ? `${path}?t=${Date.now()}` : path, { cache: bust ? 'no-store' : 'default' });
  if (!r.ok) throw new Error(`Couldn't load ${path} (${r.status})`);
  return new Uint8Array(await r.arrayBuffer());
}

export async function testToken(t) {
  const r = await fetch(`https://api.github.com/repos/${REPO}`, { headers: { Authorization: `Bearer ${t}` } });
  if (!r.ok) return { ok: false, reason: r.status === 401 ? 'That token was rejected.' : `GitHub said ${r.status}.` };
  const repo = await r.json();
  if (!repo.permissions?.push) return { ok: false, reason: 'The token works but cannot write. Give it Contents: Read and write.' };
  return { ok: true };
}

// With onlyIfChanged, resolves to null when nothing changed since the last load.
// Conditional (ETag) requests that come back 304 don't count against GitHub's rate limit.
export async function loadPhrases(onlyIfChanged = false) {
  if (token) {
    try {
      const h = headers({ Accept: 'application/vnd.github+json' });
      if (onlyIfChanged && phrasesEtag) h['If-None-Match'] = phrasesEtag;
      const r = await fetch(`${API}${PHRASES}?ref=${BRANCH}`, { headers: h, cache: 'no-store' });
      if (r.status === 304) return null;
      if (!r.ok) throw new Error(`GitHub said ${r.status}`);
      phrasesEtag = r.headers.get('ETag');
      const j = await r.json();
      if (onlyIfChanged && j.sha === phrasesSha) return null;
      phrasesSha = j.sha;
      return (await decryptJSON(key, b64ToBytes(j.content))).phrases;
    } catch (e) {
      console.warn('API read failed, falling back to site copy', e);
    }
  }
  const enc = await siteGet(PHRASES);
  const iv = bytesToB64(enc.subarray(0, 12)); // a fresh IV on every save, so it doubles as a version
  if (onlyIfChanged && iv === siteIv) return null;
  siteIv = iv;
  return (await decryptJSON(key, enc)).phrases;
}

// Read-modify-write with retry, so two phones saving at once don't clobber each other.
export async function mutatePhrases(fn, message) {
  if (!token) throw new Error('NO_TOKEN');
  for (let attempt = 0; attempt < 4; attempt++) {
    const j = await apiGetJSON(PHRASES);
    const phrases = (await decryptJSON(key, b64ToBytes(j.content))).phrases;
    fn(phrases);
    try {
      phrasesSha = await apiPut(PHRASES, await encryptJSON(key, { v: 1, phrases }), message, j.sha);
      return phrases;
    } catch (e) {
      if (e.status !== 409 && e.status !== 422) throw e;
    }
  }
  throw new Error('Could not save after several tries. Please try again.');
}

export async function uploadBlob(path, bytes, message) {
  if (!token) throw new Error('NO_TOKEN');
  await apiPut(path, await encryptBytes(key, bytes), message);
}

// Returns an object URL for an encrypted media file (photo or audio).
export async function blobURL(path, mime) {
  if (blobCache.has(path)) return blobCache.get(path);
  const p = (async () => {
    let enc;
    try {
      enc = await siteGet(path, false);
    } catch (e) {
      if (!token) throw e;
      enc = await apiGetRaw(path); // freshly uploaded, not on the site yet
    }
    return URL.createObjectURL(new Blob([await decryptBytes(key, enc)], { type: mime }));
  })();
  blobCache.set(path, p);
  p.catch(() => blobCache.delete(path));
  return p;
}

// Seed the cache with a just-recorded clip so it plays instantly without a round trip.
export function primeBlob(path, url) {
  blobCache.set(path, Promise.resolve(url));
}
