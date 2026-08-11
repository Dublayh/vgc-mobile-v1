/**
 * Core domain types for the Pokémon Champions ruleset.
 *
 * Champions differs from mainline VGC:
 *  - No IVs (everything is fixed at 31), no levels (fixed 50).
 *  - Stat Points (SP) replace EVs: pool of 66, max 32 per stat, 1 SP = +1 final stat.
 *  - Stat Alignments replace natures (same ±10% behavior; modeled as natures).
 */

export type StatID = 'hp' | 'atk' | 'def' | 'spa' | 'spd' | 'spe';

export const STAT_IDS: readonly StatID[] = ['hp', 'atk', 'def', 'spa', 'spd', 'spe'];

export const STAT_LABELS: Record<StatID, string> = {
  hp: 'HP',
  atk: 'Atk',
  def: 'Def',
  spa: 'SpA',
  spd: 'SpD',
  spe: 'Spe',
};

export type StatsTable = Record<StatID, number>;

/** SP spread: each stat 0–32, total ≤ 66. */
export type SPSpread = StatsTable;

export const SP_POOL = 66;
export const SP_STAT_MAX = 32;
export const CHAMPIONS_LEVEL = 50;
export const FIXED_IV = 31;

/**
 * Stat Alignments — identical to mainline natures (+10%/−10%).
 * `plus`/`minus` are null for neutral alignments.
 */
export interface Alignment {
  name: AlignmentName;
  plus: Exclude<StatID, 'hp'> | null;
  minus: Exclude<StatID, 'hp'> | null;
}

export type AlignmentName =
  | 'Adamant' | 'Bashful' | 'Bold' | 'Brave' | 'Calm'
  | 'Careful' | 'Docile' | 'Gentle' | 'Hardy' | 'Hasty'
  | 'Impish' | 'Jolly' | 'Lax' | 'Lonely' | 'Mild'
  | 'Modest' | 'Naive' | 'Naughty' | 'Quiet' | 'Quirky'
  | 'Rash' | 'Relaxed' | 'Sassy' | 'Serious' | 'Timid';

export const ALIGNMENTS: Record<AlignmentName, Alignment> = {
  Hardy:   { name: 'Hardy',   plus: null,  minus: null },
  Lonely:  { name: 'Lonely',  plus: 'atk', minus: 'def' },
  Brave:   { name: 'Brave',   plus: 'atk', minus: 'spe' },
  Adamant: { name: 'Adamant', plus: 'atk', minus: 'spa' },
  Naughty: { name: 'Naughty', plus: 'atk', minus: 'spd' },
  Bold:    { name: 'Bold',    plus: 'def', minus: 'atk' },
  Docile:  { name: 'Docile',  plus: null,  minus: null },
  Relaxed: { name: 'Relaxed', plus: 'def', minus: 'spe' },
  Impish:  { name: 'Impish',  plus: 'def', minus: 'spa' },
  Lax:     { name: 'Lax',     plus: 'def', minus: 'spd' },
  Timid:   { name: 'Timid',   plus: 'spe', minus: 'atk' },
  Hasty:   { name: 'Hasty',   plus: 'spe', minus: 'def' },
  Serious: { name: 'Serious', plus: null,  minus: null },
  Jolly:   { name: 'Jolly',   plus: 'spe', minus: 'spa' },
  Naive:   { name: 'Naive',   plus: 'spe', minus: 'spd' },
  Modest:  { name: 'Modest',  plus: 'spa', minus: 'atk' },
  Mild:    { name: 'Mild',    plus: 'spa', minus: 'def' },
  Quiet:   { name: 'Quiet',   plus: 'spa', minus: 'spe' },
  Bashful: { name: 'Bashful', plus: null,  minus: null },
  Rash:    { name: 'Rash',    plus: 'spa', minus: 'spd' },
  Calm:    { name: 'Calm',    plus: 'spd', minus: 'atk' },
  Gentle:  { name: 'Gentle',  plus: 'spd', minus: 'def' },
  Sassy:   { name: 'Sassy',   plus: 'spd', minus: 'spe' },
  Careful: { name: 'Careful', plus: 'spd', minus: 'spa' },
  Quirky:  { name: 'Quirky',  plus: null,  minus: null },
};

export interface ChampionsSet {
  /** Showdown species id, e.g. "garchomp" */
  species: string;
  /** Implies the mega forme is available via the Omni Ring. */
  megaStone?: string;
  ability: string;
  item?: string;
  /** "Stat Alignment" — modeled as a nature. */
  alignment: AlignmentName;
  sp: SPSpread;
  moves: [string?, string?, string?, string?];
}

export interface Team {
  id: string;
  name: string;
  regulation: string;
  format: 'doubles' | 'singles';
  sets: ChampionsSet[]; // ≤ 6
}

export interface Regulation {
  id: string; // "m-b"
  label: string;
  dateRange: [string, string];
  allowedSpecies: string[];
  allowedMegas: string[];
  bannedItems: string[];
  clauses: string[];
}

export const EMPTY_SP: SPSpread = { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 };
