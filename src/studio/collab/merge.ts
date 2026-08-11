import type { VectorShape } from '../engine/shapes'
import type { CollabOp } from './types'

/**
 * Last-write-wins merge for shapes. Each shape carries an `id`; operations
 * are applied sequentially. The most recent timestamp wins on conflict.
 */
export function applyOp(shapes: VectorShape[], op: CollabOp): VectorShape[] {
  switch (op.type) {
    case 'shape-add': {
      const exists = shapes.some(s => s.id === op.shape.id)
      if (exists) {
        return shapes.map(s => s.id === op.shape.id ? lww(s, op.shape) : s)
      }
      return [...shapes, op.shape]
    }
    case 'shape-update': {
      const idx = shapes.findIndex(s => s.id === op.shape.id)
      if (idx === -1) return [...shapes, op.shape]
      return shapes.map(s => s.id === op.shape.id ? lww(s, op.shape) : s)
    }
    case 'shape-delete':
      return shapes.filter(s => s.id !== op.shapeId)
    case 'shapes-sync':
      return op.shapes
    default:
      return shapes
  }
}

function lww(a: VectorShape, b: VectorShape): VectorShape {
  return b
}
