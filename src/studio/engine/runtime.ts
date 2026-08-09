import { Vector2 } from './math'
import { PhysicsWorld, PhysicsBody } from './physics'

export interface OFSprite {
  id: string
  name: string
  x: number
  y: number
  width: number
  height: number
  rotation: number
  alpha: number
  visible: boolean
  scaleX: number
  scaleY: number
  vx: number
  vy: number
  data: Record<string, unknown>
}

export interface OFScene {
  id: string
  name: string
  sprites: Map<string, OFSprite>
  backgroundColor: string
  width: number
  height: number
}

export interface OFParticle {
  x: number
  y: number
  vx: number
  vy: number
  life: number
  maxLife: number
  color: string
  size: number
}

export type OFEventType = 'tick' | 'pointerDown' | 'pointerUp' | 'pointerMove' | 'keyDown' | 'keyUp' | 'collision' | 'trigger' | 'sceneLoad' | 'sceneUnload'

export interface OFEvent {
  type: OFEventType
  delta?: number
  x?: number
  y?: number
  key?: string
  target?: OFSprite
  other?: OFSprite
}

export type OFEventHandler = (event: OFEvent) => void

export interface OFSpriteOptions {
  name?: string
  x?: number
  y?: number
  width?: number
  height?: number
  color?: string
}

export interface OFDrawOptions {
  color?: string
  count?: number
  speed?: number
  size?: number
}

export interface OpenFlashRuntimeOptions {
  transparent?: boolean
  dataChannel?: (name: string, value: unknown) => void
  attachInputHandlers?: boolean
}

export class OpenFlashRuntime {
  private sprites: Map<string, OFSprite> = new Map()
  private scenes: Map<string, OFScene> = new Map()
  private currentScene: OFScene | null = null
  private particles: OFParticle[] = []
  private eventHandlers: Map<OFEventType, OFEventHandler[]> = new Map()
  private canvas: HTMLCanvasElement | null = null
  private ctx: CanvasRenderingContext2D | null = null
  private isRunning = false
  private lastTime = 0
  private animationId = 0
  private physics: PhysicsWorld
  private audioContext: AudioContext | null = null
  private storage: Map<string, string> = new Map()
  private frameCount = 0
  private fps = 0
  private fpsUpdateTime = 0
  private transparent = false
  private dataChannel?: (name: string, value: unknown) => void
  private attachInputHandlers = true
  private disposedInputListeners: Array<() => void> = []

  constructor(options: OpenFlashRuntimeOptions = {}) {
    this.physics = new PhysicsWorld()
    this.setupStorage()
    this.transparent = options.transparent || false
    this.dataChannel = options.dataChannel
    this.attachInputHandlers = options.attachInputHandlers !== false
  }

  private setupStorage(): void {
    try {
      const stored = localStorage.getItem('openflash_storage')
      if (stored) {
        const data = JSON.parse(stored)
        Object.entries(data).forEach(([k, v]) => this.storage.set(k, v as string))
       }
     } catch (e) {
       console.error('[OF] Failed to load storage:', e)
     }
  }

  private saveStorage(): void {
    try {
      const data: Record<string, string> = {}
      this.storage.forEach((v, k) => data[k] = v)
      localStorage.setItem('openflash_storage', JSON.stringify(data))
    } catch (e) {
      console.error('[OF] Failed to save storage:', e)
    }
  }

  initialize(canvas: HTMLCanvasElement): void {
    this.canvas = canvas
    this.ctx = canvas.getContext('2d') || null
    if (this.attachInputHandlers) {
      this.setupInputHandlers()
    }
  }

  private setupInputHandlers(): void {
    if (!this.canvas) return

    const onPointerDown = (e: PointerEvent) => {
      const rect = this.canvas!.getBoundingClientRect()
      this._mouseX = e.clientX - rect.left
      this._mouseY = e.clientY - rect.top
      this.emit({
        type: 'pointerDown',
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
      })
    }

    const onPointerUp = (e: PointerEvent) => {
      const rect = this.canvas!.getBoundingClientRect()
      this.emit({
        type: 'pointerUp',
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
      })
    }

    const onPointerMove = (e: PointerEvent) => {
      const rect = this.canvas!.getBoundingClientRect()
      this._mouseX = e.clientX - rect.left
      this._mouseY = e.clientY - rect.top
      this.emit({
        type: 'pointerMove',
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
      })
    }

    const onKeyDown = (e: KeyboardEvent) => {
      this.pressedKeys.add(e.key)
      this.emit({ type: 'keyDown', key: e.key })
    }

    const onKeyUp = (e: KeyboardEvent) => {
      this.pressedKeys.delete(e.key)
      this.emit({ type: 'keyUp', key: e.key })
    }

    this.canvas.addEventListener('pointerdown', onPointerDown)
    this.canvas.addEventListener('pointerup', onPointerUp)
    this.canvas.addEventListener('pointermove', onPointerMove)
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)

