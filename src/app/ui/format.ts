/** Shared number formatting for dynamic values (render inside `stat-num`). */
import { type SPSpread, STAT_IDS, STAT_LABELS } from '../../engine/types';

export const pct = (v: number, digits = 1): string => `${(v * 100).toFixed(digits)}%`;

/** "32/32/2" (short) or "32 HP / 32 Atk / 2 SpD" (named) — zero stats omitted. */
export function spreadLabel(sp: SPSpread, style: 'short' | 'named' = 'short'): string {
  const ids = STAT_IDS.filter((id) => sp[id] > 0);
  return style === 'named'
    ? ids.map((id) => `${sp[id]} ${STAT_LABELS[id]}`).join(' / ')
    : ids.map((id) => `${sp[id]}`).join('/');
}
