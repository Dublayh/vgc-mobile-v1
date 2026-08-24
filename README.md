# Champions Team Builder

A free, installable PWA for building and analyzing teams for Pokémon Champions ranked
(currently Reg M-B), with accurate damage calcs using the Champions Stat Point (SP) system.
No backend, no runtime AI — everything runs client-side against static data bundles.

Full project plan: `champions-teambuilder-plan.md` (domain model, data pipeline, milestones).

## Status

- ✅ **M1 — Engine core**: Champions stat formula, SP validation, `@smogon/calc` wrapper
  (Approach A: raw-stat injection), speed tiers, SP optimizers, data pipeline.
- ✅ **Design system**: "championship stat-sheet" — see `docs/design-system.md`; living
  gallery behind the `UI` header toggle.
- ✅ **Roster intelligence**: advanced dex search (ability — mega-aware — plus
  "learns ALL of these moves" and multi-type AND filters, freely combinable with
  live match count) and the **OHKO sweep** on every dex/usage detail page: calc
  the whole regulation (all formes at 32 SP +nature, best learnset move) against
  one defender, grouped into OHKOs and 85–99% near-misses, each row deep-linking
  into Calc (`src/features/analysis/ohkoSweep.ts`, tested).
- ✅ **M2 — Team builder MVP**: dex browser (search/type/mega filters, learnsets),
  team CRUD in IndexedDB, SetEditor (forme toggle, alignment matrix, move/item pickers
  with item-clause greying, 66-SP allocator with hold-to-repeat steppers + presets),
  ambient legality (species/item clause, learnset, mega, SP), Showdown paste
  import/export (EV↔SP translation), bundled offline sprites, hash deep links.
- ✅ **M3 — Damage calc UI**: attacker/defender picked from saved team slots OR the
  whole dex — dex picks auto-seed the mon's most common ladder set (spread, item,
  ability, moves) and are fully editable in place (meta-spread chips, alignment,
  SP allocator, item, ability; dex attackers can test any learnset move),
  per-move damage rows (range, KO chance, best-move highlight), expandable detail
  (rolls, SP-worded calc description, copy-to-clipboard), field conditions
  (doubles/singles, weather, terrain, screens, Helping Hand, Friend Guard, crit),
  boost stages + burn, swap button. Calc feature is code-split (lazy chunk).
- ✅ **M4a — Meta intelligence (foundation)**: Smogon usage pipeline
  (`npm run data:usage` — real Champions Reg M-B ladder stats, ~1.76M battles,
  natively SP-scaled spreads), Meta tab with usage browser (moves/items/abilities/
  spreads/teammates per mon), L50 speed-tier ladder (team vs meta common+max
  speeds, Tailwind modes), threat audit (meta mon's most common set vs. every
  team slot: damage both ways, speed order, safe/shaky/loses verdicts), and
  one-tap "meta spreads" suggestions in the SetEditor.
- ✅ **M4b — Threat Advisor + Team Completer**: CounterFinder (top-80 meta sets
  audited vs. any threat, ranked with evidence + their full meta set shown,
  one-tap "Verify in calc" deep link), field-aware audits (Trick Room /
  My Tailwind / Their Tailwind toggles auto-defaulted from the team's detected
  archetype — acting order, verdicts and counter ranking all respect them),
  "Calc vs ›" jump buttons on every mon detail (dex, usage, threat header),
  Threats tab defaults to a "Worst matchups" ranking (top-50 meta sets audited
  vs. every team slot, loses/shaky/safe pills weighted by usage, tap → full
  audit) with "Browse by usage" as the secondary view; usage browser has search,
  quick spread-switch chips (top 5 ladder spreads) on dex-sourced calc mons,
  and a top-10 whole-learnset damage sweep in the Damage panel, Team Completer in the TeamEditor (archetype detection, teammate
  co-occurrence, coverage-gap patching, clause-friction flags, iterative
  add-and-re-rank), 18×18 type chart in the engine, and "Ask Claude" AdviceExport
  (clipboard prompts for threat matchups and team completion — never an API call).
- ✅ **M5 — PWA polish**: URL team sharing (team → deflate → base64url fragment,
  `#share/<blob>` preview + save flow, no server), Optimizer panel in Calc
  ("min SP to survive their best move" / "min Spe SP to outspeed", exact search,
  one-tap apply), install prompt, configurable base path, GitHub Actions
  workflows (deploy on push + monthly Smogon data cron — activate by pushing
  this repo to GitHub and enabling Pages).
- ✅ **M6 — Regulation swap proven**: multi-regulation pipeline
  (`CURRENT_REG=m-c npm run data:regulation && npm run data:dex` swaps the whole
  app — header, dex roster, legality, meta degradation — with zero code changes;
  fake M-C fixture in `scripts/regulation-source/m-c.ts`). When the real M-C
  lands: replace that file's roster, run `npm run data:all` with CURRENT_REG=m-c,
  and add usage once Smogon publishes the new ladder format.

- ✅ **Tournament teams (ProvenTeams)**: Meta → Tourney lists recent high-placing
  Champions tournament teams from the Limitless public API (documented, keyless —
  `npm run data:tournaments` refreshes; 8 events × top 8 with full sets). Every
  placement expands to its full teamlist and imports one-tap into your teams
  (megas inferred from held stones; SP spreads aren't published, so fill those
  in the editor).

