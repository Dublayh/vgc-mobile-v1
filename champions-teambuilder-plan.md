# Pokémon Champions Team Builder — PWA Plan & Component Spec

**Goal:** A free, installable PWA for building and analyzing teams for the current Pokémon Champions ranked regulation (Reg M-B as of Aug 2026), with accurate damage calcs using the Champions Stat Point (SP) system.

**Hard constraint:** $0 runtime cost. No backend servers, no paid APIs, no runtime AI calls. Everything runs client-side; all data is baked in at build time or fetched from free public static endpoints. Claude Code (under the existing Claude subscription) is the development tool only — the shipped app never calls any LLM API.

---

## 1. Champions domain model (differs from mainline VGC — get this right first)

These rules change how every classic VGC tool assumption must be adapted:

- **No IVs.** Every Pokémon is treated as having 31 IVs in all stats. There is no 0-Speed-IV Trick Room tech; min-speed builds use 0 SP + a Speed-lowering alignment.
- **Stat Points (SP) replace EVs.** Pool of **66 SP** per Pokémon, **max 32 SP per stat**. At the fixed Level 50 format, **1 SP = +1 to the final stat** (roughly equivalent to 8 EVs; 32 SP ≈ 256 EVs).
- **Stat Alignments replace natures.** Same +10%/−10% behavior as natures (Adamant, Timid, etc.), just renamed. Model them as natures internally.
- **All battles are Level 50.** No level input needed anywhere.
- **Mega Evolution is a core mechanic** (Omni Ring). Reg M-B allows ~76 Megas including new ones (Mega Sceptile, Blaziken, Swampert, Mawile, Staraptor, Raichu X/Y, etc.). Team preview and calcs must handle base → mega forme switching, including ability/stat changes on mega.
- **Regulation legality:** Reg M-B roster ≈ 208 species + allowed Megas; item clause (one of each item per team); species clause; Doubles is the primary VGC format but Singles ladder exists too.
- **Regulations rotate** (M-A → M-B → M-C...). Legality data must be a swappable dataset, not hardcoded.

### Core TypeScript domain types

```ts
type StatID = 'hp'|'atk'|'def'|'spa'|'spd'|'spe';

interface SPSpread { hp: number; atk: number; def: number; spa: number; spd: number; spe: number } // each 0–32, sum ≤ 66

interface ChampionsSet {
  species: string;          // Showdown species id
  megaStone?: string;       // implies mega forme available
  ability: string;
  item?: string;
  alignment: NatureName;    // "Stat Alignment", modeled as nature
  sp: SPSpread;
  moves: [string?, string?, string?, string?];
  teraType?: never;         // NOT in Champions M-A/M-B; keep field absent but design for future mechanics
}

interface Team { id: string; name: string; regulation: string; format: 'doubles'|'singles'; sets: ChampionsSet[] /* ≤6 */ }

interface Regulation {
  id: string;               // "m-b"
  label: string;
  dateRange: [string, string];
  allowedSpecies: string[];
  allowedMegas: string[];   // species allowed to mega evolve
  bannedItems: string[];
  clauses: string[];
}
```

**Stat formula (Level 50, IV 31 fixed):**
```
HP    = floor((2·Base + 31) · 50/100) + 50 + 10 + SP_hp
Other = (floor((2·Base + 31) · 50/100) + 5 + SP_stat) · alignmentMod   // verify rounding order vs in-game values!
```
⚠️ Open question for implementation: whether SP is added before or after the alignment (nature) multiplier. Community consensus is "1 SP = exactly +1 final stat," which implies SP is added **after** the nature multiplier — this differs from the EV formula. **Validate against in-game screenshots / Game8's Champions calc early** (Milestone 1 acceptance test), because it changes damage results at the margins.

---

## 2. Data pipeline (all free, refreshed by CI — no runtime servers)

Strategy: a **build-time data pipeline** (Node scripts run by GitHub Actions on a schedule) produces static JSON bundles the PWA fetches and caches. The app itself only ever hits static files on our own free host.

