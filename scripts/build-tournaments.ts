/**
 * Emits public/data/tournaments/<regulation>.json: recent high-placing Pokémon
 * Champions tournament teams from the Limitless tournament platform's public
 * JSON API (no key required; https://docs.limitlesstcg.com/developer.html).
 *
 * Endpoints used:
 *   GET https://play.limitlesstcg.com/api/tournaments?game=VGC&format=<REG>&limit=50&page=N
 *   GET https://play.limitlesstcg.com/api/tournaments/<id>/standings
 *
 * - Regulation comes from public/data/meta.json → currentRegulation ("m-b" →
 *   Limitless format id "M-B"), so the format filter IS the regulation window.
 * - Keeps the most recent MAX_EVENTS completed events that published open
 *   teamlists, top TOP_CUT placings each (fewer if the event has fewer).
 * - Species/items/abilities/moves are normalized through @pkmn/dex. Teams with
 *   an unresolvable species are dropped (logged). Items/abilities/moves that
 *   the dex doesn't know keep the source's name (logged) — Champions has a few
 *   stones the dex spells differently (see ITEM_ALIASES).
 * - Fails loudly (exit 1) if the API is unreachable or no qualifying events
 *   exist — never writes an empty or stale file.
 */
import { Dex, toID } from '@pkmn/dex';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const DATA_DIR = join(import.meta.dirname, '..', 'public', 'data');
const API_BASE = 'https://play.limitlesstcg.com/api';
const MAX_EVENTS = 8;
const TOP_CUT = 8;
const MAX_PAGES = 4;
const FETCH_DELAY_MS = 300;

// Limitless spellings → @pkmn/dex names (keyed by toID of the source name).
const ITEM_ALIASES: Record<string, string> = {
  staraptorite: 'Staraptite',
};
const SPECIES_ALIASES: Record<string, string> = {
  eternalflowerfloette: 'Floette-Eternal',
};

interface TournamentData {
  generatedAt: string;
  source: string;
  sourceUrl: string;
  synthetic?: boolean; // NEVER set by this script
  events: TournamentEvent[];
}

interface TournamentEvent {
  id: string;
  name: string;
  date: string;
  format: string;
  playerCount?: number;
  url?: string;
  placements: TournamentTeam[];
}

interface TournamentTeam {
  place: number;
  player: string;
  paste?: string;
  mons: {
    species: string;
    item?: string;
    ability?: string;
    moves?: string[];
    /** Champions alignment (the API's "nature") when published */
    alignment?: string;
  }[];
}

interface ApiTournament {
  id: string;
  game: string;
  format: string;
  name: string;
  date: string;
  players: number;
  organizerId: number;
}

interface ApiStandingMon {
  id: string;
  name: string;
  item?: string | null;
  ability?: string | null;
  attacks?: string[] | null;
  nature?: string | null;
}

interface ApiStanding {
  player: string;
  name: string;
  country?: string | null;
  placing: number | null;
  decklist?: ApiStandingMon[] | null;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url} → HTTP ${res.status}`);
  return (await res.json()) as T;
}

const warned = new Set<string>();
function warnOnce(msg: string): void {
  if (warned.has(msg)) return;
  warned.add(msg);
  console.warn(`  ${msg}`);
}

function normItem(raw: string): string {
  const alias = ITEM_ALIASES[toID(raw)];
  const item = Dex.items.get(alias ?? raw);
  if (item.exists) return item.name;
  warnOnce(`Unknown item "${raw}" — keeping source spelling`);
  return raw;
}

function normAbility(raw: string): string {
  const ability = Dex.abilities.get(raw);
  if (ability.exists) return ability.name;
  warnOnce(`Unknown ability "${raw}" — keeping source spelling`);
  return raw;
}

function normMove(raw: string): string {
  const move = Dex.moves.get(raw);
  if (move.exists) return move.name;
  warnOnce(`Unknown move "${raw}" — keeping source spelling`);
  return raw;
}

/** Normalize one standings row into a TournamentTeam, or null if it can't ship. */
function toTeam(row: ApiStanding, eventName: string): TournamentTeam | null {
  if (typeof row.placing !== 'number' || !Array.isArray(row.decklist)) return null;
  if (row.decklist.length === 0 || row.decklist.length > 6) return null;

  const mons: TournamentTeam['mons'] = [];
  for (const raw of row.decklist) {
    const sourceName = raw.name ?? raw.id;
    const species = Dex.species.get(SPECIES_ALIASES[toID(sourceName)] ?? sourceName);
    if (!species.exists) {
      console.warn(
        `  Dropping ${row.name}'s team in "${eventName}": unresolved species "${raw.name ?? raw.id}"`,
      );
      return null;
    }
    const mon: TournamentTeam['mons'][number] = { species: species.name };
    if (raw.item) mon.item = normItem(raw.item);
    if (raw.ability) mon.ability = normAbility(raw.ability);
    if (raw.nature) {
      const nature = Dex.natures.get(raw.nature);
      if (nature.exists) mon.alignment = nature.name;
      else warnOnce(`Unknown nature "${raw.nature}" — dropping`);
    }
    if (Array.isArray(raw.attacks) && raw.attacks.length > 0) {
      mon.moves = raw.attacks.map(normMove);
    }
    mons.push(mon);
  }

  return { place: row.placing, player: row.name || row.player, mons };
}