- ✅ **Post-plan additions**: Calc › **OHKO sweep** screen — pick up to 4 targets
  (usage-seeded meta spreads) and sweep the regulation for attackers that OHKO
  ALL of them (or ANY, toggleable), ranked by weakest/best matchup, with
  attacker filters (type combo + ability) applied pre-sweep for instant filtered
  runs, per-target move cells verifiable in the Matchup calc; type coverage matrix on the TeamEditor ("Coverage"
  toggle — per-type best offensive multiplier + weak/resist blocks, stacked
  weaknesses tinted); app-wide **2v2/1v1 mode** (header chip, persisted) driving
  every calc/audit/sweep gameType — AND the usage source: Singles mode serves
  the real singles ranked ladder (`gen9championsbssreg<x>`, own trends; doubles
  fallback with a label when a regulation lacks it; tournament teams remain
  doubles events); SP formula CONFIRMED IN-GAME (Adamant 32-SP
  Garchomp = 200 Atk, matching Showdown parity); tournament imports carry
  published alignments; usage browser shows month-over-month trends (▲▼ rank
  movement, "new" entrants, prior-month line in detail — snapshot embedded by
  the usage pipeline); calc "Combo" panel: add a partner attacker and get exact
  combined-damage KO odds over all 16×16 roll pairs.

Monthly data refresh (manual until CI exists): `npm run data:usage` (env
`MONTH=YYYY-MM` to pin a month; fails loudly if Smogon hasn't published; keeps
the replaced month embedded for trends) and `npm run data:tournaments` for
fresh tournament results.

### Dev utilities

- `node scripts/shoot.mjs <url> <out.png> [--full]` — screenshot the running dev app
  via system Edge (playwright-core, no browser download). Page console errors are printed.
- UI smoke tests (all exit non-zero on page errors; pass an `<out.png>` path):
  `smoke-newteam.mjs` (team creation flow), `smoke-calc.mjs` (calc incl. dex
  sourcing + scratch edits), `smoke-meta.mjs` (usage/speed/threats),
  `smoke-advisor.mjs` (counters, deep link, completer loop),
  `smoke-share.mjs` (share URL round trip), `smoke-tourney.mjs` (tournament
  list → import → editor, mega-from-stone inference), `smoke-multisweep.mjs`
  (Calc › OHKO sweep: multi-target intersection + cell verify).
- Append `?seed` to any dev URL to (re)create the demo team, then deep-link:
  `/?seed#teams/demo-team` (team editor) · `/?seed#teams/demo-team/0` (set editor) ·
  `#dex/garchomp` (dex detail).

## Commands

```bash
npm run dev          # dev server
npm test             # engine test suite (M1 acceptance gate)
npm run build        # typecheck + production build (PWA)
npm run data:all     # regenerate public/data/*.json from scripts/regulation-source/
```

## Architecture (implemented so far)

```
scripts/
  regulation-source/m-b.ts   editable roster source (⚠ starter list — sync from
                             Showdown's Champions format defs before real use)
  build-regulation.ts        → public/data/regulations/m-b.json + meta.json
  build-dex.ts               → public/data/dex.json (trimmed to reg roster)
src/engine/
  types.ts      ChampionsSet / SPSpread / Alignments (natures) / Regulation
  stats.ts      Champions stat formula (level 50, IV 31, 1 SP = +1 final stat),
                SP validation (pool 66, max 32/stat), EV↔SP interop
  calc.ts       @smogon/calc wrapper — computes Champions stats and injects them
                into Pokemon.rawStats/stats, bypassing the library's EV math
  speed.ts      L50 speed tiers with Tailwind/Scarf/paralysis/stage modifiers
  optimizer.ts  exact brute-force SP searches (survive X / reach speed / damage curve)
src/app/        app shell, bottom tab nav (Teams · Calc · Dex · Meta)
src/data/       static-data loading hooks (useMeta so far)
src/storage/    Dexie (IndexedDB) schema for saved teams
```

## Key findings during M1

- **`@pkmn/dex` already ships Champions data** — new megas like Staraptor-Mega
  (Contrary), Raichu-Mega-X/Y and Sceptile-Mega resolve with correct stats and
  abilities, so no custom data-override layer is needed for them.
- **SP rounding order (plan §7.1) — still needs in-game verification.** The engine
  defaults to `sp-after-alignment` ("1 SP = exactly +1 final stat", community
  consensus). Every stat/calc/optimizer function accepts an `SPRoundingMode` so the
  alternative (`sp-before-alignment`, EV-style) can be validated against in-game
  screenshots / Game8 values and switched globally if consensus is wrong.

## Open TODOs before M1 sign-off

1. Replace the starter roster in `scripts/regulation-source/m-b.ts` with the real
   Reg M-B list (208 species + ~76 megas) from Showdown's `config/formats.ts`.
2. ~~Verify the SP rounding mode~~ — RESOLVED: engine matches Showdown's champions
   mod formula exactly (SP added before the alignment multiplier; differential
   test = 0 mismatches). Note: "Export for calc sites" still loses 1 point on
   32-SP stats (mainline EVs cap at 252 = +31) — inherent to EV interop, compare
   against Champions-aware calcs for exact numbers.
3. Add golden calcs cross-checked against the NCP VGC damage calculator.

---

*Fan project — not affiliated with Nintendo, The Pokémon Company, or Game Freak.*
