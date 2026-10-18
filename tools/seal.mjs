#!/usr/bin/env node
// Maintenance tool for the encrypted vault. The PIN is read from the environment, never stored.
//
//   PIN=xxxxxx node tools/seal.mjs init <photosDir>   create meta.json + starter phrases + photos
//   PIN=xxxxxx node tools/seal.mjs photos <photosDir> (re)encrypt photos only
//   PIN=xxxxxx node tools/seal.mjs dump               print decrypted phrases.json
//   OLD_PIN=.. NEW_PIN=.. node tools/seal.mjs rekey   change the PIN (re-encrypts every .enc file)

import { readFile, writeFile, readdir, mkdir, stat } from 'node:fs/promises';
import { join, dirname, basename, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deriveKey, encryptBytes, decryptBytes, encryptJSON, decryptJSON, makeCheck, verifyCheck, bytesToB64 } from '../js/crypto.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DATA = join(ROOT, 'data');
const META = join(DATA, 'meta.json');
const ITERATIONS = 600000;

const [cmd, arg] = process.argv.slice(2);

async function loadMeta() {
  return JSON.parse(await readFile(META, 'utf8'));
}

async function keyFor(pin, meta) {
  if (!pin) throw new Error('Set the PIN environment variable');
  const key = await deriveKey(pin, meta.salt, meta.iterations);
  if (!(await verifyCheck(key, meta.check))) throw new Error('Wrong PIN for this vault');
  return key;
}

async function sealPhotos(key, dir) {
  await mkdir(join(DATA, 'photos'), { recursive: true });
  for (const f of await readdir(dir)) {
    if (!/\.(jpe?g|png|webp)$/i.test(f)) continue;
    const out = join(DATA, 'photos', basename(f, extname(f)) + '.enc');
    await writeFile(out, await encryptBytes(key, await readFile(join(dir, f))));
    console.log('sealed', out);
  }
}

async function walk(dir) {
  const out = [];
  for (const f of await readdir(dir)) {
    const p = join(dir, f);
    if ((await stat(p)).isDirectory()) out.push(...(await walk(p)));
    else if (p.endsWith('.enc')) out.push(p);
  }
  return out;
}

if (cmd === 'init') {
  const salt = bytesToB64(crypto.getRandomValues(new Uint8Array(16)));
  const meta = { v: 1, salt, iterations: ITERATIONS };
  const key = await deriveKey(process.env.PIN, salt, ITERATIONS);
  meta.check = await makeCheck(key);
  await mkdir(DATA, { recursive: true });
  await writeFile(META, JSON.stringify(meta, null, 2) + '\n');
  const starters = JSON.parse(await readFile(join(ROOT, 'tools', 'starter-phrases.json'), 'utf8'));
  const now = new Date().toISOString();
  const phrases = starters.map((p) => ({ ...p, starter: true, date: null, addedBy: null, createdAt: now, audio: {}, attempts: [] }));
  await writeFile(join(DATA, 'phrases.enc'), await encryptJSON(key, { v: 1, phrases }));
  console.log('vault created with', phrases.length, 'starter phrases');
  if (arg) await sealPhotos(key, arg);
} else if (cmd === 'photos') {
  await sealPhotos(await keyFor(process.env.PIN, await loadMeta()), arg);
} else if (cmd === 'dump') {
  const key = await keyFor(process.env.PIN, await loadMeta());
  console.log(JSON.stringify(await decryptJSON(key, await readFile(join(DATA, 'phrases.enc'))), null, 2));
} else if (cmd === 'rekey') {
  const meta = await loadMeta();
  const oldKey = await keyFor(process.env.OLD_PIN, meta);
  const salt = bytesToB64(crypto.getRandomValues(new Uint8Array(16)));
  const newKey = await deriveKey(process.env.NEW_PIN, salt, ITERATIONS);
  for (const f of await walk(DATA)) {
    await writeFile(f, await encryptBytes(newKey, await decryptBytes(oldKey, await readFile(f))));
    console.log('re-sealed', f);
  }
  await writeFile(META, JSON.stringify({ v: 1, salt, iterations: ITERATIONS, check: await makeCheck(newKey) }, null, 2) + '\n');
  console.log('PIN changed. Every phone will need the new PIN.');
} else {
  console.log('usage: see header of tools/seal.mjs');
}
