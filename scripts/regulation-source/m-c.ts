/**
 * ⚠ TEST REGULATION — M6 dry-run fixture, not real data.
 *
 * Proves the "new regulation = new data file" claim end-to-end: M-C derives
 * from M-B with a few cuts (species AND a mega line) so legality, dex and UI
 * changes are observable. Replace wholesale with the real M-C roster when
 * it's announced (sync from Showdown's champions formats, as with M-B).
 */
import { REGULATION_M_B } from './m-b';

const CUT_SPECIES = new Set(['Kingambit', 'Charizard', 'Annihilape']);

export const REGULATION_M_C_TEST = {
  ...REGULATION_M_B,
  id: 'm-c',
  label: 'Regulation M-C (TEST)',
  dateRange: ['2026-09-03', '2026-12-01'] as [string, string],
  allowedSpecies: REGULATION_M_B.allowedSpecies.filter((s) => !CUT_SPECIES.has(s)),
  allowedMegas: REGULATION_M_B.allowedMegas.filter((s) => !CUT_SPECIES.has(s)),
};
