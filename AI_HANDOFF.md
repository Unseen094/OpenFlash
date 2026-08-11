# OpenFlash — AI Handoff

Handoff for a continuing agent. Read this first. Last updated: hackathon session 1.

---

## 1. Project overview

**OpenFlash** — an "interactive creation portal": a canvas/vector animation **Studio**, a scriptable **game runtime** (the `Open` / `OpenFlash` script API), a **publishing + monetization layer** (plans, ads, crypto checkout, creator earnings), an **Arcade** storefront for published games, and **live collaboration**. Goal: polished, demo-ready hackathon product (3 days).

- Stack: React 18 + Vite 5 + TypeScript 5.3, React Router, Zod, Vitest 4.1.10 (jsdom, v8 coverage), optional Firebase (unused in demo mode).
- Env: **Windows, PowerShell only** (no `rg`, no `grep -r`). Repo `D:\projects\OpenFlash`, branch `main`.
- Never commit unless the user explicitly asks.

## 2. Hackathon centerpieces (user picked "top 3")

| # | Feature | Status |
|---|---------|--------|
| 1 | Template gallery (`/templates`) | Done this session |
| 2 | Arcade revamp + leaderboards | Done this session |
| 3 | **Live collab** (multi-user canvas editing) | **TODO — next big feature** |

Secondary work: synthwave/neon UI identity, bulletproof demo mode, comment sanitization, per-file lint hygiene.

## 3. What was done this session

### Leaderboard infrastructure (new)
- `src/lib/monetization/leaderboard.ts` — localStorage-backed:
  - `getLeaderboard(gameId)`, `postScore(gameId, player, score)` (top 10 desc, returns board), `clearLeaderboard(gameId)`, `listLeaderboards()`.
  - Index key `openflash_leaderboards_index`; board keys `openflash_leaderboard_<gameId>`; zod-validated; player truncated to 40 chars, default `'anonymous'`; non-finite scores ignored.
- Tested at `src/lib/monetization/leaderboard.test.ts` (9 tests). The coverage threshold for `src/lib/monetization/**` is **90%** — keep this file tested.

### Score bridge: game script -> leaderboard
- `OpenFlashRuntime.postScore(score)` at `src/studio/engine/runtime.ts` — emits via the existing `dataChannel` option: `{ name: 'score', value: { score } }`.
- `StudioSandbox` constructor gained optional 3rd param `dataChannel?: (name: string, value: unknown) => void` (`src/studio/runtime/sandbox.ts`), passed into the runtime. In the Studio itself no channel is passed, so `postScore` is a safe no-op there.

### PlayPage rewrite (`src/pages/PlayPage.tsx`)
- Previously a fake orb demo. **Now runs the published project's real code** via `loadProject(game.projectId)` inside `StudioSandbox` (800x450 canvas).
- Ads gate when `game.adsEnabled` ("Skip Ad" -> run). Sidebar "HIGH SCORES" table updates live from the dataChannel handler.
- Player name from `localStorage` key `openflash_player_name` (default `'guest'`).
- Replay button + `R` key restart the sandbox. Play is recorded once per game via `recordPlay(game.id, 0)` with a `countedRef` guard.
- Lint-safe patterns used: state synced during render (adjust-during-render), score updates via single `setState(prev => ...)`.

### Arcade revamp (`src/pages/ArcadePage.tsx`)
- `LeaderboardPreview` on each game card (top score + entry count), lazy `useState` init, no effects.
- No double counting: ArcadePage attributes ad revenue on Play click; PlayPage records the play itself.
- Seeded arcade games now point at **real seeded projects** (projectId links) — Grid Runner, Nova Drift, Orbit Painter.

### Template gallery (new)
- `src/lib/templates.ts` — 6 `TemplateDef`s (id, name, tagline, description, tags, difficulty rookie|pro|legend, minutes, starter `VectorShape[]`, full code):
  1. `particle-burst` — click to burst, posts score per wave
  2. `grid-runner` — platformer with gravity; postScore per coin
  3. `orbit-painter` — animated logo sting
  4. `neon-shooter` — mouse aim, hold to fire, combo scoring
  5. `coin-combo` — arrow catch, decaying streak, postScore
  6. `gravity-bounce` — one-button (SPACE), beam gaps, postScore on death
- `createProjectFromTemplate(owner, id)` — creates + saves a project via `saveProject(p)`.
- `src/pages/TemplatesPage.tsx` — grid gallery, tag filter chips, gradient covers, difficulty badges, "Use Template" -> creates project -> `navigate('/studio?project=<id>')` (Studio reads `?project=` from `window.location.search`).
- Route `/templates` added in `src/App.tsx` (lazy import + route title). Navbar item added (index `03`, Hub -> 04, Docs -> 05).
- `src/lib/demoSeed.ts` **refactored** to import the 3 original templates from `templates.ts` — single source of truth (previously duplicated starter shapes + code).

### Icons / CSS additions
- New icons in `src/components/Icons.tsx`: `IconTrophy`, `IconBolt`, `IconClock`.
- New CSS class `.badge-ghost` in `src/styles/globals.css` (transparent badge).

## 4. What is NOT done / next steps

