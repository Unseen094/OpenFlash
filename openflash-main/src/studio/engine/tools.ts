import { Vector2, Transform, generateId, distance } from './math'
import { VectorShape, FillStyle, StrokeStyle, createPath, createRectangle, createEllipse, createPolygon, createText } from './shapes'

export type ToolType = 'select' | 'node' | 'pen' | 'brush' | 'line' | 'rectangle' | 'ellipse' | 'polygon' | 'text' | 'bucket' | 'eyedropper'

export interface ToolState {
  activeTool: ToolType
  fillColor: string
  strokeColor: string
  strokeWidth: number
  fontSize: number
  fontFamily: string
  polygonSides: number
  cornerRadius: number
  opacity: number
}

export const defaultToolState: ToolState = {
  activeTool: 'select',
  fillColor: '#FFE600',
  strokeColor: '#FFFFFF',
  strokeWidth: 2,
  fontSize: 16,
  fontFamily: 'Space Grotesk, sans-serif',
  polygonSides: 6,
  cornerRadius: 0,
  opacity: 1
}

export interface DrawingSession {
  id: string
  tool: ToolType
  points: Vector2[]
  preview: VectorShape | null
  isDrawing: boolean
  startPoint: Vector2 | null
}

export const createDrawingSession = (tool: ToolType): DrawingSession => ({
  id: generateId(),
  tool,
  points: [],
  preview: null,
  isDrawing: false,
  startPoint: null
})

export class DrawingEngine {
  private session: DrawingSession | null = null
  private toolState: ToolState
  private shapes: VectorShape[] = []
  private selectedShapes: Set<string> = new Set()
  private undoStack: VectorShape[][] = []
  private redoStack: VectorShape[][] = []
  private maxUndoSteps = 50

  constructor(toolState: ToolState) {
    this.toolState = toolState
  }

  setToolState(state: ToolState): void {
    this.toolState = state
  }

  getShapes(): VectorShape[] {
    return this.shapes
  }

  getSelectedShapes(): VectorShape[] {
    return this.shapes.filter(s => this.selectedShapes.has(s.id))
  }

  getSelectedIds(): string[] {
    return Array.from(this.selectedShapes)
  }

  setShapes(shapes: VectorShape[]): void {
    this.shapes = shapes
  }

  selectShape(id: string, additive = false): void {
    if (additive) {
      if (this.selectedShapes.has(id)) {
        this.selectedShapes.delete(id)
      } else {
        this.selectedShapes.add(id)
      }
    } else {
      this.selectedShapes.clear()
      this.selectedShapes.add(id)
    }
  }

  selectAll(): void {
    this.selectedShapes = new Set(this.shapes.map(s => s.id))
  }

  clearSelection(): void {
    this.selectedShapes.clear()
  }

  deleteSelected(): void {
    this.saveState()
    this.shapes = this.shapes.filter(s => !this.selectedShapes.has(s.id))
    this.selectedShapes.clear()
  }

  startDrawing(point: Vector2): void {
    this.session = createDrawingSession(this.toolState.activeTool)
    this.session.startPoint = point
    this.session.isDrawing = true
    this.session.points = [point]
  }

  updateDrawing(point: Vector2): VectorShape | null {
    if (!this.session || !this.session.isDrawing) return null

    switch (this.session.tool) {
      case 'pen':
      case 'brush':
        this.session.points.push(point)
        this.session.preview = createPath(
          this.session.points,
          false,
          this.toolState.fillColor ? hexToFillColor(this.toolState.fillColor) : undefined,
          hexToFillColor(this.toolState.strokeColor)
        )
        break
      case 'line':
        this.session.points = [this.session.startPoint!, point]
        this.session.preview = createPath(
          this.session.points,
          false,
          undefined,
          hexToFillColor(this.toolState.strokeColor)
        )
        break
      case 'rectangle':
        if (this.session.startPoint) {
          const w = point.x - this.session.startPoint.x
          const h = point.y - this.session.startPoint.y
          this.session.preview = createRectangle(
            this.session.startPoint.x,
            this.session.startPoint.y,
            w,
            h,
            hexToFillColor(this.toolState.fillColor)
          )
        }
        break
      case 'ellipse':
        if (this.session.startPoint) {
          const rx = Math.abs(point.x - this.session.startPoint.x) / 2
          const ry = Math.abs(point.y - this.session.startPoint.y) / 2
          const cx = (point.x + this.session.startPoint.x) / 2
          const cy = (point.y + this.session.startPoint.y) / 2
          this.session.preview = createEllipse(cx, cy, rx, ry, hexToFillColor(this.toolState.fillColor))
        }
        break
    }

    return this.session.preview
  }

  endDrawing(): VectorShape | null {
    if (!this.session) return null
    this.session.isDrawing = false
    const shape = this.session.preview
    if (shape) {
      this.saveState()
      this.shapes.push(shape)
    }
    this.session = null
    return shape
  }

  getCurrentPreview(): VectorShape | null {
    return this.session?.preview || null
  }

  isDrawingActive(): boolean {
    return this.session?.isDrawing || false
  }

