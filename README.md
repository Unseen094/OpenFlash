# OpenFlash

A modern web-based interactive creation engine and publishing portal — think Flash for the modern web, rebuilt with TypeScript, HTML5 Canvas, and a sandboxed runtime.

## Features

- **Vector Studio editor** — pen, brush, shape, text, polygon, and star tools with magnetic grid snapping, node editing, and color palettes
- **Multi-layer timeline** — frame-by-frame animation with motion tweens, onion skinning, and keyframe tools at up to 60 fps
- **TypeScript sandbox runtime** — write live code that runs against a sandboxed engine with physics, particles, and collision detection
- **Chiptune synth** — built-in retro sound generator and Web Audio effects powered by the Web Audio API
- **Path operations** — union, subtract, intersect, and exclude boolean ops on vector paths
- **Offline HTML export** — compile projects into standalone, zero-dependency HTML files that run anywhere
- **Crypto checkout** — sell and buy games with BTC, ETH, or SOL via QR codes with live CoinGecko exchange rates
- **Creator monetization** — tiered plans (Beta / Sigma / Alpha) with ad-revenue sharing, withdrawals, and an arcade marketplace

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) 20+ (with npm)

### Install

```bash
git clone https://github.com/yourusername/openflash.git
cd openflash
npm install
```

### Development server

```bash
npm run dev
# → http://localhost:3000
```

The app runs in **demo mode** out of the box — auth routes work as a mock, and `/studio` + `/dashboard` are accessible without signing in.

### Production build

```bash
npm run build
# Output: dist/
npm run preview
# → http://localhost:3000 (preview server)
```

## Usage

### Quick tour

1. Visit `/` — the landing page introduces the platform and links to the Arcade and Studio.
2. Go to `/studio` — the full editor. Create shapes on the canvas, write TypeScript in the code panel, and click **Run** to execute it live.
3. Go to `/arcade` — browse games published by other creators (demo data) and play them in-browser.
4. Go to `/publish` — publish your current studio project to the arcade.
5. Go to `/checkout?game=<id>` — purchase a paid game with crypto (BTC/ETH/SOL) via QR code.
6. Go to `/docs` — full API reference for the TypeScript runtime.

### Writing code in the Studio

The Studio code editor runs TypeScript against a sandboxed `OpenFlash` runtime object. Example:

```typescript
// Create a sprite
const player = OpenFlash.createSprite({
  name: 'player',
  x: 80,
  y: 200,
  width: 40,
  height: 24,
  color: '#00F0FF',
})

// Move it every frame
OpenFlash.on('tick', (e) => {
  player.x += 100 * e.delta
  if (OpenFlash.isKeyDown('ArrowRight')) player.x += 150 * e.delta
})

// Particles and sound on click
OpenFlash.on('pointerDown', (e) => {
  OpenFlash.drawParticle(e.x, e.y, { color: '#FFE600', count: 24 })
  OpenFlash.playSound('hit')
})
```

See `/docs` for the complete runtime API.

### Publishing a game

1. Build your project in `/studio`.
2. Navigate to `/publish`, fill in the title, description, price, and plan.
3. Submit — your game appears in `/arcade`.

Creators on the **Beta** plan publish free games. **Sigma** ($9.99/mo) and **Alpha** ($29.99/mo) unlock custom pricing, higher revenue shares, and withdrawal limits.

## Configuration

### Environment variables

Create a `.env` file from the provided example:

```bash
cp .env.example .env
```

| Variable | Description | Default |
|---|---|---|
| `VITE_FIREBASE_API_KEY` | Firebase project API key | *(empty — demo mode)* |
| `VITE_FIREBASE_AUTH_DOMAIN` | Firebase auth domain | *(empty)* |
| `VITE_FIREBASE_PROJECT_ID` | Firebase project ID | *(empty)* |
| `VITE_FIREBASE_STORAGE_BUCKET` | Firebase storage bucket | *(empty)* |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | Firebase sender ID | *(empty)* |
| `VITE_FIREBASE_APP_ID` | Firebase app ID | *(empty)* |
| `VITE_FIREBASE_EMULATOR` | Point Firebase at a local emulator | *(empty)* |
| `VITE_BTC_ADDRESS` | Bitcoin wallet for received payments | demo address |
| `VITE_ETH_ADDRESS` | Ethereum wallet for received payments | demo address |
| `VITE_SOL_ADDRESS` | Solana wallet for received payments | demo address |
| `VITE_ADSENSE_PUB` | Google AdSense publisher ID | *(empty — custom HTML ads only)* |

