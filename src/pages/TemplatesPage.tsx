import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { listTemplates, createProjectFromTemplate, TemplateDef } from '../lib/templates'
import { useAuth } from '../context/AuthContext'
import { IconBolt, IconClock, IconWand } from '../components/Icons'

const DIFF_LABEL: Record<TemplateDef['difficulty'], { label: string; color: string }> = {
  rookie: { label: 'ROOKIE', color: 'var(--green)' },
  pro: { label: 'PRO', color: 'var(--cyan)' },
  legend: { label: 'LEGEND', color: 'var(--pink)' }
}

const GRADIENTS = [
  'linear-gradient(135deg, #1B1C24 0%, #3B2440 100%)',
  'linear-gradient(135deg, #101C2B 0%, #0E3A3A 100%)',
  'linear-gradient(135deg, #2B1020 0%, #3B2440 100%)',
  'linear-gradient(135deg, #14202E 0%, #2A2B38 100%)'
]

export default function TemplatesPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const owner = user?.email || user?.uid || 'anonymous'
  const templates = listTemplates()
  const [filter, setFilter] = useState<string>('all')
  const [used, setUsed] = useState<string | null>(null)

  const visible = filter === 'all' ? templates : templates.filter(t => t.tags.includes(filter))

  const handleUse = (template: TemplateDef) => {
    const project = createProjectFromTemplate(owner, template.id)
    if (!project) return
    setUsed(template.id)
    navigate(`/studio?project=${project.id}`)
  }

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '32px 24px', minHeight: 'calc(100vh - 60px)' }}>
      <div className="row-between" style={{ marginBottom: 4 }}>
        <h1 style={{ fontFamily: 'var(--font-sans)', fontSize: 30, fontWeight: 700 }}>Templates</h1>
      </div>
      <p style={{ fontSize: 14, color: 'var(--text-muted)', marginBottom: 24, maxWidth: 640 }}>
        Six ready-to-run starters, each wired for the arcade: scores post straight to the
        leaderboard the moment your game calls <span className="mono" style={{ fontSize: 12 }}>Open.postScore()</span>.
        Pick one, fork it, ship it.
      </p>

      <div className="row" style={{ gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
        <TagChip active={filter === 'all'} onClick={() => setFilter('all')}>all</TagChip>
        {['starter', 'physics', 'shooter', 'score', 'animation'].map(tag => (
          <TagChip
            key={tag}
            active={filter === tag}
            onClick={() => setFilter(filter === tag ? 'all' : tag)}
          >
            {tag}
          </TagChip>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
        {visible.map((template, i) => (
          <TemplateCard
            key={template.id}
            template={template}
            gradient={GRADIENTS[i % GRADIENTS.length]}
            used={used === template.id}
            onUse={() => handleUse(template)}
          />
        ))}
      </div>
    </div>
  )
}

function TagChip({ active, onClick, children }: { active: boolean; onClick(): void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`badge ${active ? 'badge-amber' : 'badge-ghost'}`}
      style={{ cursor: 'pointer', border: active ? 'none' : '1px solid var(--line)', background: active ? undefined : 'transparent', color: active ? undefined : 'var(--ink-3)' }}
    >
      {children}
    </button>
  )
}

interface CardProps {
  template: TemplateDef
  gradient: string
  used: boolean
  onUse(): void
}

function TemplateCard({ template, gradient, used, onUse }: CardProps) {
  const diff = DIFF_LABEL[template.difficulty]
  return (
    <div className="panel corner panel-hover" style={{ overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      <div style={{ height: 120, background: gradient, position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="dot-grid" style={{ position: 'absolute', inset: 0, opacity: 0.35 }} />
        <span className="badge badge-cyan" style={{ position: 'absolute', top: 10, left: 10 }}>{template.tags[0]}</span>
        <span className="badge" style={{ position: 'absolute', top: 10, right: 10, color: diff.color, borderColor: diff.color, background: 'transparent' }}>
          {diff.label}
        </span>
        <IconBolt size={34} style={{ opacity: 0.85 }} />
      </div>
      <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 8, flex: 1 }}>
        <div className="row-between">
          <h3 style={{ fontSize: 15, fontWeight: 700 }}>{template.name}</h3>
          <span className="tiny row" style={{ gap: 4, color: 'var(--ink-3)' }}>
            <IconClock size={11} /> {template.minutes} min
          </span>
        </div>
        <p className="small" style={{ color: 'var(--ink-2)', lineHeight: 1.45 }}>{template.tagline}</p>
        <p className="tiny" style={{ color: 'var(--ink-3)', lineHeight: 1.5 }}>{template.description}</p>
        <div className="row" style={{ gap: 6, marginTop: 2, flexWrap: 'wrap' }}>
          {template.tags.slice(1).map(tag => (
            <span key={tag} className="badge badge-ghost" style={{ border: '1px solid var(--line)', background: 'transparent', color: 'var(--ink-3)' }}>{tag}</span>
          ))}
        </div>
        <div style={{ flex: 1 }} />
        <button onClick={onUse} className={`btn ${used ? 'btn-ghost' : 'btn-amber'} btn-sm btn-block`} style={{ textTransform: 'uppercase', letterSpacing: 1 }}>
          <IconWand size={12} /> {used ? 'Opening Studio…' : 'Use Template'}
        </button>
      </div>
    </div>
  )
}