import { useState } from 'react';
import { useUI } from '../../app/store';
import { Button } from '../../app/ui/Button';
import { Icon } from '../../app/ui/Icon';
import { Sprite } from '../../app/ui/Sprite';
import { TypeBadge } from '../../app/ui/TypeBadge';
import type { DexLookup } from '../../data/dex';
import { teamViolations } from '../../engine/legality';
import type { Team } from '../../engine/types';
import { putTeam, renameTeam } from '../../storage/teams';
import { parsePaste, serializeTeam } from '../import-export/showdown';
import { encodeTeamShare, shareUrl } from '../import-export/shareCodec';
import { CoverageMatrix } from './CoverageMatrix';
import { TeamCompleter } from './TeamCompleter';

export function TeamEditor({ team, lookup }: { team: Team; lookup: DexLookup }) {
  const { openTeam, openSlot } = useUI();
  const [showImport, setShowImport] = useState(false);
  const [showCompleter, setShowCompleter] = useState(false);
  const [showCoverage, setShowCoverage] = useState(false);
  const [pasteText, setPasteText] = useState('');
  const [exportNote, setExportNote] = useState('');
  const violations = teamViolations(team, lookup.legalityContext());

  const slots = Array.from({ length: 6 }, (_, i) => team.sets[i]);

  const doImport = async () => {
    try {
      const sets = parsePaste(pasteText).slice(0, 6);
      if (sets.length === 0) return;
      await putTeam({ ...team, sets });
      setShowImport(false);
      setPasteText('');
    } catch {
      setExportNote('Could not parse that paste');
    }
  };

  const doExport = async (spread: 'sp' | 'evs') => {
    const text = serializeTeam(team.sets, { spread });
    try {
      await navigator.clipboard.writeText(text);
      setExportNote(spread === 'sp' ? 'Copied (Champions SP format)' : 'Copied (EV format for calc sites)');
    } catch {
      setPasteText(text);
      setShowImport(true); // clipboard blocked — show it in the textarea instead
    }
    setTimeout(() => setExportNote(''), 2500);
  };

  return (
    <div className="flex flex-col gap-3">
      <button onClick={() => openTeam(null)} className="label-caps self-start py-1 text-gold-400">
        ‹ Teams
      </button>

      <input
        value={team.name}
        onChange={(e) => renameTeam(team.id, e.target.value)}
        className="border-b border-ink-800 bg-transparent pb-1 font-display text-2xl font-bold tracking-wide uppercase outline-none focus:border-gold-600"
      />

      {violations.length > 0 && (
        <div className="flex flex-col gap-1">
          {violations.slice(0, 4).map((v, i) => (
            <p key={i} className="flex items-center gap-2 text-sm text-illegal">
              <Icon name="alert" size={14} />
              {v.slot !== undefined ? `Slot ${v.slot + 1}: ` : ''}
              {v.message}
            </p>
          ))}
          {violations.length > 4 && (
            <p className="text-sm text-ink-500">+{violations.length - 4} more</p>
          )}
        </div>
      )}

      <div className="grid grid-cols-2 gap-2">
        {slots.map((set, i) => {
          const species = set && lookup.getSpecies(set.megaStone ?? set.species);
          const slotIssues = violations.filter((v) => v.slot === i);
          return (
            <button
              key={i}
              onClick={() => openSlot(i)}
              className={`chamfer relative flex min-h-28 flex-col items-start border bg-ink-900 p-2.5 text-left ${
                slotIssues.length ? 'border-illegal/50' : 'border-ink-800'
              } hover:border-gold-600/60`}
            >
              {set && species ? (
                <>
                  <div className="flex w-full items-center justify-between">
                    <Sprite spriteId={species.spriteId} size={44} />
                    {slotIssues.length > 0 && (
                      <Icon name="alert" size={14} className="text-illegal" />
                    )}
                  </div>
                  <span className="mt-1 font-display text-sm font-bold tracking-wide uppercase">
                    {species.name}
                  </span>
                  <span className="mt-0.5 flex gap-1">
                    {species.types.map((t) => (
                      <TypeBadge key={t} type={t} size="sm" />
                    ))}
                  </span>
                  <span className="mt-1 truncate text-xs text-ink-400">
                    {set.item ?? 'No item'}
                  </span>
                </>
              ) : (
                <span className="m-auto flex flex-col items-center gap-1 text-ink-500">
                  <span className="font-display text-2xl leading-none">+</span>
                  <span className="label-caps">Slot {i + 1}</span>
                </span>
              )}
            </button>
          );
        })}
      </div>

      {team.sets.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <Button
            variant={showCompleter ? 'primary' : 'secondary'}
            onClick={() => setShowCompleter((v) => !v)}
          >
            {showCompleter ? 'Hide suggestions' : `Complete team (${team.sets.length}/6)`}
          </Button>
          <Button
            variant={showCoverage ? 'primary' : 'secondary'}
            onClick={() => setShowCoverage((v) => !v)}
          >
            Coverage
          </Button>
        </div>
      )}
      {showCoverage && team.sets.length > 0 && <CoverageMatrix team={team} lookup={lookup} />}
      {showCompleter && <TeamCompleter team={team} lookup={lookup} />}

      <div className="flex flex-wrap items-center gap-2">
        <Button onClick={() => setShowImport((v) => !v)}>Import</Button>
        <Button onClick={() => doExport('sp')} disabled={team.sets.length === 0}>
          Export
        </Button>
        <Button variant="ghost" onClick={() => doExport('evs')} disabled={team.sets.length === 0}>
          Export for calc sites
        </Button>
        <Button
          variant="ghost"
          disabled={team.sets.length === 0}
          onClick={async () => {
            const url = shareUrl(await encodeTeamShare(team));
            try {
              await navigator.clipboard.writeText(url);
              setExportNote('Share link copied');
            } catch {
              setPasteText(url);
              setShowImport(true);
            }
            setTimeout(() => setExportNote(''), 2500);
          }}
        >
          Share link
        </Button>
        {exportNote && <span className="text-sm text-legal">{exportNote}</span>}
      </div>

      {showImport && (
        <div className="chamfer border border-ink-800 bg-ink-900 p-3">
          <p className="label-caps mb-2">Showdown paste (EVs are converted to SP)</p>
          <textarea
            value={pasteText}
            onChange={(e) => setPasteText(e.target.value)}
            rows={8}
            className="w-full border border-ink-700 bg-ink-850 p-2 font-mono text-xs outline-none focus:border-gold-600"
          />
          <div className="mt-2 flex gap-2">
            <Button variant="primary" onClick={doImport} disabled={!pasteText.trim()}>
              Import (replaces team)
            </Button>
            <Button variant="ghost" onClick={() => setShowImport(false)}>
              Cancel
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
