/**
 * Downloads Showdown battle sprites (gen5 96×96 statics) for every species in
 * the current dex bundle into public/sprites/, so the app works fully offline.
 * A missing forme sprite (e.g. brand-new Champions megas) falls back to the
 * base species sprite so every spriteId is guaranteed to resolve locally.
 * Skips files that already exist — safe to re-run after roster changes.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const DATA_DIR = join(import.meta.dirname, '..', 'public', 'data');
const OUT_DIR = join(import.meta.dirname, '..', 'public', 'sprites');
const BASE_URL = 'https://play.pokemonshowdown.com/sprites/gen5';

const dex = JSON.parse(readFileSync(join(DATA_DIR, 'dex.json'), 'utf8'));
mkdirSync(OUT_DIR, { recursive: true });

let downloaded = 0;
let skipped = 0;
const fallbacks: string[] = [];

async function fetchSprite(spriteId: string): Promise<Buffer | null> {
  const res = await fetch(`${BASE_URL}/${spriteId}.png`);
  if (!res.ok) return null;
  return Buffer.from(await res.arrayBuffer());
}

for (const s of dex.species) {
  const dest = join(OUT_DIR, `${s.spriteId}.png`);
  if (existsSync(dest)) {
    skipped++;
    continue;
  }
  let buf = await fetchSprite(s.spriteId);
  if (!buf && s.baseSpecies) {
    const baseId = s.spriteId.split('-')[0];
    buf = await fetchSprite(baseId);
    if (buf) fallbacks.push(`${s.spriteId} → ${baseId}`);
  }
  if (!buf) {
    console.error(`✗ no sprite for ${s.name} (${s.spriteId})`);
    process.exitCode = 1;
    continue;
  }
  writeFileSync(dest, buf);
  downloaded++;
}

for (const f of fallbacks) console.warn(`  ⚠ fallback: ${f}`);
console.log(`✓ sprites — ${downloaded} downloaded, ${skipped} already present`);
