import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { listProjects, deleteProject, ProjectMeta, createEmptyProject, saveProject } from '../lib/projects'
import { ensureWorkspaceSeed } from '../lib/demoSeed'
import { listEarningsByUser, pendingBalanceForUser } from '../lib/monetization/earnings'
import { listPublishedGamesByCreator } from '../lib/monetization/games'

export default function DashboardPage() {
  const { user } = useAuth()
  const owner = user?.email || user?.uid || 'anonymous'
  const [activeTab, setActiveTab] = useState<'overview' | 'projects' | 'assets'>('overview')
  const [projects, setProjects] = useState<ProjectMeta[]>([])

  const refreshProjects = () => {
    setProjects(listProjects(owner))
  }

  useEffect(() => {
    ensureWorkspaceSeed(owner)
    refreshProjects()
  }, [owner])

  const handleNewProject = () => {
    const p = createEmptyProject(owner, `Project ${projects.length + 1}`)
    saveProject(p)
    refreshProjects()
  }

  const earnings = listEarningsByUser(owner)
  const myGames = listPublishedGamesByCreator(owner)
  const balance = pendingBalanceForUser(owner)
  const tipsMonthly = earnings.filter(e => e.createdAt > Date.now() - 30 * 24 * 60 * 60 * 1000).reduce((s, e) => s + e.creatorUsd, 0)
  const allTime = earnings.reduce((s, e) => s + e.creatorUsd, 0)

  const stats = [
    { label: 'Total Plays', value: String(myGames.reduce((s, g) => s + g.plays, 0)), change: 'live', color: 'var(--accent-yellow)' },
    { label: 'Published', value: `${myGames.length}`, change: 'arcade', color: 'var(--accent-cyan)' },
    { label: 'Projects', value: `${projects.length}`, change: 'local', color: 'var(--accent-green)' },
    { label: 'Balance', value: `$${balance.toFixed(2)}`, change: 'USD', color: 'var(--accent-magenta)' }
  ]

  const handleDelete = (id: string) => {
    deleteProject(id)
    refreshProjects()
  }

  return (
    <div style={{ padding: '24px', maxWidth: 1200, margin: '0 auto' }}>
      {/* Header */}
      <div className="row-between" style={{ marginBottom: 32, alignItems: 'flex-end' }}>
        <div>
          <span className="sec-label"><b>HUB</b> WORKSPACE</span>
          <h1 style={{ fontFamily: 'var(--font-sans)', fontSize: 28, fontWeight: 700, marginBottom: 4, marginTop: 8 }}>
            Creator Hub
          </h1>
          <p style={{ fontSize: 14, color: 'var(--text-secondary)' }}>
            Welcome back, <strong>{user?.displayName || owner.split('@')[0]}</strong>
          </p>
        </div>
        <Link to="/studio" className="btn btn-amber" onClick={handleNewProject}>
          + New Project
        </Link>
      </div>

      {/* Stats Grid */}
      <div className="stat-grid" style={{ marginBottom: 32 }}>
        {stats.map((stat, i) => (
          <div key={i} className="panel corner" style={{ padding: 18 }}>
            <div className="tiny" style={{ opacity: 0.7, marginBottom: 8 }}>
              {stat.label}
            </div>
            <div className="row" style={{ alignItems: 'baseline', gap: 8 }}>
              <span style={{ fontSize: 26, fontWeight: 700, color: stat.color, fontFamily: 'var(--font-mono)' }}>
                {stat.value}
              </span>
              <span className="badge" style={{ color: 'var(--green)', borderColor: 'rgba(22,240,140,0.3)' }}>
                {stat.change}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 20, borderBottom: '1px solid var(--border-subtle)' }}>
        {(['overview', 'projects', 'assets'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              padding: '10px 16px',
              fontSize: 13,
              fontWeight: 500,
              background: 'none',
              border: 'none',
              borderBottom: activeTab === tab ? '2px solid var(--accent-yellow)' : '2px solid transparent',
              color: activeTab === tab ? 'var(--text-primary)' : 'var(--text-muted)',
              cursor: 'pointer',
              transition: 'all var(--transition-fast)',
              textTransform: 'capitalize'
            }}
          >
            {tab}
          </button>
        ))}
      </div>

      {activeTab === 'overview' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          {/* Performance Chart */}
          <div className="glass-panel" style={{ padding: 20 }}>
            <h3 style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 11,
              color: 'var(--text-muted)',
              textTransform: 'uppercase',
              letterSpacing: 1,
              marginBottom: 16
            }}>
              Performance (Last 7 Days)
            </h3>
            <div style={{
              height: 160,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontFamily: 'var(--font-mono)',
              fontSize: 12,
              color: 'var(--text-muted)'
            }}>
              No data yet
            </div>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              marginTop: 8,
              fontFamily: 'var(--font-mono)',
              fontSize: 9,
              color: 'var(--text-muted)'
            }}>
              {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(d => (
                <span key={d}>{d}</span>
              ))}
            </div>
          </div>

          {/* Revision History */}
          <div className="glass-panel" style={{ padding: 20 }}>
            <h3 style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 11,
              color: 'var(--text-muted)',
              textTransform: 'uppercase',
              letterSpacing: 1,
              marginBottom: 16
            }}>
              Revision History
            </h3>
            <div style={{
              textAlign: 'center',
              fontFamily: 'var(--font-mono)',
              fontSize: 12,
              color: 'var(--text-muted)',
              padding: '24px 0'
            }}>
              No revisions yet
            </div>
          </div>

          {/* Monetization */}
          <div className="glass-panel" style={{ padding: 20, gridColumn: '1 / -1' }}>
            <h3 style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 11,
              color: 'var(--text-muted)',
              textTransform: 'uppercase',
              letterSpacing: 1,
              marginBottom: 16
            }}>
              Monetization
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontFamily: 'var(--font-sans)', fontSize: 24, fontWeight: 700, color: 'var(--accent-green)' }}>
                  ${tipsMonthly.toFixed(2)}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>Earned This Month</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontFamily: 'var(--font-sans)', fontSize: 24, fontWeight: 700, color: 'var(--accent-cyan)' }}>
                  {earnings.length}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>Revenue Events</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontFamily: 'var(--font-sans)', fontSize: 24, fontWeight: 700, color: 'var(--accent-yellow)' }}>
                  ${allTime.toFixed(2)}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>All Time</div>
              </div>
            </div>
            <div style={{
              marginTop: 16,
              padding: 12,
              background: 'var(--bg-primary)',
              borderRadius: 'var(--radius-md)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <div>
                <div style={{ fontSize: 12, marginBottom: 2 }}>Withdrawable balance:</div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--accent-cyan)' }}>
                  ${balance.toFixed(2)}
                </div>
              </div>
              <Link to="/earnings" className="btn btn-amber btn-sm">Withdraw</Link>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'projects' && (
        <div className="glass-panel" style={{ overflow: 'hidden' }}>
          {projects.length === 0 ? (
            <div style={{
              textAlign: 'center',
              padding: '48px 24px',
              fontFamily: 'var(--font-mono)',
              fontSize: 12,
              color: 'var(--text-muted)'
            }}>
              No projects yet. Click "+ New Project" to create your first one!
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                  <th style={thStyle}>Project</th>
                  <th style={thStyle}>Shapes</th>
                  <th style={thStyle}>Code Lines</th>
                  <th style={thStyle}>Last Edited</th>
                  <th style={thStyle}></th>
                </tr>
              </thead>
              <tbody>
                {projects.map(proj => (
                  <tr key={proj.id} style={{ borderBottom: '1px solid var(--border-subtle)', transition: 'background var(--transition-fast)' }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.02)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                  >
                    <td style={{ ...tdStyle, fontWeight: 600 }}>{proj.name}</td>
                    <td style={{ ...tdStyle, fontFamily: 'var(--font-mono)', fontSize: 12 }}>{proj.shapeCount}</td>
                    <td style={{ ...tdStyle, fontFamily: 'var(--font-mono)', fontSize: 12 }}>{proj.codeLines}</td>
                    <td style={{ ...tdStyle, fontSize: 12, color: 'var(--text-muted)' }}>
                      {new Date(proj.updatedAt).toLocaleString()}
                    </td>
                    <td style={tdStyle}>
                      <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                        <Link to={`/studio?project=${proj.id}`} className="btn btn-ghost" style={{ padding: '4px 10px', fontSize: 11 }}>
                          Edit
                        </Link>
                        <button onClick={() => handleDelete(proj.id)} className="btn btn-ghost"
                          style={{ padding: '4px 10px', fontSize: 11, color: '#FF5F75' }}
                          onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255, 95, 117, 0.08)')}
                          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {activeTab === 'assets' && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))',
          gap: 12
        }}>
          <div style={{
            gridColumn: '1 / -1',
            textAlign: 'center',
            padding: '48px 0',
            fontFamily: 'var(--font-mono)',
            fontSize: 12,
            color: 'var(--text-muted)'
          }}>
            No assets uploaded yet. Start by uploading your first file!
          </div>
          <div className="glass-panel" style={{
            padding: 16,
            border: '2px dashed var(--border-subtle)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: 140,
            cursor: 'pointer',
            transition: 'all var(--transition-base)'
          }}>
            <div style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
              <div style={{ fontSize: 24, marginBottom: 4 }}>+</div>
              <div style={{ fontSize: 11 }}>Upload Asset</div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

const thStyle: React.CSSProperties = {
  padding: '12px 16px',
  textAlign: 'left',
  fontFamily: 'var(--font-mono)',
  fontSize: 10,
  fontWeight: 600,
  color: 'var(--text-muted)',
  textTransform: 'uppercase',
  letterSpacing: 1
}

const tdStyle: React.CSSProperties = {
  padding: '14px 16px',
  fontSize: 13
}
