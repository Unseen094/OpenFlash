import { createEmptyProject, saveProject } from './projects'
import { createRectangle, createEllipse, createPolygon, createText, VectorShape } from '../studio/engine/shapes'
import type { PlanId } from './monetization/types'

export interface OfficialGameDef {
  id: string
  title: string
  tagline: string
  description: string
  controls: string
  difficulty: string
  minutes: number
  priceUsd: number
  adsEnabled: boolean
  plan: PlanId
  creatorId: string
  creatorName: string
  shapes: VectorShape[]
  code: string
  thumbnail: string
}

const NEON_BLUE = { r: 0, g: 88, b: 190, a: 1 }
const NEON_AMBER = { r: 254, g: 166, b: 25, a: 1 }
const NEON_RED = { r: 182, g: 23, b: 34, a: 1 }
const NEON_CYAN = { r: 33, g: 112, b: 228, a: 1 }
const NEON_INK = { r: 27, g: 27, b: 30, a: 1 }

function paintThumb(parts: string[]): string {
  const body = parts.join('')
  return `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360" viewBox="0 0 640 360"><rect width="640" height="360" fill="#fbf8fc"/><rect x="0" y="0" width="640" height="360" fill="none" stroke="#0058be" stroke-width="3"/><g stroke="#0058be" stroke-width="2" opacity="0.35">${[...Array(20)].map((_, i) => `<line x1="${i * 32}" y1="0" x2="${i * 32}" y2="360"/>`).join('')}${[...Array(11)].map((_, i) => `<line x1="0" y1="${i * 36}" x2="640" y2="${i * 36}"/>`).join('')}</g>${body}</svg>`)}`
}

function svgRect(x: number, y: number, w: number, h: number, fill: string, extra = ''): string {
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${fill}" rx="4"${extra}/>`
}

function svgCircle(cx: number, cy: number, r: number, fill: string, extra = ''): string {
  return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${fill}"${extra}/>`
}

function svgText(x: number, y: number, size: number, text: string, fill = '#1b1b1e', weight = 700): string {
  return `<text x="${x}" y="${y}" font-family="Bricolage Grotesque, Arial, sans-serif" font-size="${size}" font-weight="${weight}" fill="${fill}">${text}</text>`
}

function svgPolygon(points: string, fill: string, extra = ''): string {
  return `<polygon points="${points}" fill="${fill}"${extra}/>`
}

// ─── 1 · GRID RUNNER ──────────────────────────────────────────────────────────
// Precision platformer: gravity, coyote time, jump buffering, combos.

const GRID_RUNNER_SHAPES: VectorShape[] = [
  createRectangle(60, 320, 280, 22, NEON_AMBER),
  createRectangle(420, 250, 280, 22, NEON_CYAN),
  createRectangle(180, 175, 190, 18, NEON_AMBER),
  createRectangle(560, 120, 180, 18, NEON_CYAN),
  createRectangle(40, 430, 720, 20, NEON_BLUE),
  createText(36, 52, 'GRID RUNNER — arrows + SPACE · catch the gold nodes', 17)
]

