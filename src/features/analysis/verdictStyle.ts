import type { Verdict } from './completer';

/** Ambient verdict colors (never modals): legal green / warn / illegal red. */
export const VERDICT_STYLE: Record<Verdict, string> = {
  safe: 'bg-legal/15 text-legal',
  shaky: 'bg-warn/15 text-warn',
  loses: 'bg-illegal/15 text-illegal',
};
