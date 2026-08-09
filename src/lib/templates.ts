import { createEmptyProject, saveProject, ProjectData } from './projects'
import { createRectangle, createEllipse, createPolygon, createText, VectorShape } from '../studio/engine/shapes'

export type TemplateDifficulty = 'rookie' | 'pro' | 'legend'

export interface TemplateDef {
  id: string
  name: string
  tagline: string
  description: string
  tags: string[]
  difficulty: TemplateDifficulty
  minutes: number
  shapes: VectorShape[]
  code: string
}

const NEON_AMBER = { r: 255, g: 212, b: 0, a: 1 }
const NEON_CYAN = { r: 0, g: 229, b: 255, a: 1 }
const NEON_PINK = { r: 255, g: 46, b: 179, a: 1 }
const NEON_GREEN = { r: 22, g: 240, b: 140, a: 1 }

const PARTICLE_STARTER: VectorShape[] = [
  createEllipse(400, 225, 18, 18, NEON_AMBER),
  createEllipse(300, 160, 8, 8, NEON_CYAN),
  createEllipse(520, 120, 8, 8, NEON_PINK),
  createEllipse(240, 320, 8, 8, NEON_GREEN),
  createEllipse(560, 340, 8, 8, NEON_CYAN)
]

const PLATFORMER_STARTER: VectorShape[] = [
  createRectangle(320, 60, 160, 32, NEON_AMBER),
  createRectangle(60, 320, 260, 24, NEON_CYAN),
  createRectangle(420, 250, 260, 24, NEON_CYAN),
  createRectangle(200, 180, 140, 16, NEON_PINK),
  createText(36, 60, 'jump with SPACE / W — track the coin', 15)
]

const LOGO_STARTER: VectorShape[] = [
  createPolygon([
    { x: 400, y: 120 },
    { x: 472, y: 240 },
    { x: 328, y: 240 }
  ], NEON_AMBER),
  createEllipse(400, 320, 90, 36, NEON_CYAN),
  createText(300, 60, 'OPENFLASH', 30)
]

const SHOOTER_STARTER: VectorShape[] = [
  createRectangle(389, 400, 22, 40, NEON_CYAN),
  createEllipse(200, 120, 26, 26, NEON_PINK),
  createEllipse(480, 90, 20, 20, NEON_GREEN),
  createEllipse(620, 160, 24, 24, NEON_AMBER),
  createText(36, 44, 'aim with mouse — hold to fire', 15)
]

const COIN_STARTER: VectorShape[] = [
  createRectangle(388, 400, 24, 24, NEON_AMBER),
  createEllipse(300, 60, 10, 10, NEON_CYAN),
  createEllipse(520, 60, 10, 10, NEON_CYAN),
  createText(36, 44, 'arrows to catch — chain the combo', 15)
]

const GRAVITY_STARTER: VectorShape[] = [
  createRectangle(74, 200, 12, 24, NEON_AMBER),
  createRectangle(700, 60, 18, 200, NEON_PINK),
  createText(36, 44, 'hold SPACE to fly — survive the gaps', 15)
]

export const PARTICLE_TEMPLATE: TemplateDef = {
  id: 'particle-burst',
  name: 'Particle Burst',
  tagline: 'One click, thirty sparks.',
  description: 'The classic first game. Click anywhere and the screen erupts. Learn events, the draw loop and how score travels up to the arcade leaderboard.',
  tags: ['starter', 'events', 'score'],
  difficulty: 'rookie',
  minutes: 5,
  shapes: PARTICLE_STARTER,
  code: `// particle demo — click to burst
let waves = 0

const burst = () => {
  waves += 1
  Open.postScore(waves)
  for (let i = 0; i < 30; i++) {
    Open.drawCircle(
      Math.random() * 800,
      Math.random() * 450,
      2 + Math.random() * 3,
      ['#FFD400', '#00E5FF', '#FF2EB3'][Math.floor(Math.random() * 3)]
    )
  }
}

Open.on('pointerDown', burst)
Open.on('tick', () => {
  Open.drawCircle(
    400 + Math.sin(Date.now() / 300) * 120,
    225 + Math.cos(Date.now() / 400) * 80,
    14,
    '#FFD400'
  )
})`
}

