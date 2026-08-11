/**
 * Living style guide — temporary screen while M2 features land, so the
 * design system can be reviewed on-device. The set card below is rendered
 * from REAL engine output (computeStats), not mock numbers.
 */
import { computeStats } from '../engine/stats';
import { ALIGNMENTS, STAT_IDS, STAT_LABELS } from '../engine/types';
import { Button } from './ui/Button';
import { Icon } from './ui/Icon';
import { Panel } from './ui/Panel';
import { POKEMON_TYPES, TypeBadge } from './ui/TypeBadge';
import { StatBar } from './ui/StatBar';

const GARCHOMP_BASE = { hp: 108, atk: 130, def: 95, spa: 80, spd: 85, spe: 102 };
const DEMO_SP = { hp: 2, atk: 32, def: 0, spa: 0, spd: 0, spe: 32 };
const DEMO_ALIGNMENT = 'Jolly' as const;
const stats = computeStats(GARCHOMP_BASE, DEMO_SP, DEMO_ALIGNMENT);
const spSpent = Object.values(DEMO_SP).reduce((a, b) => a + b, 0);

export function DesignGallery() {
  const a = ALIGNMENTS[DEMO_ALIGNMENT];
  return (
    <div className="flex flex-col gap-4">
      {/* Set card — the M2 SetEditor's read view, previewed here */}
      <Panel
        title="Set card / live engine"
        aside={<span className="stat-num text-xs text-gold-400">{spSpent}/66 SP</span>}
      >
        <div className="flex items-baseline justify-between">
          <div>
            <span className="font-display text-2xl font-bold tracking-wide uppercase italic">
              Garchomp
            </span>
            <span className="ml-2 text-sm text-ink-400">@ Life Orb</span>
          </div>
          <span className="label-caps text-gold-400">{DEMO_ALIGNMENT}</span>
        </div>
        <div className="mt-1.5 flex gap-1.5">
          <TypeBadge type="dragon" size="sm" />
          <TypeBadge type="ground" size="sm" />
        </div>
        <div className="mt-4 flex flex-col gap-1.5">
          {STAT_IDS.map((id) => (
            <StatBar
              key={id}
              label={STAT_LABELS[id]}
              value={stats[id]}
              sp={DEMO_SP[id]}
              max={id === 'hp' ? 260 : 240}
              alignment={a.plus === id ? 'plus' : a.minus === id ? 'minus' : undefined}
            />
          ))}
        </div>
        <div className="mt-4 grid grid-cols-2 gap-1.5">
          {['Earthquake', 'Dragon Claw', 'Swords Dance', 'Protect'].map((m) => (
            <span key={m} className="border border-ink-700 bg-ink-850 px-2.5 py-1.5 text-sm">
              {m}
            </span>
          ))}
        </div>
      </Panel>

      <Panel title="Buttons">
        <div className="flex flex-wrap items-center gap-2.5">
          <Button variant="primary">Save team</Button>
          <Button>Duplicate</Button>
          <Button variant="danger">Delete</Button>
          <Button variant="ghost">Cancel</Button>
        </div>
      </Panel>

      <Panel title="Legality feedback">
        <div className="flex flex-col gap-2 text-sm">
          <p className="flex items-center gap-2 text-legal">
            <Icon name="check" size={16} /> Reg M-B legal · clauses satisfied
          </p>
          <p className="flex items-center gap-2 text-illegal">
            <Icon name="alert" size={16} /> Item clause: Life Orb already on Chandelure
          </p>
          <p className="flex items-center gap-2 text-warn">
            <Icon name="alert" size={16} /> Shaky vs Mega Staraptor — takes 78–92%
          </p>
        </div>
      </Panel>

      <Panel title="Type system" aside={<span className="label-caps">18 tokens</span>}>
        <div className="flex flex-wrap gap-1.5">
          {POKEMON_TYPES.map((t) => (
            <TypeBadge key={t} type={t} size="sm" />
          ))}
        </div>
      </Panel>

      <Panel title="Palette">
        <div className="flex flex-wrap gap-2">
          {(
            [
              ['ink-950', '#0f0d0b'], ['ink-900', '#17140f'], ['ink-850', '#1d1a14'],
              ['ink-800', '#26221a'], ['ink-700', '#363021'], ['ink-400', '#8d846f'],
              ['ink-200', '#cfc7b2'], ['ink-50', '#f4f0e4'], ['gold-400', '#e7b84e'],
              ['gold-500', '#d49e2b'], ['legal', '#6fc27a'], ['illegal', '#e5484d'],
            ] as const
          ).map(([name, hex]) => (
            <div key={name} className="flex flex-col items-center gap-1">
              <div className="chamfer-sm h-10 w-14 border border-ink-700" style={{ backgroundColor: hex }} />
              <span className="text-[0.65rem] text-ink-400">{name}</span>
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}
