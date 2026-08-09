import { useState, useCallback } from 'react'
import { Vector2 } from '../engine/math'
import { zoomToFit } from '../engine/canvas-features'
import { VectorShape } from '../engine/shapes'

export interface CanvasViewState {
  zoom: number
  panOffset: Vector2
  guides: Array<{ id: string; orientation: 'horizontal' | 'vertical'; position: number }>
  cursorPos: Vector2
}

export interface CanvasViewActions {
  setZoom: (zoom: number) => void
  setPanOffset: (offset: Vector2) => void
  setGuides: (guides: Array<{ id: string; orientation: 'horizontal' | 'vertical'; position: number }>) => void
  setCursorPos: (pos: Vector2) => void
  addGuide: (orientation: 'horizontal' | 'vertical', position: number) => void
  removeGuide: (id: string) => void
  handleZoomToFit: (shapes: VectorShape[], canvasWidth: number, canvasHeight: number) => void
  handleZoomIn: () => void
  handleZoomOut: () => void
  handleZoomReset: () => void
}

export function useCanvasView(): CanvasViewState & CanvasViewActions {
  const [zoom, setZoom] = useState(1)
  const [panOffset, setPanOffset] = useState<Vector2>({ x: 0, y: 0 })
  const [guides, setGuides] = useState<Array<{ id: string; orientation: 'horizontal' | 'vertical'; position: number }>>([])
  const [cursorPos, setCursorPos] = useState<Vector2>({ x: 0, y: 0 })

  const addGuide = useCallback((orientation: 'horizontal' | 'vertical', position: number) => {
    setGuides(prev => [...prev, { id: `guide_${Date.now().toString(36)}_${Math.random().toString(36).substr(2, 6)}`, orientation, position }])
  }, [])

  const removeGuide = useCallback((id: string) => {
    setGuides(prev => prev.filter(g => g.id !== id))
  }, [])

  const handleZoomToFit = useCallback((shapes: VectorShape[], canvasWidth: number, canvasHeight: number) => {
    const { zoom: z, pan } = zoomToFit(shapes, canvasWidth, canvasHeight)
    setZoom(z)
    setPanOffset(pan)
  }, [])

  const handleZoomIn = useCallback(() => setZoom(z => Math.min(3, z + 0.1)), [])
  const handleZoomOut = useCallback(() => setZoom(z => Math.max(0.2, z - 0.1)), [])
  const handleZoomReset = useCallback(() => setZoom(1), [])

  return {
    zoom,
    panOffset,
    guides,
    cursorPos,
    setZoom,
    setPanOffset,
    setGuides,
    setCursorPos,
    addGuide,
    removeGuide,
    handleZoomToFit,
    handleZoomIn,
    handleZoomOut,
    handleZoomReset,
  }
}
