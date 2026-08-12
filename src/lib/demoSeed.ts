import { createEmptyProject, saveProject, ProjectData } from './projects'
import { createLayer, addKeyframe, TimelineState } from '../studio/engine/timeline'
import { publishGame } from './monetization/games'
import { OFFICIAL_GAMES, getOfficialGame } from './officialGames'
import { VectorShape } from '../studio/engine/shapes'

const ARCADE_SEED_KEY = 'openflash_arcade_seeded_v2'
const DEMO_CREATOR = 'openflash-team'

function makeTimeline(shapes: VectorShape[], frames: number): TimelineState {
  const layer = createLayer('Scene', '#0058be')
  shapes.forEach((shape, i) => {
    addKeyframe(layer, i + 1, shape)
  })
  return {
    layers: [layer, createLayer('Guide', '#d8e2ff')],
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

/**
 * Seeds the three official OpenFlash games into the arcade. Games published
 * from the official catalog keep the official game id, so PlayPage resolves
 * their code from the catalog directly and never depends on the seeded
 * project surviving a storage wipe.
 */
export function ensureArcadeSeed(): void {
  if (typeof window === 'undefined') return
  try {
    if (localStorage.getItem(ARCADE_SEED_KEY)) return
    let seeded = 0
    for (const game of OFFICIAL_GAMES) {
      if (getOfficialGame(game.id) === undefined) continue
      const project = seedProject(DEMO_CREATOR, game.title, game.shapes, game.code, 64)
      publishGame({
        id: game.id,
        projectId: project.id,
        title: game.title,
        description: game.description,
        creatorId: game.creatorId,
        creatorName: game.creatorName,
        priceUsd: game.priceUsd,
        adsEnabled: game.adsEnabled,
        plan: game.plan,
        thumbnail: game.thumbnail
      })
      seeded += 1
    }
    if (seeded > 0) {
      localStorage.setItem(ARCADE_SEED_KEY, '1')
    }
  } catch (e) {
    console.error('Arcade seed failed:', e)
  }
}

/** No-op now — the workspace starts clean; official games are available from the hub. */
export function ensureWorkspaceSeed(_owner: string): void {
  return
}