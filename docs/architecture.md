# Architecture

## Overview

A single-page React app with no backend. All state lives in the browser (localStorage); plans are shared by encoding them into a URL.

| Concern | Choice |
| --- | --- |
| UI | React 19, Tailwind CSS 4 |
| Routing | `react-router-dom` hash router |
| State | Zustand with `persist` middleware |
| Build | Vite 6, TypeScript, `vite-plugin-pwa` |
| Tests | Vitest |
| Sharing | `lz-string` compressed URL |

## Layout

```
src/
  main.tsx, App.tsx     Entry point and routes (/, /import, /plan/:id)
  pages/                Route-level screens: Home, Plan, Import, Help (modal)
  components/
    common/             Shared UI primitives (AppShell, Button, Card, ...)
    plan-modals/        Setup and players modals
    plan-view/          Timeline, SegmentEditor, PrintLayout
    roster/, setup/     Player rows/badges, substitution settings
  constants/            Sport presets (sizes, lineups, defaults)
  scheduler/            Pure rotation-planning logic (no React)
  store/                Zustand store of saved plans
  types/                Domain types: sport, player, match
  utils/                Share URLs, slot intervals/transitions, pitch time
public/                 PWA icons
```

## Domain model (`src/types`)

- `SportConfig`: field size, position types, lineup slots, periods.
- `Player`: id, name, level, playable positions.
- `MatchPlan` / `TournamentPlan` (`SavedItem`): roster, config, user `pins`, `lockedSlots`, and the generated `slots`.
- `TimeSlot`: one interval; `gkId`, `fieldIds`, `benchIds`, absent ids, and a derived `positions` overlay (slot id to player id).

## Scheduler (`src/scheduler`)

`generatePlan(input)` in `index.ts` is the single entry point and is pure and deterministic. Pipeline:

1. `segmentBuilder`: split matches/periods into intervals from the bench stint length.
2. Input validation: invalid input returns a warning rather than throwing, keeping locked history.
3. `feasibility`: pre-checks that produce warnings.
4. `rotationSolver`: chooses keeper, field and bench per interval, balancing pitch time and honouring pins and bench/substitution limits.
5. `positionOverlay`: assigns players to specific lineup slots using `maxMatch` (bipartite matching).
6. Assemble `TimeSlot[]`; locked slots are copied through unchanged; warnings are de-duplicated.

## Store (`src/store`)

`savedPlansStore` holds saved items, persisted under the localStorage key `coach-saved-plans`. Any edit to a plan's inputs calls `regenSlots`, which re-runs `generatePlan`. Loaded data passes through `normalizeSavedItem` to migrate older shapes.

## Sharing

`utils/shareUrl.ts` serialises a plan to JSON, compresses it, and puts it in `#/import?plan=...`. `ImportPage` decodes and saves it as a new item.

## Offline / PWA

`vite-plugin-pwa` precaches the build and auto-updates. `VITE_BASE` sets the base path for subpath hosting.