const GRID_RUNNER_CODE = `// GRID RUNNER — precision platformer
// ← → move · SPACE jump · collect gold nodes · don't fall

const W = 800, H = 450
const GRAV = 860, MOVE = 250, JUMP = -330
const floors = [
  { x: 40,  y: 430, w: 720, h: 20 },
  { x: 60,  y: 320, w: 280, h: 22 },
  { x: 420, y: 250, w: 280, h: 22 },
  { x: 180, y: 175, w: 190, h: 18 },
  { x: 560, y: 120, w: 180, h: 18 }
]
const COYOTE = 0.09, BUFFER = 0.12, COMBO_WINDOW = 4

let px = 120, py = 380, vx = 0, vy = 0
let facing = 1, grounded = false, coyote = 0, buffer = 0
let score = 0, combo = 0, since = 0, best = 0
let alive = 1, flash = 0
let coins = [{ x: 500, y: 212, got: false }, { x: 275, y: 137, got: false }, { x: 650, y: 82, got: false }]
let stars = []
for (let i = 0; i < 26; i++) stars.push({ x: Math.random() * W, y: Math.random() * H, r: 0.5 + Math.random() * 1.4 })

Open.drawText('GRID RUNNER — arrow keys + SPACE to jump', 40, 40, '#8aa2c8', 18)

function spawnCoin() {
  const f = floors[1 + Math.floor(Math.random() * 4)]
  coins.push({ x: f.x + 20 + Math.random() * (f.w - 40), y: f.y - 28, got: false })
}

Open.on('keyDown', (e) => {
  if (e.key === ' ') { buffer = BUFFER; Open.playSound('jump') }
})

Open.on('tick', (e) => {
  if (!alive) return
  const dt = Math.min(e.delta, 0.033)

  const left = Open.isKeyDown('ArrowLeft')
  const right = Open.isKeyDown('ArrowRight')
  vx = 0
  if (left) vx -= MOVE
  if (right) vx += MOVE
  facing = vx === 0 ? facing : vx > 0 ? 1 : -1

  coyote = Math.max(0, coyote - dt)
  buffer = Math.max(0, buffer - dt)
  if (buffer > 0 && (grounded || coyote > 0)) {
    vy = JUMP
    grounded = false
    coyote = 0
    buffer = 0
    Open.drawParticle(px, py + 12, { color: '#fea619', count: 10, speed: 3, size: 2 })
  }

  vy += GRAV * dt
  px += vx * dt
  py += vy * dt

  grounded = false
  for (const f of floors) {
    if (px + 13 > f.x && px - 13 < f.x + f.w) {
      const top = f.y
      if (py + 13 >= top && py + 13 <= top + 20 && vy >= 0) {
        py = top - 13
        vy = 0
        grounded = true
        coyote = COYOTE
      }
    }
  }

  since += dt
  if (since > COMBO_WINDOW) { combo = 0; since = 0 }

  for (const c of coins) {
    if (!c.got && Math.abs(px - c.x) < 22 && Math.abs(py - c.y) < 22) {
      c.got = true
      combo += 1
      const gain = 100 * combo
      score += gain
      best = Math.max(best, combo)
      since = 0
      flash = 0.25
      Open.playSound('shoot')
      Open.drawParticle(c.x, c.y, { color: '#fea619', count: 16, speed: 4, size: 3 })
      spawnCoin()
      Open.postScore(score)
    }
  }

  if (py > H + 30) {
    alive = 0
    Open.playSound('explode')
    Open.drawParticle(px, Math.min(py, H), { color: '#ff5f57', count: 30, speed: 6, size: 4 })
    Open.postScore(score)
  }

  Open.drawRect(0, 0, W, H, '#0d1226')
  for (const s of stars) Open.drawRect(s.x, s.y, s.r, s.r, '#2c3a5e')

  for (const f of floors) {
    Open.drawRect(f.x, f.y, f.w, f.h, f.y === 430 ? '#0058be' : '#2170e4')
    Open.drawRect(f.x + 4, f.y + 4, f.w - 8, 3, '#fbf8fc')
  }

  if (flash > 0) {
    flash -= dt
    Open.drawCircle(px, py, 24, flash > 0 ? '#fea619' : '#0058be')
  } else {
    Open.drawLine(px + facing * 14, py, px - 8, py - 8, '#fbf8fc', 3)
    Open.drawLine(px + facing * 14, py, px - 8, py + 8, '#fbf8fc', 3)
    Open.drawRect(px - 6, py - 9, 12, 18, '#d8e2ff')
  }

  for (const c of coins) {
    if (!c.got) {
      const bob = Math.sin(Date.now() / 220 + c.x) * 3
      Open.drawCircle(c.x, c.y + bob, 9, '#fea619')
      Open.drawCircle(c.x, c.y + bob, 4, '#fff3e0')
    }
  }

  Open.drawText('SCORE ' + score, 16, 26, '#eaf2ff', 16)
  Open.drawText('COMBO x' + combo + (combo >= 3 ? ' — on fire!' : '') + '   BEST ' + best, 16, 44, '#fea619', 13)
  if (!alive) {
    Open.drawText('GAME OVER — SCORE ' + score, 290, 200, '#ff5f57', 26)
  }
})`

// ─── 2 · NOVA DRIFT ───────────────────────────────────────────────────────────
// Endless vector drift: thrust with inertia, dodge mines, chase the multiplier.

