import { createEmptyProject, saveProject, ProjectData } from './projects'
import { createLayer, addKeyframe, TimelineState } from '../studio/engine/timeline'
import { publishGame, listPublishedGames } from './monetization/games'
import { recordRevenue } from './monetization/earnings'
import { VectorShape } from '../studio/engine/shapes'
import { PARTICLE_TEMPLATE, PLATFORMER_TEMPLATE, LOGO_TEMPLATE } from './templates'

const ARCADE_SEED_KEY = 'openflash_arcade_seeded_v1'
const WORKSPACE_SEED_KEY = 'openflash_workspace_seeded_v1'
const DEMO_CREATOR = 'creative-2024'

function makeTimeline(shapes: VectorShape[], frames: number): TimelineState {
  const layer = createLayer('Scene', '#FFD400')
  shapes.forEach((shape, i) => {
    addKeyframe(layer, i + 1, shape)
  })
  return {
    layers: [layer, createLayer('Guide', '#00E5FF')],
    currentFrame: 1,
    totalFrames: frames,
    fps: 60,
    loop: true
  }
}

function seedProject(owner: string, name: string, shapes: VectorShape[], code: string, frames: number): ProjectData {
  const p = createEmptyProject(owner, name)
  p.shapes = shapes
  p.code = code
  p.timeline = makeTimeline(shapes, frames)
  p.autosave = true
  saveProject(p)
  return p
}

function seedWorkspaceProjects(owner: string): void {
  if (typeof window === 'undefined') return
  if (localStorage.getItem(WORKSPACE_SEED_KEY)) return
  seedProject(owner, 'Particle Burst', PARTICLE_TEMPLATE.shapes, PARTICLE_TEMPLATE.code, 60)
  seedProject(owner, 'Platformer Starter', PLATFORMER_TEMPLATE.shapes, PLATFORMER_TEMPLATE.code, 72)
  seedProject(owner, 'Logo Sting', LOGO_TEMPLATE.shapes, LOGO_TEMPLATE.code, 48)
  localStorage.setItem(WORKSPACE_SEED_KEY, '1')
}

function seedWorkspaceEarnings(userId: string): void {
  const rows = [
    { game: 'Nova Drift', type: 'ad' as const, gross: 0.42, share: 50 },
    { game: 'Grid Runner', type: 'download' as const, gross: 1.99, share: 70 },
    { game: 'Nova Drift', type: 'ad' as const, gross: 0.2, share: 50 },
    { game: 'Orbit Painter', type: 'download' as const, gross: 0.99, share: 70 },
    { game: 'Grid Runner', type: 'ad' as const, gross: 0.31, share: 50 },
  ]
  const base = Date.now() - 6 * 24 * 60 * 60 * 1000
  rows.forEach((row, i) => {
    recordRevenue({
      userId,
      gameId: `seed-${i}`,
      gameTitle: row.game,
      type: row.type,
      grossUsd: row.gross,
      creatorSharePct: row.share
    })
  })
  void base
}

export function ensureArcadeSeed(): void {
  if (typeof window === 'undefined') return
  try {
    if (localStorage.getItem(ARCADE_SEED_KEY)) return
    if (listPublishedGames().length > 0) {
      localStorage.setItem(ARCADE_SEED_KEY, '1')
      return
    }
    const platformer = seedProject(DEMO_CREATOR, 'Grid Runner', PLATFORMER_TEMPLATE.shapes, PLATFORMER_TEMPLATE.code, 72)
    const drift = seedProject(DEMO_CREATOR, 'Nova Drift', PARTICLE_TEMPLATE.shapes, PARTICLE_TEMPLATE.code, 60)
    const orbit = seedProject(DEMO_CREATOR, 'Orbit Painter', LOGO_TEMPLATE.shapes, LOGO_TEMPLATE.code, 48)
    publishGame({
      projectId: platformer.id,
      title: 'Grid Runner',
      description: 'A precision platformer. Catch the golden node, keep the combo alive.',
      creatorId: DEMO_CREATOR,
      creatorName: 'OpenFlash Team',
      priceUsd: 0,
      adsEnabled: true,
      plan: 'alpha'
    })
    publishGame({
      projectId: drift.id,
      title: 'Nova Drift',
      description: 'Endless vector drift. Dodge the mines, chase the multiplier.',
      creatorId: DEMO_CREATOR,
      creatorName: 'OpenFlash Team',
      priceUsd: 1.99,
      adsEnabled: false,
      plan: 'beta'
    })
    publishGame({
      projectId: orbit.id,
      title: 'Orbit Painter',
      description: 'Draw with your orbit. Every pass lays a new stroke of light.',
      creatorId: DEMO_CREATOR,
      creatorName: 'OpenFlash Team',
      priceUsd: 0,
      adsEnabled: true,
      plan: 'sigma'
    })
    localStorage.setItem(ARCADE_SEED_KEY, '1')
  } catch (e) {
    console.error('Arcade seed failed:', e)
  }
}

export function ensureWorkspaceSeed(owner: string): void {
  if (typeof window === 'undefined') return
  seedWorkspaceProjects(owner)
  seedWorkspaceEarnings(owner)
}