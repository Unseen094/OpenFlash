import { z } from 'zod'
import { createRepository, Result, formatStorageError } from './storage/repository'
import { getStorageProvider, setStorageProvider, LocalStorageProvider, StorageProvider } from './storage/StorageProvider'
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
  version: number
}

const CURRENT_VERSION = 1

const Vector2Schema = z.object({
  x: z.number(),
  y: z.number()
})

const TransformSchema = z.object({
  x: z.number(),
  y: z.number(),
  scaleX: z.number(),
  scaleY: z.number(),
  rotation: z.number(),
  alpha: z.number()
})

const ColorSchema = z.object({
  r: z.number(),
  g: z.number(),
  b: z.number(),
  a: z.number()
})

const BoundsSchema = z.object({
  minX: z.number(),
  minY: z.number(),
  maxX: z.number(),
  maxY: z.number()
})

const FillStyleSchema: z.ZodType<any> = z.object({
  type: z.enum(['solid', 'linear', 'radial']),
  color: ColorSchema,
  gradient: z.object({
    stops: z.array(z.object({ offset: z.number(), color: ColorSchema })),
    angle: z.number().optional(),
    startPoint: Vector2Schema.optional(),
    endPoint: Vector2Schema.optional()
  }).optional()
})

const StrokeStyleSchema: z.ZodType<any> = z.object({
  color: ColorSchema,
  width: z.number(),
  cap: z.enum(['butt', 'round', 'square']),
  join: z.enum(['miter', 'round', 'bevel']),
  dashArray: z.array(z.number()).optional()
})

const FilterStyleSchema: z.ZodType<any> = z.object({
  blur: z.number().optional(),
  glow: z.object({ color: ColorSchema, radius: z.number(), strength: z.number() }).optional(),
  dropShadow: z.object({ color: ColorSchema, offsetX: z.number(), offsetY: z.number(), blur: z.number() }).optional(),
  brightness: z.number().optional(),
  contrast: z.number().optional()
})

const VectorShapeSchema: z.ZodType<any> = z.lazy(() => z.object({
  id: z.string(),
  type: z.enum(['rectangle', 'ellipse', 'polygon', 'path', 'text', 'bitmap', 'group']),
  name: z.string(),
  transform: TransformSchema,
  fill: FillStyleSchema.optional(),
  stroke: StrokeStyleSchema.optional(),
  filters: FilterStyleSchema.optional(),
  visible: z.boolean(),
  locked: z.boolean(),
  points: z.array(Vector2Schema).optional(),
  closed: z.boolean().optional(),
  text: z.string().optional(),
  fontSize: z.number().optional(),
  fontFamily: z.string().optional(),
  children: z.array(VectorShapeSchema).optional(),
  bounds: BoundsSchema.optional()
}))

const KeyframeSchema: z.ZodType<any> = z.object({
  frame: z.number(),
  shape: VectorShapeSchema,
  tweenType: z.enum(['motion', 'shape', 'none']),
  tweenEasing: z.number(),
  tweenPath: z.array(z.object({ x: z.number(), y: z.number() })).optional()
})

const LayerSchema: z.ZodType<any> = z.object({
  id: z.string(),
  name: z.string(),
  visible: z.boolean(),
  locked: z.boolean(),
  keyframes: z.array(KeyframeSchema),
  color: z.string()
})

const TimelineSchema: z.ZodType<any> = z.object({
  layers: z.array(LayerSchema),
  currentFrame: z.number(),
  totalFrames: z.number(),
  fps: z.number(),
  loop: z.boolean()
})

const ProjectDataSchema: z.ZodType<ProjectData> = z.object({
  id: z.string(),
  name: z.string().max(200),
  owner: z.string(),
  createdAt: z.number(),
  updatedAt: z.number(),
  shapes: z.array(VectorShapeSchema),
  code: z.string().max(100000),
  timeline: TimelineSchema,
  shaders: z.array(z.string()),
  autosave: z.boolean(),
  version: z.number()
})

export { setStorageProvider, LocalStorageProvider }
export type { StorageProvider }

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

const indexRepo = createRepository<string[]>(INDEX_KEY, z.array(z.string()))

