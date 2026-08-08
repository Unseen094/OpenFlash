import { Vector2, generateId } from './math'
import { VectorShape } from './shapes'

export const simplifyPath = (points: Vector2[], tolerance = 1): Vector2[] => {
  if (points.length <= 2) return points
  return douglasPeucker(points, tolerance)
}

const douglasPeucker = (points: Vector2[], epsilon: number): Vector2[] => {
  if (points.length <= 2) return points
  let maxDist = 0, index = 0
  const end = points.length - 1
  for (let i = 1; i < end; i++) {
    const dist = perpendicularDistance(points[i], points[0], points[end])
    if (dist > maxDist) { maxDist = dist; index = i }
  }
  if (maxDist > epsilon) {
    const left = douglasPeucker(points.slice(0, index + 1), epsilon)
    const right = douglasPeucker(points.slice(index), epsilon)
    return [...left.slice(0, -1), ...right]
  }
  return [points[0], points[end]]
}

const perpendicularDistance = (point: Vector2, lineStart: Vector2, lineEnd: Vector2): number => {
  const dx = lineEnd.x - lineStart.x, dy = lineEnd.y - lineStart.y
  const len = Math.sqrt(dx * dx + dy * dy)
  if (len === 0) return Math.sqrt((point.x - lineStart.x) ** 2 + (point.y - lineStart.y) ** 2)
  return Math.abs(dy * point.x - dx * point.y + lineEnd.x * lineStart.y - lineEnd.y * lineStart.x) / len
}

export const closePath = (shape: VectorShape): VectorShape => {
  if (!shape.points || shape.points.length < 2) return shape
  return { ...shape, closed: true, points: [...shape.points, shape.points[0]] }
}

export const openPath = (shape: VectorShape): VectorShape => {
  if (!shape.points || shape.points.length < 2) return shape
  return { ...shape, closed: false, points: shape.points.slice(0, -1) }
}

export const reversePath = (shape: VectorShape): VectorShape => {
  if (!shape.points) return shape
  return { ...shape, points: [...shape.points].reverse() }
}

export const outlineStroke = (shape: VectorShape): VectorShape => {
  if (!shape.stroke || !shape.points) return shape
  return {
    ...shape,
    fill: { type: 'solid', color: shape.stroke.color },
    stroke: { ...shape.stroke, width: 0 }
  }
}

export const bezierToPoints = (p0: Vector2, p1: Vector2, p2: Vector2, p3: Vector2, segments = 20): Vector2[] => {
  const points: Vector2[] = []
  for (let i = 0; i <= segments; i++) {
    const t = i / segments
    const mt = 1 - t
    points.push({
      x: mt * mt * mt * p0.x + 3 * mt * mt * t * p1.x + 3 * mt * t * t * p2.x + t * t * t * p3.x,
      y: mt * mt * mt * p0.y + 3 * mt * mt * t * p1.y + 3 * mt * t * t * p2.y + t * t * t * p3.y
    })
  }
  return points
}

export const smoothToCorner = (shape: VectorShape, pointIndex: number, handleLength = 30): VectorShape => {
  if (!shape.points || pointIndex < 0 || pointIndex >= shape.points.length) return shape
  const pts = [...shape.points]
  const prev = pts[(pointIndex - 1 + pts.length) % pts.length]
  const curr = pts[pointIndex]
  const next = pts[(pointIndex + 1) % pts.length]
  const angle = Math.atan2(next.y - prev.y, next.x - prev.x)
  pts[pointIndex] = {
    x: curr.x + Math.cos(angle) * handleLength,
    y: curr.y + Math.sin(angle) * handleLength
  }
  return { ...shape, points: pts }
}

export const pathUnion = (a: VectorShape, b: VectorShape): VectorShape => {
  if (!a.points || !b.points) return a
  return { ...a, id: generateId(), name: 'Union', points: [...a.points, ...b.points], closed: true }
}

export const pathSubtract = (a: VectorShape, b: VectorShape): VectorShape => {
  return { ...a, id: generateId(), name: 'Subtract', points: a.points ? [...a.points] : [], closed: true }
}

export const pathIntersect = (a: VectorShape, b: VectorShape): VectorShape => {
  return { ...a, id: generateId(), name: 'Intersect', points: a.points ? [...a.points] : [], closed: true }
}

export const pathExclude = (a: VectorShape, b: VectorShape): VectorShape => {
  return { ...a, id: generateId(), name: 'Exclude', points: a.points ? [...a.points] : [], closed: true }
}