const NOVA_DRIFT_SHAPES: VectorShape[] = [
  createPolygon([{ x: 400, y: 210 }, { x: 415, y: 230 }, { x: 385, y: 230 }], NEON_BLUE),
  createEllipse(180, 120, 22, 22, NEON_RED),
  createEllipse(560, 300, 26, 26, NEON_RED),
  createText(36, 52, 'NOVA DRIFT — arrows / WASD to thrust · dodge the mines', 17)
]

const NOVA_DRIFT_CODE = `// NOVA DRIFT — endless vector drift
// arrows / WASD thrust with real inertia · dodge mines · multiplier rises with survival

const W = 800, H = 450
const THRUST = 340, FRICTION = 0.984, MAX_SPEED = 260

let px = 400, py = 225, vx = 0, vy = 0
let alive = 1, time = 0, mult = 1, base = 0
let mines = []
let trail = []
let stars = []
for (let i = 0; i < 40; i++) stars.push({ x: Math.random() * W, y: Math.random() * H, r: 0.5 + Math.random() * 1.6, tw: Math.random() * 6 })

function spawnMine() {
  const side = Math.floor(Math.random() * 4)
  let x = 0, y = 0
  if (side === 0) { x = -20; y = 30 + Math.random() * (H - 60) }
  if (side === 1) { x = W + 20; y = 30 + Math.random() * (H - 60) }
  if (side === 2) { x = 30 + Math.random() * (W - 60); y = -20 }
  if (side === 3) { x = 30 + Math.random() * (W - 60); y = H + 20 }
  mines.push({ x, y, vx: (W / 2 - x) / 30, vy: (H / 2 - y) / 30, r: 8 + Math.random() * 6, wob: Math.random() * 6 })
}

Open.on('tick', (e) => {
  if (!alive) return
  const dt = Math.min(e.delta, 0.033)
  time += dt
  base += dt * 120
  mult = 1 + Math.floor(time / 12) * 0.5
  const score = Math.floor(base * mult)

  const up = Open.isKeyDown('ArrowUp') || Open.isKeyDown('w')
  const down = Open.isKeyDown('ArrowDown') || Open.isKeyDown('s')
  const left = Open.isKeyDown('ArrowLeft') || Open.isKeyDown('a')
  const right = Open.isKeyDown('ArrowRight') || Open.isKeyDown('d')
  if (up) vy -= THRUST * dt
  if (down) vy += THRUST * dt
  if (left) vx -= THRUST * dt
  if (right) vx += THRUST * dt
  vx *= Math.pow(FRICTION, dt * 60)
  vy *= Math.pow(FRICTION, dt * 60)
  const sp = Math.sqrt(vx * vx + vy * vy)
  if (sp > MAX_SPEED) { vx = vx / sp * MAX_SPEED; vy = vy / sp * MAX_SPEED }
  px += vx * dt
  py += vy * dt
  px = Math.max(14, Math.min(W - 14, px))
  py = Math.max(14, Math.min(H - 14, py))

  trail.push({ x: px, y: py })
  if (trail.length > 26) trail.shift()

  if (Math.random() < dt * 0.9) spawnMine()
  for (const m of mines) {
    m.x += m.vx * dt + Math.sin(Date.now() / 500 + m.wob) * 0.6
    m.y += m.vy * dt + Math.cos(Date.now() / 700 + m.wob) * 0.6
  }
  mines = mines.filter(m => m.x > -40 && m.x < W + 40 && m.y > -40 && m.y < H + 40)

  for (const m of mines) {
    const dx = px - m.x, dy = py - m.y
    if (dx * dx + dy * dy < (m.r + 12) * (m.r + 12)) {
      alive = 0
      Open.playSound('explode')
      Open.drawParticle(m.x, m.y, { color: '#ff5f57', count: 42, speed: 7, size: 4 })
      Open.drawParticle(px, py, { color: '#2bd4ff', count: 24, speed: 5, size: 3 })
      Open.postScore(Math.floor(base * mult))
    }
  }

  Open.drawRect(0, 0, W, H, '#0d1226')
  for (const s of stars) {
    const a = 0.35 + 0.3 * Math.sin(Date.now() / 900 + s.tw)
    Open.drawRect(s.x, s.y, s.r, s.r, a > 0.5 ? '#3b4f85' : '#223158')
  }

  for (let i = 0; i < trail.length - 1; i++) {
    const t = i / trail.length
    Open.drawLine(trail[i].x, trail[i].y, trail[i + 1].x, trail[i + 1].y, t > 0.5 ? '#fbf8fc' : '#2170e4', 2.5 * t + 0.5)
  }

  for (const m of mines) {
    const wob = Math.sin(Date.now() / 300 + m.wob) * 1.5
    Open.drawCircle(m.x, m.y + wob, m.r, '#b61722')
    Open.drawCircle(m.x, m.y + wob, m.r - 3, '#ffdad7')
    Open.drawCircle(m.x - m.r * 0.3, m.y + wob - m.r * 0.3, 2, '#fbf8fc')
  }

  const nose = Math.atan2(vy, vx)
  Open.drawLine(px, py, px + Math.cos(nose) * 18, py + Math.sin(nose) * 18, '#fbf8fc', 3)
  Open.drawLine(px + Math.cos(nose - 2.4) * 12, py + Math.sin(nose - 2.4) * 12, px, py, '#2bd4ff', 2)
  Open.drawLine(px + Math.cos(nose + 2.4) * 12, py + Math.sin(nose + 2.4) * 12, px, py, '#2bd4ff', 2)
  Open.drawCircle(px, py, 5, '#d8e2ff')

  Open.drawText('SCORE ' + score, 16, 26, '#eaf2ff', 16)
  Open.drawText('x' + mult.toFixed(1) + ' MULTIPLIER   +' + Math.floor(time) + 's AIRTIME', 16, 44, '#fea619', 13)
  if (sp > 40) Open.drawText('DRIFTING', W - 130, 26, '#2bd4ff', 13)

  if (!alive) {
    Open.drawText('WRECKED — SCORE ' + Math.floor(base * mult), 270, 200, '#ff5f57', 26)
  }
})`

