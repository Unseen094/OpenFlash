export type OscillatorType = 'sine' | 'square' | 'sawtooth' | 'triangle'

export interface SynthNote {
  frequency: number
  duration: number
  type: OscillatorType
  volume: number
  attack: number
  decay: number
  sustain: number
  release: number
}

export interface SynthSequence {
  notes: Array<{ note: SynthNote; startTime: number }>
  bpm: number
  loop: boolean
}

export const NOTE_FREQUENCIES: Record<string, number> = {
  'C3': 130.81, 'C#3': 138.59, 'D3': 146.83, 'D#3': 155.56, 'E3': 164.81,
  'F3': 174.61, 'F#3': 185.00, 'G3': 196.00, 'G#3': 207.65, 'A3': 220.00,
  'A#3': 233.08, 'B3': 246.94,
  'C4': 261.63, 'C#4': 277.18, 'D4': 293.66, 'D#4': 311.13, 'E4': 329.63,
  'F4': 349.23, 'F#4': 369.99, 'G4': 392.00, 'G#4': 415.30, 'A4': 440.00,
  'A#4': 466.16, 'B4': 493.88,
  'C5': 523.25, 'C#5': 554.37, 'D5': 587.33, 'D#5': 622.25, 'E5': 659.25,
  'F5': 698.46, 'F#5': 739.99, 'G5': 783.99, 'G#5': 830.61, 'A5': 880.00,
  'A#5': 932.33, 'B5': 987.77,
  'C6': 1046.50
}

export class AudioEngine {
  private context: AudioContext | null = null
  private masterGain: GainNode | null = null
  private compressor: DynamicsCompressorNode | null = null
  private reverbNode: ConvolverNode | null = null
  private activeOscillators: Map<string, { osc: OscillatorNode; gain: GainNode }> = new Map()
  private isInitialized = false

  async initialize(): Promise<void> {
    if (this.isInitialized) return
    this.context = new AudioContext()
    this.masterGain = this.context.createGain()
    this.masterGain.gain.value = 0.5
    this.compressor = this.context.createDynamicsCompressor()
    this.compressor.threshold.value = -24
    this.compressor.knee.value = 30
    this.compressor.ratio.value = 12
    this.compressor.attack.value = 0.003
    this.compressor.release.value = 0.25
    this.reverbNode = await this.createReverb()
    this.masterGain.connect(this.compressor)
    this.compressor.connect(this.context.destination)
    this.isInitialized = true
  }

