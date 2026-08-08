import { VectorShape } from './shapes'

export type EasingType = 'linear' | 'easeIn' | 'easeOut' | 'easeInOut' | 'bounce' | 'elastic'

export const easingFunctions: Record<EasingType, (t: number) => number> = {
  linear: (t) => t,
  easeIn: (t) => t * t * t,
  easeOut: (t) => 1 - Math.pow(1 - t, 3),
  easeInOut: (t) => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2,
  bounce: (t) => {
    const n1 = 7.5625, d1 = 2.75
    if (t < 1 / d1) return n1 * t * t
    if (t < 2 / d1) return n1 * (t -= 1.5 / d1) * t + 0.75
    if (t < 2.5 / d1) return n1 * (t -= 2.25 / d1) * t + 0.9375
    return n1 * (t -= 2.625 / d1) * t + 0.984375
  },
  elastic: (t) => t === 0 ? 0 : t === 1 ? 1 : Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * (2 * Math.PI) / 3) + 1
}

export const interpolateValue = (from: number, to: number, t: number, easing: EasingType = 'linear'): number => {
  const eased = easingFunctions[easing](t)
  return from + (to - from) * eased
}

export const interpolateTransform = (from: { x: number; y: number; rotation: number; scaleX: number; scaleY: number }, to: { x: number; y: number; rotation: number; scaleX: number; scaleY: number }, t: number, easing: EasingType = 'linear') => ({
  x: interpolateValue(from.x, to.x, t, easing),
  y: interpolateValue(from.y, to.y, t, easing),
  rotation: interpolateValue(from.rotation, to.rotation, t, easing),
  scaleX: interpolateValue(from.scaleX, to.scaleX, t, easing),
  scaleY: interpolateValue(from.scaleY, to.scaleY, t, easing),
  alpha: 1
})

export interface TweenFrame {
  frame: number
  shape: VectorShape & { transform: { x: number; y: number; rotation: number; scaleX: number; scaleY: number; alpha: number } }
}

export const generateTweenFrames = (fromShape: VectorShape, toShape: VectorShape, frameCount: number, easing: EasingType = 'linear'): TweenFrame[] => {
  const frames: TweenFrame[] = []
  for (let i = 0; i <= frameCount; i++) {
    const t = i / frameCount
    frames.push({
      frame: i + 1,
      shape: {
        ...fromShape,
        transform: interpolateTransform(fromShape.transform, toShape.transform, t, easing)
      }
    })
  }
  return frames
}
