/**
 * AdviceExport (plan §4): serialize team + analysis into a structured prompt
 * copied to the clipboard for pasting into a claude.ai chat. This is the ONLY
 * sanctioned AI touchpoint — never an in-app API call.
 */
import type { UsageLookup } from '../../data/usage';
import type { MatchupAudit } from '../../engine/threat';
import type { ChampionsSet, Team } from '../../engine/types';
import { serializeTeam } from '../import-export/showdown';
import type { Archetype, CoverageGaps, Suggestion } from './completer';

const header = (usage: UsageLookup) =>
  `You are helping with Pokémon Champions ranked doubles (Regulation M-B, ${usage.data.month} ladder).
Champions rules: level 50, no IVs (all 31), Stat Points instead of EVs (66 pool, max 32/stat, 1 SP = +1 final stat), Stat Alignments = natures, Mega Evolution via Omni Ring, species + item clause.

Top of the current meta (usage %): ${usage
    .top(15)
    .map((m) => `${m.name} ${(m.usage * 100).toFixed(1)}`)
    .join(', ')}.`;

export function threatAdvicePrompt(
  team: Team,
  threatName: string,
  threatSet: ChampionsSet,
  audits: (MatchupAudit | null)[],
  usage: UsageLookup,
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

  return `${header(usage)}

My team (SP spreads):
${serializeTeam(team.sets)}

Threat: ${threatName}'s most common set — ${threatSet.item ?? 'no item'}, ${threatSet.alignment}, moves: ${threatSet.moves.filter(Boolean).join(' / ')}.

My calc-audited matchups vs. it (max rolls, doubles):
${auditLines}

Question: how should I play this matchup, and if my answers are thin, what tech or replacement would you consider? Keep suggestions legal in Reg M-B and explain the reasoning.`;
}

export function completeTeamPrompt(
  team: Team,
  gaps: CoverageGaps,
  archetypes: Archetype[],
  suggestions: Suggestion[],
  usage: UsageLookup,
): string {
  return `${header(usage)}

My locked core (${team.sets.length}/6, SP spreads):
${serializeTeam(team.sets)}

Detected plan: ${archetypes.length ? archetypes.join(' + ') : 'none obvious yet'}.
Coverage gaps: cannot hit ${gaps.uncovered.join(', ') || 'nothing'} super-effectively; stacked weak to ${gaps.weakTo.join(', ') || 'nothing'}.

Statistical partner suggestions from the ladder (with evidence):
${suggestions
  .slice(0, 6)
  .map((s) => `- ${s.name} (${(s.usage * 100).toFixed(1)}%): ${s.evidence.join('; ') || 'usage only'}`)
  .join('\n')}

Question: help me finish this team. Which of these (or other Reg M-B-legal picks) complete the plan best, what roles are still missing (speed control, Fake Out, redirection, win condition), and what SP spreads would you run?`;
}

export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}