  private createReverb(): ConvolverNode {
    const ctx = this.context!
    const rate = ctx.sampleRate
    const length = rate * 1.5
    const impulse = ctx.createBuffer(2, length, rate)
    for (let channel = 0; channel < 2; channel++) {
      const data = impulse.getChannelData(channel)
      for (let i = 0; i < length; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, 2.5)
      }
    }
    const convolver = ctx.createConvolver()
    convolver.buffer = impulse
    return convolver
  }

  setMasterVolume(volume: number): void {
    if (this.masterGain) {
      this.masterGain.gain.setTargetAtTime(volume, this.context!.currentTime, 0.01)
    }
  }

  playNote(note: SynthNote, id?: string): void {
    if (!this.context || !this.masterGain) return
    const ctx = this.context
    const now = ctx.currentTime

    const osc = ctx.createOscillator()
    const gainNode = ctx.createGain()
    const filter = ctx.createBiquadFilter()

    osc.type = note.type
    osc.frequency.setValueAtTime(note.frequency, now)

    filter.type = 'lowpass'
    filter.frequency.setValueAtTime(2000, now)
    filter.Q.setValueAtTime(1, now)

    const peakGain = note.volume * 0.3
    gainNode.gain.setValueAtTime(0, now)
    gainNode.gain.linearRampToValueAtTime(peakGain, now + note.attack)
    gainNode.gain.linearRampToValueAtTime(peakGain * note.sustain, now + note.attack + note.decay)
    gainNode.gain.linearRampToValueAtTime(0, now + note.duration + note.release)

    osc.connect(filter)
    filter.connect(gainNode)
    gainNode.connect(this.masterGain)

    osc.start(now)
    osc.stop(now + note.duration + note.release + 0.1)

    if (id) {
      this.activeOscillators.set(id, { osc, gain: gainNode })
      osc.onended = () => this.activeOscillators.delete(id)
    }
  }

  playNoteByName(name: string, type: OscillatorType = 'square', duration = 0.2): void {
    const freq = NOTE_FREQUENCIES[name]
    if (!freq) return
    this.playNote({
      frequency: freq,
      duration,
      type,
      volume: 0.5,
      attack: 0.005,
      decay: 0.05,
      sustain: 0.7,
      release: 0.05
    })
  }

  playMelody(notes: Array<{ name: string; duration: number; type?: OscillatorType }>, bpm = 120): void {
    const beatDuration = 60 / bpm
    let time = 0
    notes.forEach((note) => {
      setTimeout(() => {
        this.playNoteByName(note.name, note.type || 'square', note.duration * beatDuration)
      }, time * 1000)
      time += note.duration * beatDuration
    })
  }

  playClick(volume = 0.1): void {
    if (!this.context) return
    const osc = this.context.createOscillator()
    const gain = this.context.createGain()
    osc.type = 'square'
    osc.frequency.setValueAtTime(1800, this.context.currentTime)
    gain.gain.setValueAtTime(volume, this.context.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, this.context.currentTime + 0.03)
    osc.connect(gain)
    gain.connect(this.context.destination)
    osc.start()
    osc.stop(this.context.currentTime + 0.03)
  }

  playSound(name: string): void {
    switch (name) {
      case 'click':
        this.playClick()
        break
      case 'hit':
        this.playNoteByName('C5', 'square', 0.1)
        break
      case 'jump':
        this.playNoteByName('A4', 'square', 0.15)
        setTimeout(() => this.playNoteByName('C5', 'square', 0.1), 80)
        break
      case 'shoot':
        this.playNoteByName('E5', 'sawtooth', 0.12)
        break
      case 'explode':
        this.playNoteByName('C3', 'sawtooth', 0.3)
        setTimeout(() => this.playNoteByName('C4', 'sawtooth', 0.2), 100)
        break
    }
  }

  playRewindEffect(duration = 0.3): void {
    if (!this.context) return
    const osc = this.context.createOscillator()
    const gain = this.context.createGain()
    osc.type = 'sawtooth'
    osc.frequency.setValueAtTime(800, this.context.currentTime)
    osc.frequency.exponentialRampToValueAtTime(100, this.context.currentTime + duration)
    gain.gain.setValueAtTime(0.15, this.context.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, this.context.currentTime + duration)
    osc.connect(gain)
    gain.connect(this.context.destination)
    osc.start()
    osc.stop(this.context.currentTime + duration)
  }

  stopNote(id: string): void {
    const entry = this.activeOscillators.get(id)
    if (entry) {
      entry.gain.gain.setTargetAtTime(0, this.context!.currentTime, 0.01)
      setTimeout(() => {
        try { entry.osc.stop() } catch (e) {
          console.error('[synth] Oscillator stop failed:', e)
        }
        this.activeOscillators.delete(id)
      }, 50)
    }
  }

  stopAll(): void {
    this.activeOscillators.forEach((_, id) => this.stopNote(id))
  }

  getContext(): AudioContext | null {
    return this.context
  }

  dispose(): void {
    this.stopAll()
    if (this.context) {
      void this.context.close()
      this.context = null
    }
    this.isInitialized = false
  }
}

export const createDefaultNote = (frequency = 440, type: OscillatorType = 'square'): SynthNote => ({
  frequency,
  duration: 0.2,
  type,
  volume: 0.5,
  attack: 0.005,
  decay: 0.05,
  sustain: 0.7,
  release: 0.05
})

export const generateTone = (frequency: number, duration: number, type: OscillatorType = 'sine'): AudioBuffer | null => {
  const sampleRate = 44100
  const length = Math.floor(sampleRate * duration)
  const buffer = new AudioBuffer({ length, sampleRate })
  const data = buffer.getChannelData(0)

  for (let i = 0; i < length; i++) {
    const t = i / sampleRate
    let sample = 0
    switch (type) {
      case 'sine':
        sample = Math.sin(2 * Math.PI * frequency * t)
        break
      case 'square':
        sample = Math.sin(2 * Math.PI * frequency * t) > 0 ? 1 : -1
        break
      case 'sawtooth':
        sample = 2 * (frequency * t - Math.floor(frequency * t + 0.5))
        break
      case 'triangle':
        sample = 2 * Math.abs(2 * (frequency * t - Math.floor(frequency * t + 0.5))) - 1
        break
    }
    const envelope = Math.exp(-3 * t / duration)
    data[i] = sample * envelope * 0.5
  }
  return buffer
}