### Sources
| Data | Source | Method | Cost |
|---|---|---|---|
| Species/base stats/types/abilities/moves/items/learnsets | `@pkmn/dex` + `@pkmn/data` npm packages (Pokémon Showdown data) | npm dependency; tree-shake to only what's needed | Free |
| Champions-specific data (new Megas, new items like new Mega Stones, changed moves) | Pokémon Showdown's `pokemon-showdown` repo data files (Showdown supports the Champions VGC 2026 formats); supplement with the NCP-VGC-Damage-Calculator fork (github.com/nerd-of-now/NCP-VGC-Damage-Calculator) which already encodes Reg M-B items/moves/megas | Build script imports/diffs into our dataset | Free |
| Regulation legality (allowed species/megas per reg) | Showdown format definitions (`config/formats.ts` rulesets for VGC 2026 Reg M-A/M-B); cross-check against Victory Road's regulation pages and Serebii's ranked battle pages | Build script generates `regulations/m-b.json`; manual review step on new regs | Free |
| Ladder usage stats (usage %, moves, items, spreads, teammates) | Smogon public stats: `smogon.com/stats/{YYYY-MM}/chaos/{format}.json` for the Champions VGC 2026 Reg M-B ladder format; and/or the pre-cleaned `pkmn.github.io/smogon` stats API (`/data/stats/{format}.json`) | Monthly GitHub Action downloads → transforms → commits `usage/m-b.json` (trim to top ~150 mons, top 8 moves/items/spreads each to keep bundle small) | Free |
| Tournament usage (optional, phase 2) | pokedata.ovh (real-life VGC), Limitless tournament data | Only if a public JSON endpoint exists; otherwise link out, don't scrape | Free |
| Sprites/icons | `@pkmn/img` or PokéAPI sprite repo (static GitHub raw URLs), pre-downloaded into the app bundle at build time | Bundled = works offline | Free |

**Do NOT scrape Pikalytics** (no public API; ToS risk). Link out to it instead where helpful.

### Pipeline outputs (static, versioned, cached by service worker)
```
/data/dex.json            // trimmed species/moves/items/abilities for allowed roster
/data/regulations/m-b.json
/data/usage/m-b.json      // monthly refresh
/data/meta.json           // { currentRegulation: "m-b", dataVersion, generatedAt }
```
The app reads `meta.json` first; a new regulation ships as a data update, not a code change.

---

## 3. Damage calculation engine

Use **`@smogon/calc`** (the library behind calc.pokemonshowdown.com) as the core. It runs fully in-browser. Two viable integration approaches — Claude Code should start with A and fall back to B only if accuracy tests fail:

**Approach A (preferred): compute stats ourselves, feed raw stats via overrides.**
- Our own `computeStats(set)` implements the Champions formula in §1.
- Construct `@smogon/calc` `Pokemon` objects with `overrides`/raw-stat injection (level 50, the computed final stats), so the calc's internal EV math is bypassed entirely. This sidesteps the SP-vs-EV rounding question inside the library.
- Use the `@smogon/calc/adaptable` entry point with `@pkmn/data` so we ship one data layer, and layer Champions-only entities (new Mega Stones/formes) on top via the data override mechanism.

**Approach B (fallback): map SP → EVs (1 SP = 8 EVs) + nature and let the calc compute.** Simpler but risks ±1 stat point rounding errors; only acceptable if A hits library limitations.

**Calc features required (all supported by @smogon/calc):** doubles spread-move penalty, weather, terrain, screens, Helping Hand, Intimidate, items, abilities, crits, multi-hit, KO chance text ("50.2 – 59.4% — guaranteed 2HKO").

**Champions-specific calc layer:**
- Mega toggle per Pokémon (recalc stats/ability/typing on mega).
- Reverse calc / spread optimizer: "find minimum SP in SpD such that X survives move Y from attacker Z" — iterate SP 0–32 (tiny search space; 66-point pool makes brute-force optimization over 2–3 stats trivially fast, a real advantage over EV systems).
- Speed comparison always at L50 with alignment ±10% and modifiers (Tailwind, Icy Wind stages, Choice Scarf if legal, paralysis).

**Golden test suite:** encode 30–50 known calcs (taken from Pikalytics/NCP calc outputs and in-game screenshots) as unit tests. This is the acceptance gate for the engine.

---

## 4. Component architecture

Recommended stack: **Vite + React + TypeScript**, Tailwind CSS, Zustand (state), Dexie (IndexedDB), vite-plugin-pwa (Workbox). Static hosting on **GitHub Pages or Cloudflare Pages** (both free tiers), GitHub Actions for the data refresh cron.