    this.disposedInputListeners = [
      () => this.canvas?.removeEventListener('pointerdown', onPointerDown),
      () => this.canvas?.removeEventListener('pointerup', onPointerUp),
      () => this.canvas?.removeEventListener('pointermove', onPointerMove),
      () => window.removeEventListener('keydown', onKeyDown),
      () => window.removeEventListener('keyup', onKeyUp)
    ]
  }

  on(event: OFEventType, handler: OFEventHandler): () => void {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, [])
    }
    this.eventHandlers.get(event)!.push(handler)
    return () => {
      const handlers = this.eventHandlers.get(event)
      if (handlers) {
        const idx = handlers.indexOf(handler)
        if (idx >= 0) handlers.splice(idx, 1)
      }
    }
  }

  dispatchEvent(type: OFEventType, data: Partial<OFEvent> = {}): void {
    if (type === 'keyDown' && data.key) {
      this.pressedKeys.add(data.key)
    } else if (type === 'keyUp' && data.key) {
      this.pressedKeys.delete(data.key)
    }
    this.emit({ type, ...data } as OFEvent)
  }

  private emit(event: OFEvent): void {
    const handlers = this.eventHandlers.get(event.type)
    if (handlers) {
      handlers.forEach(h => {
        try { h(event) } catch (e) { console.error('OF Event Error:', e) }
      })
    }
  }

  getSprite(name: string): OFSprite | undefined {
    return this.sprites.get(name)
  }

  postScore(score: number): void {
    this.dataChannel?.('score', { score })
  }

  createSprite(options: OFSpriteOptions = {}): OFSprite {
    const sprite: OFSprite = {
      id: `sprite_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      name: options.name || 'sprite',
      x: options.x || 0,
      y: options.y || 0,
      width: options.width || 50,
      height: options.height || 50,
      rotation: 0,
      alpha: 1,
      visible: true,
      scaleX: 1,
      scaleY: 1,
      vx: 0,
      vy: 0,
      data: options.color ? { color: options.color } : {}
    }
    this.sprites.set(sprite.name, sprite)
    if (this.currentScene) {
      this.currentScene.sprites.set(sprite.name, sprite)
    }
    return sprite
  }

  clear(): void {
    this.sprites.clear()
    this.particles = []
    if (this.currentScene) {
      this.currentScene.sprites.clear()
    }
    if (this.ctx) {
      this.ctx.clearRect(0, 0, this.canvas?.width || 0, this.canvas?.height || 0)
    }
  }

  isKeyDown(key: string): boolean {
    return this.pressedKeys.has(key)
  }

  private pressedKeys: Set<string> = new Set()

  removeSprite(name: string): void {
    this.sprites.delete(name)
    if (this.currentScene) {
      this.currentScene.sprites.delete(name)
    }
  }

  drawRect(x: number, y: number, width: number, height: number, color = '#FFFFFF'): void {
    if (!this.ctx) return
    this.ctx.fillStyle = color
    this.ctx.fillRect(x, y, width, height)
  }

  drawCircle(x: number, y: number, radius: number, color = '#FFFFFF'): void {
    if (!this.ctx) return
    this.ctx.fillStyle = color
    this.ctx.beginPath()
    this.ctx.arc(x, y, radius, 0, Math.PI * 2)
    this.ctx.fill()
  }

  drawLine(x1: number, y1: number, x2: number, y2: number, color = '#FFFFFF', width = 1): void {
    if (!this.ctx) return
    this.ctx.strokeStyle = color
    this.ctx.lineWidth = width
    this.ctx.beginPath()
    this.ctx.moveTo(x1, y1)
    this.ctx.lineTo(x2, y2)
    this.ctx.stroke()
  }

  drawText(text: string, x: number, y: number, color = '#FFFFFF', size = 16): void {
    if (!this.ctx) return
    this.ctx.fillStyle = color
    this.ctx.font = `${size}px 'Space Grotesk', sans-serif`
    this.ctx.fillText(text, x, y)
  }

  drawParticle(x: number, y: number, options: OFDrawOptions = {}): void {
    const count = options.count || 10
    const speed = options.speed || 5
    const color = options.color || '#FFE600'
    const size = options.size || 4

    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2
      const vel = Math.random() * speed
      this.particles.push({
        x, y,
        vx: Math.cos(angle) * vel,
        vy: Math.sin(angle) * vel,
        life: 1,
        maxLife: 1,
        color,
        size: size * (0.5 + Math.random() * 0.5)
      })
    }
  }

  playSound(type: 'hit' | 'jump' | 'shoot' | 'explode' | 'click' = 'click'): void {
    if (!this.audioContext) {
      try { this.audioContext = new AudioContext() } catch (e) {
        console.error('[OF] AudioContext creation failed:', e)
        return
      }
    }
    const ctx = this.audioContext
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain)
    gain.connect(ctx.destination)

    switch (type) {
      case 'hit':
        osc.type = 'square'
        osc.frequency.setValueAtTime(200, ctx.currentTime)
        osc.frequency.exponentialRampToValueAtTime(50, ctx.currentTime + 0.1)
        break
      case 'jump':
        osc.type = 'sine'
        osc.frequency.setValueAtTime(300, ctx.currentTime)
        osc.frequency.exponentialRampToValueAtTime(600, ctx.currentTime + 0.15)
        break
      case 'shoot':
        osc.type = 'sawtooth'
        osc.frequency.setValueAtTime(800, ctx.currentTime)
        osc.frequency.exponentialRampToValueAtTime(100, ctx.currentTime + 0.08)
        break
      case 'explode':
        osc.type = 'sawtooth'
        osc.frequency.setValueAtTime(150, ctx.currentTime)
        osc.frequency.exponentialRampToValueAtTime(20, ctx.currentTime + 0.3)
        break
      default:
        osc.type = 'square'
        osc.frequency.setValueAtTime(800, ctx.currentTime)
        break
    }

    gain.gain.setValueAtTime(0.2, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15)
    osc.start(ctx.currentTime)
    osc.stop(ctx.currentTime + 0.2)
  }

  createScene(name: string, width = 800, height = 450): OFScene {
    const scene: OFScene = {
      id: `scene_${Date.now()}`,
      name,
      sprites: new Map(),
      backgroundColor: '#0A0B0E',
      width,
      height
    }
    this.scenes.set(name, scene)
    return scene
  }

  loadScene(name: string): void {
    const scene = this.scenes.get(name)
    if (!scene) return
    if (this.currentScene) {
      this.emit({ type: 'sceneUnload' })
    }
    this.currentScene = scene
    this.sprites = scene.sprites
    this.emit({ type: 'sceneLoad', target: undefined })
  }

  transition(name: string, type: 'fade' | 'slide' | 'cut' = 'fade', duration = 500): void {
    this.loadScene(name)
  }

  setBackgroundColor(color: string): void {
    if (this.currentScene) {
      this.currentScene.backgroundColor = color
    }
  }

  getKey(key: string): string | null {
    return this.storage.get(key) || null
  }

  setKey(key: string, value: string): void {
    this.storage.set(key, value)
    this.saveStorage()
  }

  removeKey(key: string): void {
    this.storage.delete(key)
    this.saveStorage()
  }

  clearStorage(): void {
    this.storage.clear()
    this.saveStorage()
  }

  get mouseX(): number {
    return this._mouseX || 0
  }

  get mouseY(): number {
    return this._mouseY || 0
  }

  private _mouseX = 0
  private _mouseY = 0

  get frameRate(): number {
    return this.fps
  }

  get spriteCount(): number {
    return this.sprites.size
  }

  start(): void {
    if (this.isRunning) return
    this.isRunning = true
    this.lastTime = performance.now()
    this.fpsUpdateTime = this.lastTime
    this.loop()
  }

  stop(): void {
    this.isRunning = false
    if (this.animationId) {
      cancelAnimationFrame(this.animationId)
    }
  }

  private loop = (): void => {
    if (!this.isRunning) return
    const now = performance.now()
    const delta = Math.min((now - this.lastTime) / 1000, 0.1)
    this.lastTime = now

    this.frameCount++
    if (now - this.fpsUpdateTime >= 1000) {
      this.fps = this.frameCount
      this.frameCount = 0
      this.fpsUpdateTime = now
    }

    this.physics.step(delta)
    this.updateParticles(delta)
    this.emit({ type: 'tick', delta })
    this.render()

    this.animationId = requestAnimationFrame(this.loop)
  }

  private updateParticles(dt: number): void {
    this.particles = this.particles.filter(p => {
      p.x += p.vx
      p.y += p.vy
      p.vy += 50 * dt
      p.life -= dt * 2
      return p.life > 0
    })
  }

  private render(): void {
    if (!this.ctx || !this.canvas) return
    const ctx = this.ctx
    const w = this.canvas.width
    const h = this.canvas.height

    if (this.transparent) {
      ctx.clearRect(0, 0, w, h)
    } else {
      ctx.fillStyle = this.currentScene?.backgroundColor || '#0A0B0E'
      ctx.fillRect(0, 0, w, h)
    }

    for (const [, sprite] of this.sprites) {
      if (!sprite.visible) continue
      ctx.save()
      ctx.globalAlpha = sprite.alpha
      ctx.translate(sprite.x, sprite.y)
      ctx.rotate(sprite.rotation * Math.PI / 180)
      ctx.scale(sprite.scaleX, sprite.scaleY)
      ctx.fillStyle = String(sprite.data.color || '#FFFFFF')
      ctx.fillRect(-sprite.width / 2, -sprite.height / 2, sprite.width, sprite.height)
      ctx.restore()
    }

    for (const p of this.particles) {
      ctx.save()
      ctx.globalAlpha = p.life / p.maxLife
      ctx.fillStyle = p.color
      ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size)
      ctx.restore()
    }
  }

  dispose(): void {
    this.stop()
    this.sprites.clear()
    this.scenes.clear()
    this.particles = []
    this.eventHandlers.clear()
    this.pressedKeys.clear()
    this.physics.dispose()
    this.disposedInputListeners.forEach(fn => { try { fn() } catch (e) { console.error('[OF] Input listener disposal error:', e) } })
    this.disposedInputListeners = []
    if (this.audioContext) {
      this.audioContext.close()
      this.audioContext = null
    }
  }
}

export const OpenFlash = new OpenFlashRuntime()
