import { VectorShape } from './engine/shapes'
import { Transform } from './engine/math'
import { Layer, Keyframe } from './engine/timeline'

export interface Command {
  readonly type: string
  do(): void
  undo(): void
  serialize(): Record<string, unknown>
}

export class CommandStack {
  private stack: Command[] = []
  private index = -1

  push(cmd: Command): void {
    this.stack = this.stack.slice(0, this.index + 1)
    this.stack.push(cmd)
    this.index = this.stack.length - 1
    cmd.do()
  }

  undo(): void {
    if (!this.canUndo()) return
    this.stack[this.index].undo()
    this.index--
  }

  redo(): void {
    if (!this.canRedo()) return
    this.index++
    this.stack[this.index].do()
  }

  canUndo(): boolean {
    return this.index >= 0
  }

  canRedo(): boolean {
    return this.index < this.stack.length - 1
  }

  clear(): void {
    this.stack = []
    this.index = -1
  }

  serialize(): { commands: Record<string, unknown>[]; index: number } {
    return {
      commands: this.stack.map(cmd => cmd.serialize()),
      index: this.index
    }
  }
}

export type ShapeContainer = { shapes: VectorShape[]; setShapes: (shapes: VectorShape[]) => void }

export class AddShapeCommand implements Command {
  readonly type = 'add-shape'
  private shape: VectorShape
  private container: ShapeContainer

  constructor(shape: VectorShape, container: ShapeContainer) {
    this.shape = shape
    this.container = container
  }

  do(): void {
    this.container.setShapes([...this.container.shapes, this.shape])
  }

  undo(): void {
    this.container.setShapes(this.container.shapes.filter(s => s.id !== this.shape.id))
  }

  serialize(): Record<string, unknown> {
    return { type: this.type, shape: this.shape }
  }
}

export class RemoveShapeCommand implements Command {
  readonly type = 'remove-shape'
  private shape: VectorShape
  private container: ShapeContainer
  private originalIndex: number

  constructor(shape: VectorShape, container: ShapeContainer) {
    this.shape = shape
    this.container = container
    this.originalIndex = container.shapes.findIndex(s => s.id === shape.id)
  }

  do(): void {
    this.container.setShapes(this.container.shapes.filter(s => s.id !== this.shape.id))
  }

  undo(): void {
    if (this.originalIndex < 0 || this.originalIndex > this.container.shapes.length) {
      this.container.setShapes([...this.container.shapes, this.shape])
    } else {
      const shapes = [...this.container.shapes]
      shapes.splice(this.originalIndex, 0, this.shape)
      this.container.setShapes(shapes)
    }
  }

  serialize(): Record<string, unknown> {
    return { type: this.type, shape: this.shape, originalIndex: this.originalIndex }
  }
}

export class TransformShapeCommand implements Command {
  readonly type = 'transform-shape'
  private shapeId: string
  private newTransform: Transform
  private oldTransform: Transform
  private container: ShapeContainer

  constructor(shapeId: string, newTransform: Transform, container: ShapeContainer) {
    this.shapeId = shapeId
    this.newTransform = newTransform
    const shape = container.shapes.find(s => s.id === shapeId)
    this.oldTransform = shape ? { ...shape.transform } : { x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0, alpha: 1 }
    this.container = container
  }

  do(): void {
    this.container.setShapes(
      this.container.shapes.map(s =>
        s.id === this.shapeId ? { ...s, transform: { ...this.newTransform } } : s
      )
    )
  }

  undo(): void {
    this.container.setShapes(
      this.container.shapes.map(s =>
        s.id === this.shapeId ? { ...s, transform: { ...this.oldTransform } } : s
      )
    )
  }

  serialize(): Record<string, unknown> {
    return { type: this.type, shapeId: this.shapeId, newTransform: this.newTransform, oldTransform: this.oldTransform }
  }
}

export type TimelineContainer = { layers: Layer[]; setLayers: (layers: Layer[]) => void }

export class AddKeyframeCommand implements Command {
  readonly type = 'add-keyframe'
  private layerId: string
  private keyframe: Keyframe
  private container: TimelineContainer

  constructor(layerId: string, keyframe: Keyframe, container: TimelineContainer) {
    this.layerId = layerId
    this.keyframe = keyframe
    this.container = container
  }

  do(): void {
    this.container.setLayers(
      this.container.layers.map(layer => {
        if (layer.id !== this.layerId) return layer
        const existing = layer.keyframes.findIndex(kf => kf.frame === this.keyframe.frame)
        if (existing >= 0) {
          const keyframes = [...layer.keyframes]
          keyframes[existing] = this.keyframe
          return { ...layer, keyframes }
        }
        return { ...layer, keyframes: [...layer.keyframes, this.keyframe].sort((a, b) => a.frame - b.frame) }
      })
    )
  }

  undo(): void {
    this.container.setLayers(
      this.container.layers.map(layer => {
        if (layer.id !== this.layerId) return layer
        const existing = layer.keyframes.findIndex(kf => kf.frame === this.keyframe.frame)
        if (existing >= 0) {
          const keyframes = [...layer.keyframes]
          keyframes.splice(existing, 1)
          return { ...layer, keyframes }
        }
        return layer
      })
    )
  }

  serialize(): Record<string, unknown> {
    return { type: this.type, layerId: this.layerId, keyframe: this.keyframe }
  }
}

export class RemoveKeyframeCommand implements Command {
  readonly type = 'remove-keyframe'
  private layerId: string
  private keyframe: Keyframe
  private container: TimelineContainer
  private originalIndex: number

  constructor(layerId: string, keyframe: Keyframe, container: TimelineContainer) {
    this.layerId = layerId
    this.keyframe = keyframe
    this.container = container
    const layer = container.layers.find(l => l.id === layerId)
    this.originalIndex = layer ? layer.keyframes.findIndex(kf => kf.frame === keyframe.frame) : -1
  }

  do(): void {
    this.container.setLayers(
      this.container.layers.map(layer => {
        if (layer.id !== this.layerId) return layer
        return { ...layer, keyframes: layer.keyframes.filter(kf => kf.frame !== this.keyframe.frame) }
      })
    )
  }

  undo(): void {
    this.container.setLayers(
      this.container.layers.map(layer => {
        if (layer.id !== this.layerId) return layer
        if (this.originalIndex < 0) {
          return { ...layer, keyframes: [...layer.keyframes, this.keyframe].sort((a, b) => a.frame - b.frame) }
        }
        const keyframes = [...layer.keyframes]
        keyframes.splice(this.originalIndex, 0, this.keyframe)
        return { ...layer, keyframes }
      })
    )
  }

  serialize(): Record<string, unknown> {
    return { type: this.type, layerId: this.layerId, keyframe: this.keyframe, originalIndex: this.originalIndex }
  }
}