1. **Live collab (centerpiece #3)** — design + implement. Candidate approach: BroadcastChannel-based peer sync in Studio (shape ops + cursor positions), presence list, conflict-lite last-write-wins per shape. Must NOT use network calls in demo mode. Consider a `CollabPanel` and a `collabBus` module under `src/studio/collab/`. Wire into `StudioPage` where shapes change (toolState/shapes state). Tests should cover the merge/op-apply logic (`src/studio/collab/*.test.ts`).
2. **Verify session work in browser** — the last eslint run was aborted (per-file lint still pending for `TemplatesPage.tsx`, `lib/templates.ts`, `lib/demoSeed.ts`, `Icons.tsx`, `Navbar.tsx`, `App.tsx`).
3. DocsPage (`src/pages/DocsPage.tsx`) still doesn't mention `postScore` — add a doc card so template code makes sense to users.
4. Dashboard could link `/templates` ("start from a template") next to New Project.
5. Demo-mode polish: scripts in `PlayPage` could auto-post a friendly score if the game never calls `postScore`.

## 5. Commands (exact, Windows PowerShell — IMPORTANT)

- Dev server: `npm run dev`
- Typecheck: `node node_modules/typescript/bin/tsc --noEmit` (NOT bare `tsc`)
- Tests: `node node_modules/vitest/vitest.mjs run` (default fork pool; `pool: 'threads'` hangs on this machine — never change it back)
- Single test file: `node node_modules/vitest/vitest.mjs run src/lib/monetization/leaderboard.test.ts`
- Lint is **per-file only** (full-repo lint times out):
  `node node_modules/eslint/bin/eslint.js <file1> <file2>`
- Build: `npx vite build` (tsc already passed in `npm run build` = `tsc && vite build`)

## 6. Conventions & gotchas (READ BEFORE WRITING CODE)

- Lint is strict (react-hooks + @typescript-eslint):
  - **NEVER set state synchronously inside a `useEffect` body** (`react-hooks/set-state-in-effect`). Use lazy `useState(initializer)` or the adjust-state-during-render pattern.
  - Destructure function props with arrow types (`onPlay: () => void`) — method-shorthand props trip `@typescript-eslint/unbound-method`.
  - No unused vars (must match `/^_/`).
- Scripts run inside a `new Function` sandbox; banned tokens: eval/Function/constructor/prototype, fetch/XMLHttpRequest/WebSocket/Worker/importScripts, localStorage/sessionStorage/cookie, process.env.
- Sandbox `run(code)` returns `{ ok, message }`; use `sandboxRef.stop()` before re-`run()` (watchdog + frame handles).
- Runtime script API surface (what game code can call): `Open.on(event, fn)`, `Open.drawRect/drawCircle/drawText(x,y,...,color,size)`, `Open.createSprite({name,x,y,width,height,color})`, `Open.playSound('hit'|'jump'|'shoot'|'explode'|'click')`, `Open.postScore(n)`. Events: tick (`e.delta`), pointerDown/Up/Move (`e.x`, `e.y`), keyDown/Up (`e.key`).
- Storage repos: `createRepository<T>(key, zodSchema)` from `src/lib/storage/repository.ts` — `readOrDefault`, `write`, `clear`. Projects live under `src/lib/projects.ts`.
- CSS: new design tokens in `src/styles/globals.css` (`--bg-*`, `--amber`, `--cyan`, `--pink`, `--green`, `--red`, `--mono`, `--ink-*`, `--line`, radii) AND legacy aliases (e.g. `--text-primary/secondary/muted`) that existing components use — keep both working. System classes: `.panel`, `.corner`, `.btn`, `.badge*`, `.row/-between`, `.tiny/.small/.mono/.muted`, `.table`, `.glass-panel` (legacy), `.dot-grid`, etc.
- Demo seeds keyed by localStorage flags (`openflash_arcade_seeded_v1`, `openflash_workspace_seeded_v1`) — bump version suffix when seed content changes materially.
- User asked (prior session) to strip comments aggressively and keep code human-styled — avoid dense AI-slop comment banners.

## 7. Progress checkpoints (tests)

- All tests green last full run: 117 tests, 7 files (payments, sanitize, blockchain, earnings, engine-pure, sandbox, leaderboard).
- Typecheck green after leaderboards + templates work (before the aborted lint run).
- New/changed files this session (verify lint + rerun tests after any edits):
  - `src/lib/monetization/leaderboard.ts` (+ test)
  - `src/studio/engine/runtime.ts` (postScore)
  - `src/studio/runtime/sandbox.ts` (dataChannel param)
  - `src/pages/PlayPage.tsx`, `src/pages/ArcadePage.tsx`
  - `src/lib/templates.ts`, `src/pages/TemplatesPage.tsx`
  - `src/lib/demoSeed.ts` (refactor)
  - `src/components/Icons.tsx`, `src/components/Navbar.tsx`
  - `src/App.tsx`, `src/styles/globals.css` (badge-ghost)

## 8. Product map (key files)

- Studio: `src/pages/StudioPage.tsx` (big), engine `src/studio/engine/` (runtime, shapes, timeline, physics), sandbox `src/studio/runtime/sandbox.ts`
- Monetization: `src/lib/monetization/` (games, plans, ads, earnings, payments, blockchain, api, + leaderboard)
- Pages: Landing, Arcade, Play, Studio, Templates, Dashboard, Earnings, Publish, Admin, Checkout, Docs, Auth
- Shared: `src/lib/storage/` (repository, StorageProvider), `src/lib/sanitize.ts`, `src/lib/projects.ts`, `src/lib/demoSeed.ts`, `src/components/` (Navbar, Icons, AdSlot, ...), `src/context/AuthContext.tsx`