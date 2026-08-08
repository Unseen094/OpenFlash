import { VectorShape } from '../studio/engine/shapes'
import { TimelineState, createLayer } from '../studio/engine/timeline'

export interface ProjectData {
  id: string
  name: string
  owner: string
  createdAt: number
  updatedAt: number
  shapes: VectorShape[]
  code: string
  timeline: TimelineState
  shaders: string[]
  autosave: boolean
}

const KEY_PREFIX = 'openflash_project_'
const INDEX_KEY = 'openflash_projects_index'

export interface ProjectMeta {
  id: string
  name: string
  owner: string
  createdAt: number
  updatedAt: number
  shapeCount: number
  codeLines: number
}

export function createEmptyProject(owner: string, name = 'Untitled Project'): ProjectData {
  const now = Date.now()
  return {
    id: `proj_${now.toString(36)}_${Math.random().toString(36).substring(2, 8)}`,
    name,
    owner,
    createdAt: now,
    updatedAt: now,
    shapes: [],
    code: '',
    timeline: {
      layers: [createLayer('Layer 1'), createLayer('Guide')],
      currentFrame: 1,
      totalFrames: 48,
      fps: 60,
      loop: true
    },
    shaders: [],
    autosave: false
  }
}

function getIndex(): string[] {
  try {
    const raw = localStorage.getItem(INDEX_KEY)
    return raw ? JSON.parse(raw) : []
    } catch (e) {
      console.error('[projects] Failed to parse project index:', e)
      return []
    }
}

function setIndex(ids: string[]): void {
  localStorage.setItem(INDEX_KEY, JSON.stringify(ids))
}

export function listProjects(owner: string): ProjectMeta[] {
  const metas: ProjectMeta[] = []
  for (const id of getIndex()) {
    const raw = localStorage.getItem(KEY_PREFIX + id)
    if (!raw) continue
    try {
      const p: ProjectData = JSON.parse(raw)
      if (p.owner !== owner) continue
      metas.push({
        id: p.id,
        name: p.name,
        owner: p.owner,
        createdAt: p.createdAt,
        updatedAt: p.updatedAt,
        shapeCount: p.shapes.length,
        codeLines: p.code ? p.code.split('\n').length : 0
      })
    } catch (e) {
      console.error('[projects] Failed to parse project data:', e)
    }
  }
  metas.sort((a, b) => b.updatedAt - a.updatedAt)
  return metas
}

export function loadProject(id: string): ProjectData | null {
  try {
    const raw = localStorage.getItem(KEY_PREFIX + id)
    if (!raw) return null
    const p = JSON.parse(raw) as ProjectData
    return {
      ...p,
      timeline: {
        ...p.timeline,
        layers: p.timeline.layers.map(l => ({ ...l, keyframes: l.keyframes || [] }))
      },
      shaders: p.shaders || [],
      autosave: p.autosave ?? false
    }
  } catch (e) {
    return null
  }
}

export function saveProject(project: ProjectData): void {
  const updated: ProjectData = { ...project, updatedAt: Date.now() }
  localStorage.setItem(KEY_PREFIX + updated.id, JSON.stringify(updated))
  const index = getIndex()
  if (!index.includes(updated.id)) {
    index.push(updated.id)
    setIndex(index)
  }
}

export function renameProject(id: string, name: string): void {
  const p = loadProject(id)
  if (!p) return
  saveProject({ ...p, name: name.trim() || p.name })
}

export function deleteProject(id: string): void {
  localStorage.removeItem(KEY_PREFIX + id)
  setIndex(getIndex().filter(x => x !== id))
}

export function exportProjectJson(project: ProjectData): string {
  return JSON.stringify(project, null, 2)
}

export function importProjectJson(json: string, owner: string): ProjectData | null {
  try {
    const data = JSON.parse(json)
    if (!data || typeof data !== 'object' || !Array.isArray(data.shapes)) return null
    const now = Date.now()
    const project: ProjectData = {
      id: data.id && data.id.startsWith('proj_') ? data.id : `proj_${now.toString(36)}_${Math.random().toString(36).substring(2, 8)}`,
      name: typeof data.name === 'string' && data.name ? data.name : 'Imported Project',
      owner,
      createdAt: data.createdAt || now,
      updatedAt: now,
      shapes: data.shapes,
      code: typeof data.code === 'string' ? data.code : '',
      timeline: data.timeline || createEmptyProject(owner).timeline,
      shaders: Array.isArray(data.shaders) ? data.shaders : [],
      autosave: false
    }
    saveProject(project)
    return project
  } catch (e) {
    return null
  }
}
