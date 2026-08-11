import { lazy, Suspense, useState } from 'react';
import { useDex } from '../data/useDex';
import { DexBrowser } from '../features/dex/DexBrowser';
import { TeamsScreen } from '../features/teams/TeamsScreen';

// The calc + meta features carry @smogon/calc (~110KB gz) — load on demand.
const CalcView = lazy(() =>
  import('../features/calc/CalcView').then((m) => ({ default: m.CalcView })),
);
const MetaScreen = lazy(() =>
  import('../features/meta/MetaScreen').then((m) => ({ default: m.MetaScreen })),
);
import { DesignGallery } from './DesignGallery';
import { useUI, type Tab } from './store';
import { Icon, type IconName } from './ui/Icon';

const TABS: { id: Tab; label: string; icon: IconName }[] = [
  { id: 'teams', label: 'Teams', icon: 'teams' },
  { id: 'calc', label: 'Calc', icon: 'calc' },
  { id: 'dex', label: 'Dex', icon: 'dex' },
  { id: 'meta', label: 'Meta', icon: 'meta' },
];

export function App() {
  const { tab, setTab } = useUI();
  const [showGallery, setShowGallery] = useState(false);
  const lookup = useDex();

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-10 border-b border-ink-800 bg-ink-950/90 backdrop-blur">
        <div className="mx-auto flex w-full max-w-xl items-center justify-between px-4 py-2.5">
          <h1 className="flex items-center gap-2">
            <span className="chamfer-sm bg-gold-500 px-1.5 py-0.5 font-display text-sm font-bold text-ink-950 italic">
              TB
            </span>
            <span className="font-display text-xl font-bold tracking-[0.06em] uppercase italic">
              Champions
            </span>
          </h1>
          <div className="flex items-center gap-2.5">
            {lookup && (
              <span className="chamfer-sm border border-gold-600/50 bg-gold-950 px-2 py-0.5 font-display text-xs font-semibold tracking-[0.14em] uppercase text-gold-300">
                {lookup.regulation.label.replace('Regulation', 'Reg')}
              </span>
            )}
            <button
              onClick={() => setShowGallery((v) => !v)}
              className={`label-caps ${showGallery ? 'text-gold-400' : ''}`}
              title="Toggle design gallery (dev)"
            >
              UI
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-xl flex-1 px-4 py-4">
        {showGallery ? (
          <DesignGallery />
        ) : !lookup ? (
          <p className="mt-16 text-center text-sm text-ink-500">Loading data…</p>
        ) : tab === 'teams' ? (
          <TeamsScreen lookup={lookup} />
        ) : tab === 'dex' ? (
          <DexBrowser lookup={lookup} />
        ) : tab === 'calc' ? (
          <Suspense
            fallback={<p className="mt-16 text-center text-sm text-ink-500">Loading calc…</p>}
          >
            <CalcView lookup={lookup} />
          </Suspense>
        ) : (
          <Suspense
            fallback={<p className="mt-16 text-center text-sm text-ink-500">Loading meta…</p>}
          >
            <MetaScreen lookup={lookup} />
          </Suspense>
        )}
      </main>

      <nav className="sticky bottom-0 border-t border-ink-800 bg-ink-900/95 backdrop-blur">
        <div className="mx-auto grid max-w-xl grid-cols-4">
          {TABS.map((t) => {
            const isActive = tab === t.id && !showGallery;
            return (
              <button
                key={t.id}
                onClick={() => {
                  setTab(t.id);
                  setShowGallery(false);
                }}
                className={`relative flex flex-col items-center gap-1 pt-2.5 pb-2 ${
                  isActive ? 'text-gold-400' : 'text-ink-500'
                }`}
              >
                {isActive && (
                  <span className="absolute inset-x-6 top-0 h-0.5 bg-gold-500" aria-hidden />
                )}
                <Icon name={t.icon} />
                <span className="font-display text-xs font-semibold tracking-[0.12em] uppercase">
                  {t.label}
                </span>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
