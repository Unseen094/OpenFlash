import type { VectorShape } from './shapes'
import type { TimelineState } from './timeline'

export interface RendererProvider {
  initialize(canvas: HTMLCanvasElement): Promise<void>
  render(scene: RenderScene): void
  dispose(): void
  hitTest?(point: { x: number; y: number }, shapes: VectorShape[]): VectorShape | undefined
}

export interface RenderScene {
  shapes: VectorShape[]
  selectedShapeIds: Set<string>
  timeline: TimelineState
  zoom: number
  panOffset: { x: number; y: number }
  onionSkin: boolean
  shaders: Set<string>
  toolState: Record<string, unknown>
  guides: Array<{ id: string; orientation: 'horizontal' | 'vertical'; position: number }>
}

export class Canvas2DRenderer implements RendererProvider {
  private ctx: CanvasRenderingContext2D | null = null

  initialize(canvas: HTMLCanvasElement): Promise<void> {
    this.ctx = canvas.getContext('2d')
    return Promise.resolve()
  }

  render(scene: RenderScene): void {
    if (!this.ctx) return
  }

  dispose(): void {
    this.ctx = null
  }

  get context(): CanvasRenderingContext2D | null {
    return this.ctx
  }
}

export class WebGLRenderer implements RendererProvider {
  private gl: WebGL2RenderingContext | null = null

  initialize(_canvas: HTMLCanvasElement): Promise<void> {
    return Promise.resolve()
  }

  render(_scene: RenderScene): void {
    if (!this.gl) return
  }

  dispose(): void {
    this.gl = null
  }

  get context(): WebGL2RenderingContext | null {
    return this.gl
  }
}
