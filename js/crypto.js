// AES-256-GCM with a PBKDF2-derived key. Shared by the browser app and tools/seal.mjs.
// Encrypted blob layout: [12-byte IV][ciphertext + GCM tag]

const te = new TextEncoder();
const td = new TextDecoder();

export const CHECK_TEXT = 'kem cho? kemon acho?';

export function bytesToB64(bytes) {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  }
  return btoa(s);
}

export function b64ToBytes(b64) {
  const s = atob(b64.replace(/\s+/g, ''));
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}

export async function deriveKey(pin, saltB64, iterations, extractable = false) {
  const base = await crypto.subtle.importKey('raw', te.encode(pin), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: b64ToBytes(saltB64), iterations, hash: 'SHA-256' },
    base,
    { name: 'AES-GCM', length: 256 },
    extractable,
    ['encrypt', 'decrypt'],
  );
}

export async function encryptBytes(key, bytes) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, bytes));
  const out = new Uint8Array(12 + ct.length);
  out.set(iv);
  out.set(ct, 12);
  return out;
}

export async function decryptBytes(key, buf) {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: bytes.subarray(0, 12) }, key, bytes.subarray(12));
  return new Uint8Array(pt);
}

export async function encryptJSON(key, obj) {
  return encryptBytes(key, te.encode(JSON.stringify(obj)));
}

export async function decryptJSON(key, buf) {
  return JSON.parse(td.decode(await decryptBytes(key, buf)));
}

export async function makeCheck(key) {
  return bytesToB64(await encryptBytes(key, te.encode(CHECK_TEXT)));
}

export async function verifyCheck(key, checkB64) {
  try {
    return td.decode(await decryptBytes(key, b64ToBytes(checkB64))) === CHECK_TEXT;
  } catch {
    return false;
  }
}
