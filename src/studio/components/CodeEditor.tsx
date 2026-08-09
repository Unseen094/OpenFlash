import { memo } from 'react'
import { IconPlay, IconStop } from '../../components/Icons'
import type { CodeEditorProps } from './types'

export const CodeEditor = memo(function CodeEditor({ code, codeOutput, onCodeChange, onRunCode, isRunning }: CodeEditorProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ padding: '8px 12px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)' }}>TypeScript</span>
        <button className="btn btn-primary" onClick={onRunCode} style={{ padding: '4px 10px', fontSize: 10 }}>
          {isRunning ? <><IconStop size={11} /> Stop</> : <><IconPlay size={11} /> Run</>}
        </button>
      </div>
      <textarea value={code} onChange={e => onCodeChange(e.target.value)} spellCheck={false}
        placeholder={"// OpenFlash TypeScript API"}
        style={{
          flex: 1, background: 'transparent', border: 'none', resize: 'none', outline: 'none',
          padding: 12, fontFamily: 'var(--font-mono)', fontSize: 11, lineHeight: 1.6,
          color: 'var(--text-primary)', tabSize: 2, minHeight: 200
        }} />
      <div style={{ borderTop: '1px solid var(--border-subtle)', maxHeight: 120, overflow: 'auto' }}>
        <div style={{ padding: '6px 12px', fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)', background: 'var(--bg-primary)' }}>Output</div>
        <pre style={{ padding: '8px 12px', fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--accent-green)', whiteSpace: 'pre-wrap', margin: 0 }}>
          {codeOutput}
        </pre>
      </div>
    </div>
  )
})
