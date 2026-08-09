import { useState } from 'react'
import { memo } from 'react'
import type { OscillatorType } from '../audio/synth'
import type { AudioEngine } from '../audio/synth'
import type { AudioSynthProps } from './types'

export const AudioSynth = memo(function AudioSynth({ audioEngine }: AudioSynthProps) {
  const [activeOscillator, setActiveOscillator] = useState<OscillatorType>('square')
  const [volume, setVolume] = useState(0.3)
  const [bpm, setBpm] = useState(120)

  const playNote = (freq: number, duration = 0.2) => {
    audioEngine?.playNote({
      frequency: freq, duration, type: activeOscillator, volume,
      attack: 0.005, decay: 0.05, sustain: 0.7, release: 0.05
    })
  }

  const notes = [
    { name: 'C', freq: 261.63 }, { name: 'D', freq: 293.66 }, { name: 'E', freq: 329.63 },
    { name: 'F', freq: 349.23 }, { name: 'G', freq: 392.00 }, { name: 'A', freq: 440.00 },
    { name: 'B', freq: 493.88 }, { name: 'C\'', freq: 523.25 }
  ]

  return (
    <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div>
        <h3 style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 }}>Oscillator</h3>
        <div style={{ display: 'flex', gap: 4 }}>
          {(['sine', 'square', 'sawtooth', 'triangle'] as OscillatorType[]).map(type => (
            <button key={type} onClick={() => setActiveOscillator(type)}
              className={`btn ${activeOscillator === type ? 'btn-cyan' : 'btn-ghost'}`}
              style={{ flex: 1, padding: '4px', fontSize: 9, textTransform: 'capitalize' }}>
              {type}
            </button>
          ))}
        </div>
      </div>
      <div>
        <h3 style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 }}>Piano Keys</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(8, 1fr)', gap: 2 }}>
          {notes.map((note, i) => (
            <button key={i} onClick={() => playNote(note.freq)}
              style={{
                padding: '10px 4px', fontSize: 9, fontFamily: 'var(--font-mono)',
                background: 'var(--bg-primary)', border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-sm)', color: 'var(--text-secondary)', cursor: 'pointer',
                transition: 'all var(--transition-fast)'
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent-cyan)'; e.currentTarget.style.color = 'var(--accent-cyan)' }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-subtle)'; e.currentTarget.style.color = 'var(--text-secondary)' }}>
              {note.name}
            </button>
          ))}
        </div>
      </div>
      <div>
        <h3 style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 }}>Controls</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <label style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', width: 40 }}>Vol</label>
            <input type="range" min={0} max={1} step={0.01} value={volume} onChange={e => setVolume(Number(e.target.value))}
              style={{ flex: 1, accentColor: 'var(--accent-cyan)' }} />
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-secondary)', width: 30 }}>{Math.round(volume * 100)}%</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <label style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', width: 40 }}>BPM</label>
            <input type="number" value={bpm} onChange={e => setBpm(Number(e.target.value))} min={40} max={300}
              className="input" style={{ width: 60, padding: '2px 6px', fontSize: 10 }} />
          </div>
        </div>
      </div>
      <div>
        <h3 style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 }}>SFX Presets</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}>
          {[
            { name: 'Click', type: 'click' }, { name: 'Hit', type: 'hit' },
            { name: 'Jump', type: 'jump' }, { name: 'Shoot', type: 'shoot' },
            { name: 'Explode', type: 'explode' }
          ].map(sfx => (
            <button key={sfx.type} onClick={() => audioEngine?.playSound(sfx.type)}
              className="btn btn-ghost" style={{ padding: '6px', fontSize: 10 }}>
              {sfx.name}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
})
