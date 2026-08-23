/** Tournament results schema — produced by scripts/build-tournaments.ts. */

export interface TournamentMon {
  species: string; // Showdown-style name (may be a mega forme)
  item?: string;
  ability?: string;
  moves?: string[];
  /** Champions alignment (nature) when the source publishes it */
  alignment?: string;
}

export interface TournamentTeam {
  place: number;
  player: string;
  /** full text paste when the source publishes one */
  paste?: string;
  mons: TournamentMon[];
}

export interface TournamentEvent {
  id: string;
  name: string;
  date: string;
  format: string;
  playerCount?: number;
  url?: string;
  placements: TournamentTeam[];
}

export interface TournamentData {
  generatedAt: string;
  source: string;
  sourceUrl: string;
  /** true only for the checked-in sample file */
  synthetic?: boolean;
  events: TournamentEvent[];
}
