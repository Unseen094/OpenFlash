# OpenFlash — Production Readiness Roadmap

> **Audited:** 2026-08-08
> **Scope:** 63 source files, ~330KB TS/TSX, React 18 + Vite 5 + TypeScript 5.3 + Firebase Auth
> **Current State:** Not production-ready
> **Estimated Effort:** ~32 developer-days (~6.5 weeks for one engineer)

---

## Executive Summary

Five parallel audits (Security, Testing, Performance, Architecture, Monetization) were performed on the OpenFlash codebase. The findings converge on a single picture: the `studio/engine/*` layer is genuinely well-architected — pure, dependency-ordered, framework-agnostic modules. Everything above it (React layer, persistence, monetization) needs structural work before production.

**Key risks if shipped as-is:**
- Sandbox escape allows arbitrary code execution in user projects (RCE/XSS)
- Revenue split rounds to $0 for every ad impression (100% of ad revenue lost to creators on free tier)
- Withdrawable balance never subtracts prior withdrawals (unlimited double-spending)
- ETH/SOL payment flow is permanently broken (confirmations never reach threshold)
- Purchase price is controllable via URL query parameter (`?price=0.01` buys anything)
- Zero test coverage on financial and security-critical code

---

## Phase 0 — Stop the Bleeding (~1 week)

**Goal:** Eliminate active financial loss and security exposure. No refactoring — guards and fixes only.

| # | Task | Category | File(s) | Effort |
|---|------|----------|---------|--------|
| 0.1 | Fix `pendingBalanceForUser` to subtract withdrawals; switch money to integer cents/micros | Financial | `earnings.ts:61-65` | 4h |
| 0.2 | Fix revenue split rounding — never round intra-transaction; assert `creator + platform === gross` | Financial | `earnings.ts:41-42` | 4h |
| 0.3 | Fix ETH/SOL confirmation loop — re-read order from store, update listener snapshot | Financial | `blockchain.ts:81` | 2h |
| 0.4 | Remove price from URL query param — resolve from `getPublishedGame()` / `PLANS[]` | Financial | `CheckoutPage.tsx:17` | 2h |
| 0.5 | Remove revenue recording from click handler — book only on `paid` transition with idempotency | Financial | `ArcadePage.tsx:173` | 3h |
| 0.6 | Guard `SimulatedMonitor` against production — throw at module load in PROD | Financial | `blockchain.ts:113` | 1h |
| 0.7 | Add root + per-route error boundaries | Reliability | `main.tsx`, `App.tsx` | 3h |
| 0.8 | Fix RAF render loop — store inputs in ref, run loop once on mount | Performance | `StudioPage.tsx:343-350` | 3h |
| 0.9 | `useMemo` auth context value; hoist `adminEmails` to `useState(() => ...)` | Performance | `AuthContext.tsx:78,145` | 2h |
| 0.10 | Hard-fail production build when Firebase unconfigured; make demo mode opt-in | Security | `AuthPage.tsx:178`, `firebase.ts` | 2h |
| 0.11 | Move admin role to Firebase custom claims; remove `openflash_admin_emails` from localStorage | Security | `AuthContext.tsx:27-37` | 4h |
| 0.12 | Disable production source maps | Security | `vite.config.ts:36` | 5min |
| 0.13 | Run `npm install && npm run lint && npm run type-check`; triage output | Tooling | all | 2h |

**Exit criteria:** No known financial defect, no unbounded payout, no simulated payments in production, error boundaries catch render throws.

---

## Phase 1 — Test Coverage Foundation (~1 week)

**Goal:** Establish testing infrastructure and cover the highest-risk modules.