  hitTest(point: VectorShape): VectorShape | null {
    for (let i = this.shapes.length - 1; i >= 0; i--) {
      const shape = this.shapes[i]
      if (shape.locked || !shape.visible) continue
      if (isPointInShape(point, shape)) {
        return shape
      }
    }
    return null
  }

  moveSelected(dx: number, dy: number): void {
    this.saveState()
    this.shapes = this.shapes.map(s => {
      if (this.selectedShapes.has(s.id)) {
        return { ...s, transform: { ...s.transform, x: s.transform.x + dx, y: s.transform.y + dy } }
      }
      return s
    })
  }

  updateSelectedTransform(transform: Partial<Transform>): void {
    this.saveState()
    this.shapes = this.shapes.map(s => {
      if (this.selectedShapes.has(s.id)) {
        return { ...s, transform: { ...s.transform, ...transform } }
      }
      return s
    })
  }

  saveState(): void {
    this.undoStack.push(JSON.parse(JSON.stringify(this.shapes)))
    if (this.undoStack.length > this.maxUndoSteps) {
      this.undoStack.shift()
    }
    this.redoStack = []
  }

  undo(): boolean {
    if (this.undoStack.length === 0) return false
    this.redoStack.push(JSON.parse(JSON.stringify(this.shapes)))
    this.shapes = this.undoStack.pop()!
    return true
  }

  redo(): boolean {
    if (this.redoStack.length === 0) return false
    this.undoStack.push(JSON.parse(JSON.stringify(this.shapes)))
    this.shapes = this.redoStack.pop()!
    return true
  }

  canUndo(): boolean {
    return this.undoStack.length > 0
  }

  canRedo(): boolean {
    return this.redoStack.length > 0
  }

  importSVG(svgString: string): void {
    const parser = new DOMParser()
    const doc = parser.parseFromString(svgString, 'image/svg+xml')
    const paths = doc.querySelectorAll('path')
    const rects = doc.querySelectorAll('rect')
    const ellipses = doc.querySelectorAll('ellipse, circle')

    this.saveState()

    paths.forEach(path => {
      const d = path.getAttribute('d') || ''
      const points = parseSVGPath(d)
      if (points.length > 1) {
        this.shapes.push(createPath(points, true))
      }
    })

    rects.forEach(rect => {
      const x = parseFloat(rect.getAttribute('x') || '0')
      const y = parseFloat(rect.getAttribute('y') || '0')
      const w = parseFloat(rect.getAttribute('width') || '0')
      const h = parseFloat(rect.getAttribute('height') || '0')
      this.shapes.push(createRectangle(x, y, w, h))
    })

    ellipses.forEach(el => {
      const cx = parseFloat(el.getAttribute('cx') || el.getAttribute('cx') || '0')
      const cy = parseFloat(el.getAttribute('cy') || el.getAttribute('cy') || '0')
      const rx = parseFloat(el.getAttribute('rx') || el.getAttribute('r') || '0')
      const ry = parseFloat(el.getAttribute('ry') || el.getAttribute('r') || '0')
      this.shapes.push(createEllipse(cx, cy, rx, ry))
    })
  }
}

const hexToFillColor = (hex: string): any => {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return { r, g, b, a: 1 }
}

const isPointInShape = (point: Vector2, shape: VectorShape): boolean => {
  const localX = point.x - shape.transform.x
  const localY = point.y - shape.transform.y
  if (!shape.points || shape.points.length === 0) return false

  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  for (const p of shape.points) {
    if (p.x < minX) minX = p.x
    if (p.y < minY) minY = p.y
    if (p.x > maxX) maxX = p.x
    if (p.y > maxY) maxY = p.y
  }

  const padding = 8
  return localX >= minX - padding && localX <= maxX + padding &&
         localY >= minY - padding && localY <= maxY + padding
}

const parseSVGPath = (d: string): Vector2[] => {
  const points: Vector2[] = []
  const commands = d.match(/[MmLlHhVvCcSsQqTtAaZz][^MmLlHhVvCcSsQqTtAaZz]*/g) || []
  let currentX = 0, currentY = 0

  for (const cmd of commands) {
    const type = cmd[0]
    const args = cmd.slice(1).trim().split(/[\s,]+/).map(Number).filter(n => !isNaN(n))

    switch (type.toUpperCase()) {
      case 'M':
        if (args.length >= 2) {
          currentX = args[0]
          currentY = args[1]
          points.push({ x: currentX, y: currentY })
        }
        break
      case 'L':
        if (args.length >= 2) {
          currentX = args[0]
          currentY = args[1]
          points.push({ x: currentX, y: currentY })
        }
        break
      case 'C':
        if (args.length >= 6) {
          for (let i = 0; i <= 10; i++) {
            const t = i / 10
            const x = Math.pow(1-t, 3) * currentX + 3 * Math.pow(1-t, 2) * t * args[0] + 3 * (1-t) * t * t * args[2] + t * t * t * args[4]
            const y = Math.pow(1-t, 3) * currentY + 3 * Math.pow(1-t, 2) * t * args[1] + 3 * (1-t) * t * t * args[3] + t * t * t * args[5]
            points.push({ x, y })
          }
          currentX = args[4]
          currentY = args[5]
        }
        break
    }
  }
  return points
}
