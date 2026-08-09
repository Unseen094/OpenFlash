import '@testing-library/jest-dom'
import { beforeEach, vi } from 'vitest'

class LocalStorageMock implements Storage {
  private store = new Map<string, string>()

  get length(): number {
    return this.store.size
  }

  clear(): void {
    this.store.clear()
  }

  getItem(key: string): string | null {
    return this.store.has(key) ? (this.store.get(key) as string) : null
  }

  key(index: number): string | null {
    return Array.from(this.store.keys())[index] ?? null
  }

  removeItem(key: string): void {
    this.store.delete(key)
  }

  setItem(key: string, value: string): void {
    this.store.set(key, String(value))
  }
}

const localStorageMock = new LocalStorageMock()
const sessionStorageMock = new LocalStorageMock()

Object.defineProperty(globalThis, 'localStorage', {
  value: localStorageMock,
  writable: true,
  configurable: true
})

Object.defineProperty(globalThis, 'sessionStorage', {
  value: sessionStorageMock,
  writable: true,
  configurable: true
})

function createContext2DMock(): CanvasRenderingContext2D {
  const noop = () => undefined
  const ctx = {
    canvas: null,
    fillStyle: '#000000',
    strokeStyle: '#000000',
    lineWidth: 1,
    lineCap: 'butt',
    lineJoin: 'miter',
    miterLimit: 10,
    globalAlpha: 1,
    globalCompositeOperation: 'source-over',
    font: '10px sans-serif',
    textAlign: 'start',
    textBaseline: 'alphabetic',
    shadowBlur: 0,
    shadowColor: 'rgba(0, 0, 0, 0)',
    shadowOffsetX: 0,
    shadowOffsetY: 0,
    imageSmoothingEnabled: true,
    save: noop,
    restore: noop,
    scale: noop,
    rotate: noop,
    translate: noop,
    transform: noop,
    setTransform: noop,
    resetTransform: noop,
    beginPath: noop,
    closePath: noop,
    moveTo: noop,
    lineTo: noop,
    bezierCurveTo: noop,
    quadraticCurveTo: noop,
    arc: noop,
    arcTo: noop,
    ellipse: noop,
    rect: noop,
    roundRect: noop,
    fill: noop,
    stroke: noop,
    clip: noop,
    clearRect: noop,
    fillRect: noop,
    strokeRect: noop,
    fillText: noop,
    strokeText: noop,
    setLineDash: noop,
    getLineDash: () => [],
    drawImage: noop,
    putImageData: noop,
    isPointInPath: () => false,
    isPointInStroke: () => false,
    measureText: (text: string) => ({
      width: text.length * 6,
      actualBoundingBoxAscent: 8,
      actualBoundingBoxDescent: 2,
      actualBoundingBoxLeft: 0,
      actualBoundingBoxRight: text.length * 6,
      fontBoundingBoxAscent: 8,
      fontBoundingBoxDescent: 2
    }),
    createImageData: (w: number, h: number) => ({
      width: w,
      height: h,
      data: new Uint8ClampedArray(w * h * 4),
      colorSpace: 'srgb'
    }),
    getImageData: (_x: number, _y: number, w: number, h: number) => ({
      width: w,
      height: h,
      data: new Uint8ClampedArray(w * h * 4),
      colorSpace: 'srgb'
    }),
    createLinearGradient: () => ({ addColorStop: noop }),
    createRadialGradient: () => ({ addColorStop: noop }),
    createConicGradient: () => ({ addColorStop: noop }),
    createPattern: () => null
  }
  return ctx as unknown as CanvasRenderingContext2D
}

if (typeof HTMLCanvasElement !== 'undefined') {
  HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, kind: string) {
    if (kind === '2d') {
      const ctx = createContext2DMock() as unknown as { canvas: HTMLCanvasElement }
      ctx.canvas = this
      return ctx as unknown as CanvasRenderingContext2D
    }
    return null
  } as unknown as HTMLCanvasElement['getContext']

  HTMLCanvasElement.prototype.toDataURL = () => 'data:image/png;base64,'
  HTMLCanvasElement.prototype.toBlob = function (cb: BlobCallback) {
    cb(new Blob([], { type: 'image/png' }))
  }
}

const clipboardMock = {
  writeText: vi.fn(async () => undefined),
  readText: vi.fn(async () => ''),
  write: vi.fn(async () => undefined),
  read: vi.fn(async () => [])
}

Object.defineProperty(globalThis.navigator, 'clipboard', {
  value: clipboardMock,
  writable: true,
  configurable: true
})

beforeEach(() => {
  localStorageMock.clear()
  sessionStorageMock.clear()
  clipboardMock.writeText.mockReset().mockImplementation(async () => undefined)
  clipboardMock.readText.mockReset().mockImplementation(async () => '')
})

export { localStorageMock, clipboardMock }
