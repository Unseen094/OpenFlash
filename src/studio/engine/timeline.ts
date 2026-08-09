import { VectorShape } from './shapes'
import { Transform, generateId, deepClone } from './math'

export type TweenType = 'motion' | 'shape' | 'none'

export interface Keyframe {
  frame: number
  shape: VectorShape
  tweenType: TweenType
  tweenEasing: number
  tweenPath?: Array<{ x: number; y: number }>
}

export interface Layer {
  id: string
  name: string
  visible: boolean
  locked: boolean
  keyframes: Keyframe[]
  color: string
}

export interface TimelineState {
  layers: Layer[]
  currentFrame: number
  totalFrames: number
  fps: number
  loop: boolean
}

export const createLayer = (name: string, color = '#00F0FF'): Layer => ({
  id: generateId(),
  name,
  visible: true,
  locked: false,
  keyframes: [],
  color
})

export const createKeyframe = (frame: number, shape: VectorShape): Keyframe => ({
  frame,
  shape: deepClone(shape),
  tweenType: 'none',
  tweenEasing: 0
})

export const addKeyframe = (layer: Layer, frame: number, shape: VectorShape): Layer => {
  const existing = layer.keyframes.findIndex(kf => kf.frame === frame)
  const keyframe = createKeyframe(frame, shape)
  if (existing >= 0) {
    const newKeyframes = [...layer.keyframes]
    newKeyframes[existing] = keyframe
    return { ...layer, keyframes: newKeyframes }
  }
  return { ...layer, keyframes: [...layer.keyframes, keyframe].sort((a, b) => a.frame - b.frame) }
}

export const removeKeyframe = (layer: Layer, frame: number): Layer => ({
  ...layer,
  keyframes: layer.keyframes.filter(kf => kf.frame !== frame)
})

export const getKeyframeAtFrame = (layer: Layer, frame: number): Keyframe | undefined =>
  layer.keyframes.find(kf => kf.frame === frame)

export const getSurroundingKeyframes = (layer: Layer, frame: number): [Keyframe | undefined, Keyframe | undefined] => {
  let prev: Keyframe | undefined
  let next: Keyframe | undefined
  for (const kf of layer.keyframes) {
    if (kf.frame <= frame) prev = kf
    if (kf.frame >= frame && !next) next = kf
  }
  return [prev, next]
}

export const interpolateShape = (layer: Layer, frame: number): VectorShape | null => {
  const [prev, next] = getSurroundingKeyframes(layer, frame)
  if (!prev) return next ? next.shape : null
  if (!next || prev.frame === next.frame) return prev.shape

  const t = (frame - prev.frame) / (next.frame - prev.frame)

  if (prev.tweenType === 'motion' || prev.tweenType === 'shape') {
    return interpolateTransform(prev.shape, next.shape, t)
  }

  return prev.shape
}

const interpolateTransform = (from: VectorShape, to: VectorShape, t: number): VectorShape => ({
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

export const getShapesAtFrame = (timeline: TimelineState): VectorShape[] => {
  const shapes: VectorShape[] = []
  for (const layer of timeline.layers) {
    if (!layer.visible) continue
    const shape = interpolateShape(layer, timeline.currentFrame)
    if (shape) shapes.push(shape)
  }
  return shapes
}

export const getOnionSkinFrames = (timeline: TimelineState, beforeFrames = 3, afterFrames = 3): Array<{ frame: number; alpha: number; direction: 'before' | 'after' }> => {
  const frames: Array<{ frame: number; alpha: number; direction: 'before' | 'after' }> = []
  for (let i = 1; i <= beforeFrames; i++) {
    const f = timeline.currentFrame - i
    if (f >= 1) frames.push({ frame: f, alpha: 0.3 / i, direction: 'before' })
  }
  for (let i = 1; i <= afterFrames; i++) {
    const f = timeline.currentFrame + i
    if (f <= timeline.totalFrames) frames.push({ frame: f, alpha: 0.3 / i, direction: 'after' })
  }
  return frames
}

export const duplicateLayer = (layer: Layer): Layer => ({
  ...layer,
  id: generateId(),
  name: `${layer.name} Copy`,
  keyframes: layer.keyframes.map(kf => ({
    ...kf,
    shape: deepClone(kf.shape)
  }))
})

export const mergeLayers = (layer1: Layer, layer2: Layer): Layer => ({
  ...layer1,
  name: `${layer1.name} + ${layer2.name}`,
  keyframes: [...layer1.keyframes, ...layer2.keyframes].sort((a, b) => a.frame - b.frame)
})
