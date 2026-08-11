import { useState } from 'react'
import type { PeerInfo } from './types'
import { IconUsers } from '../../components/Icons'

interface CollabPanelProps {
  peers: PeerInfo[]
  peerName: string
  onNameChange: (_name: string) => void
  connected: boolean
}

export function CollabPanel({ peers, peerName, onNameChange, connected }: CollabPanelProps) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(peerName)

  const commit = () => {
    const trimmed = draft.trim()
    if (trimmed) onNameChange(trimmed)
    else setDraft(peerName)
    setEditing(false)
  }

  const total = peers.length + 1

  return (
    <div className="panel" style={{ overflow: 'hidden', marginBottom: 8 }}>
      <div className="panel-head" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <IconUsers size={12} />
        <span className="tiny">COLLAB ({total} online)</span>
        <span
          className="badge"
          style={{
            marginLeft: 'auto',
            fontSize: 9,
            color: connected ? 'var(--green)' : 'var(--text-muted)',
            borderColor: connected ? 'rgba(22,240,140,0.3)' : 'var(--line)',
            background: 'transparent'
          }}
        >
          {connected ? 'LIVE' : 'OFFLINE'}
        </span>
      </div>
      <div style={{ padding: '8px 12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--cyan)', flexShrink: 0 }} />
          {editing ? (
            <input
              value={draft}
              onChange={e => setDraft(e.target.value)}
              onBlur={commit}
              onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') { setDraft(peerName); setEditing(false) } }}
              autoFocus
              style={{ flex: 1, fontSize: 12, background: 'var(--bg-primary)', border: '1px solid var(--line)', color: 'var(--text-primary)', padding: '2px 6px', borderRadius: 4 }}
            />
          ) : (
            <span
              style={{ fontSize: 12, fontWeight: 600, cursor: 'pointer', flex: 1 }}
              onClick={() => setEditing(true)}
              title="Click to rename"
            >
              {peerName} <span className="tiny" style={{ color: 'var(--text-muted)' }}>(you)</span>
            </span>
          )}
        </div>
        {peers.map(p => (
          <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: p.color, flexShrink: 0 }} />
            <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{p.name}</span>
          </div>
        ))}
        {peers.length === 0 && (
          <div className="tiny" style={{ color: 'var(--text-muted)', marginTop: 4 }}>
            Open another tab on this machine to start collaborating.
          </div>
        )}
      </div>
    </div>
  )
}
