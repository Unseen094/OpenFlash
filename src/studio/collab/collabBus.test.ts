import { describe, it, expect, vi, afterEach } from 'vitest'
import { CollabBus } from './collabBus'
import { applyOp } from './merge'
import type { VectorShape } from '../engine/shapes'

function makeShape(id: string, x = 0): VectorShape {
  return {
    id,
    type: 'rectangle',
    name: id,
    transform: { x, y: 0, scaleX: 1, scaleY: 1, rotation: 0, alpha: 1 },
    fill: { type: 'solid', color: { r: 255, g: 0, b: 0, a: 1 } },
    stroke: { color: { r: 255, g: 255, b: 255, a: 1 }, width: 1, cap: 'round', join: 'round' },
    visible: true,
    locked: false,
    points: [{ x: 0, y: 0 }, { x: 50, y: 0 }, { x: 50, y: 50 }, { x: 0, y: 50 }],
    closed: true
  }
}

describe('merge — applyOp', () => {
  it('adds a new shape', () => {
    const s = makeShape('a')
    const result = applyOp([], { type: 'shape-add', shape: s, peerId: 'p1' })
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('a')
  })

  it('updates existing shape via add', () => {
    const s1 = makeShape('a', 0)
    const s2 = makeShape('a', 100)
    const result = applyOp([s1], { type: 'shape-add', shape: s2, peerId: 'p1' })
    expect(result).toHaveLength(1)
    expect(result[0].transform.x).toBe(100)
  })

  it('deletes a shape', () => {
    const result = applyOp([makeShape('a'), makeShape('b')], { type: 'shape-delete', shapeId: 'a', peerId: 'p1' })
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('b')
  })

  it('replaces all shapes on sync', () => {
    const result = applyOp([makeShape('old')], { type: 'shapes-sync', shapes: [makeShape('new')], peerId: 'p1' })
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('new')
  })

  it('returns same array on unknown op', () => {
    const arr = [makeShape('a')]
    const result = applyOp(arr, { type: 'cursor-move', peerId: 'p1', x: 10, y: 20 })
    expect(result).toBe(arr)
  })

  it('shape-update adds if missing', () => {
    const s = makeShape('x')
    const result = applyOp([], { type: 'shape-update', shape: s, peerId: 'p1' })
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('x')
  })

  it('shape-update overwrites existing', () => {
    const s1 = makeShape('x', 0)
    const s2 = makeShape('x', 999)
    const result = applyOp([s1], { type: 'shape-update', shape: s2, peerId: 'p1' })
    expect(result[0].transform.x).toBe(999)
  })
})

describe('CollabBus', () => {
  let bus: CollabBus

  afterEach(() => {
    bus?.disconnect()
  })

  it('creates with peer id and default name', () => {
    bus = new CollabBus('Alice')
    expect(bus.getPeerId()).toMatch(/^peer_/)
    expect(bus.getPeerName()).toBe('Alice')
  })

  it('setPeerName updates name', () => {
    bus = new CollabBus('Bob')
    bus.setPeerName('Zelda')
    expect(bus.getPeerName()).toBe('Zelda')
  })

  it('onOp returns unsubscribe', () => {
    bus = new CollabBus()
    const cb = vi.fn()
    const unsub = bus.onOp(cb)
    unsub()
    bus.disconnect()
  })

  it('getPeers returns empty before connect', () => {
    bus = new CollabBus()
    expect(bus.getPeers()).toEqual([])
  })

  it('disconnect clears peers', () => {
    bus = new CollabBus()
    bus.disconnect()
    expect(bus.getPeers()).toEqual([])
  })
})