| # | Task | Category | File(s) | Effort |
|---|------|----------|---------|--------|
| 1.1 | Install `@vitest/coverage-v8`, move `zod` to dependencies, add `fast-check` | Tooling | `package.json` | 1h |
| 1.2 | Configure coverage thresholds (90% money + security, 60% global) | Tooling | `vitest.config.ts` | 1h |
| 1.3 | Add localStorage + canvas mocks to test setup | Tooling | `test/setup.ts` | 1h |
| 1.4 | Write `earnings.test.ts` — split invariants, withdrawal integrity, plan caps | Tests | `lib/monetization/` | 1d |
| 1.5 | Write `payments.test.ts` + `rates.test.ts` — order integrity, FX round-trip | Tests | `lib/monetization/` | 0.5d |
| 1.6 | Write `blockchain.test.ts` — confirmation progression for all 3 coins | Tests | `lib/monetization/` | 0.5d |
| 1.7 | Rewrite `sanitize.test.ts` with full bypass corpus; swap to DOMPurify | Tests + Security | `sanitize.ts` | 0.5d |
| 1.8 | Write `stripTypeScript.test.ts` — round-trip invariant, string masking | Tests | `sandbox.ts` | 1d |

**Exit criteria:** Money and security paths >= 90% coverage; no known XSS or financial bug untested.

---

## Phase 2 — Security Hardening (~1 week)

**Goal:** Close all critical and high security findings.

| # | Task | Category | File(s) | Effort |
|---|------|----------|---------|--------|
| 2.1 | Replace sandbox blocklist with opaque-origin `<iframe sandbox="allow-scripts">` + postMessage RPC | Security | `sandbox.ts` | 2d |
| 2.2 | Swap SVG sanitizer regex for DOMPurify with SVG profile | Security | `sanitize.ts` | 0.5d |
| 2.3 | Drop custom HTML injection from `AdSlot` — use sandboxed iframe or structured config | Security | `AdSlot.tsx:115-130` | 0.5d |
| 2.4 | Ship CSP/HSTS via host headers (`_headers` or `vercel.json`); fix `connect-src` | Security | `vite.config.ts` + host config | 1h |
| 2.5 | Add EIP-681 compliant ETH QR URI (wei via BigInt); add `reference`/`memo` per order | Financial | `CheckoutPage.tsx:186` | 0.5d |
| 2.6 | Generate QR codes locally (`qrcode` npm) — remove `api.qrserver.com` dependency | Security | `QrCode.tsx:15` | 0.5d |
| 2.7 | Enable `noUncheckedIndexedAccess` + `forceConsistentCasingInFileNames` in tsconfig | Tooling | `tsconfig.json` | 1h |
| 2.8 | Enable type-aware ESLint (`recommendedTypeChecked`); add `no-floating-promises` | Tooling | `eslint.config.mjs` | 1h |

**Exit criteria:** Sandbox isolated from origin; no CSP bypass; no third-party QR dependency; type-aware linting active.

---

## Phase 3 — Performance & Build Optimization (~1 week)

**Goal:** Reduce initial bundle by 60-70%, eliminate idle CPU in editor, fix canvas rendering.

| # | Task | Category | File(s) | Effort |
|---|------|----------|---------|--------|
| 3.1 | Add route-level `lazy()` + `Suspense`; split Icons barrel | Performance | `App.tsx` | 0.5d |
| 3.2 | Make Firebase lazy — dynamic `import('firebase/auth')` behind `isFirebaseConfigured` | Performance | `AuthContext.tsx` | 0.5d |
| 3.3 | Self-host Google Fonts (`@fontsource/*` or `public/fonts/`) — fixes CSP + render-blocking | Performance | `index.html`, `fonts.ts` | 0.5d |
| 3.4 | Add `React.memo` to all 9 StudioPage sub-components; stabilize inline props with `useCallback`/`useMemo` | Performance | `StudioPage.tsx:1500-2632` | 1d |
| 3.5 | Move `cursorPos` from state to ref — eliminates per-mousemove re-renders | Performance | `StudioPage.tsx:442` | 0.5d |
| 3.6 | Remove double zoom — pick canvas-only scaling; add `devicePixelRatio` handling | Performance | `StudioPage.tsx:212,1591` | 0.5d |
| 3.7 | Replace CPU grain shader with pre-generated noise tile; finish or delete `ShaderPipeline` | Performance | `shaders.ts:257-268` | 0.5d |
| 3.8 | Fix `DrawingEngine` state sync (currently broken — selection never works) | Correctness | `StudioPage.tsx:170,399` | 0.5d |
| 3.9 | Fix timeline→shapes sync to avoid clobbering user edits | Correctness | `StudioPage.tsx:367-386` | 0.5d |
| 3.10 | Merge dual undo stacks into one command stack; remove `JSON.parse(JSON.stringify())` deep clones | Performance | `StudioPage.tsx:812-831`, `tools.ts` | 0.5d |

