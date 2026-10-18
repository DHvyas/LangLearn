# Kem cho × Kemon acho

A private phrasebook for Dhruv (Gujarati) and Sohini (Bengali), learning each other's languages one phrase a day.

The live site is on the `gh-pages` branch, served by GitHub Pages.

## How it's protected

- Everything personal (phrases, photos, voice notes) is stored **encrypted** (`data/**/*.enc`): AES-256-GCM with a key derived from the 6-digit PIN (PBKDF2-SHA256, 600k iterations).
- The PIN itself is never stored anywhere. Only a small encrypted check value lives in `data/meta.json`.
- Commit messages never contain phrase text.
- Caveat: a 6-digit PIN keeps out anyone who stumbles onto the site, but a determined attacker who copies the encrypted files could eventually brute-force it offline. Don't put anything here you'd need bank-level secrecy for.

## Adding phrases from the phone

Settings → paste a fine-grained GitHub token (only this repo, **Contents: Read and write**). The site then commits encrypted changes to `gh-pages` directly.

## Maintenance (`tools/seal.mjs`, Node 20+)

```sh
PIN=...... node tools/seal.mjs dump                # print decrypted phrases
PIN=...... node tools/seal.mjs photos ./my-photos  # add/replace photos (filename = photo id)
OLD_PIN=...... NEW_PIN=...... node tools/seal.mjs rekey   # change the PIN
```

Photo ids used by the app: `avatar-dhruv`, `avatar-sohini`, `us`, `s1`, `s2`, `s3`, `d1`, `d2`.
