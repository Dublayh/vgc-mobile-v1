# Champions Team Builder — project context

Pokémon Champions team builder PWA. **Read `champions-teambuilder-plan.md` first** —
it is the source of truth for the domain model, data pipeline, component architecture,
and milestones. `README.md` tracks current status and open TODOs.

## Non-negotiable domain rules (Champions ≠ mainline VGC)

- No IVs (always 31), no levels (always 50), no Tera.
- **SP system**: 66-point pool, max 32/stat, 1 SP = +1 final stat.
  Default rounding mode is `sp-after-alignment` (SP added AFTER the ±10% multiplier) —
  unverified in-game; every engine function takes an `SPRoundingMode` param so it can flip.
- Alignments = natures (same ±10%, modeled as `AlignmentName` in `src/engine/types.ts`).
- Mega Evolution is core; `@pkmn/dex` 0.10.x already contains Champions megas
  (Staraptor-Mega, Raichu-Mega-X/Y, Sceptile-Mega, ...) — verified, no override layer needed.
- $0 runtime: static hosting only, no backend, no runtime AI/API calls ever.

## Design system — read `docs/design-system.md` before writing any UI

"Championship stat-sheet": warm `ink-*` carbon neutrals (Tailwind default palette
is disabled), single `gold-*` accent, Barlow/Barlow Condensed + JetBrains Mono
(`stat-num` for all dynamic numbers), chamfered corners (`chamfer`/`chamfer-sm`),
type colors via `TypeBadge`. Build screens from the primitives in `src/app/ui/`
and keep the `DesignGallery` in sync when adding primitives. Never reintroduce
the generic look (slate + blue accent + rounded-2xl + emoji icons).

## Conventions

- Damage calcs go through `src/engine/calc.ts` (Approach A: Champions stats from
  `stats.ts`, injected via `overrides.baseStats` INVERSION — nonHP base = final−20,
  HP base = final−75 at L50/IV31/EV0/neutral). Never mutate `Pokemon.rawStats`
  post-construction: `calculate()` clones its inputs and recomputes stats, so only
  constructor `overrides` survive (regression-tested in calc.test.ts). Never
  construct `@smogon/calc` Pokemon with EVs directly.
- Regulation/dex data is generated, never hand-edited: edit
  `scripts/regulation-source/*.ts`, then `npm run data:all` → `public/data/*.json`.
- Learnsets = mainline gen-9 learnsets ∪ Champions-specific TM/tutor additions
  from Showdown's champions mod, vendored at `scripts/vendor/champions-learnsets.ts`
  (refresh: `REFRESH_MODS=1 npm run data:dex`). build-dex cross-checks every
  ladder-observed usage move against the learnsets and fails if any is missing —
  that failure means the vendored file is stale or a forme's learnset source is
  wrong (megas resolve to base species; Floette-Mega → Floette-Eternal).
- The roster in `scripts/regulation-source/m-b.ts` is a STARTER list, not the real
  Reg M-B roster (see README TODOs).
- TypeScript 7 (native): no `baseUrl` in tsconfig; use relative `paths`.
- Tests: `npm test` (Vitest, node env). The golden calc suite in
  `src/engine/calc.test.ts` is the engine acceptance gate — extend it with any
  externally-verified calc values you obtain.
- Type effectiveness: `src/engine/typechart.ts` (tested) — never hand-roll
  matchups. Counter ranking: `src/engine/counters.ts`; coverage/completer
  analysis: `src/features/analysis/` (pure + tested). AdviceExport
  (`analysis/adviceExport.ts`) is the ONLY AI touchpoint — clipboard prompts,
  never an API call (plan §5).
- Usage stats: schema pinned in `src/data/usage.ts`; produced by
  `scripts/build-usage.ts` from Smogon chaos JSON (format
  `gen9championsvgc2026regmb-<rating>`; Champions spreads are natively
  SP-scaled). Consumers use `useUsage()` and MUST degrade gracefully when it
  returns null. Threat auditing: `src/engine/threat.ts` (pure, tested) +
  `usageMonToSet` in `src/features/meta/threatSet.ts`.
- Navigation is hash-based via the zustand store in `src/app/store.ts`
  (`#teams/<id>/<slot>`, `#dex/<speciesId>`) — no router library; extend the
  store, don't add one.
- Legality: build the context once via `lookup.legalityContext()` and call
  `setViolations`/`teamViolations` (`src/engine/legality.ts`); render results as
  ambient red badges, never modals.
- To visually verify UI work: `npm run dev`, then
  `node scripts/shoot.mjs "http://localhost:5173/?seed#teams/demo-team" out.png --full`
  (drives system Edge via playwright-core and prints page console errors —
  plain `msedge --headless --screenshot` renders but IndexedDB screens stay blank).
  `?seed` recreates the demo team (`src/dev/seed.ts`), id `demo-team`.
