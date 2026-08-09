export interface RendererProvider {
  initialize(canvas: HTMLCanvasElement): Promise<void>
  render(scene: RenderScene): void
  dispose(): void
  hitTest?(point: { x: number; y: number }, shapes: any[]): any | undefined
}

export interface RenderScene {
  shapes: any[]
  selectedShapeIds: Set<string>
  timeline: any
  zoom: number
  panOffset: { x: number; y: number }
  onionSkin: boolean
  shaders: Set<string>
  toolState: any
  guides: Array<{ id: string; orientation: 'horizontal' | 'vertical'; position: number }>
}

export class Canvas2DRenderer implements RendererProvider {
  private ctx: CanvasRenderingContext2D | null = null

  async initialize(canvas: HTMLCanvasElement): Promise<void> {
    this.ctx = canvas.getContext('2d')
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

  async initialize(canvas: HTMLCanvasElement): Promise<void> {
  }

  render(_scene: RenderScene): void {
    if (!this.gl) return
  }

  dispose(): void {
  }

  get context(): WebGL2RenderingContext | null {
    return this.gl
  }
}
