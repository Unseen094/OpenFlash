import { useState, useCallback } from 'react'
import { Asset, SvgElement } from '../components/types'
import { importAudioFile } from '../../studio/audio/audio-import'
import { showToast } from '../../components/Toast'

export interface AudioClip {
  id: string
  name: string
  duration: number
  waveform: number[]
}

export interface AssetsState {
  assets: Asset[]
  svgElements: SvgElement[]
  svgSelectedId: string | null
  svgTool: SvgElement['type'] | 'select'
  audioClips: AudioClip[]
}

export interface AssetsActions {
  setAssets: React.Dispatch<React.SetStateAction<Asset[]>>
  addSvgElement: (type: SvgElement['type']) => void
  updateSvgAttr: (id: string, attr: string, value: string | number) => void
  updateSvgStyle: (id: string, style: Partial<Pick<SvgElement, 'fill' | 'stroke' | 'strokeWidth'>>) => void
  removeSvgElement: (id: string) => void
  selectSvgElement: (id: string) => void
  setSvgTool: (tool: SvgElement['type'] | 'select') => void
  importAssets: (files: FileList | File[]) => void
  removeAsset: (id: string) => void
  importAudio: (file: File) => void
  exportSvg: (elements: SvgElement[]) => void
}

export function useAssets(): AssetsState & AssetsActions {
  const [assets, setAssets] = useState<Asset[]>([])
  const [svgElements, setSvgElements] = useState<SvgElement[]>([])
  const [svgSelectedId, setSvgSelectedId] = useState<string | null>(null)
  const [svgTool, setSvgTool] = useState<SvgElement['type'] | 'select'>('select')
  const [audioClips, setAudioClips] = useState<AudioClip[]>([])

  const importAssets = useCallback((files: FileList | File[]) => {
    Array.from(files).forEach(file => {
      if (!file.type.startsWith('image/') && !file.type.includes('svg')) return
      const reader = new FileReader()
      reader.onload = () => {
        const src = String(reader.result)
        const isSvg = file.type.includes('svg') || file.name.endsWith('.svg')
        const id = `asset_${Date.now().toString(36)}_${Math.random().toString(36).substr(2, 6)}`
        const name = file.name.replace(/\.[^.]+$/, '')

        if (isSvg) {
          const asset: Asset = { id, name, type: 'svg', src, width: 100, height: 100, createdAt: Date.now() }
          setAssets(prev => [...prev, asset])
        } else {
          const img = new Image()
          img.onload = () => {
            const asset: Asset = { id, name, type: 'image', src, width: img.naturalWidth, height: img.naturalHeight, createdAt: Date.now() }
            setAssets(prev => [...prev, asset])
          }
          img.src = src
        }
      }
      reader.readAsDataURL(file)
    })
  }, [])

  const removeAsset = useCallback((id: string) => {
    setAssets(prev => prev.filter(a => a.id !== id))
  }, [])

  const importAudio = useCallback((file: File) => {
    importAudioFile(file).then((clip) => {
      setAudioClips(prev => [...prev, { id: clip.id, name: clip.name, duration: clip.duration, waveform: clip.waveform }])
      showToast(`Imported ${clip.name}`, 'success')
    }).catch(() => showToast('Failed to import audio', 'error'))
  }, [])

  const addSvgElement = useCallback((type: SvgElement['type']) => {
    const id = `svg_${Date.now().toString(36)}_${Math.random().toString(36).substr(2, 6)}`
    const base: SvgElement = { id, type, attrs: {}, fill: '#FFE600', stroke: '#FFFFFF', strokeWidth: 2 }
    switch (type) {
      case 'rect': base.attrs = { x: 80, y: 60, width: 120, height: 80 }; break
      case 'circle': base.attrs = { cx: 140, cy: 100, r: 50 }; break
      case 'ellipse': base.attrs = { cx: 140, cy: 100, rx: 70, ry: 40 }; break
      case 'line': base.attrs = { x1: 60, y1: 60, x2: 220, y2: 140 }; break
      case 'polygon': base.attrs = { points: '140,50 200,150 80,150' }; break
      case 'path': base.attrs = { d: 'M60,100 C60,60 200,60 200,100 S60,140 60,100' }; break
      case 'text': base.attrs = { x: 100, y: 110, text: 'Text', fontSize: 24 }; break
    }
    setSvgElements(prev => [...prev, base])
    setSvgSelectedId(id)
  }, [])

  const updateSvgAttr = useCallback((id: string, attr: string, value: string | number) => {
    setSvgElements(prev => prev.map(el =>
      el.id === id ? { ...el, attrs: { ...el.attrs, [attr]: value } } : el
    ))
  }, [])

  const updateSvgStyle = useCallback((id: string, style: Partial<Pick<SvgElement, 'fill' | 'stroke' | 'strokeWidth'>>) => {
    setSvgElements(prev => prev.map(el =>
      el.id === id ? { ...el, ...style } : el
    ))
  }, [])

  const removeSvgElement = useCallback((id: string) => {
    setSvgElements(prev => prev.filter(el => el.id !== id))
    if (svgSelectedId === id) setSvgSelectedId(null)
  }, [svgSelectedId])

  const selectSvgElement = useCallback((id: string) => {
    setSvgSelectedId(id)
  }, [])

  const exportSvg = useCallback((elements: SvgElement[]) => {
    const svgAttrs = `xmlns="http://www.w3.org/2000/svg" viewBox="0 0 280 200"`
    const elementStrings = elements.map(el => {
      const a = el.attrs
      const style = `fill:${el.fill};stroke:${el.stroke};stroke-width:${el.strokeWidth}`
      switch (el.type) {
        case 'rect': return `<rect x="${a.x}" y="${a.y}" width="${a.width}" height="${a.height}" style="${style}" />`
        case 'circle': return `<circle cx="${a.cx}" cy="${a.cy}" r="${a.r}" style="${style}" />`
        case 'ellipse': return `<ellipse cx="${a.cx}" cy="${a.cy}" rx="${a.rx}" ry="${a.ry}" style="${style}" />`
        case 'line': return `<line x1="${a.x1}" y1="${a.y1}" x2="${a.x2}" y2="${a.y2}" style="${style}" stroke="${el.stroke}" />`
        case 'polygon': return `<polygon points="${a.points}" style="${style}" />`
        case 'path': return `<path d="${a.d}" style="${style}" fill="none" />`
        case 'text': return `<text x="${a.x}" y="${a.y}" font-size="${a.fontSize}" style="${style}" text-anchor="middle">${a.text}</text>`
        default: return ''
      }
    }).join('\n  ')
    const svg = `<svg ${svgAttrs}>\n  ${elementStrings}\n</svg>`
    const blob = new Blob([svg], { type: 'image/svg+xml' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'openflash-graphic.svg'
    a.click()
    URL.revokeObjectURL(url)
  }, [])

  return {
    assets,
    svgElements,
    svgSelectedId,
    svgTool,
    audioClips,
    setAssets,
    addSvgElement,
    updateSvgAttr,
    updateSvgStyle,
    removeSvgElement,
    selectSvgElement,
    setSvgTool,
    importAssets,
    removeAsset,
    importAudio,
    exportSvg
  }
}