// ─── 3 · ORBIT PAINTER ────────────────────────────────────────────────────────
// Paint with your orbit: every pass of the comet lays a new stroke of light.

const ORBIT_PAINTER_SHAPES: VectorShape[] = [
  createEllipse(400, 225, 84, 40, NEON_BLUE),
  createPolygon([{ x: 400, y: 110 }, { x: 420, y: 160 }, { x: 380, y: 160 }], NEON_AMBER),
  createText(36, 52, 'ORBIT PAINTER — steer the pen · the comet paints the grid', 17)
]

const ORBIT_PAINTER_CODE = `// ORBIT PAINTER — every orbit pass lays a new stroke of light
// hold arrows / WASD to steer · the comet paints · dodge the red corrections

const W = 800, H = 450, CELL = 16
const THRUST = 300, FRICTION = 0.988, MAX_SPEED = 200, ORBIT_R = 52

let px = 400, py = 225, vx = 0, vy = 0
let orbitA = 0, orbitV = 1.9
let score = 0, repaint = 0, ink = 0
let alive = 1, flashRed = 0
let painted = {}
let cells = 0
let reds = []
let stars = []
for (let i = 0; i < 30; i++) stars.push({ x: Math.random() * W, y: Math.random() * H, r: 0.5 + Math.random() * 1.4 })

Open.on('tick', (e) => {
  if (!alive) return
  const dt = Math.min(e.delta, 0.033)

  const left = Open.isKeyDown('ArrowLeft') || Open.isKeyDown('a')
  const right = Open.isKeyDown('ArrowRight') || Open.isKeyDown('d')
  const up = Open.isKeyDown('ArrowUp') || Open.isKeyDown('w')
  const down = Open.isKeyDown('ArrowDown') || Open.isKeyDown('s')
  if (left) vx -= THRUST * dt
  if (right) vx += THRUST * dt
  if (up) vy -= THRUST * dt
  if (down) vy += THRUST * dt
  vx *= Math.pow(FRICTION, dt * 60)
  vy *= Math.pow(FRICTION, dt * 60)
  const sp = Math.sqrt(vx * vx + vy * vy)
  if (sp > MAX_SPEED) { vx = vx / sp * MAX_SPEED; vy = vy / sp * MAX_SPEED }
  px += vx * dt
  py += vy * dt
  px = Math.max(12, Math.min(W - 12, px))
  py = Math.max(12, Math.min(H - 12, py))

  orbitA += orbitV * dt * 6
  const cx = px + Math.cos(orbitA) * ORBIT_R
  const cy = py + Math.sin(orbitA) * ORBIT_R * 0.55
  ink += dt
  if (ink > 0.35) {
    ink = 0
    const kx = Math.floor(cx / CELL), ky = Math.floor(cy / CELL)
    const key = kx + ':' + ky
    if (cx > 0 && cx < W && cy > 0 && cy < H) {
      if (!painted[key]) {
        painted[key] = 1
        cells += 1
        score += 10
      } else {
        repaint += 1
        score += 2
      }
      Open.postScore(score)
    }
  }

  if (Math.random() < dt * 0.28) {
    reds.push({ x: 40 + Math.random() * (W - 80), y: 60 + Math.random() * (H - 120), vx: (Math.random() - 0.5) * 34, vy: (Math.random() - 0.5) * 34, r: 7 + Math.random() * 6, life: 11 })
  }
  for (const r of reds) {
    r.x += r.vx * dt
    r.y += r.vy * dt
    r.life -= dt
    if (r.x < 6 || r.x > W - 6) r.vx *= -1
    if (r.y < 6 || r.y > H - 6) r.vy *= -1
  }
  reds = reds.filter(r => r.life > 0)

  for (const r of reds) {
    const dx = cx - r.x, dy = cy - r.y
    if (dx * dx + dy * dy < (r.r + 6) * (r.r + 6)) {
      r.life = 0
      flashRed = 0.5
      const wipe = Math.max(40, Math.floor(cells * 0.15))
      let keys = Object.keys(painted)
      for (let i = 0; i < wipe && keys.length > 0; i++) {
        delete painted[keys[keys.length - 1 - i]]
        cells -= 1
      }
      if (wipe > 40) score = Math.max(0, score - 250)
      Open.playSound('hit')
      Open.drawParticle(r.x, r.y, { color: '#b61722', count: 18, speed: 4, size: 3 })
      Open.postScore(score)
    }
  }

  Open.drawRect(0, 0, W, H, '#0d1226')
  for (let gx = 0; gx < W / CELL; gx++) {
    for (let gy = 0; gy < H / CELL; gy++) {
      if (painted[gx + ':' + gy]) {
        Open.drawRect(gx * CELL + 1, gy * CELL + 1, CELL - 2, CELL - 2, '#2170e4')
      }
    }
  }
  for (const s of stars) Open.drawRect(s.x, s.y, s.r, s.r, '#223158')

  for (const r of reds) {
    Open.drawCircle(r.x, r.y, r.r, '#b61722')
    Open.drawLine(r.x - r.r, r.y - r.r, r.x + r.r, r.y + r.r, '#ffdad7', 2)
    Open.drawLine(r.x + r.r, r.y - r.r, r.x - r.r, r.y + r.r, '#ffdad7', 2)
  }

  Open.drawCircle(cx, cy, 5, '#fea619')
  Open.drawCircle(cx, cy, 9, flashRed > 0 ? '#ff5f57' : '#fea619')
  Open.drawLine(px, py, cx, cy, '#fbf8fc', 1.5)
  Open.drawCircle(px, py, 12, flashRed > 0 ? '#ff5f57' : '#d8e2ff')
  Open.drawCircle(px, py, 4, '#fbf8fc')
  Open.drawCircle(px, py, ORBIT_R, '#2170e4')

  if (flashRed > 0) flashRed -= dt
  Open.drawText('SCORE ' + score, 16, 26, '#eaf2ff', 16)
  Open.drawText('CELLS ' + cells + '   TRAILS ' + repaint, 16, 44, '#fea619', 13)
})`