```
src/
  app/                    App shell, routing, theme, PWA install prompt
  data/                   Data loading layer
    useDex()              loads /data/dex.json, memoized lookups
    useRegulation()       current reg legality checks: isLegal(set), teamViolations(team)
    useUsage()            usage stats accessor
  engine/
    stats.ts              Champions stat formula + SP validation (≤66 total, ≤32/stat)
    calc.ts               @smogon/calc wrapper (Approach A)
    optimizer.ts          SP spread search (survive X / outspeed Y / max damage)
    speed.ts              speed tier computation with modifiers
  features/
    dex-browser/          Searchable roster for current reg
      PokemonList         virtualized list, filters: type, allowed-mega, usage rank
      PokemonDetail       base stats, abilities, learnset (reg-legal moves only), usage summary
    team-builder/
      TeamList            saved teams (IndexedDB), duplicate, delete, rename
      TeamEditor          6 slots, legality banner (species/item clause, reg violations)
      SetEditor           the core screen:
        SpeciesPicker     search w/ usage-ranked suggestions
        MegaToggle        base/mega forme switch
        MoveSelector      4 slots, legal moves, usage % shown inline
        ItemPicker        item-clause aware (greys out items used elsewhere on team)
        AlignmentPicker   nature grid UI (+/− stat matrix)
        SPAllocator       66-point pool UI: sliders/steppers per stat with live final-stat
                          preview, remaining-pool indicator, "suggest spread from usage" button
      TeamAnalysis
        TypeCoverageMatrix  offensive coverage + defensive weaknesses across the team
        ThreatList          top usage mons vs. this team: best move matchup, damage % each way
        SpeedTierChart      team + top meta mons on one L50 speed ladder (w/ Tailwind rows)
      TeamCompleter         BUILDS AROUND A CORE ("I have Reuniclus + Mega Blastoise, fill the team")
        ArchetypeDetector   infers team plan from locked slots' speed profile + common sets
                            (e.g. slow bulky setter → Trick Room; Drizzle → rain) and biases
                            all suggestions toward that plan
        PartnerSuggester    intersects the chaos-JSON `teammates` co-occurrence data across
                            all locked slots → statistically proven partners for this core
                            in the current regulation, with co-occurrence % shown
        GapFiller           combines coverage-matrix holes + missing roles (speed control,
                            Fake Out, redirection, TR abuser, win condition) and searches the
                            reg-legal roster for candidates, scored: patches most gaps,
                            fits archetype, usage-viable, doesn't violate item/species clause
        IterativeLoop       lock a suggestion into the next slot → gaps recompute → slot N+1
                            suggestions re-rank; every suggestion shows its evidence (the
                            coverage cell it fixes, co-occurrence %, key calc it wins)
        ProvenTeams         (phase 2, needs tournament data source) full real tournament
                            teams from Limitless/pokedata that contain all locked slots
    damage-calc/
      CalcView            attacker/defender panels (import from any saved team slot),
                          field conditions (weather/terrain/screens/helping hand), doubles toggle
      ResultPanel         damage %, rolls, KO chance, one-tap "copy calc" text
      OptimizerPanel      "min SP to survive this" / "min SP to outspeed X" solvers
    usage-browser/
      UsageTable          rank, usage %, trend vs last month
      MonUsageDetail      top moves/items/spreads/teammates (from chaos JSON transform)
    threat-advisor/       ANSWERS "how do I cover Pokémon X?" — deterministically, no AI
      ThreatInput         pick any meta mon (e.g. Garchomp); auto-loads its top usage sets
      TeamAudit           runs X's top sets vs. user's current team: damage % both ways,
                          speed order, per-slot verdict (safe answer / shaky / loses)
      CounterFinder       searches the reg-legal roster for answers, ranked by score:
                          takes <50% from X's best common move, outspeeds or KOs back
                          within 2 turns, bonus for usage viability + synergy with the
                          user's existing team; every suggestion deep-links to the
                          underlying calc in CalcView so advice is verifiable, not vibes
      AdviceExport        "Ask Claude" button: serializes team + SP spreads + threat
                          audit + meta snapshot into a structured prompt copied to the
                          clipboard for pasting into a claude.ai chat (covered by the
                          user's subscription; zero app cost; NEVER an in-app API call)
    import-export/
      ShowdownPaste       import/export Showdown paste format (translate EV spreads → nearest
                          legal SP spread on import, SP → EV(×8) on export for calc-site interop)
      ShareCodec          team → compressed URL fragment for link sharing (no server needed)
      RentalNote          display field for in-game Replica/rental codes (manual entry —
                          there is no public API for in-game codes)
  storage/
    db.ts                 Dexie schema: teams, settings, cached data versions
  pwa/
    sw config             precache app shell + /data/*.json; stale-while-revalidate for data;
                          full offline support after first load
```

