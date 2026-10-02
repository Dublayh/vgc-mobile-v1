/**
 * "Who OHKOs this?" — sweeps the ENTIRE regulation (every forme, mega included)
 * against one defender seeded with its most common ladder set (item and
 * ability included — the same defender Calc › Sweep uses), at a pickable
 * spread. Every row jumps into the Calc for verification.
 */
import { useEffect, useState } from 'react';
import { Button } from '../../app/ui/Button';
import { Panel } from '../../app/ui/Panel';
import type { DexLookup } from '../../data/dex';
import { useUsage } from '../../data/useUsage';
import { EMPTY_SP, type AlignmentName, type SPSpread } from '../../engine/types';
import { seedSelection } from '../calc/jumpToCalc';
import { SpreadChips, type SpreadOption } from '../teams/fields';
import { SweepResults } from './SweepResults';
import { useOhkoSweep, useVerifyInCalc, type SweepTarget } from './useOhkoSweep';

export function OhkoSweepPanel({
  defenderName,
  lookup,
}: {
  defenderName: string; // forme display name
  lookup: DexLookup;
}) {
  const usage = useUsage();
  const sweep = useOhkoSweep(lookup);
  const verify = useVerifyInCalc(lookup);
  const [spread, setSpread] = useState<{ alignment: AlignmentName; sp: SPSpread } | null>(null);

  // Reset when the viewed mon or the game mode changes.
  useEffect(() => {
    sweep.reset();
    setSpread(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [defenderName, sweep.gameMode]);

  const species = lookup.getSpecies(defenderName);
  if (!species) return null;
  const mon = usage?.get(defenderName);

  const spreadOptions: SpreadOption[] = [
    ...(mon?.spreads.slice(0, 3) ?? []),
    { alignment: 'Serious', sp: { ...EMPTY_SP }, label: '0 SP' },
  ];
  const active = spread ?? { alignment: spreadOptions[0].alignment as AlignmentName, sp: spreadOptions[0].sp };
  const seeded = seedSelection(species, usage, lookup);
  const target: SweepTarget = {
    species,
    set: { ...seeded.set, alignment: active.alignment, sp: { ...active.sp } },
    sourceLabel: seeded.sourceLabel,
  };
  const ohkoCount = sweep.rows?.filter((r) => r.score >= 100).length ?? 0;

  return (
    <Panel
      title={`Who OHKOs ${species.name}?`}
      aside={
        sweep.rows !== null ? <span className="stat-num text-xs text-illegal">{ohkoCount} can</span> : undefined
      }
    >
      <div className="mb-2 flex flex-wrap items-center gap-1.5">
        <span className="label-caps">As:</span>
        <SpreadChips
          size="xs"
          spreads={spreadOptions}
          current={active}
          onPick={(alignment, sp) => {
            setSpread({ alignment, sp });
            sweep.reset();
          }}
        />
      </div>

      {sweep.rows === null && (
        <div className="flex items-center gap-3">
          <Button variant="primary" onClick={() => sweep.run([target], { chunk: 20 })} disabled={sweep.running}>
            {sweep.running ? `Sweeping… ${sweep.progress}%` : `Sweep all ${lookup.species.length} formes`}
          </Button>
          {sweep.running && (
            <div className="h-1.5 flex-1 bg-ink-800">
              <div className="h-full bg-gold-500" style={{ width: `${sweep.progress}%` }} />
            </div>
          )}
        </div>
      )}

      {sweep.rows !== null && (
        <SweepResults
          rows={sweep.rows}
          targets={[target]}
          matchMode="all"
          gameMode={sweep.gameMode}
          onVerify={(row, idx, option) => verify(row, target, idx, option)}
        />
      )}
    </Panel>
  );
}