function sanitizeForPrototypePollution(data: unknown): unknown {
  if (Array.isArray(data)) {
    return data.map(sanitizeForPrototypePollution)
  }
  if (data !== null && typeof data === 'object') {
    const clean: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
      if (key === '__proto__' || key === 'constructor' || key === 'prototype') continue
      clean[key] = sanitizeForPrototypePollution(value)
    }
    return clean
  }
  return data
}

export function migrateProject(data: any): ProjectData {
  if (!data || typeof data !== 'object') {
    throw new Error('Invalid project data')
  }
  if (data.version === 1) {
    return data as ProjectData
  }
  const migrated: any = { ...data }
  if (!migrated.version) {
    migrated.version = 1
    migrated.autosave = migrated.autosave ?? false
    migrated.shaders = Array.isArray(migrated.shaders) ? migrated.shaders : []
    migrated.timeline = migrated.timeline ?? {
      layers: [createLayer('Layer 1'), createLayer('Guide')],
      currentFrame: 1,
      totalFrames: 48,
      fps: 60,
      loop: true
    }
  }
  return migrated as ProjectData
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
    autosave: false,
    version: CURRENT_VERSION
  }
}

function getProjectRepo(id: string) {
  return createRepository<ProjectData>(KEY_PREFIX + id, ProjectDataSchema)
}

function getIndex(): string[] {
  return indexRepo.readOrDefault([])
}

function setIndex(ids: string[]): Result<void> {
  return indexRepo.write(ids)
}

export function listProjects(owner: string): ProjectMeta[] {
  const metas: ProjectMeta[] = []
  for (const id of getIndex()) {
    const repo = getProjectRepo(id)
    const result = repo.read()
    if (!result.ok) continue
    const p = result.value
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
  }
  metas.sort((a, b) => b.updatedAt - a.updatedAt)
  return metas
}

export function loadProject(id: string): ProjectData | null {
  const repo = getProjectRepo(id)
  const result = repo.read()
  if (!result.ok) return null
  try {
    return migrateProject(result.value)
  } catch {
    return null
  }
}

export function saveProject(project: ProjectData): Result<void> {
  const updated: ProjectData = { ...project, updatedAt: Date.now(), version: CURRENT_VERSION }
  const repo = getProjectRepo(updated.id)
  const writeResult = repo.write(updated)
  if (!writeResult.ok) return writeResult
  const index = getIndex()
  if (!index.includes(updated.id)) {
    index.push(updated.id)
    const idxResult = setIndex(index)
    if (!idxResult.ok) return idxResult
  }
  return { ok: true, value: undefined }
}

export function renameProject(id: string, name: string): Result<void> {
  const p = loadProject(id)
  if (!p) return { ok: false, error: { type: 'parse', message: 'Project not found' } }
  const result = saveProject({ ...p, name: name.trim() || p.name })
  return result
}

export function deleteProject(id: string): void {
  const repo = getProjectRepo(id)
  repo.clear()
  const index = getIndex().filter(x => x !== id)
  setIndex(index)
}

export function exportProjectJson(project: ProjectData): string {
  return JSON.stringify(project, null, 2)
}

export function importProjectJson(json: string, owner: string): ProjectData | null {
  try {
    const raw = JSON.parse(json)
    const clean = sanitizeForPrototypePollution(raw) as Record<string, unknown>
    const now = Date.now()
    const project: ProjectData = {
      id: typeof clean.id === 'string' && clean.id.startsWith('proj_')
        ? clean.id
        : `proj_${now.toString(36)}_${Math.random().toString(36).substring(2, 8)}`,
      name: typeof clean.name === 'string' && clean.name ? clean.name.slice(0, 200) : 'Imported Project',
      owner,
      createdAt: typeof clean.createdAt === 'number' ? clean.createdAt : now,
      updatedAt: now,
      shapes: Array.isArray(clean.shapes) ? clean.shapes as VectorShape[] : [],
      code: typeof clean.code === 'string' ? clean.code.slice(0, 100000) : '',
      timeline: clean.timeline && typeof clean.timeline === 'object'
        ? clean.timeline as TimelineState
        : createEmptyProject(owner).timeline,
      shaders: Array.isArray(clean.shaders) ? clean.shaders as string[] : [],
      autosave: false,
      version: CURRENT_VERSION
    }
    const validation = ProjectDataSchema.safeParse(project)
    if (!validation.success) return null
    saveProject(project)
    return project
  } catch {
    return null
  }
}