export const PLATFORMER_TEMPLATE: TemplateDef = {
  id: 'grid-runner',
  name: 'Grid Runner',
  tagline: 'Jump, land, repeat.',
  description: 'A precision platformer with real physics: gravity, solid floors and a golden goal. Every coin adds one point straight to your arcade board.',
  tags: ['physics', 'platformer', 'score'],
  difficulty: 'pro',
  minutes: 15,
  shapes: PLATFORMER_STARTER,
  code: `// mini platformer — arrow keys + space
const player = Open.createSprite({ name: 'hero', x: 120, y: 300, width: 26, height: 26, color: '#FFD400' })
let vy = 0
let grounded = false
let score = 0

const floorY = (sprite) => {
  const solids = [
    { x: 60, y: 320, w: 260, h: 24 },
    { x: 420, y: 250, w: 260, h: 24 },
    { x: 200, y: 180, w: 140, h: 16 }
  ]
  return solids.find(s => {
    const overlapX = sprite.x < s.x + s.w && sprite.x + sprite.width > s.x
    const overlapY = sprite.y + sprite.height >= s.y && sprite.y + sprite.height <= s.y + s.h + 8
    return overlapX && overlapY
  })
}

Open.on('keyDown', (e) => {
  if (e.key === 'ArrowLeft') player.x -= 6
  if (e.key === 'ArrowRight') player.x += 6
  if ((e.key === ' ' || e.key === 'w') && grounded) {
    vy = -9
    grounded = false
    Open.playSound('jump')
  }
})

Open.on('tick', (e) => {
  vy += e.delta * 0.45
  player.y += vy
  const solid = floorY(player)
  if (solid) {
    player.y = solid.y - player.height
    vy = 0
    grounded = true
  }
  if (player.x < 300 && player.y < 100) {
    score += 1
    player.x = 120
    player.y = 300
    Open.playSound('shoot')
    Open.postScore(score)
  }
  Open.drawText('SCORE ' + score, 16, 24, '#00E5FF', 16)
})`
}

export const LOGO_TEMPLATE: TemplateDef = {
  id: 'orbit-painter',
  name: 'Orbit Painter',
  tagline: 'A logo that never sits still.',
  description: 'An animated sting for intros and menus: a spinning mark, a drifting orb, a little "est. 2026". Swap in your own shapes and colors.',
  tags: ['animation', 'branding'],
  difficulty: 'rookie',
  minutes: 8,
  shapes: LOGO_STARTER,
  code: `// logo sting — spins the mark
let rot = 0

Open.on('tick', (e) => {
  rot += e.delta * 0.002
  Open.drawRect(0, 0, 800, 450, '#0A0B0E')
  Open.drawText('OPENFLASH', 330, 230, '#FFD400', 28)
  Open.drawText('est. 2026', 340, 260, '#00E5FF', 13)
  Open.drawCircle(
    400 + Math.cos(rot) * 140,
    225 + Math.sin(rot) * 60,
    10,
    '#FF2EB3'
  )
})`
}

export const SHOOTER_TEMPLATE: TemplateDef = {
  id: 'neon-shooter',
  name: 'Neon Shooter',
  tagline: 'Hold to fire. Don\'t let one through.',
  description: 'Aiming comes from mouse position, targets rain down from the top. Score lands on the arcade board the second you hit something.',
  tags: ['shooter', 'mouse', 'score'],
  difficulty: 'pro',
  minutes: 20,
  shapes: SHOOTER_STARTER,
  code: `// neon shooter — aim with mouse, hold to fire
let targets = []
let shots = []
let firing = false
let combo = 0

Open.on('pointerDown', () => { firing = true })
Open.on('pointerUp', () => { firing = false })

Open.on('tick', (e) => {
  if (Math.random() < 0.02) {
    targets.push({ x: 20 + Math.random() * 760, y: 20, r: 7 + Math.random() * 9, hit: false })
  }

  for (const t of targets) {
    t.y += e.delta * 45
    if (!t.hit) Open.drawCircle(t.x, t.y, t.r, '#FF2EB3')
  }
  targets = targets.filter(t => t.y < 460 && !t.hit)

  if (firing) shots.push({ x: 400, y: 405 })
  for (const s of shots) {
    s.y -= e.delta * 560
    Open.drawRect(s.x - 2, s.y, 4, 12, '#FFD400')
    for (const t of targets) {
      if (!t.hit && (s.x - t.x) ** 2 + (s.y - t.y) ** 2 < (t.r + 6) ** 2) {
        t.hit = true
        combo += 100
        Open.postScore(combo)
        Open.playSound('explode')
      }
    }
  }
  shots = shots.filter(s => s.y > 0)
})`
}