### UX notes
- Mobile-first (this will live on a phone next to the Switch/phone running the game). Bottom tab nav: **Teams · Calc · Dex · Meta**.
- SP allocator is the signature interaction — make it fast: steppers with long-press repeat, common presets (max/max offensive, bulky, min speed), and live "outspeeds X% of meta" readout tied to usage data.
- Legality is always-on ambient feedback (red badges), never a blocking modal.

---

## 5. Free-tier deployment & ops

- **Hosting:** GitHub Pages (or Cloudflare Pages) — free, HTTPS, custom domain optional.
- **CI:** GitHub Actions free tier: (a) build+deploy on push; (b) monthly cron job pulls new Smogon chaos JSON, regenerates `usage/*.json`, commits, redeploys. New regulation = run the regulation script + review the diff.
- **No accounts, no sync backend.** Teams live in IndexedDB; sharing via URL-encoded team strings. (If cross-device sync is ever wanted: export/import file, or a free-tier option later — explicitly out of scope for v1.)
- **No runtime AI.** If AI-assisted team suggestions are ever desired, they must be a dev-time artifact (e.g., Claude Code generating a curated "sample teams" JSON checked into the repo) — never a runtime API call.

---

## 6. Milestones for Claude Code

**M1 — Engine core (no UI):** data pipeline scripts → `dex.json` + `regulations/m-b.json`; `stats.ts` with the Champions formula; `calc.ts` wrapper; golden test suite passing (incl. resolving the SP-vs-alignment rounding question against verified in-game values). *Acceptance: 30+ golden calcs match reference calculators exactly.*

**M2 — Team builder MVP:** app shell, dex browser, team CRUD in IndexedDB, SetEditor with SP allocator + legality checks, Showdown paste import/export.

**M3 — Damage calc UI:** CalcView + ResultPanel wired to saved teams, field conditions, doubles mode.

**M4 — Meta intelligence:** usage pipeline cron, UsageBrowser, ThreatList, SpeedTierChart, "suggest spread from usage," the **Threat Advisor** (TeamAudit + CounterFinder + AdviceExport), and the **Team Completer** (archetype detection + partner suggestions + gap-filling iterative loop; AdviceExport also serializes a locked core + gap analysis for open-ended "help me finish this team" prompts to Claude). *Acceptance: (a) querying "Garchomp" against a sample team returns ranked, calc-backed counter suggestions in <1s on a mid-range phone; (b) locking a 2-mon core produces slot-3 suggestions with visible evidence, and re-ranks after each added slot.*

**M5 — PWA polish:** service worker/offline, install prompt, URL team sharing, optimizer panel, performance pass (bundle < ~300KB gz before data; virtualized lists).

**M6 — Regulation M-C readiness:** prove the "new reg = new data file" claim by dry-running a fake regulation swap end-to-end.

---

## 7. Risks & open questions (track these in the repo)

1. **SP rounding order vs. alignment multiplier** — verify in-game before M1 sign-off (affects calc accuracy).
2. **Champions mechanic drift from Gen 9** — Champions may tweak move/ability behavior vs. Showdown's Gen 9 implementation; mirror fixes from the NCP calc fork and Showdown's Champions format as they land.
3. **Smogon ladder format name/availability** — confirm the exact chaos JSON filename for the current Champions format each month; the pipeline should fail loudly, not silently serve stale data (surface `generatedAt` in the UI).
4. **Regulation M-B ends ~Sept 9, 2026** — M-C support is imminent; M6 exists for this reason.
5. **Trademark/IP hygiene** — fan project: no official logos/artwork beyond sprite conventions other fan tools use; include the standard "not affiliated with Nintendo/TPC" disclaimer.
