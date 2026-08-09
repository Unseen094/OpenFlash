import { memo, useRef } from 'react'
import type { ProjectMeta } from '../../lib/projects'
import type { ProjectBarProps } from './types'
import {
  IconChevronDown, IconSave, IconDot, IconArrowDown, IconArrowUp
} from '../../components/Icons'


export const ProjectBar = memo(function ProjectBar({ projectName, onProjectNameChange, projectAutosave, onToggleAutosave, onSave, onNewProject, savedProjects, isProjectsOpen, onToggleProjects, onOpenProject, onExportJson, onImportJson, isSaved }: ProjectBarProps) {
  const importRef = useRef<HTMLInputElement>(null)

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10, padding: '6px 16px',
      background: 'var(--bg-tertiary)', borderBottom: '1px solid var(--border-subtle)', flexShrink: 0,
      position: 'relative', zIndex: 100
    }}>
      <button onClick={onNewProject} className="btn btn-primary" style={{ padding: '4px 10px', fontSize: 11 }}>
        + New
      </button>
      <button onClick={onToggleProjects} className={`btn ${isProjectsOpen ? 'btn-cyan' : 'btn-ghost'}`} style={{ padding: '4px 8px', fontSize: 11 }}>
        Open <IconChevronDown size={11} />
      </button>
      {isProjectsOpen && (
        <div className="glass-panel animate-slide-up" style={{ position: 'absolute', top: 40, left: 96, width: 260, maxHeight: 300, overflow: 'auto', padding: 8, zIndex: 300 }}>
          {savedProjects.length === 0 ? (
            <div style={{ padding: '10px 12px', fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
              No saved projects yet.
            </div>
          ) : savedProjects.map((p: ProjectMeta) => (
            <button key={p.id} onClick={() => onOpenProject(p.id)}
              style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8,
                width: '100%', padding: '8px 12px', background: 'none', border: 'none', borderRadius: 'var(--radius-sm)',
                cursor: 'pointer', transition: 'background var(--transition-fast)', textAlign: 'left'
              }}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-tertiary)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
              <span style={{ fontSize: 12, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {p.name}
              </span>
              <span style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', flexShrink: 0 }}>
                {new Date(p.updatedAt).toLocaleDateString()}
              </span>
            </button>
          ))}
        </div>
      )}
      <div style={{ width: 1, height: 22, background: 'var(--border-subtle)' }} />
      <input
        value={projectName}
        onChange={e => onProjectNameChange(e.target.value)}
        spellCheck={false}
        style={{
          background: 'transparent', border: '1px solid transparent', borderRadius: 'var(--radius-sm)',
          padding: '4px 8px', fontSize: 12, width: 220, color: 'var(--text-primary)',
          fontFamily: 'var(--font-sans)', outline: 'none', transition: 'border var(--transition-fast)'
        }}
        onFocus={e => (e.currentTarget.style.border = '1px solid var(--border-subtle)')}
        onBlur={e => (e.currentTarget.style.border = '1px solid transparent')}
      />
      <button onClick={onSave} className="btn btn-ghost" style={{ padding: '4px 10px', fontSize: 11 }}>
        <IconSave size={12} /> Save
      </button>
      <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, color: 'var(--text-secondary)', cursor: 'pointer' }}>
        <input type="checkbox" checked={projectAutosave} onChange={onToggleAutosave} style={{ accentColor: 'var(--accent-cyan)' }} />
        Autosave
      </label>
      <div style={{ flex: 1 }} />
      <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: isSaved ? 'var(--accent-green)' : 'var(--text-muted)' }}>
        {isSaved ? <><IconDot size={8} style={{ color: projectAutosave ? 'var(--accent-cyan)' : 'var(--accent-green)' }} /> {projectAutosave ? 'autosaving' : 'saved'}</> : 'unsaved'}
      </span>
      <div style={{ width: 1, height: 22, background: 'var(--border-subtle)' }} />
      <input
        ref={importRef}
        type="file"
        accept=".json,application/json"
        style={{ display: 'none' }}
        onChange={e => {
          const f = e.target.files?.[0]
          if (f) onImportJson(f)
          e.currentTarget.value = ''
        }}
      />
      <button onClick={() => importRef.current?.click()} className="btn btn-ghost" style={{ padding: '4px 10px', fontSize: 11 }}>
        <IconArrowDown size={12} /> Import
      </button>
      <button onClick={onExportJson} className="btn btn-ghost" style={{ padding: '4px 10px', fontSize: 11 }}>
        <IconArrowUp size={12} /> Export
      </button>
    </div>
  )
})
