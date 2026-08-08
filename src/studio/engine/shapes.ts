import { Vector2, Transform, Color, Bounds, generateId } from './math'

export type ShapeType = 'rectangle' | 'ellipse' | 'polygon' | 'path' | 'text' | 'bitmap' | 'group'

export interface FillStyle {
  type: 'solid' | 'linear' | 'radial'
  color: Color
  gradient?: {
    stops: Array<{ offset: number; color: Color }>
    angle?: number
    startPoint?: Vector2
    endPoint?: Vector2
  }
}

export interface StrokeStyle {
  color: Color
  width: number
  cap: 'butt' | 'round' | 'square'
  join: 'miter' | 'round' | 'bevel'
  dashArray?: number[]
}

export interface FilterStyle {
  blur?: number
  glow?: { color: Color; radius: number; strength: number }
  dropShadow?: { color: Color; offsetX: number; offsetY: number; blur: number }
  brightness?: number
  contrast?: number
}

export interface VectorShape {
  id: string
  type: ShapeType
  name: string
  transform: Transform
  fill?: FillStyle
  stroke?: StrokeStyle
  filters?: FilterStyle
  visible: boolean
  locked: boolean
  points?: Vector2[]
  closed?: boolean
  text?: string
  fontSize?: number
  fontFamily?: string
  children?: VectorShape[]
  bounds?: Bounds
}

export const createRectangle = (x: number, y: number, width: number, height: number, fill?: Color): VectorShape => ({
  id: generateId(),
  type: 'rectangle',
  name: 'Rectangle',
  transform: { x, y, scaleX: 1, scaleY: 1, rotation: 0, alpha: 1 },
  fill: fill ? { type: 'solid', color: fill } : { type: 'solid', color: { r: 255, g: 230, b: 0, a: 1 } },
  stroke: { color: { r: 255, g: 255, b: 255, a: 0.5 }, width: 1, cap: 'round', join: 'round' },
  visible: true,
  locked: false,
  points: [
    { x: 0, y: 0 },
    { x: width, y: 0 },
    { x: width, y: height },
    { x: 0, y: height }
  ],
  closed: true
})

export const createEllipse = (x: number, y: number, radiusX: number, radiusY: number, fill?: Color): VectorShape => ({
  id: generateId(),
  type: 'ellipse',
  name: 'Ellipse',
  transform: { x, y, scaleX: 1, scaleY: 1, rotation: 0, alpha: 1 },
  fill: fill ? { type: 'solid', color: fill } : { type: 'solid', color: { r: 0, g: 240, b: 255, a: 1 } },
  stroke: { color: { r: 255, g: 255, b: 255, a: 0.5 }, width: 1, cap: 'round', join: 'round' },
  visible: true,
  locked: false,
  points: [{ x: radiusX, y: radiusY }],
  closed: true
})

export const createPolygon = (points: Vector2[], fill?: Color): VectorShape => ({
  id: generateId(),
  type: 'polygon',
  name: 'Polygon',
  transform: { x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0, alpha: 1 },
  fill: fill ? { type: 'solid', color: fill } : { type: 'solid', color: { r: 255, g: 0, b: 170, a: 1 } },
  stroke: { color: { r: 255, g: 255, b: 255, a: 0.5 }, width: 1, cap: 'round', join: 'round' },
  visible: true,
  locked: false,
  points,
  closed: true
})

export const createPath = (points: Vector2[], closed = false, fill?: Color, stroke?: Color): VectorShape => ({
  id: generateId(),
  type: 'path',
  name: 'Path',
  transform: { x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0, alpha: 1 },
  fill: fill ? { type: 'solid', color: fill } : undefined,
  stroke: stroke ? { color: stroke, width: 2, cap: 'round', join: 'round' } : { color: { r: 255, g: 255, b: 255, a: 1 }, width: 2, cap: 'round', join: 'round' },
  visible: true,
  locked: false,
  points,
  closed
})

export const createText = (x: number, y: number, text: string, fontSize = 16): VectorShape => ({
  id: generateId(),
  type: 'text',
  name: 'Text',
  transform: { x, y, scaleX: 1, scaleY: 1, rotation: 0, alpha: 1 },
  fill: { type: 'solid', color: { r: 255, g: 255, b: 255, a: 1 } },
  visible: true,
  locked: false,
  text,
  fontSize,
  fontFamily: 'Space Grotesk, sans-serif'
})

export const createGroup = (children: VectorShape[]): VectorShape => ({
  id: generateId(),
  type: 'group',
  name: 'Group',
  transform: { x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0, alpha: 1 },
  visible: true,
  locked: false,
  children
})

export const renderShape = (ctx: CanvasRenderingContext2D, shape: VectorShape, time = 0): void => {
  if (!shape.visible) return

  ctx.save()
  ctx.globalAlpha = shape.transform.alpha
  ctx.translate(shape.transform.x, shape.transform.y)
  ctx.rotate(shape.transform.rotation * Math.PI / 180)
  ctx.scale(shape.transform.scaleX, shape.transform.scaleY)

  if (shape.filters) {
    if (shape.filters.blur) ctx.filter = `blur(${shape.filters.blur}px)`
  }

  switch (shape.type) {
    case 'rectangle':
      renderRectangle(ctx, shape)
      break
    case 'ellipse':
      renderEllipse(ctx, shape)
      break
    case 'polygon':
      renderPolygonPath(ctx, shape)
      break
    case 'path':
      renderPath(ctx, shape)
      break
    case 'text':
      renderText(ctx, shape)
      break
    case 'group':
      shape.children?.forEach(child => renderShape(ctx, child, time))
      break
  }

  ctx.restore()
}

