/**
 * AdviceExport (plan §4): serialize team + analysis into a structured prompt
 * copied to the clipboard for pasting into a claude.ai chat. This is the ONLY
 * sanctioned AI touchpoint — never an in-app API call.
 */
import type { GameMode } from '../../app/settings';
import type { UsageLookup } from '../../data/usage';
import type { MatchupAudit } from '../../engine/threat';
import type { ChampionsSet, Team } from '../../engine/types';
import { serializeTeam } from '../import-export/showdown';
import type { Archetype, CoverageGaps, Role, Suggestion } from './completer';
import type { WorstRow } from './worstThreats';

/** What the prompt must know about the app's current context. */
export interface AdviceContext {
  /** e.g. "Regulation M-C" (from the loaded regulation bundle) */
  regulationLabel: string;
  gameMode: GameMode;
}

const header = (usage: UsageLookup, ctx: AdviceContext) => {
  const mode = ctx.gameMode === 'Singles' ? 'singles (1v1)' : 'doubles (2v2)';
  const stale = usage.staleRegulation
    ? ` — note: these stats are from the previous regulation (${usage.staleRegulation.toUpperCase()}) because the current one has no published month yet`
    : '';
  return `You are helping with Pokémon Champions ranked ${mode} (${ctx.regulationLabel}, ${usage.data.month} ladder${stale}).
Champions rules: level 50, no IVs (all 31), Stat Points instead of EVs (66 pool, max 32/stat, +1 final stat per SP on neutral stats), Stat Alignments = natures, Mega Evolution via Omni Ring, species + item clause.

Top of the current meta (usage %): ${usage
    .top(15)
    .map((m) => `${m.name} ${(m.usage * 100).toFixed(1)}`)
    .join(', ')}.`;
};

export function threatAdvicePrompt(
  team: Team,
  threatName: string,
  threatSet: ChampionsSet,
  audits: (MatchupAudit | null)[],
  usage: UsageLookup,
  ctx: AdviceContext,
): string {
  const auditLines = team.sets
    .map((set, i) => {
      const a = audits[i];
      if (!a) return null;
      return `- ${set.megaStone ?? set.species}: ${a.verdict.toUpperCase()} | takes ${
        a.incoming ? `${a.incoming.maxPercent}% max (${a.incoming.move})` : 'nothing'
      } | deals ${
        a.outgoing ? `${a.outgoing.maxPercent}% max (${a.outgoing.move})` : 'nothing'
      } | speed ${a.mySpeed} vs ${a.theirSpeed}`;
    })
    .filter(Boolean)
    .join('\n');

  return `${header(usage, ctx)}

My team (SP spreads):
${serializeTeam(team.sets)}

Threat: ${threatName}'s most common set — ${threatSet.item ?? 'no item'}, ${threatSet.alignment}, moves: ${threatSet.moves.filter(Boolean).join(' / ')}.

My calc-audited matchups vs. it (max rolls, ${ctx.gameMode.toLowerCase()}):
${auditLines}

Question: how should I play this matchup, and if my answers are thin, what tech or replacement would you consider? Keep suggestions legal in ${ctx.regulationLabel} and explain the reasoning.`;
}

export interface CompletionSummary {
  gaps: CoverageGaps;
  archetypes: Archetype[];
  roles: Set<Role>;
  suggestions: Suggestion[];
  /** the team's worst meta matchups, when the calc audit has run */
  threats?: WorstRow[];
  /** mons the user explicitly wants the remaining slots to cover */
  targets?: string[];
}

export function completeTeamPrompt(
  team: Team,
  summary: CompletionSummary,
  usage: UsageLookup,
  ctx: AdviceContext,
): string {
  const { gaps, archetypes, roles, suggestions, threats, targets } = summary;
  const threatLines = threats?.length
    ? `\nWorst calc-audited matchups so far (meta set vs. each locked slot): ${threats
        .slice(0, 6)
        .map((t) => `${t.name} (${t.loses} lose / ${t.shaky} shaky / ${t.safe} safe)`)
        .join(', ')}.`
    : '';
  const targetLine = targets?.length
    ? `\nI specifically want the remaining slots to handle: ${targets.join(', ')} (suggestions below were calc-audited against each one's most common set).`
    : '';
  return `${header(usage, ctx)}

My locked core (${team.sets.length}/6, SP spreads):
${serializeTeam(team.sets)}

Detected plan: ${archetypes.length ? archetypes.join(' + ') : 'none obvious yet'}.
Roles covered: ${roles.size ? [...roles].join(', ') : 'none yet'}.
Coverage gaps: cannot hit ${gaps.uncovered.join(', ') || 'nothing'} super-effectively; stacked weak to ${gaps.weakTo.join(', ') || 'nothing'}.${threatLines}${targetLine}

Statistical + calc-audited partner suggestions from the ladder (with evidence):
${suggestions
  .slice(0, 6)
  .map((s) => `- ${s.name} (${(s.usage * 100).toFixed(1)}%): ${s.evidence.join('; ') || 'usage only'}`)
  .join('\n')}

Question: help me finish this team. Which of these (or other ${ctx.regulationLabel}-legal picks) complete the plan best, what roles are still missing (speed control, Fake Out, redirection, win condition), and what SP spreads would you run?`;
}
