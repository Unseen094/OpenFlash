import { Vector2, Transform, generateId } from './math'
import { VectorShape } from './shapes'

export const CANVAS_PRESETS = [
  { label: '1920×1080', width: 1920, height: 1080 },
  { label: '1280×720', width: 1280, height: 720 },
  { label: '800×600', width: 800, height: 600 },
  { label: '800×450', width: 800, height: 450 },
  { label: '640×480', width: 640, height: 480 },
  { label: '512×512', width: 512, height: 512 },
  { label: '1080×1080', width: 1080, height: 1080 },
  { label: '1024×768', width: 1024, height: 768 }
]

export const snapPoint = (point: Vector2, gridSize: number): Vector2 => ({
  x: Math.round(point.x / gridSize) * gridSize,
  y: Math.round(point.y / gridSize) * gridSize
})

export const constrainAspectRatio = (w: number, h: number): { w: number; h: number } => {
  const size = Math.max(Math.abs(w), Math.abs(h))
  return { w: Math.sign(w) * size, h: Math.sign(h) * size }
}

export const alignShapes = (shapes: VectorShape[], mode: 'left' | 'right' | 'top' | 'bottom' | 'center-h' | 'center-v', canvasW: number, canvasH: number): VectorShape[] => {
  if (shapes.length === 0) return shapes
  const bounds = getShapesBounds(shapes)
  return shapes.map(s => {
    const sb = getShapeBounds(s)
    let dx = 0, dy = 0
    switch (mode) {
      case 'left': dx = bounds.minX - sb.minX; break
      case 'right': dx = bounds.maxX - sb.maxX; break
      case 'top': dy = bounds.minY - sb.minY; break
      case 'bottom': dy = bounds.maxY - sb.maxY; break
      case 'center-h': dx = (bounds.minX + bounds.maxX) / 2 - (sb.minX + sb.maxX) / 2; break
      case 'center-v': dy = (bounds.minY + bounds.maxY) / 2 - (sb.minY + sb.maxY) / 2; break
    }
    return { ...s, transform: { ...s.transform, x: s.transform.x + dx, y: s.transform.y + dy } }
  })
}

export const distributeShapes = (shapes: VectorShape[], mode: 'horizontal' | 'vertical'): VectorShape[] => {
  if (shapes.length < 3) return shapes
  const sorted = [...shapes].sort((a, b) =>
    mode === 'horizontal' ? a.transform.x - b.transform.x : a.transform.y - b.transform.y
  )
  const first = sorted[0]
  const last = sorted[sorted.length - 1]
  const firstB = getShapeBounds(first)
  const lastB = getShapeBounds(last)
  const totalSpace = mode === 'horizontal'
    ? (lastB.maxX - firstB.minX) - sorted.reduce((sum, s) => sum + (getShapeBounds(s).maxX - getShapeBounds(s).minX), 0)
    : (lastB.maxY - firstB.minY) - sorted.reduce((sum, s) => sum + (getShapeBounds(s).maxY - getShapeBounds(s).minY), 0)
  const gap = totalSpace / (sorted.length - 1)
  let offset = mode === 'horizontal' ? firstB.minX : firstB.minY
  return sorted.map(s => {
    const sb = getShapeBounds(s)
    const size = mode === 'horizontal' ? sb.maxX - sb.minX : sb.maxY - sb.minY
    const d = offset - (mode === 'horizontal' ? sb.minX : sb.minY)
    offset += size + gap
    return mode === 'horizontal'
      ? { ...s, transform: { ...s.transform, x: s.transform.x + d } }
      : { ...s, transform: { ...s.transform, y: s.transform.y + d } }
  })
}

export const getShapeBounds = (shape: VectorShape) => {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  if (shape.points && shape.points.length > 0) {
    for (const p of shape.points) {
      if (p.x < minX) minX = p.x
      if (p.y < minY) minY = p.y
      if (p.x > maxX) maxX = p.x
      if (p.y > maxY) maxY = p.y
    }
  } else {
    minX = shape.transform.x
    minY = shape.transform.y
    maxX = shape.transform.x + 50
    maxY = shape.transform.y + 50
  }
  return { minX, minY, maxX, maxY }
}