async function main(): Promise<void> {
  const meta = JSON.parse(readFileSync(join(DATA_DIR, 'meta.json'), 'utf8'));
  const regulation: string = meta.currentRegulation; // e.g. "m-b"
  const formatId = regulation.toUpperCase(); // Limitless format id, e.g. "M-B"

  const events: TournamentEvent[] = [];
  let teamsDropped = 0;

  for (let page = 1; page <= MAX_PAGES && events.length < MAX_EVENTS; page++) {
    const listUrl = `${API_BASE}/tournaments?game=VGC&format=${encodeURIComponent(formatId)}&limit=50&page=${page}`;
    const list = await fetchJson<ApiTournament[]>(listUrl);
    if (list.length === 0) break;

    // The API returns newest-first; keep it that way but don't rely on it.
    list.sort((a, b) => b.date.localeCompare(a.date));

    for (const t of list) {
      if (events.length >= MAX_EVENTS) break;
      await sleep(FETCH_DELAY_MS);

      let standings: ApiStanding[];
      try {
        standings = await fetchJson<ApiStanding[]>(`${API_BASE}/tournaments/${t.id}/standings`);
      } catch (err) {
        console.warn(`  Skipping "${t.name}": ${(err as Error).message}`);
        continue;
      }

      // Completed events have numeric final placings; in-progress ones are null.
      const finished = standings.filter((s) => typeof s.placing === 'number');
      if (finished.length === 0) {
        console.log(`  Skipping "${t.name}" (${t.date}): not finished yet`);
        continue;
      }

      const topCut = finished
        .sort((a, b) => (a.placing as number) - (b.placing as number))
        .filter((s) => (s.placing as number) <= TOP_CUT);

      const placements: TournamentTeam[] = [];
      for (const row of topCut) {
        const team = toTeam(row, t.name);
        if (team) placements.push(team);
        else if (typeof row.placing === 'number' && Array.isArray(row.decklist)) teamsDropped++;
      }
      if (placements.length === 0) {
        console.log(`  Skipping "${t.name}" (${t.date}): no published teamlists in the top ${TOP_CUT}`);
        continue;
      }

      events.push({
        id: t.id,
        name: t.name,
        date: t.date,
        format: `Reg ${t.format}`,
        playerCount: t.players,
        url: `https://play.limitlesstcg.com/tournament/${t.id}`,
        placements,
      });
      console.log(
        `Kept "${t.name}" (${t.date.slice(0, 10)}, ${t.players} players, ${placements.length} teams)`,
      );
    }
  }

  if (events.length === 0) {
    console.error(
      `No completed ${formatId} events with published teamlists found on Limitless — refusing to write.`,
    );
    process.exit(1);
  }

  events.sort((a, b) => b.date.localeCompare(a.date));

  const out: TournamentData = {
    generatedAt: new Date().toISOString(),
    source: 'play.limitlesstcg.com',
    sourceUrl: `https://play.limitlesstcg.com/tournaments/completed?game=VGC&format=${encodeURIComponent(formatId)}`,
    events,
  };

  const outDir = join(DATA_DIR, 'tournaments');
  mkdirSync(outDir, { recursive: true });
  const outPath = join(outDir, `${regulation}.json`);
  const json = JSON.stringify(out, null, 2);
  writeFileSync(outPath, json);

  const teamCount = events.reduce((n, e) => n + e.placements.length, 0);
  if (teamsDropped > 0) console.log(`Dropped ${teamsDropped} team(s) during normalization.`);
  console.log(
    `Wrote ${outPath} (${events.length} events, ${teamCount} teams, ${(json.length / 1024).toFixed(1)} KB)`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