const renderRectangle = (ctx: CanvasRenderingContext2D, shape: VectorShape): void => {
  if (!shape.points || shape.points.length < 4) return
  const w = shape.points[1].x - shape.points[0].x
  const h = shape.points[2].y - shape.points[1].y
  if (shape.fill) {
    ctx.fillStyle = getFillCss(ctx, shape.fill)
    ctx.fillRect(0, 0, w, h)
  }
  if (shape.stroke) {
    ctx.strokeStyle = getStrokeCss(shape.stroke)
    ctx.lineWidth = shape.stroke.width
    ctx.lineCap = shape.stroke.cap
    ctx.lineJoin = shape.stroke.join
    ctx.strokeRect(0, 0, w, h)
  }
}

const renderEllipse = (ctx: CanvasRenderingContext2D, shape: VectorShape): void => {
  if (!shape.points || shape.points.length < 1) return
  const rx = shape.points[0].x
  const ry = shape.points[0].y
  ctx.beginPath()
  ctx.ellipse(rx, ry, rx, ry, 0, 0, Math.PI * 2)
  if (shape.fill) {
    ctx.fillStyle = getFillCss(ctx, shape.fill)
    ctx.fill()
  }
  if (shape.stroke) {
    ctx.strokeStyle = getStrokeCss(shape.stroke)
    ctx.lineWidth = shape.stroke.width
    ctx.stroke()
  }
}

const renderPolygonPath = (ctx: CanvasRenderingContext2D, shape: VectorShape): void => {
  if (!shape.points || shape.points.length < 3) return
  ctx.beginPath()
  ctx.moveTo(shape.points[0].x, shape.points[0].y)
  for (let i = 1; i < shape.points.length; i++) {
    ctx.lineTo(shape.points[i].x, shape.points[i].y)
  }
  if (shape.closed) ctx.closePath()
  if (shape.fill) {
    ctx.fillStyle = getFillCss(ctx, shape.fill)
    ctx.fill()
  }
  if (shape.stroke) {
    ctx.strokeStyle = getStrokeCss(shape.stroke)
    ctx.lineWidth = shape.stroke.width
    ctx.lineCap = shape.stroke.cap
    ctx.lineJoin = shape.stroke.join
    ctx.stroke()
  }
}

const renderPath = (ctx: CanvasRenderingContext2D, shape: VectorShape): void => {
  if (!shape.points || shape.points.length < 2) return
  ctx.beginPath()
  ctx.moveTo(shape.points[0].x, shape.points[0].y)
  for (let i = 1; i < shape.points.length; i++) {
    ctx.lineTo(shape.points[i].x, shape.points[i].y)
  }
  if (shape.closed) ctx.closePath()
  if (shape.fill && shape.closed) {
    ctx.fillStyle = getFillCss(ctx, shape.fill)
    ctx.fill()
  }
  if (shape.stroke) {
    ctx.strokeStyle = getStrokeCss(shape.stroke)
    ctx.lineWidth = shape.stroke.width
    ctx.lineCap = shape.stroke.cap
    ctx.lineJoin = shape.stroke.join
    if (shape.stroke.dashArray) ctx.setLineDash(shape.stroke.dashArray)
    ctx.stroke()
    ctx.setLineDash([])
  }
}

const renderText = (ctx: CanvasRenderingContext2D, shape: VectorShape): void => {
  if (!shape.text) return
  if (shape.fill) {
    ctx.fillStyle = getFillCss(ctx, shape.fill)
  }
  ctx.font = `${shape.fontSize || 16}px ${shape.fontFamily || 'sans-serif'}`
  ctx.textBaseline = 'top'
  ctx.fillText(shape.text, 0, 0)
}

const getFillCss = (ctx: CanvasRenderingContext2D, fill: FillStyle): string | CanvasGradient => {
  if (fill.type === 'solid') {
    return `rgba(${fill.color.r}, ${fill.color.g}, ${fill.color.b}, ${fill.color.a})`
  }
  if (fill.type === 'linear' && fill.gradient) {
    const grad = ctx.createLinearGradient(0, 0, 400, 0)
    fill.gradient.stops.forEach(s => grad.addColorStop(s.offset, `rgba(${s.color.r}, ${s.color.g}, ${s.color.b}, ${s.color.a})`))
    return grad
  }
  if (fill.type === 'radial' && fill.gradient) {
    const grad = ctx.createRadialGradient(200, 200, 0, 200, 200, 200)
    fill.gradient.stops.forEach(s => grad.addColorStop(s.offset, `rgba(${s.color.r}, ${s.color.g}, ${s.color.b}, ${s.color.a})`))
    return grad
  }
  return `rgba(${fill.color.r}, ${fill.color.g}, ${fill.color.b}, ${fill.color.a})`
}

const getStrokeCss = (stroke: StrokeStyle): string =>
  `rgba(${stroke.color.r}, ${stroke.color.g}, ${stroke.color.b}, ${stroke.color.a})`
