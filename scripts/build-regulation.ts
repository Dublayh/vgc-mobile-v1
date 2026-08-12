/**
 * Compiles scripts/regulation-source/*.ts into public/data/regulations/*.json,
 * validating every species/mega name against Showdown dex data. Fails loudly
 * on unknown species; warns on megas whose forme isn't in Showdown data yet.
 */
import { Dex } from '@pkmn/dex';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  DEFAULT_REGULATION,
  REGULATIONS,
  type RegulationSource,
} from './regulation-source/index';

const OUT_DIR = join(import.meta.dirname, '..', 'public', 'data');

function resolveMegaFormes(species: string): string[] {
  const formes: string[] = [];
  for (const suffix of ['-Mega', '-Mega-X', '-Mega-Y']) {
    const forme = Dex.species.get(species + suffix);
    if (forme.exists) formes.push(forme.name);
  }
  return formes;
}

function buildRegulation(reg: RegulationSource) {
  const errors: string[] = [];
  const warnings: string[] = [];

  for (const name of reg.allowedSpecies) {
    if (!Dex.species.get(name).exists) errors.push(`Unknown species: "${name}"`);
  }

  const megaFormes: Record<string, string[]> = {};
  for (const name of reg.allowedMegas) {
    if (!reg.allowedSpecies.includes(name)) {
      errors.push(`Mega-allowed species "${name}" is not in allowedSpecies`);
      continue;
    }
    const formes = resolveMegaFormes(name);
    if (formes.length === 0) {
      warnings.push(
        `No mega forme in Showdown data for "${name}" — new Champions mega? ` +
          `Add via data override layer (see plan §2) once NCP/Showdown data lands.`,
      );
    } else {
      megaFormes[name] = formes;
    }
  }

  if (errors.length) {
    console.error('Regulation build FAILED:');
    for (const e of errors) console.error('  ✗ ' + e);
    process.exit(1);
  }
  for (const w of warnings) console.warn('  ⚠ ' + w);

  return {
    id: reg.id,
    label: reg.label,
    dateRange: reg.dateRange,
    allowedSpecies: reg.allowedSpecies,
    allowedMegas: reg.allowedMegas,
    megaFormes,
    bannedItems: reg.bannedItems,
    clauses: reg.clauses,
    generatedAt: new Date().toISOString(),
  };
}

mkdirSync(join(OUT_DIR, 'regulations'), { recursive: true });

const current = process.env.CURRENT_REG ?? DEFAULT_REGULATION;
if (!REGULATIONS.some((r) => r.id === current)) {
  console.error(
    `✗ CURRENT_REG="${current}" has no source (known: ${REGULATIONS.map((r) => r.id).join(', ')})`,
  );
  process.exit(1);
}

for (const source of REGULATIONS) {
  const reg = buildRegulation(source);
  writeFileSync(
    join(OUT_DIR, 'regulations', `${reg.id}.json`),
    JSON.stringify(reg, null, 2),
  );
  console.log(
    `✓ regulations/${reg.id}.json — ${reg.allowedSpecies.length} species, ` +
      `${reg.allowedMegas.length} megas (${Object.keys(reg.megaFormes).length} resolved in dex data)` +
      (reg.id === current ? '  ← current' : ''),
  );
}

writeFileSync(
  join(OUT_DIR, 'meta.json'),
  JSON.stringify(
    {
      currentRegulation: current,
      dataVersion: 1,
      generatedAt: new Date().toISOString(),
    },
    null,
    2,
  ),
);
