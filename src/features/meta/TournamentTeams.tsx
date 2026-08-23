/**
 * ProvenTeams (plan §4, phase 2): high-placing tournament teams for the
 * current regulation, importable into your own teams (SP left for you to
 * fill when the source doesn't publish spreads).
 */
import { useState } from 'react';
import { useUI } from '../../app/store';
import { Button } from '../../app/ui/Button';
import { Icon } from '../../app/ui/Icon';
import { Panel } from '../../app/ui/Panel';
import { Sprite } from '../../app/ui/Sprite';
import type { DexLookup } from '../../data/dex';
import type { TournamentEvent, TournamentTeam } from '../../data/tournaments';
import { useTournaments } from '../../data/useTournaments';
import {
  ALIGNMENTS,
  type AlignmentName,
  EMPTY_SP,
  type ChampionsSet,
  type Team,
} from '../../engine/types';
import { db } from '../../storage/db';
import { parsePaste } from '../import-export/showdown';

function placementToSets(t: TournamentTeam, lookup: DexLookup): ChampionsSet[] {
  if (t.paste) {
    try {
      return parsePaste(t.paste).slice(0, 6);
    } catch {
      /* fall through to structured mons */
    }
  }
  return t.mons.slice(0, 6).flatMap((m): ChampionsSet[] => {
    const sp = lookup.getSpecies(m.species);
    if (!sp) return [];
    const base = sp.baseSpecies ? (lookup.megaBaseOf(sp.name) ?? sp.baseSpecies) : sp.name;

    // Sources (Limitless) list megas as base species holding the stone —
    // the stone pins the exact forme, so mark the set as that mega.
    let megaForme = sp.baseSpecies ? sp.name : undefined;
    if (!megaForme && m.item) {
      const stone = lookup.getItem(m.item);
      if (
        stone?.megaForme &&
        (lookup.megaBaseOf(stone.megaForme) ?? stone.megaEvolves) === base
      ) {
        megaForme = lookup.getSpecies(stone.megaForme)?.name;
      }
    }

    return [
      {
        species: base,
        ...(megaForme ? { megaStone: megaForme } : {}),
        ability: m.ability ?? sp.abilities[0] ?? '',
        item: megaForme ? (lookup.stoneFor(megaForme)?.name ?? m.item) : m.item,
        alignment:
          m.alignment && m.alignment in ALIGNMENTS
            ? (m.alignment as AlignmentName)
            : 'Serious',
        sp: { ...EMPTY_SP },
        moves: (m.moves ?? []).slice(0, 4) as ChampionsSet['moves'],
      },
    ];
  });
}

export function TournamentTeams({ lookup }: { lookup: DexLookup }) {
  const data = useTournaments();
  const { openTeam, setTab } = useUI();
  const [expanded, setExpanded] = useState<string | null>(null);

  if (data === undefined) {
    return <p className="py-4 text-center text-sm text-ink-500">Loading tournament data…</p>;
  }
  if (data === null || data.events.length === 0) {
    return (
      <div className="py-4 text-sm text-ink-400">
        <p>No tournament bundle for this regulation yet.</p>
        <p className="mt-1 text-ink-500">
          Results live at{' '}
          <a href="https://victoryroadvgc.com/" target="_blank" rel="noreferrer" className="text-gold-400">
            Victory Road
          </a>{' '}
          — run <span className="stat-num">npm run data:tournaments</span> once a source ships.
        </p>
      </div>
    );
  }

  const importTeam = async (event: TournamentEvent, t: TournamentTeam) => {
    const sets = placementToSets(t, lookup);
    if (sets.length === 0) return;
    const team: Team = {
      id: crypto.randomUUID(),
      name: `${t.player} · ${event.name}`.slice(0, 60),
      regulation: lookup.regulation.id,
      format: 'doubles',
      sets,
    };
    await db.teams.add(team);
    openTeam(team.id);
    setTab('teams');
  };

  return (
    <div className="flex flex-col gap-3">
      {data.synthetic && (
        <p className="flex items-center gap-2 border border-warn/40 bg-warn/10 px-2.5 py-1.5 text-xs text-warn">
          <Icon name="alert" size={14} className="shrink-0" />
          Sample data — no real tournament source is wired yet. Teams shown are
          illustrative only.
        </p>
      )}

      {data.events.map((event) => (
        <Panel
          key={event.id}
          title={event.name}
          aside={
            <span className="label-caps">
              {new Date(event.date).toLocaleDateString()}
              {event.playerCount ? ` · ${event.playerCount} players` : ''}
            </span>
          }
        >
          <ul className="flex flex-col">
            {event.placements.map((t) => {
              const key = `${event.id}-${t.place}`;
              const open = expanded === key;
              return (
                <li key={key} className="border-b border-ink-800/60 last:border-0">
                  <button
                    onClick={() => setExpanded(open ? null : key)}
                    className="flex w-full items-center gap-2 py-2 text-left hover:bg-ink-850"
                  >
                    <span className="stat-num w-8 shrink-0 text-right text-sm text-gold-300">
                      #{t.place}
                    </span>
                    <span className="flex flex-1 items-center gap-0.5 overflow-hidden">
                      {t.mons.map((m, i) => {
                        const sp = lookup.getSpecies(m.species);
                        return sp ? <Sprite key={i} spriteId={sp.spriteId} size={32} /> : null;
                      })}
                    </span>
                    <span className="max-w-24 truncate text-xs text-ink-400">{t.player}</span>
                  </button>
                  {open && (
                    <div className="pb-2.5 pl-10">
                      <ul className="flex flex-col gap-1 text-xs text-ink-300">
                        {t.mons.map((m, i) => (
                          <li key={i}>
                            <span className="font-display font-semibold tracking-wide uppercase">
                              {m.species}
                            </span>
                            {m.item && <span className="text-ink-400"> @ {m.item}</span>}
                            {m.alignment && (
                              <span className="text-gold-400/80"> · {m.alignment}</span>
                            )}
                            {m.moves && m.moves.length > 0 && (
                              <span className="block text-ink-500">{m.moves.join(' / ')}</span>
                            )}
                          </li>
                        ))}
                      </ul>
                      <div className="mt-2 flex items-center gap-2">
                        <Button
                          variant="secondary"
                          className="!px-2.5 !py-1"
                          onClick={() => importTeam(event, t)}
                        >
                          Import to my teams
                        </Button>
                        <span className="text-[0.65rem] text-ink-500">
                          SP spreads aren't published — fill them in the editor.
                        </span>
                      </div>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
          {event.url && (
            <a
              href={event.url}
              target="_blank"
              rel="noreferrer"
              className="label-caps mt-2 inline-block text-gold-400"
            >
              Event page ›
            </a>
          )}
        </Panel>
      ))}

      <p className="text-xs text-ink-500">
        Source: {data.source} ·{' '}
        <a href={data.sourceUrl} target="_blank" rel="noreferrer" className="text-gold-400">
          {data.sourceUrl.replace(/^https?:\/\//, '')}
        </a>
      </p>
    </div>
  );
}