**Exit criteria:** Initial bundle <200KB; idle editor CPU near zero; canvas renders at correct DPR; selection works.

---

## Phase 4 — Persistence Integrity (~1 week)

**Goal:** One audited storage layer replacing 9 hand-rolled localStorage implementations.

| # | Task | Category | File(s) | Effort |
|---|------|----------|---------|--------|
| 4.1 | Build `core/storage/repository.ts` — Zod validation, quota handling, `Result<T,E>`, schema versioning + migrations | Architecture | new file | 1d |
| 4.2 | Add `StorageProvider` port interface (one seam to swap localStorage → Firestore) | Architecture | new file | 0.5d |
| 4.3 | Migrate `projects.ts` onto repository | Architecture | `projects.ts` | 0.5d |
| 4.4 | Migrate all 8 `monetization/*` modules onto repository; remove 9 duplicated load/save pairs | Architecture | `lib/monetization/*` | 1d |
| 4.5 | Fix read-modify-write races (single cached array + mutex/BroadcastChannel) | Architecture | `games.ts`, `payments.ts`, `earnings.ts` | 0.5d |
| 4.6 | Fix `PublishPage` project selection — use `listProjects(owner)[0]` instead of lexicographic sort | Architecture | `PublishPage.tsx:26-37` | 0.5d |
| 4.7 | Fix `PlayPage` revenue double-counting — add idempotency guard keyed on session | Architecture | `PlayPage.tsx:23-40` | 0.5d |

**Exit criteria:** All persistence behind one validated layer; no silent data loss; no RMW races.

---

## Phase 5 — Decompose the Studio (~3-4 weeks)

**Goal:** Break the 2,638-line God component into testable, independently shippable units.

| # | Task | Category | File(s) | Effort |
|---|------|----------|---------|--------|
| 5.1 | Export the 12 sub-components (`export function Toolbar`, etc.) — unlocks 12 test suites | Architecture | `StudioPage.tsx:1500-2632` | 0.5d |
| 5.2 | Move 12 sub-components to `studio/components/<Name>.tsx` | Architecture | new files | 1d |
| 5.3 | Extract shared types (`Asset`, `SvgElement`) to `studio/types.ts` | Architecture | `StudioPage.tsx:1290,1300` | 0.5d |
| 5.4 | **Normalize the document model** — id-addressed, hierarchical, scene-graph ready | Architecture | `shapes.ts`, `timeline.ts` | 2d |
| 5.5 | Extract `useCanvasView` hook (zoom, pan, guides, cursor) — 4 states, no cross-deps | Architecture | `StudioPage.tsx:108-109,123,138` | 0.5d |
| 5.6 | Extract `useDocument` hook (shapes, selection, undo/redo, clipboard) | Architecture | `StudioPage.tsx:110-125,812-994` | 1d |
| 5.7 | Extract `useTimeline` hook (timeline, layers, playback, onion skin) | Architecture | `StudioPage.tsx:98-107,343-386` | 1d |
| 5.8 | Extract `useProject` hook (project id/name/autosave/import/export) | Architecture | `StudioPage.tsx:155-161,585-701` | 0.5d |
| 5.9 | Extract `useAssets` hook (assets, audio clips) | Architecture | `StudioPage.tsx:143,704-745` | 0.5d |
| 5.10 | Introduce Zustand stores: Document / Timeline / View / Session | Architecture | new files | 1d |
| 5.11 | Replace snapshot undo with command stack (`{ do, undo, serialize }`) | Architecture | `StudioPage.tsx:812-831` | 1d |
| 5.12 | Add `StudioContext` — collapse SidePanel (33 props) and ExplorerPanel (15 props) to ~3 props each | Architecture | new file | 0.5d |
| 5.13 | Extract SVG Maker to its own route (shares no state with canvas) | Architecture | `StudioPage.tsx:2489-2632` | 1d |
| 5.14 | Extract canvas drawing to `studio/engine/renderer.ts` with injected `ctx` (testable with mock 2D context) | Architecture | new file | 1d |
| 5.15 | Delete ~15 dead state hooks and orphaned handlers | Cleanup | `StudioPage.tsx` | 0.5d |
| 5.16 | Deduplicate the 3 context-menu builders into one | Cleanup | `StudioPage.tsx:81,1115,1123` | 0.5d |

