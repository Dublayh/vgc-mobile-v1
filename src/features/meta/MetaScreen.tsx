import { useSettings } from '../../app/settings';
import { useUI, type MetaSegment } from '../../app/store';
import { EmptyState } from '../../app/ui/EmptyState';
import { Icon } from '../../app/ui/Icon';
import type { DexLookup } from '../../data/dex';
import { isSinglesData, useUsage } from '../../data/useUsage';
import { SpeedTiers } from './SpeedTiers';
import { ThreatAudit } from './ThreatAudit';
import { TournamentTeams } from './TournamentTeams';
import { UsageBrowser } from './UsageBrowser';

export function MetaScreen({ lookup }: { lookup: DexLookup }) {
  const usage = useUsage();
  const { metaSegment: segment, setMetaSegment } = useUI();
  const { gameMode } = useSettings();

  if (usage === undefined) {
    return <p className="mt-16 text-center text-sm text-ink-500">Loading usage data…</p>;
  }
  if (usage === null) {
    return (
      <EmptyState
        icon="meta"
        title="No usage data"
        hint="No ladder stats bundle found for this regulation. Run `npm run data:usage` once Smogon publishes Champions stats."
      />
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {gameMode === 'Singles' && (
        <p className="flex items-center gap-2 border border-info/40 bg-info/10 px-2.5 py-1.5 text-xs text-info">
          <Icon name="alert" size={14} className="shrink-0" />
          {isSinglesData(usage)
            ? 'Singles mode: usage below is the SINGLES ranked ladder. Tournament teams remain doubles events.'
            : 'Singles mode: no singles ladder bundle for this regulation — showing doubles usage.'}
        </p>
      )}
      {usage.data.synthetic && (
        <p className="flex items-center gap-2 border border-warn/40 bg-warn/10 px-2.5 py-1.5 text-xs text-warn">
          <Icon name="alert" size={14} className="shrink-0" />
          Sample data — real Smogon ladder stats haven't been wired up yet. Numbers are
          illustrative only.
        </p>
      )}

      <div className="flex gap-1.5">
        {(
          [
            ['usage', 'Usage'],
            ['speed', 'Speed'],
            ['threats', 'Threats'],
            ['tourney', 'Tourney'],
          ] as [MetaSegment, string][]
        ).map(([id, label]) => (
          <button
            key={id}
            onClick={() => setMetaSegment(id)}
            className={`chamfer-sm px-3 py-1 font-display text-sm font-semibold tracking-[0.1em] uppercase ${
              segment === id ? 'bg-gold-500 text-ink-950' : 'border border-ink-700 text-ink-400'
            }`}
          >
            {label}
          </button>
        ))}
        <span className="label-caps ml-auto self-center">
          {usage.data.month}
          {usage.data.totalBattles > 0 && ` · ${usage.data.totalBattles.toLocaleString()} battles`}
        </span>
      </div>

      {segment === 'usage' && <UsageBrowser usage={usage} lookup={lookup} />}
      {segment === 'speed' && <SpeedTiers usage={usage} lookup={lookup} />}
      {segment === 'threats' && <ThreatAudit usage={usage} lookup={lookup} />}
      {segment === 'tourney' && <TournamentTeams lookup={lookup} />}
    </div>
  );
}
