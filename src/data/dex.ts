/** Types + loader for the static /data bundle (dex.json, regulations/*.json). */
import type { LegalityContext } from '../engine/legality';
import type { Regulation, StatsTable } from '../engine/types';

export interface DexSpecies {
  id: string;
  name: string;
  num: number;
  types: string[];
  baseStats: StatsTable;
  abilities: string[];
  weightkg: number;
  baseSpecies?: string;
  learnset: string[];
  spriteId: string;
}

export interface DexMove {
  id: string;
  name: string;
  type: string;
  category: 'Physical' | 'Special' | 'Status';
  basePower: number;
  accuracy: number | null;
  priority: number;
  target: string;
  shortDesc: string;
}

export interface DexItem {
  id: string;
  name: string;
  shortDesc: string;
  megaEvolves?: string;
  megaForme?: string;
}

export interface DexAbility {
  id: string;
  name: string;
  shortDesc: string;
}

export interface RegulationData extends Regulation {
  megaFormes: Record<string, string[]>;
  generatedAt: string;
}

export const toId = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');

/** Memoized lookup views over the raw dex bundle. */
export class DexLookup {
  readonly species: DexSpecies[];
  readonly moves: DexMove[];
  readonly items: DexItem[];
  readonly abilities: DexAbility[];
  readonly regulation: RegulationData;
  private bySpecies = new Map<string, DexSpecies>();
  private byMove = new Map<string, DexMove>();
  private byItem = new Map<string, DexItem>();

  constructor(
    dex: {
      species: DexSpecies[];
      moves: DexMove[];
      items: DexItem[];
      abilities: DexAbility[];
    },
    regulation: RegulationData,
  ) {
    this.species = dex.species;
    this.moves = dex.moves;
    this.items = dex.items;
    this.abilities = dex.abilities;
    this.regulation = regulation;
    for (const s of dex.species) {
      this.bySpecies.set(s.id, s);
      this.bySpecies.set(toId(s.name), s);
    }
    for (const m of dex.moves) this.byMove.set(m.id, m);
    for (const i of dex.items) this.byItem.set(toId(i.name), i);
  }

  getSpecies(nameOrId: string): DexSpecies | undefined {
    return this.bySpecies.get(toId(nameOrId));
  }
  getMove(nameOrId: string): DexMove | undefined {
    return this.byMove.get(toId(nameOrId));
  }
  getItem(nameOrId: string): DexItem | undefined {
    return this.byItem.get(toId(nameOrId));
  }

  /** Base (non-mega) roster, the browsable/pickable list. */
  get roster(): DexSpecies[] {
    return this.species.filter((s) => !s.baseSpecies);
  }

  megaFormesOf(speciesName: string): DexSpecies[] {
    return (this.regulation.megaFormes[speciesName] ?? [])
      .map((f) => this.getSpecies(f))
      .filter((s): s is DexSpecies => !!s);
  }

  legalityContext(): LegalityContext {
    return {
      allowedSpecies: new Set(this.regulation.allowedSpecies),
      megaFormes: new Map(Object.entries(this.regulation.megaFormes)),
      bannedItems: new Set(this.regulation.bannedItems),
      clauses: this.regulation.clauses,
      learnsets: new Map(this.species.map((s) => [s.name, new Set(s.learnset)])),
      abilities: new Map(this.species.map((s) => [s.name, s.abilities])),
      moveId: toId,
    };
  }
}