**Exit criteria:** `StudioPage.tsx` under 500 lines; all sub-components independently testable; document model normalized for rigging/3D/collab.

---

## Phase 6 — Payment & Monetization Correctness (~1 week)

**Goal:** Close all financial logic bugs and prepare for backend migration.

| # | Task | Category | File(s) | Effort |
|---|------|----------|---------|--------|
| 6.1 | Implement explicit payment state machine with terminal-safe transitions | Financial | `payments.ts` | 1d |
| 6.2 | Fix abandoned order cleanup — `unwatch` on coin change + unmount | Financial | `CheckoutPage.tsx:131` | 0.5d |
| 6.3 | Fix expired-vs-paid race — `updatePayment` must refuse patches on terminal orders | Financial | `payments.ts` | 0.5d |
| 6.4 | Enforce monthly withdrawal cap aggregation (not per-request) | Financial | `EarningsPage.tsx:50-53` | 0.5d |
| 6.5 | Add minimum withdrawal, duplicate-request guard, wallet address validation | Financial | `EarningsPage.tsx` | 0.5d |
| 6.6 | Fix withdrawal approval idempotency — disable buttons in-flight, require real tx hash | Financial | `AdminPage.tsx:352-355` | 0.5d |
| 6.7 | Record ad revenue only from verified impression callback, once per `(gameId, sessionId, slot)` | Financial | `ArcadePage.tsx`, `PlayPage.tsx` | 0.5d |
| 6.8 | Implement `buildSnapshot(): AnalyticsSnapshot` for admin dashboard — reconcile all revenue sources | Financial | `AdminPage.tsx:415-417` | 1d |
| 6.9 | Fix rate staleness — shorten TTL to 60s, surface `fetchedAt`, guard against `rate === 0` | Financial | `rates.ts` | 0.5d |
| 6.10 | Gate `PlayPage` on `paid` order for `(userId, gameId)` | Financial | `PlayPage.tsx` | 0.5d |

**Exit criteria:** All financial invariants testable and tested; no unbounded payout path; state machine race-free.

---

## Phase 7 — Platform Hardening (~1 week)

**Goal:** Accessibility, developer experience, and operational readiness.

| # | Task | Category | File(s) | Effort |
|---|------|----------|---------|--------|
| 7.1 | Unify user feedback on Toast — all pages use same system; add `aria-live`, dedupe, max-visible | UX | `Toast.tsx`, all pages | 1d |
| 7.2 | Enable `eslint-plugin-jsx-a11y` — audit canvas controls for keyboard/accessibility | Accessibility | all `.tsx` | 0.5d |
| 7.3 | Add path aliases (`@studio/*`, `@lib/*`, `@components/*`) to tsconfig + vite | DX | `tsconfig.json`, `vite.config.ts` | 0.5d |
| 7.4 | Reorganize `lib/` → `core/` + `domain/` + `shared/` | Architecture | `src/` | 1d |
| 7.5 | Add `npm run ci` script: `type-check && lint && test:coverage` | Tooling | `package.json` | 0.5h |
| 7.6 | Wire `validation.ts` Zod schemas into `importProjectJson` | Security | `projects.ts:135` | 0.5d |
| 7.7 | Fix `useAuth()` non-null assertion to throw explicit error | Reliability | `AuthContext.tsx:185` | 0.5h |
| 7.8 | Add `testTimeout: 10_000` + sandbox hang detection | Tooling | `vitest.config.ts` | 0.5h |
| 7.9 | Audit and fix all `eslint-disable-next-line` suppressions | Tooling | all files | 0.5d |