export const COIN_TEMPLATE: TemplateDef = {
  id: 'coin-combo',
  name: 'Coin Combo',
  tagline: 'Chain the streak before it burns.',
  description: 'Arcade catch mechanics with a timer on your combo. The streak decays after three quiet seconds — keep moving or lose it all.',
  tags: ['catch', 'combo', 'score'],
  difficulty: 'rookie',
  minutes: 10,
  shapes: COIN_STARTER,
  code: `// coin combo — arrows to catch, chain the streak
const hero = Open.createSprite({ name: 'hero', x: 400, y: 400, width: 24, height: 24, color: '#FFD400' })
let coins = []
let streak = 0
let best = 0
let since = 0

Open.on('keyDown', (e) => {
  if (e.key === 'ArrowLeft') hero.x -= 26
  if (e.key === 'ArrowRight') hero.x += 26
})

Open.on('tick', (e) => {
  since += e.delta
  if (since > 3) { streak = 0; since = 0 }

  if (Math.random() < 0.04) coins.push({ x: 30 + Math.random() * 740, y: 0 })
  for (const c of coins) c.y += e.delta * 120
  for (const c of coins) Open.drawCircle(c.x, c.y, 9, '#00E5FF')
  coins = coins.filter(c => c.y < 460)

  for (const c of coins) {
    if (Math.abs(c.x - hero.x) < 26 && Math.abs(c.y - hero.y) < 26) {
      streak += 1
      best = Math.max(best, streak)
      Open.postScore(best * 50)
      Open.playSound('jump')
    }
  }
  coins = coins.filter(c => !(Math.abs(c.x - hero.x) < 26 && Math.abs(c.y - hero.y) < 26))

  Open.drawText('STREAK ' + streak + '  BEST ' + best, 16, 28, '#FFD400', 16)
})`
}

export const GRAVITY_TEMPLATE: TemplateDef = {
  id: 'gravity-bounce',
  name: 'Gravity Bounce',
  tagline: 'One button. No pity.',
  description: 'The flappy-style classic: hold SPACE to rise against gravity, thread the gaps between neon beams. Each second alive is a point.',
  tags: ['one-button', 'endless', 'score'],
  difficulty: 'legend',
  minutes: 20,
  shapes: GRAVITY_STARTER,
  code: `// gravity bounce — hold SPACE to fly, dodge the beams
let y = 200
let vy = 0
let alive = 1
let score = 0
let beams = []
let hold = 0

Open.on('keyDown', (e) => { if (e.key === ' ' || e.key === 'w') hold = 1 })
Open.on('keyUp', (e) => { if (e.key === ' ' || e.key === 'w') hold = 0 })

Open.on('tick', (e) => {
  if (!alive) return

  vy += (hold ? -260 : 280) * e.delta
  y += vy * e.delta
  if (y < 30) { y = 30; vy = 0 }
  if (y > 430) { alive = 0; Open.postScore(score); return }

  if (Math.random() < 0.012) {
    beams.push({ x: 830, gap: 90 + Math.random() * 90, y: 60 + Math.random() * 300 })
  }
  beams = beams.filter(b => b.x > -30)
  for (const b of beams) {
    b.x -= e.delta * 200
    Open.drawRect(b.x, 0, 18, b.y - b.gap / 2, '#FF2EB3')
    Open.drawRect(b.x, b.y + b.gap / 2, 18, 450 - b.y - b.gap / 2, '#FF2EB3')
    if (Math.abs(b.x - 80) < 24 && Math.abs(y - b.y) < b.gap / 2) {
      alive = 0
      Open.postScore(score)
      Open.playSound('explode')
    }
  }

  score += 1
  Open.drawCircle(80, y, 12, '#FFD400')
  Open.drawText('SCORE ' + score, 16, 28, '#00E5FF', 16)
})`
}

const TEMPLATES: TemplateDef[] = [
  PARTICLE_TEMPLATE,
  PLATFORMER_TEMPLATE,
  LOGO_TEMPLATE,
  SHOOTER_TEMPLATE,
  COIN_TEMPLATE,
  GRAVITY_TEMPLATE
]

export function listTemplates(): TemplateDef[] {
  return TEMPLATES
}

export function getTemplate(id: string): TemplateDef | undefined {
  return TEMPLATES.find(t => t.id === id)
}

export function createProjectFromTemplate(owner: string, templateId: string): ProjectData | null {
  const template = getTemplate(templateId)
  if (!template) return null
  const project = createEmptyProject(owner, template.name)
  project.shapes = template.shapes
  project.code = template.code
  project.autosave = true
  saveProject(project)
  return project
}