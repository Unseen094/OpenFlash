import { VectorShape, renderShape } from './shapes'

export interface SpriteSheetConfig {
  shapes: VectorShape[]
  columns: number
  frameWidth: number
  frameHeight: number
  rows: number
}

export const exportSpriteSheet = (config: SpriteSheetConfig): void => {
  const { shapes, columns, frameWidth, frameHeight, rows } = config
  const canvas = document.createElement('canvas')
  canvas.width = columns * frameWidth
  canvas.height = rows * frameHeight
  const ctx = canvas.getContext('2d')
  if (!ctx) return

  ctx.fillStyle = 'transparent'
  ctx.fillRect(0, 0, canvas.width, canvas.height)

  for (let i = 0; i < shapes.length && i < columns * rows; i++) {
    const col = i % columns
    const row = Math.floor(i / columns)
    ctx.save()
    ctx.translate(col * frameWidth + frameWidth / 2, row * frameHeight + frameHeight / 2)
    renderShape(ctx, shapes[i])
    ctx.restore()
  }

  const link = document.createElement('a')
  link.download = 'spritesheet.png'
  link.href = canvas.toDataURL('image/png')
  link.click()
}

export const exportGif = (frames: HTMLCanvasElement[], delay = 100, loop = true): void => {
  const width = frames[0]?.width || 800
  const height = frames[0]?.height || 450
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) return

  const gifData: string[] = []
  for (const frame of frames) {
    ctx.clearRect(0, 0, width, height)
    ctx.drawImage(frame, 0, 0)
    gifData.push(canvas.toDataURL('image/png'))
  }

  const link = document.createElement('a')
  link.download = 'animation.gif'
  link.href = gifData[0] || ''
  link.click()
}

export const generateTweenFrames = (from: VectorShape, to: VectorShape, count: number): VectorShape[] => {
  const frames: VectorShape[] = []
  for (let i = 0; i <= count; i++) {
    const t = i / count
    frames.push({
      ...from,
      transform: {
        x: from.transform.x + (to.transform.x - from.transform.x) * t,
        y: from.transform.y + (to.transform.y - from.transform.y) * t,
        scaleX: from.transform.scaleX + (to.transform.scaleX - from.transform.scaleX) * t,
        scaleY: from.transform.scaleY + (to.transform.scaleY - from.transform.scaleY) * t,
        rotation: from.transform.rotation + (to.transform.rotation - from.transform.rotation) * t,
        alpha: from.transform.alpha + (to.transform.alpha - from.transform.alpha) * t
      }
    })
  }
  return frames
}

export const exportFramesAsZip = async (frames: HTMLCanvasElement[], projectName: string): Promise<void> => {
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')
  if (!ctx || frames.length === 0) return

  canvas.width = frames[0].width
  canvas.height = frames[0].height

  for (let i = 0; i < frames.length; i++) {
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.drawImage(frames[i], 0, 0)
    const link = document.createElement('a')
    link.download = `${projectName}_frame_${String(i).padStart(3, '0')}.png`
    link.href = canvas.toDataURL('image/png')
    link.click()
    await new Promise(r => setTimeout(r, 100))
  }
}
