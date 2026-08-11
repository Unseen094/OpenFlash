import type { VectorShape } from '../engine/shapes'
import type { CollabOp, PeerInfo } from './types'
import { PEER_COLORS } from './types'

const CHANNEL_NAME = 'openflash_collab'
const HEARTBEAT_MS = 3000
const PEER_TIMEOUT_MS = 10000

function generatePeerId(): string {
  return `peer_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
}

function pickColor(index: number): string {
  return PEER_COLORS[index % PEER_COLORS.length]
}

export type CollabCallback = (_op: CollabOp) => void

export class CollabBus {
  private channel: BroadcastChannel | null = null
  private peer: PeerInfo
  private peers = new Map<string, PeerInfo>()
  private listeners: CollabCallback[] = []
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null
  private cleanupTimer: ReturnType<typeof setInterval> | null = null

  constructor(name?: string) {
    const id = generatePeerId()
    this.peer = {
      id,
      name: name || `User ${id.slice(-4)}`,
      color: pickColor(0),
      cursorX: 0,
      cursorY: 0,
      lastSeen: Date.now()
    }
  }

  connect(): void {
    if (typeof BroadcastChannel === 'undefined') return
    this.channel = new BroadcastChannel(CHANNEL_NAME)
    this.channel.onmessage = (e: MessageEvent<CollabOp>) => this.handleOp(e.data)

    this.broadcast({ type: 'join', peer: { ...this.peer } })

    this.heartbeatTimer = setInterval(() => {
      this.broadcast({ type: 'presence', peer: { ...this.peer, lastSeen: Date.now() } })
      this.pruneStalePeers()
    }, HEARTBEAT_MS)
  }

  disconnect(): void {
    if (this.channel) {
      this.broadcast({ type: 'leave', peerId: this.peer.id })
      this.channel.close()
      this.channel = null
    }
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer)
    if (this.cleanupTimer) clearInterval(this.cleanupTimer)
    this.peers.clear()
  }

  getPeerId(): string {
    return this.peer.id
  }

  getPeerName(): string {
    return this.peer.name
  }

  setPeerName(name: string): void {
    this.peer.name = name
    this.broadcast({ type: 'presence', peer: { ...this.peer } })
  }

  getPeers(): PeerInfo[] {
    return Array.from(this.peers.values())
  }

  updateCursor(x: number, y: number): void {
    this.peer.cursorX = x
    this.peer.cursorY = y
    this.broadcast({ type: 'cursor-move', peerId: this.peer.id, x, y })
  }

  broadcastShapeAdd(shape: VectorShape): void {
    this.broadcast({ type: 'shape-add', shape, peerId: this.peer.id })
  }

  broadcastShapeUpdate(shape: VectorShape): void {
    this.broadcast({ type: 'shape-update', shape, peerId: this.peer.id })
  }

  broadcastShapeDelete(shapeId: string): void {
    this.broadcast({ type: 'shape-delete', shapeId, peerId: this.peer.id })
  }

  broadcastShapesSync(shapes: VectorShape[]): void {
    this.broadcast({ type: 'shapes-sync', shapes, peerId: this.peer.id })
  }

  onOp(cb: CollabCallback): () => void {
    this.listeners.push(cb)
    return () => {
      this.listeners = this.listeners.filter(l => l !== cb)
    }
  }

  private broadcast(op: CollabOp): void {
    this.channel?.postMessage(op)
  }

  private handleOp(op: CollabOp): void {
    if (op.type === 'join' || op.type === 'presence') {
      const p = op.peer
      if (p.id === this.peer.id) return
      const existing = this.peers.get(p.id)
      if (!existing) {
        this.peer.color = pickColor(this.peers.size + 1)
      }
      this.peers.set(p.id, { ...p, lastSeen: Date.now() })
    } else if (op.type === 'leave') {
      this.peers.delete(op.peerId)
    } else if (op.type === 'cursor-move') {
      const p = this.peers.get(op.peerId)
      if (p) {
        p.cursorX = op.x
        p.cursorY = op.y
        p.lastSeen = Date.now()
      }
    }

    for (const listener of this.listeners) {
      listener(op)
    }
  }

  private pruneStalePeers(): void {
    const now = Date.now()
    for (const [id, p] of this.peers) {
      if (now - p.lastSeen > PEER_TIMEOUT_MS) {
        this.peers.delete(id)
      }
    }
  }
}
