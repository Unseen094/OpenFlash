export interface Vector2 {
  x: number
  y: number
}

export interface Transform {
  x: number
  y: number
  scaleX: number
  scaleY: number
  rotation: number
  alpha: number
}

export interface Color {
  r: number
  g: number
  b: number
  a: number
}

export const hexToColor = (hex: string, alpha = 1): Color => {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16),
    a: alpha
  } : { r: 0, g: 0, b: 0, a: alpha }
}

export const colorToRgba = (color: Color): string =>
  `rgba(${color.r}, ${color.g}, ${color.b}, ${color.a})`

export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t

export const lerpVector = (a: Vector2, b: Vector2, t: number): Vector2 => ({
  x: lerp(a.x, b.x, t),
  y: lerp(a.y, b.y, t)
})

export const clamp = (val: number, min: number, max: number): number =>
  Math.max(min, Math.min(max, val))

export const degToRad = (deg: number): number => deg * (Math.PI / 180)
export const radToDeg = (rad: number): number => rad * (180 / Math.PI)

export const distance = (a: Vector2, b: Vector2): number =>
  Math.sqrt((b.x - a.x) ** 2 + (b.y - a.y) ** 2)

export const bezier = (t: number, p0: Vector2, p1: Vector2, p2: Vector2, p3: Vector2): Vector2 => {
  const u = 1 - t
  const tt = t * t
  const uu = u * u
  const uuu = uu * u
  const ttt = tt * t
  return {
    x: uuu * p0.x + 3 * uu * t * p1.x + 3 * u * tt * p2.x + ttt * p3.x,
    y: uuu * p0.y + 3 * uu * t * p1.y + 3 * u * tt * p2.y + ttt * p3.y
  }
}

export const cubicEase = (t: number, p1x = 0.25, p1y = 0.1, p2x = 0.25, p2y = 1): number => {
  const cx = 3 * p1x
  const bx = 3 * (p2x - p1x) - cx
  const ax = 1 - cx - bx
  const cy = 3 * p1y
  const by = 3 * (p2y - p1y) - cy
  const ay = 1 - cy - by
  const sampleCurveX = (t: number) => ((ax * t + bx) * t + cx) * t
  const sampleCurveY = (t: number) => ((ay * t + by) * t + cy) * t
  let guess = t
  for (let i = 0; i < 8; i++) {
    const currentX = sampleCurveX(guess)
    if (Math.abs(currentX - t) < 1e-7) return sampleCurveY(guess)
    const derivative = (3 * ax * guess + 2 * bx) * guess + cx
    if (Math.abs(derivative) < 1e-7) break
    guess -= (currentX - t) / derivative
  }
  return sampleCurveY(guess)
}

export interface Bounds {
  minX: number
  minY: number
  maxX: number
  maxY: number
}

export const getBounds = (points: Vector2[]): Bounds => {
  if (points.length === 0) return { minX: 0, minY: 0, maxX: 0, maxY: 0 }
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  for (const p of points) {
    if (p.x < minX) minX = p.x
    if (p.y < minY) minY = p.y
    if (p.x > maxX) maxX = p.x
    if (p.y > maxY) maxY = p.y
  }
  return { minX, minY, maxX, maxY }
}

export const pointInBounds = (point: Vector2, bounds: Bounds): boolean =>
  point.x >= bounds.minX && point.x <= bounds.maxX &&
  point.y >= bounds.minY && point.y <= bounds.maxY

export const pointInPolygon = (point: Vector2, polygon: Vector2[]): boolean => {
  let inside = false
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].x, yi = polygon[i].y
    const xj = polygon[j].x, yj = polygon[j].y
    if (((yi > point.y) !== (yj > point.y)) &&
        (point.x < (xj - xi) * (point.y - yi) / (yj - yi) + xi)) {
      inside = !inside
    }
  }
  return inside
}

export const generateId = (): string => {
  return Date.now().toString(36) + Math.random().toString(36).substring(2, 11)
}

export const deepClone = <T>(obj: T): T => JSON.parse(JSON.stringify(obj))