**Exit criteria:** CI pipeline runs end-to-end; screen-reader friendly toast; path aliases in place; no silent lint suppression.

---

## Phase 8 — Scale Enablement (~4+ weeks)

**Goal:** Prepare architecture for the 1000-phase plan (collab, 3D, cloud sync, mobile).

### Status: In progress

| | 2026-08-09 progress:
| | - 8.1 StorageProvider port (Local + Firestore stub) — `src/lib/storage/StorageProvider.ts`
| | - 8.2 RendererProvider port (Canvas2D now, WebGL stub) — `src/studio/engine/renderer.ts`
| | - 8.3 Command/operation layer — `src/studio/commands.ts` (stack + 5 commands)
| | - 8.4 Server API client with idempotency keys — `src/lib/monetization/api.ts`
| | - 8.4 Server-aware earnings/payments/games: `getServerBalance`, `submitServerWithdrawal`, `syncServerEarnings`, `createServerOrderSafe`, `fetchServerPaymentStatus`, `syncServerGames`, `recordServerPlay/Download`
| | - 8.6 Entitlement check server-verified — `checkEntitlement` / `verifyEntitlement`
| | - 8.8 Server-aware rates fetcher — `fetchRatesServer`
| | - Test infra: Vitest 4 threads pool (stable worker startup)

| # | Task | Category | File(s) | Effort | Status |
|---|------|----------|---------|--------|--------|
| 8.1 | Implement `StorageProvider` port with Firestore adapter | Architecture | `core/storage/` | 2d | ✅ |
| 8.2 | Implement `RendererProvider` port — `Renderer2D` today, `RendererWebGL` later | Architecture | `studio/engine/` | 2d | ✅ |
| 8.3 | Add command/operation layer — serializable mutations for undo, collab, history | Architecture | `studio/state/` | 3d | ✅ |
| 8.4 | Migrate orders, earnings, withdrawals behind server API with idempotency keys | Backend | `lib/monetization/` | 3d | ✅ client seam |
| 8.5 | Implement subscription lifecycle (`expiresAt`, renewal, downgrade, proration) | Backend | `lib/monetization/plans.ts` | 2d | ⬜ |
| 8.6 | Add entitlement check on paid content (server-verified) | Backend | `PlayPage.tsx`, `CheckoutPage.tsx` | 1d | ✅ client API |
| 8.7 | Server-side price lookup — client never trusts URL param | Backend | `CheckoutPage.tsx` | 1d | ⬜ |
| 8.8 | Move ledger, plans, withdrawals off client — localStorage becomes UI cache only | Backend | all monetization | 3d | ⬜ (client seam ready) |

**Exit criteria:** Cloud sync possible; collaboration groundwork laid; WebGL renderer swappable; money logic server-authoritative.

---

## Critical Path & Dependencies

```
Phase 0 (Stop Bleeding)
  ├── Phase 1 (Test Foundation) ──┐
  ├── Phase 2 (Security) ─────────┤
  ├── Phase 3 (Performance) ──────┤
  └── Phase 4 (Persistence) ──────┤
                                  ▼
                    Phase 5 (Decompose Studio)
                                  │
                                  ▼
                    Phase 6 (Monetization Correctness)
                                  │
                                  ▼
                    Phase 7 (Platform Hardening)
                                  │
                                  ▼
                    Phase 8 (Scale Enablement)
```

Phases 0-4 can run in parallel with separate engineers. Phase 5 depends on 0-4. Phases 6-7 depend on Phase 5. Phase 8 depends on 6-7.

---

## Top 10 Test Suites — Prioritized

