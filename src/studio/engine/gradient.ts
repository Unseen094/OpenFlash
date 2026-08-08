import { Color } from './math'

export interface GradientStop {
  offset: number
  color: Color
}

export interface Gradient {
  type: 'linear' | 'radial'
  stops: GradientStop[]
  angle: number
  centerX?: number
  centerY?: number
}

export const createLinearGradient = (stops?: GradientStop[]): Gradient => ({
  type: 'linear',
  stops: stops || [
    { offset: 0, color: { r: 255, g: 230, b: 0, a: 1 } },
    { offset: 1, color: { r: 0, g: 240, b: 255, a: 1 } }
  ],
  angle: 0
})

export const createRadialGradient = (stops?: GradientStop[]): Gradient => ({
  type: 'radial',
  stops: stops || [
    { offset: 0, color: { r: 255, g: 230, b: 0, a: 1 } },
    { offset: 1, color: { r: 0, g: 240, b: 255, a: 1 } }
  ],
  angle: 0,
  centerX: 0.5,
  centerY: 0.5
})

export const gradientToCss = (gradient: Gradient): string => {
  const stops = gradient.stops
    .sort((a, b) => a.offset - b.offset)
    .map(s => `rgba(${s.color.r},${s.color.g},${s.color.b},${s.color.a}) ${Math.round(s.offset * 100)}%`)
    .join(', ')
  if (gradient.type === 'linear') return `linear-gradient(${gradient.angle}deg, ${stops})`
  return `radial-gradient(circle at ${(gradient.centerX || 0.5) * 100}% ${(gradient.centerY || 0.5) * 100}%, ${stops})`
}

export const gradientToCanvas = (ctx: CanvasRenderingContext2D, gradient: Gradient, x: number, y: number, w: number, h: number): CanvasGradient => {
  let cg: CanvasGradient
  if (gradient.type === 'linear') {
    const rad = (gradient.angle * Math.PI) / 180
    const cx = x + w / 2, cy = y + h / 2
    const len = Math.abs(w * Math.cos(rad)) + Math.abs(h * Math.sin(rad))
    cg = ctx.createLinearGradient(cx - Math.cos(rad) * len / 2, cy - Math.sin(rad) * len / 2, cx + Math.cos(rad) * len / 2, cy + Math.sin(rad) * len / 2)
  } else {
    cg = ctx.createRadialGradient(x + w * (gradient.centerX || 0.5), y + h * (gradient.centerY || 0.5), 0, x + w / 2, y + h / 2, Math.max(w, h) / 2)
  }
  gradient.stops.sort((a, b) => a.offset - b.offset).forEach(s => {
    cg.addColorStop(s.offset, `rgba(${s.color.r},${s.color.g},${s.color.b},${s.color.a})`)
  })
  return cg
}

export const addGradientStop = (gradient: Gradient, offset: number, color: Color): Gradient => ({
  ...gradient,
  stops: [...gradient.stops, { offset, color }].sort((a, b) => a.offset - b.offset)
})

export const removeGradientStop = (gradient: Gradient, index: number): Gradient => ({
  ...gradient,
  stops: gradient.stops.filter((_, i) => i !== index)
})

export const updateGradientStop = (gradient: Gradient, index: number, updates: Partial<GradientStop>): Gradient => ({
  ...gradient,
  stops: gradient.stops.map((s, i) => i === index ? { ...s, ...updates } : s)
})
