import { Vector2, generateId } from './math'
import { VectorShape } from './shapes'
import { getShapeBounds } from './canvas-features'

export interface Selection {
  ids: Set<string>
  feather: number
  inverted: boolean
}

export const createSelection = (): Selection => ({
  ids: new Set(),
  feather: 0,
  inverted: false
})

export const selectAll = (shapes: VectorShape[]): Set<string> =>
  new Set(shapes.map(s => s.id))

export const invertSelection = (shapes: VectorShape[], current: Set<string>): Set<string> =>
  new Set(shapes.map(s => s.id).filter(id => !current.has(id)))

export const selectByColor = (shapes: VectorShape[], targetColor: string, tolerance = 30): Set<string> => {
  const result = new Set<string>()
  for (const s of shapes) {
    if (s.fill && colorsMatch(s.fill.color, targetColor, tolerance)) {
      result.add(s.id)
    }
  }
  return result
}

const colorsMatch = (c: { r: number; g: number; b: number }, hex: string, tolerance: number): boolean => {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return Math.abs(c.r - r) <= tolerance && Math.abs(c.g - g) <= tolerance && Math.abs(c.b - b) <= tolerance
}

export const expandSelection = (shapes: VectorShape[], ids: Set<string>, amount: number): Set<string> => {
  const result = new Set(ids)
  for (const s of shapes) {
    if (ids.has(s.id)) continue
    const sb = getShapeBounds(s)
    for (const id of ids) {
      const shape = shapes.find(sh => sh.id === id)
      if (!shape) continue
      const b = getShapeBounds(shape)
      if (rectsOverlapExpand(b, sb, amount)) {
        result.add(s.id)
        break
      }
    }
  }
  return result
}

const rectsOverlapExpand = (a: { minX: number; minY: number; maxX: number; maxY: number }, b: { minX: number; minY: number; maxX: number; maxY: number }, expand: number): boolean =>
  !(a.maxX + expand < b.minX || a.minX - expand > b.maxX || a.maxY + expand < b.minY || a.minY - expand > b.maxY)

export const lassoSelect = (shapes: VectorShape[], lassoPoints: Vector2[]): Set<string> => {
  const result = new Set<string>()
  for (const s of shapes) {
    if (s.points && s.points.length > 0) {
      const allInside = s.points.every(p => pointInPolygon(p, lassoPoints))
      if (allInside) result.add(s.id)
    } else {
      const cx = s.transform.x, cy = s.transform.y
      if (pointInPolygon({ x: cx, y: cy }, lassoPoints)) result.add(s.id)
    }
  }
  return result
}

const pointInPolygon = (point: Vector2, polygon: Vector2[]): boolean => {
  let inside = false
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].x, yi = polygon[i].y
    const xj = polygon[j].x, yj = polygon[j].y
    if ((yi > point.y) !== (yj > point.y) && point.x < (xj - xi) * (point.y - yi) / (yj - yi) + xi) {
      inside = !inside
    }
  }
  return inside
}

export const marqueeSelect = (shapes: VectorShape[], rect: { x: number; y: number; w: number; h: number }): Set<string> => {
  const result = new Set<string>()
  const r2 = { minX: Math.min(rect.x, rect.x + rect.w), minY: Math.min(rect.y, rect.y + rect.h), maxX: Math.max(rect.x, rect.x + rect.w), maxY: Math.max(rect.y, rect.y + rect.h) }
  for (const s of shapes) {
    const b = getShapeBounds(s)
    if (!(b.maxX < r2.minX || b.minX > r2.maxX || b.maxY < r2.minY || b.minY > r2.maxY)) {
      result.add(s.id)
    }
  }
  return result
}

export const groupShapes = (shapes: VectorShape[], ids: Set<string>): VectorShape[] => {
  const toGroup = shapes.filter(s => ids.has(s.id))
  if (toGroup.length < 2) return shapes
  const groupId = generateId()
  const remaining = shapes.filter(s => !ids.has(s.id))
  const minX = Math.min(...toGroup.map(s => getShapeBounds(s).minX))
  const minY = Math.min(...toGroup.map(s => getShapeBounds(s).minY))
  const group: VectorShape = {
    id: groupId, type: 'group', name: 'Group', transform: { x: minX, y: minY, scaleX: 1, scaleY: 1, rotation: 0, alpha: 1 },
    visible: true, locked: false, children: toGroup, closed: true,
    fill: { type: 'solid', color: { r: 0, g: 0, b: 0, a: 0 } },
    stroke: { color: { r: 0, g: 0, b: 0, a: 0 }, width: 0, cap: 'round', join: 'round' },
    points: []
  }
  return [...remaining, group]
}

export const ungroupShapes = (shapes: VectorShape[], groupId: string): VectorShape[] => {
  const result: VectorShape[] = []
  for (const s of shapes) {
    if (s.id === groupId && s.type === 'group' && s.children) {
      result.push(...s.children)
    } else {
      result.push(s)
    }
  }
  return result
}