export const getShapesBounds = (shapes: VectorShape[]) => {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  for (const s of shapes) {
    const b = getShapeBounds(s)
    if (b.minX < minX) minX = b.minX
    if (b.minY < minY) minY = b.minY
    if (b.maxX > maxX) maxX = b.maxX
    if (b.maxY > maxY) maxY = b.maxY
  }
  return { minX, minY, maxX, maxY }
}

export const duplicateShapes = (shapes: VectorShape[], ids: Set<string>): VectorShape[] => {
  const duplicates = shapes.filter(s => ids.has(s.id)).map(s => ({
    ...s,
    id: generateId(),
    name: s.name + ' copy',
    transform: { ...s.transform, x: s.transform.x + 20, y: s.transform.y + 20 }
  }))
  return [...shapes, ...duplicates]
}

export const changeZOrder = (shapes: VectorShape[], ids: Set<string>, direction: 'up' | 'down' | 'top' | 'bottom'): VectorShape[] => {
  const result = [...shapes]
  const indices = result.map((s, i) => ids.has(s.id) ? i : -1).filter(i => i >= 0)
  if (indices.length === 0) return result
  if (direction === 'top') {
    const items = indices.map(i => result.splice(i, 1)[0])
    result.push(...items)
  } else if (direction === 'bottom') {
    const items = indices.map(i => result.splice(i, 1)[0])
    result.unshift(...items)
  } else {
    const sorted = direction === 'up' ? [...indices].sort((a, b) => b - a) : [...indices].sort((a, b) => a - b)
    for (const idx of sorted) {
      const target = direction === 'up' ? idx + 1 : idx - 1
      if (target >= 0 && target < result.length) {
        [result[idx], result[target]] = [result[target], result[idx]]
      }
    }
  }
  return result
}

export const rotateCanvas = (shapes: VectorShape[], angle: number, w: number, h: number): VectorShape[] => {
  const rad = (angle * Math.PI) / 180
  const cos = Math.cos(rad), sin = Math.sin(rad)
  return shapes.map(s => {
    const cx = s.transform.x, cy = s.transform.y
    let nx = cx * cos - cy * sin
    let ny = cx * sin + cy * cos
    if (angle === 90) { nx = cx; ny = -cy + h }
    else if (angle === 180) { nx = -cx + w; ny = -cy + h }
    else if (angle === 270) { nx = -cx + w; ny = cy }
    return { ...s, transform: { ...s.transform, x: nx, y: ny, rotation: s.transform.rotation + angle } }
  })
}

export const flipCanvas = (shapes: VectorShape[], horizontal: boolean, w: number, h: number): VectorShape[] =>
  shapes.map(s => horizontal
    ? { ...s, transform: { ...s.transform, x: w - s.transform.x, scaleX: -s.transform.scaleX } }
    : { ...s, transform: { ...s.transform, y: h - s.transform.y, scaleY: -s.transform.scaleY } }
  )

export const zoomToFit = (shapes: VectorShape[], canvasW: number, canvasH: number, padding = 40): { zoom: number; pan: Vector2 } => {
  if (shapes.length === 0) return { zoom: 1, pan: { x: 0, y: 0 } }
  const b = getShapesBounds(shapes)
  const contentW = b.maxX - b.minX + padding * 2
  const contentH = b.maxY - b.minY + padding * 2
  const zoom = Math.min(canvasW / contentW, canvasH / contentH, 3)
  const centerX = (b.minX + b.maxX) / 2
  const centerY = (b.minY + b.maxY) / 2
  return { zoom, pan: { x: canvasW / 2 - centerX, y: canvasH / 2 - centerY } }
}

export const smoothPoints = (points: Vector2[], tension = 0.5): Vector2[] => {
  if (points.length < 3) return points
  const result: Vector2[] = [points[0]]
  for (let i = 1; i < points.length - 1; i++) {
    const prev = points[i - 1], curr = points[i], next = points[i + 1]
    result.push({
      x: curr.x + (next.x - prev.x) * tension * 0.25,
      y: curr.y + (next.y - prev.y) * tension * 0.25
    })
  }
  result.push(points[points.length - 1])
  return result
}

export interface Guide {
  id: string
  orientation: 'horizontal' | 'vertical'
  position: number
}

export const createGuide = (orientation: 'horizontal' | 'vertical', position: number): Guide => ({
  id: generateId(),
  orientation,
  position
})
