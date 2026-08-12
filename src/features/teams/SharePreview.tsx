/** Landing view for #share/<blob> links: decode, preview, save a copy. */
import { useEffect, useState } from 'react';
import { useUI } from '../../app/store';
import { Button } from '../../app/ui/Button';
import { Icon } from '../../app/ui/Icon';
import { Panel } from '../../app/ui/Panel';
import { Sprite } from '../../app/ui/Sprite';
import { TypeBadge } from '../../app/ui/TypeBadge';
import type { DexLookup } from '../../data/dex';
import { teamViolations } from '../../engine/legality';
import type { Team } from '../../engine/types';
import { db } from '../../storage/db';
import { decodeTeamShare } from '../import-export/shareCodec';

export function SharePreview({ blob, lookup }: { blob: string; lookup: DexLookup }) {
  const { clearShare, openTeam } = useUI();
  const [team, setTeam] = useState<Team | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let live = true;
    decodeTeamShare(blob)
      .then((t) => live && setTeam(t))
      .catch(() => live && setError(true));
    return () => {
      live = false;
    };
  }, [blob]);

  if (error) {
    return (
      <div className="mt-16 text-center">
        <p className="text-illegal">This share link is invalid or truncated.</p>
        <Button className="mt-4" onClick={clearShare}>
          Go to my teams
        </Button>
      </div>
    );
  }
  if (!team) return <p className="mt-16 text-center text-sm text-ink-500">Decoding shared team…</p>;

  const violations = teamViolations(team, lookup.legalityContext());

  return (
    <div className="flex flex-col gap-3">
      <p className="label-caps">Shared team</p>
      <Panel
        title={team.name}
        aside={<span className="label-caps">{team.format}</span>}
      >
        <ul className="flex flex-col gap-2">
          {team.sets.map((set, i) => {
            const species = lookup.getSpecies(set.megaStone ?? set.species);
            return (
              <li key={i} className="flex items-center gap-2.5 border-b border-ink-800/60 pb-2 last:border-0 last:pb-0">
                {species && <Sprite spriteId={species.spriteId} size={40} />}
                <div className="flex-1">
                  <span className="font-display text-sm font-semibold tracking-wide uppercase">
                    {set.megaStone ?? set.species}
                  </span>
                  <p className="text-xs text-ink-400">
                    {set.item ?? 'no item'} · {set.alignment} ·{' '}
                    {set.moves.filter(Boolean).join(' / ') || 'no moves'}
                  </p>
                </div>
                <span className="flex gap-1">
                  {species?.types.map((t) => <TypeBadge key={t} type={t} size="sm" />)}
                </span>
              </li>
            );
          })}
        </ul>
      </Panel>

      {violations.length > 0 && (
        <p className="flex items-center gap-2 text-sm text-warn">
          <Icon name="alert" size={14} /> {violations.length} legality issue
          {violations.length === 1 ? '' : 's'} under {lookup.regulation.label} — shown in the
          editor after saving.
        </p>
      )}

      <div className="flex gap-2">
        <Button
          variant="primary"
          onClick={async () => {
            await db.teams.add(team);
            openTeam(team.id);
          }}
        >
          Save to my teams
        </Button>
        <Button variant="ghost" onClick={clearShare}>
          Discard
        </Button>
      </div>
    </div>
  );
}
