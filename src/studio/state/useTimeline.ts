import { useState, useCallback, useRef, useEffect } from 'react'
import { TimelineState, Layer, createLayer, addKeyframe as addKeyframeToLayer, removeKeyframe as removeKeyframeFromLayer } from '../engine/timeline'
import { VectorShape } from '../engine/shapes'
import { generateId } from '../engine/math'

export interface TimelineActions {
  setTimeline: React.Dispatch<React.SetStateAction<TimelineState>>
  setSelectedLayerId: (id: string) => void
  setIsPlaying: (playing: boolean) => void
  setOnionSkin: (onion: boolean) => void
  setPlaybackSpeed: (speed: number) => void
  setTimelineFps: (fps: number) => void
  addNewLayer: () => void
  deleteLayer: (id: string) => void
  addKeyframe: (currentFrame: number, shapes: VectorShape[]) => void
  deleteKeyframe: (currentFrame: number) => void
}

export interface TimelineStateFull {
  timeline: TimelineState
  selectedLayerId: string
  isPlaying: boolean
  onionSkin: boolean
  playbackSpeed: number
  timelineFps: number
}

export function useTimeline(): TimelineStateFull & TimelineActions {
  const [timeline, setTimeline] = useState<TimelineState>({
    layers: [createLayer('Layer 1'), createLayer('Guide')],
    currentFrame: 1,
    totalFrames: 48,
    fps: 60,
    loop: true
  })
  const [selectedLayerId, setSelectedLayerId] = useState<string>(timeline.layers[0].id)
  const [isPlaying, setIsPlaying] = useState(false)
  const [onionSkin, setOnionSkin] = useState(false)
  const [playbackSpeed, setPlaybackSpeed] = useState(1)
  const [timelineFps, setTimelineFps] = useState(60)

  const addNewLayer = useCallback(() => {
    const newLayer = createLayer(`Layer ${timeline.layers.length + 1}`)
    setTimeline(prev => ({ ...prev, layers: [...prev.layers, newLayer] }))
    setSelectedLayerId(newLayer.id)
  }, [timeline.layers.length])

  const deleteLayer = useCallback((id: string) => {
    if (timeline.layers.length <= 1) return
    setTimeline(prev => ({
      ...prev,
      layers: prev.layers.filter(l => l.id !== id)
    }))
    if (selectedLayerId === id) {
      setSelectedLayerId(timeline.layers[0].id)
    }
  }, [timeline.layers, selectedLayerId])

  const addKeyframe = useCallback((currentFrame: number, shapes: VectorShape[]) => {
    const layer = timeline.layers.find(l => l.id === selectedLayerId)
    if (!layer || layer.locked) return
    const currentShape = shapes[0] || {
      id: generateId(),
      type: 'rectangle' as const,
      name: 'Keyframe',
      transform: { x: 400, y: 225, scaleX: 1, scaleY: 1, rotation: 0, alpha: 1 },
      fill: { type: 'solid' as const, color: { r: 255, g: 230, b: 0, a: 1 } },
      stroke: { color: { r: 255, g: 255, b: 255, a: 0.5 }, width: 1, cap: 'round' as const, join: 'round' as const },
      visible: true,
      locked: false,
      points: [{ x: -25, y: -25 }, { x: 25, y: -25 }, { x: 25, y: 25 }, { x: -25, y: 25 }],
      closed: true
    }
    const updatedLayer = addKeyframeToLayer(layer, currentFrame, currentShape)
    setTimeline(prev => ({
      ...prev,
      layers: prev.layers.map(l => l.id === updatedLayer.id ? updatedLayer : l)
    }))
  }, [timeline.layers, selectedLayerId])

  const deleteKeyframe = useCallback((currentFrame: number) => {
    const layer = timeline.layers.find(l => l.id === selectedLayerId)
    if (!layer || layer.locked) return
    const updatedLayer = removeKeyframeFromLayer(layer, currentFrame)
    setTimeline(prev => ({
      ...prev,
      layers: prev.layers.map(l => l.id === updatedLayer.id ? updatedLayer : l)
    }))
  }, [timeline.layers, selectedLayerId])

  return {
    timeline,
    selectedLayerId,
    isPlaying,
    onionSkin,
    playbackSpeed,
    timelineFps,
    setTimeline,
    setSelectedLayerId,
    setIsPlaying,
    setOnionSkin,
    setPlaybackSpeed,
    setTimelineFps,
    addNewLayer,
    deleteLayer,
    addKeyframe,
    deleteKeyframe,
  }
}