> **Production:** Firebase **must** be configured in production. The app throws at startup if any required `VITE_FIREBASE_*` variable is missing when `NODE_ENV === 'production'`.

### Demo mode

When no Firebase config is provided, the app runs in demo mode:
- Sign-in accepts any email/password and creates a demo user.
- A Konami code cheat (`↑↑↓↓←→←→BA`) toggles a fun overlay.
- All data is persisted to `localStorage` — nothing hits a real backend.

## Routes

| Route | Description |
|---|---|
| `/` | Landing page |
| `/studio` | Full vector/timeline/code editor (requires auth in production) |
| `/arcade` | Browse and play published games |
| `/play/:gameId` | Play a single game (with optional pre-roll ad) |
| `/publish` | Publish a project to the arcade |
| `/checkout` | Crypto checkout (BTC/ETH/SOL) with QR code |
| `/earnings` | Creator revenue dashboard and withdrawal form |
| `/dashboard` | Creator hub — list, create, manage projects |
| `/admin` | Admin panel — payments, ads, creators, analytics (admin only) |
| `/docs` | Runtime TypeScript API reference |
| `/login` | Sign in |
| `/signup` | Create an account |

## Development

### Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start Vite dev server on `http://localhost:3000` |
| `npm run build` | Type-check + production build to `dist/` |
| `npm run preview` | Preview the production build locally |
| `npm run type-check` | Run `tsc --noEmit` for type checking |
| `npm run lint` | Run ESLint on `src/` |
| `npm run lint:fix` | Run ESLint with `--fix` |
| `npm test` | Run Vitest in watch mode |
| `npm run test:ui` | Run Vitest with the web UI |
| `npm run test:coverage` | Run tests with V8 coverage report |

### Project structure

```
src/
├── App.tsx              # Route definitions
├── components/          # Reusable UI (Navbar, Toast, AdSlot, etc.)
├── context/             # AuthContext (Firebase + demo mode)
├── lib/
│   ├── firebase.ts      # Firebase init + config check
│   ├── projects.ts      # Project CRUD with Zod validation + localStorage
│   ├── sanitize.ts      # DOMPurify SVG sanitization
│   ├── validation.ts    # Zod schemas
│   ├── storage/         # Generic localStorage repository
│   └── monetization/    # Ads, payments, earnings, plans, coins, blockchain
├── pages/               # Route pages (Studio, Arcade, Checkout, Admin, etc.)
├── studio/
│   ├── engine/          # Drawing engine, tools, timeline, shapes, runtime
│   ├── audio/           # Web Audio synth
│   └── runtime/         # User-code sandbox
└── styles/              # Global CSS with dark neon theme
```

### Architecture notes

- **Data storage**: Projects, games, payments, earnings, and withdrawals are all persisted to `localStorage` via a typed `createRepository` wrapper with Zod schema validation. No backend database is required for the core experience.
- **Sandboxing**: User code runs through `StudioSandbox` (`studio/runtime/sandbox.ts`) which bans dangerous patterns (`eval`, `Function`, `fetch`, `localStorage`, etc.) and enforces a per-execution timeout. The definitive isolation layer is an iframe sandbox (see roadmap).
- **Security**: A strict Content-Security-Policy is applied via `vite-plugin-csp`. SVG exports are sanitized with DOMPurify. Crypto checkout addresses are resolved from env vars at build time.
- **State management**: React Context (`AuthContext`) handles auth state. All other state is local component state or `localStorage`.

## License

This project is licensed under the MIT License — see the [LICENSE](LICENSE) file for details.
