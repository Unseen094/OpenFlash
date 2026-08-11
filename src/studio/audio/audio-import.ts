export interface AudioClip {
  id: string
  name: string
  buffer: AudioBuffer | null
  duration: number
  waveform: number[]
  trimStart: number
  trimEnd: number
  loop: boolean
}

export const importAudioFile = (file: File): Promise<AudioClip> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = async () => {
      try {
        const audioCtx = new AudioContext()
        const buffer = await audioCtx.decodeAudioData(reader.result as ArrayBuffer)
        const waveform = generateWaveform(buffer)
        resolve({
          id: `audio_${Date.now().toString(36)}_${Math.random().toString(36).substr(2, 6)}`,
          name: file.name.replace(/\.[^.]+$/, ''),
          buffer,
          duration: buffer.duration,
          waveform,
          trimStart: 0,
          trimEnd: buffer.duration,
          loop: false
        })
      } catch (e) { reject(e instanceof Error ? e : new Error(String(e))) }
    }
    reader.onerror = reject
    reader.readAsArrayBuffer(file)
  })
}

export const generateWaveform = (buffer: AudioBuffer, samples = 100): number[] => {
  const data = buffer.getChannelData(0)
  const blockSize = Math.floor(data.length / samples)
  const waveform: number[] = []
  for (let i = 0; i < samples; i++) {
    let sum = 0
    for (let j = 0; j < blockSize; j++) {
      sum += Math.abs(data[i * blockSize + j])
    }
    waveform.push(sum / blockSize)
  }
  return waveform
}

export const renderWaveform = (ctx: CanvasRenderingContext2D, waveform: number[], width: number, height: number, color = '#00F0FF') => {
  ctx.fillStyle = color
  const barWidth = width / waveform.length
  const maxVal = Math.max(...waveform, 0.01)
  for (let i = 0; i < waveform.length; i++) {
    const barHeight = (waveform[i] / maxVal) * height * 0.8
    ctx.fillRect(i * barWidth, (height - barHeight) / 2, barWidth - 1, barHeight)
  }
}

export const exportWav = (buffer: AudioBuffer): void => {
  const numChannels = buffer.numberOfChannels
  const sampleRate = buffer.sampleRate
  const format = 1
  const bitDepth = 16
  const bytesPerSample = bitDepth / 8
  const blockAlign = numChannels * bytesPerSample
  const dataLength = buffer.length * blockAlign
  const bufferLength = 44 + dataLength
  const arrayBuffer = new ArrayBuffer(bufferLength)
  const view = new DataView(arrayBuffer)

  const writeString = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i))
  }

  writeString(0, 'RIFF')
  view.setUint32(4, 36 + dataLength, true)
  writeString(8, 'WAVE')
  writeString(12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, format, true)
  view.setUint16(22, numChannels, true)
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * blockAlign, true)
  view.setUint16(32, blockAlign, true)
  view.setUint16(34, bitDepth, true)
  writeString(36, 'data')
  view.setUint32(40, dataLength, true)

  const channels: Float32Array[] = []
  for (let i = 0; i < numChannels; i++) channels.push(buffer.getChannelData(i))
  let offset = 44
  for (let i = 0; i < buffer.length; i++) {
    for (let ch = 0; ch < numChannels; ch++) {
      const sample = Math.max(-1, Math.min(1, channels[ch][i]))
      view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7FFF, true)
      offset += 2
    }
  }

  const blob = new Blob([arrayBuffer], { type: 'audio/wav' })
  const link = document.createElement('a')
  link.download = 'audio.wav'
  link.href = URL.createObjectURL(blob)
  link.click()
}
