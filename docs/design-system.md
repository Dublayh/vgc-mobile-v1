# Champions TB design system — "championship stat-sheet"

The identity: a pro player's stat sheet, not a generic dashboard. Warm carbon
ground, champion-gold accent, athletic condensed type, tabular numerals, sharp
chamfered geometry. Nothing blue-gray, nothing pill-shaped, no emoji.

All tokens live in `src/index.css` (`@theme`); primitives in `src/app/ui/`.
The `UI` toggle in the app header opens the living gallery (`DesignGallery.tsx`).

## Rules

1. **Color**
   - Neutrals are the warm `ink-*` scale only — Tailwind's default palette is
     disabled (`--color-*: initial`), so `slate-*`/`gray-*` won't compile.
   - `gold-*` is the single brand accent: primary actions, active states, SP
     investment, the reg chip. Don't introduce a second accent.
   - Semantic colors are fixed: `legal` (green), `illegal` (red), `warn`
     (orange), `info` (desaturated blue). Legality feedback always uses these.
   - Pokémon type colors are tokens (`type-fire`, …) — use `TypeBadge`, never
     ad-hoc type colors. They're the intended source of variety in the UI.

2. **Typography**
   - `font-display` (Barlow Condensed) — headings, buttons, labels, tab items:
     uppercase, tracked (`tracking-[0.08em]`–`[0.14em]`). Species names get
     bold italic. Use the `label-caps` utility for eyebrow/section labels.
   - `font-sans` (Barlow) — body copy, form fields. Sentence case.
   - Every dynamic number (stats, SP, %, speeds) uses the `stat-num` utility
     (JetBrains Mono, tabular) so columns never jitter.

3. **Geometry**
   - Signature: chamfered top-right corner — `chamfer` on cards/panels,
     `chamfer-sm` on buttons/badges/chips. No `rounded-*` above `radius-md`
     (5px), no circles except sprites.
   - Surfaces stack: `ink-950` ground → `ink-900` panel → `ink-850` inset →
     `ink-800` border/track. Hairline borders (`border-ink-800`/`700`), no
     drop shadows.

4. **Components before markup** — build screens from `Panel`, `Button`,
   `TypeBadge`, `StatBar`, `EmptyState`, `Icon` (custom stroke set,
   square caps, 1.8px). Extend the primitives rather than styling divs inline;
   add new primitives to the gallery when created.

5. **Ambient legality** (plan §4 UX note) — violations are inline badges/rows
   in `illegal`, never modals.

## Anti-goals

The "default AI app" look: slate/zinc + blue-violet accent, glassmorphism,
rounded-2xl cards, emoji icons, Inter everywhere, centered hero copy.
If a screen would pass in a generic SaaS template, it's off-system.
