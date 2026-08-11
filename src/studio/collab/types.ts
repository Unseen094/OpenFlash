import type { VectorShape } from '../engine/shapes'

export interface PeerInfo {
  id: string
  name: string
  color: string
  cursorX: number
  cursorY: number
  lastSeen: number
}

export type CollabOp =
  | { type: 'join'; peer: PeerInfo }
  | { type: 'leave'; peerId: string }
  | { type: 'shape-add'; shape: VectorShape; peerId: string }
  | { type: 'shape-update'; shape: VectorShape; peerId: string }
  | { type: 'shape-delete'; shapeId: string; peerId: string }
  | { type: 'shapes-sync'; shapes: VectorShape[]; peerId: string }
  | { type: 'cursor-move'; peerId: string; x: number; y: number }
  | { type: 'presence'; peer: PeerInfo }

export const PEER_COLORS = [
  '#FF6B6B', '#4ECDC4', '#FFE66D', '#A78BFA',
  '#F472B6', '#34D399', '#60A5FA', '#FBBF24'
]