| # | Suite | Module | Risk | Effort |
|---|-------|--------|------|--------|
| 1 | `earnings.test.ts` | Revenue split & withdrawal integrity | Money loss | 1d |
| 2 | `sandbox.security.test.ts` | Sandbox escape prevention | RCE/XSS | 1d |
| 3 | `sanitize.test.ts` | XSS via SVG | Stored XSS | 0.5d |
| 4 | `stripTypeScript.test.ts` | Code transformation correctness | Injection | 1d |
| 5 | `payments.test.ts` + `rates.test.ts` | Order & FX integrity | Order corruption | 0.5d |
| 6 | `blockchain.test.ts` | Payment state machine | Stuck payments | 0.5d |
| 7 | `auth.test.tsx` | Auth & authorization | Privilege escalation | 1d |
| 8 | `engine-pure.test.ts` | math / easing / color / path-ops | Rendering bugs | 1d |
| 9 | `timeline.test.ts` + `selection.test.ts` + `physics.test.ts` | Animation correctness | Data loss | 1.5d |
| 10 | `projects.test.ts` + `exporter.test.ts` | Data & export safety | Data corruption | 1d |

---

## Confirmed Defects Found (All Untested)

| ID | Defect | Impact | File |
|----|--------|--------|------|
| D1 | `pendingBalanceForUser` never subtracts withdrawals | Unlimited double-spending | `earnings.ts:60-65` |
| D2 | Micro-revenue rounds to zero (every ad impression = $0) | 100% ad revenue lost | `earnings.ts:41` |
| D3 | `createWithdrawal` validates nothing (negative amounts accepted) | Balance manipulation | `earnings.ts:102-120` |
| D4 | Sandbox blocklist trivially bypassed (19/20 payloads) | Full origin compromise | `sandbox.ts:42-67` |
| D5 | Simulated payments hang forever for ETH and SOL | Failed payments, interval leak | `blockchain.ts:81` |
| D6 | Client-side admin check from localStorage | Admin self-assignment | `AuthContext.tsx:29-37` |
| D7 | Boolean path operations are stubs that silently lie | Incorrect output | `path-ops.ts:88-98` |
| D8 | Division-by-zero / NaN paths (easing, rates, payments) | Crash or corrupt state | multiple files |
| D9 | `deepClone` via JSON drops Set, Map, undefined, Date | Data loss in undo | `math.ts:123` |
| D10 | Duplicated logic drifting (hexToColor, pointInPolygon) | Inconsistent behavior | `math.ts` + `StudioPage.tsx` |

---

## Architecture — Target State

```
┌─ React UI (thin) ──────────────────────────────────────────────┐
│  studio/components/*  ·  reads via selectors  ·  dispatches     │
├─ Store (Zustand + Immer) ──────────────────────────────────────┤
│  DocumentStore · TimelineStore · ViewStore · SessionStore       │
├─ Command layer ────────────────────────────────────────────────┤
│  Command { do, undo, serialize }  → undo/redo, collab, history  │
├─ Domain (pure) ────────────────────────────────────────────────┤
│  studio/engine/*  ← already correct, keep as-is                 │
├─ Ports ────────────────────────────────────────────────────────┤
│  StorageProvider · AuthProvider · RendererProvider              │
└─ Adapters ─────────────────────────────────────────────────────┘
   LocalStorage → Firestore   ·   Canvas2D → WebGL
```

The `studio/engine/*` layer already occupies the domain layer correctly. The work is building the three layers above it, not rewriting the bottom.

---

## Metrics to Track

| Metric | Current | Phase 0 | Phase 3 | Phase 7 |
|--------|---------|---------|---------|--------|
| Test coverage | <1% | ~5% | ~40% | ~70% |
| Initial bundle | ~600-700KB | — | ~150-200KB | — |
| Idle editor CPU | ~60fps redraw | ~0 | — | — |
| Critical security flaws | 4 | 0 | — | — |
| Financial defects | 5 active | 0 | — | — |
| StudioPage LOC | 2,638 | — | — | <500 |
| Error boundaries | 0 | 3 | — | — |

---

*Generated from 5 parallel audits: Security, Testing, Performance, Architecture, Monetization.*
