import { useState } from 'react';
import { Panel } from '../../app/ui/Panel';
import { Sprite } from '../../app/ui/Sprite';
import { TypeBadge } from '../../app/ui/TypeBadge';
import type { DexLookup } from '../../data/dex';
import type { UsageLookup, UsageMon } from '../../data/usage';
import { STAT_IDS, STAT_LABELS } from '../../engine/types';

const pct = (v: number, digits = 1) => `${(v * 100).toFixed(digits)}%`;

export function UsageBrowser({ usage, lookup }: { usage: UsageLookup; lookup: DexLookup }) {
  const [selected, setSelected] = useState<UsageMon | null>(null);

  if (selected) {
    return (
      <MonUsageDetail
        mon={selected}
        usage={usage}
        lookup={lookup}
        onBack={() => setSelected(null)}
        onJump={(m) => setSelected(m)}
      />
    );
  }

  const maxUsage = usage.mons[0]?.usage ?? 1;

  return (
    <ul className="chamfer border border-ink-800 bg-ink-900">
      {usage.mons.map((m) => {
        const sp = lookup.getSpecies(m.name);
        return (
          <li key={m.name}>
            <button
              onClick={() => setSelected(m)}
              className="flex w-full items-center gap-2.5 border-b border-ink-800/60 px-3 py-1.5 text-left hover:bg-ink-850"
            >
              <span className="stat-num w-6 text-right text-xs text-ink-500">{m.rank}</span>
              {sp && <Sprite spriteId={sp.spriteId} size={36} />}
              <span className="flex-1">
                <span className="font-display text-sm font-semibold tracking-wide uppercase">
                  {m.name}
                </span>
                <span className="mt-0.5 block h-1 max-w-40 bg-ink-800">
                  <span
                    className="block h-full bg-gold-500"
                    style={{ width: `${(m.usage / maxUsage) * 100}%` }}
                  />
                </span>
              </span>
              <span className="stat-num text-sm text-ink-200">{pct(m.usage)}</span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

function RankedList({
  title,
  entries,
  render,
}: {
  title: string;
  entries: [string, number][];
  render?: (name: string) => React.ReactNode;
}) {
  if (entries.length === 0) return null;
  return (
    <Panel title={title}>
      <ul className="flex flex-col gap-1">
        {entries.map(([name, share]) => (
          <li key={name} className="flex items-center gap-2 text-sm">
            {render ? render(name) : <span className="flex-1">{name}</span>}
            <span className="stat-num w-12 text-right text-xs text-ink-300">{pct(share)}</span>
          </li>
        ))}
      </ul>
    </Panel>
  );
}

function MonUsageDetail({
  mon,
  usage,
  lookup,
  onBack,
  onJump,
}: {
  mon: UsageMon;
  usage: UsageLookup;
  lookup: DexLookup;
  onBack: () => void;
  onJump: (m: UsageMon) => void;
}) {
  const species = lookup.getSpecies(mon.name);

  return (
    <div className="flex flex-col gap-3">
      <button onClick={onBack} className="label-caps self-start py-1 text-gold-400">
        ‹ Usage
      </button>

      <div className="flex items-center gap-3">
        {species && <Sprite spriteId={species.spriteId} size={56} />}
        <div className="flex-1">
          <p className="font-display text-xl font-bold tracking-wide uppercase italic">
            {mon.name}
          </p>
          <div className="mt-0.5 flex items-center gap-1.5">
            {species?.types.map((t) => <TypeBadge key={t} type={t} size="sm" />)}
            <span className="stat-num text-xs text-gold-300">
              #{mon.rank} · {pct(mon.usage)}
            </span>
          </div>
        </div>
      </div>

      <RankedList
        title="Moves"
        entries={mon.moves}
        render={(name) => {
          const move = lookup.getMove(name);
          return (
            <span className="flex flex-1 items-center gap-2">
              {move && <TypeBadge type={move.type} size="sm" />}
              {name}
            </span>
          );
        }}
      />

      <RankedList title="Items" entries={mon.items} />
      <RankedList title="Abilities" entries={mon.abilities} />

      {mon.spreads.length > 0 && (
        <Panel title="Spreads (SP)">
          <ul className="flex flex-col gap-1.5">
            {mon.spreads.map((s, i) => (
              <li key={i} className="flex items-center gap-2 text-sm">
                <span className="label-caps w-16 text-gold-400">{s.alignment}</span>
                <span className="stat-num flex-1 text-xs text-ink-300">
                  {STAT_IDS.map((id) => `${s.sp[id] || '·'}`).join(' / ')}
                </span>
                <span className="stat-num w-12 text-right text-xs text-ink-300">{pct(s.pct)}</span>
              </li>
            ))}
            <li className="label-caps pt-0.5">
              {STAT_IDS.map((id) => STAT_LABELS[id]).join(' / ')}
            </li>
          </ul>
        </Panel>
      )}

      {mon.teammates.length > 0 && (
        <Panel title="Teammates">
          <div className="flex flex-wrap gap-1.5">
            {mon.teammates.map(([name, share]) => {
              const target = usage.get(name);
              return (
                <button
                  key={name}
                  disabled={!target}
                  onClick={() => target && onJump(target)}
                  className={`chamfer-sm border border-ink-700 px-2 py-1 text-xs ${
                    target ? 'text-ink-200 hover:border-gold-600' : 'text-ink-500'
                  }`}
                >
                  {name} <span className="stat-num text-ink-500">{pct(share, 0)}</span>
                </button>
              );
            })}
          </div>
        </Panel>
      )}
    </div>
  );
}