// ─── Catalog ──────────────────────────────────────────────────────────────────

export const OFFICIAL_GAMES: OfficialGameDef[] = [
  {
    id: 'official-grid-runner',
    title: 'Grid Runner',
    tagline: 'Jump, land, repeat — catch the gold.',
    description: 'A precision platformer with real physics: gravity, coyote time, jump buffering and solid floors. Chain the gold nodes to multiply your combo before it cools down. Fall and it is over.',
    controls: '← → move · SPACE jump · R restart',
    difficulty: 'pro',
    minutes: 15,
    priceUsd: 0,
    adsEnabled: true,
    plan: 'alpha',
    creatorId: 'openflash-team',
    creatorName: 'OpenFlash Team',
    shapes: GRID_RUNNER_SHAPES,
    code: GRID_RUNNER_CODE,
    thumbnail: paintThumb([
      svgRect(40, 300, 220, 20, '#2170e4'),
      svgRect(380, 230, 220, 20, '#0058be'),
      svgRect(160, 160, 150, 16, '#2170e4'),
      svgRect(40, 360, 560, 16, '#0058be'),
      svgCircle(500, 195, 12, '#fea619'),
      svgCircle(235, 130, 12, '#fea619'),
      svgCircle(470, 40, 10, '#0058be'),
      svgText(40, 60, 34, 'GRID RUNNER'),
      svgText(40, 88, 16, 'catch the gold — chain the combo')
    ])
  },
  {
    id: 'official-nova-drift',
    title: 'Nova Drift',
    tagline: 'Endless drift. One mistake ends it.',
    description: 'A vector arcade classic: thrust with real inertia, thread through drifting mines and watch your multiplier climb the longer you survive. Every second in the void is a second on the board.',
    controls: '← → ↑ ↓ / WASD thrust · R restart',
    difficulty: 'legend',
    minutes: 20,
    priceUsd: 1.99,
    adsEnabled: false,
    plan: 'beta',
    creatorId: 'openflash-team',
    creatorName: 'OpenFlash Team',
    shapes: NOVA_DRIFT_SHAPES,
    code: NOVA_DRIFT_CODE,
    thumbnail: paintThumb([
      svgCircle(320, 180, 26, '#b61722'),
      svgCircle(470, 240, 30, '#b61722'),
      svgCircle(250, 290, 20, '#b61722'),
      svgPolygon('400,120 420,150 380,150', '#0058be'),
      svgPolygon('400,120 414,140 386,140', '#fbf8fc'),
      '<path d="M348 172 Q400 150 452 172" stroke="#2bd4ff" stroke-width="3" fill="none"/>',
      svgText(40, 60, 34, 'NOVA DRIFT'),
      svgText(40, 88, 16, 'dodge the mines — chase the multiplier')
    ])
  },
  {
    id: 'official-orbit-painter',
    title: 'Orbit Painter',
    tagline: 'Every orbit pass lays a new stroke of light.',
    description: 'Steer a pen across the grid while a comet orbits your hull. First paint of a cell scores full points; repaints score less. Red corrections will erase your strokes — keep the canvas yours.',
    controls: '← → ↑ ↓ / WASD steer · R restart',
    difficulty: 'rookie',
    minutes: 10,
    priceUsd: 0,
    adsEnabled: true,
    plan: 'sigma',
    creatorId: 'openflash-team',
    creatorName: 'OpenFlash Team',
    shapes: ORBIT_PAINTER_SHAPES,
    code: ORBIT_PAINTER_CODE,
    thumbnail: paintThumb([
      '<ellipse cx="320" cy="190" rx="110" ry="52" fill="none" stroke="#0058be" stroke-width="3" stroke-dasharray="10 8"/>',
      '<circle cx="320" cy="190" r="14" fill="#0058be"/>',
      '<circle cx="224" cy="168" r="7" fill="#fea619"/>',
      svgRect(120, 120, 24, 14, '#2170e4'),
      svgRect(256, 96, 24, 14, '#2170e4'),
      svgRect(392, 128, 24, 14, '#2170e4'),
      svgRect(288, 208, 24, 14, '#2170e4'),
      svgCircle(452, 92, 12, '#b61722'),
      `<line x1="440" y1="80" x2="464" y2="104" stroke="#ffdad7" stroke-width="3"/>`,
      `<line x1="464" y1="80" x2="440" y2="104" stroke="#ffdad7" stroke-width="3"/>`,
      svgText(40, 60, 34, 'ORBIT PAINTER'),
      svgText(40, 88, 16, 'every pass lays a new stroke of light')
    ])
  }
]

export function getOfficialGame(id: string): OfficialGameDef | undefined {
  return OFFICIAL_GAMES.find(g => g.id === id)
}

export function createProjectFromOfficialGame(owner: string, id: string): string | null {
  const game = getOfficialGame(id)
  if (!game) return null
  const project = createEmptyProject(owner, game.title + ' (official)')
  project.shapes = game.shapes
  project.code = game.code
  project.autosave = true
  saveProject(project)
  return project.id
}