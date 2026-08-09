import { useState, useCallback, useRef } from 'react'
import { VectorShape } from '../engine/shapes'
import { generateId, deepClone, Transform } from '../engine/math'
import { duplicateShapes, alignShapes, distributeShapes, changeZOrder, rotateCanvas, flipCanvas, zoomToFit as zoomToFitFn } from '../engine/canvas-features'
import { selectAll, invertSelection, groupShapes, ungroupShapes } from '../engine/selection'
import { showToast } from '../../components/Toast'

export const MAX_UNDO_STACK = 50

export interface DocumentState {
  shapes: VectorShape[]
  selectedShapeIds: Set<string>
  clipboard: VectorShape[]
}

export interface DocumentActions {
  setShapes: React.Dispatch<React.SetStateAction<VectorShape[]>>
  setSelectedShapeIds: React.Dispatch<React.SetStateAction<Set<string>>>
  addShape: (shape: VectorShape) => void
  updateShape: (id: string, patch: Partial<VectorShape>) => void
  updateShapeTransform: (id: string, patch: Partial<Transform>) => void
  deleteSelectedShapes: () => void
  selectShape: (id: string, multi?: boolean) => void
  selectAllShapes: () => void
  invertSelection: () => void
  copySelected: () => void
  paste: () => void
  duplicate: () => void
  group: () => void
  ungroup: () => void
  align: (mode: 'left' | 'right' | 'top' | 'bottom' | 'center-h' | 'center-v') => void
  distribute: (mode: 'horizontal' | 'vertical') => void
  changeZOrder: (direction: 'up' | 'down' | 'top' | 'bottom') => void
  rotate: (angle: number, canvasWidth: number, canvasHeight: number) => void
  flip: (horizontal: boolean, canvasWidth: number, canvasHeight: number) => void
  zoomToFit: (shapes: VectorShape[], canvasWidth: number, canvasHeight: number) => { zoom: number; pan: { x: number; y: number } }
  undo: () => void
  redo: () => void
  canUndo: boolean
  canRedo: boolean
  clearAll: () => void
}

export function useDocument(): DocumentState & DocumentActions {
  const [shapes, setShapes] = useState<VectorShape[]>([])
  const [selectedShapeIds, setSelectedShapeIds] = useState<Set<string>>(new Set())
  const [clipboard, setClipboard] = useState<VectorShape[]>([])
  const undoStack = useRef<VectorShape[][]>([])
  const redoStack = useRef<VectorShape[][]>([])

  const pushUndo = useCallback(() => {
    undoStack.current = undoStack.current.slice(-49)
    undoStack.current.push(deepClone(shapes))
    redoStack.current = []
  }, [shapes])

  const undo = useCallback(() => {
    if (undoStack.current.length === 0) return
    redoStack.current.push(deepClone(shapes))
    const prev = undoStack.current.pop()!
    setShapes(prev)
  }, [])

  const redo = useCallback(() => {
    if (redoStack.current.length === 0) return
    undoStack.current.push(deepClone(shapes))
    const next = redoStack.current.pop()!
    setShapes(next)
  }, [])

  const addShape = useCallback((shape: VectorShape) => {
    setShapes(prev => [...prev, shape])
  }, [])

  const updateShape = useCallback((id: string, patch: Partial<VectorShape>) => {
    setShapes(prev => prev.map(s => s.id === id ? { ...s, ...patch } : s))
  }, [])

  const updateShapeTransform = useCallback((id: string, patch: Partial<Transform>) => {
    setShapes(prev => prev.map(s =>
      s.id === id ? { ...s, transform: { ...s.transform, ...patch } } : s
    ))
  }, [])

  const deleteSelectedShapes = useCallback(() => {
    if (selectedShapeIds.size === 0) return
    pushUndo()
    setShapes(prev => prev.filter(s => !selectedShapeIds.has(s.id)))
    setSelectedShapeIds(new Set())
  }, [selectedShapeIds, pushUndo])

  const selectShape = useCallback((id: string, multi = false) => {
    setSelectedShapeIds(prev => {
      if (multi) {
        const next = new Set(prev)
        if (next.has(id)) next.delete(id)
        else next.add(id)
        return next
      }
      return new Set([id])
    })
  }, [])

  const selectAllShapes = useCallback(() => {
    setSelectedShapeIds(new Set(shapes.map(s => s.id)))
  }, [shapes])

  const invertSelectionCb = useCallback(() => {
    setSelectedShapeIds(prev => invertSelection(shapes, prev))
  }, [shapes])

  const copySelected = useCallback(() => {
    const selected = shapes.filter(s => selectedShapeIds.has(s.id))
    setClipboard(selected)
    showToast(`Copied ${selected.length} shape${selected.length > 1 ? 's' : ''}`, 'info')
  }, [shapes, selectedShapeIds])

  const paste = useCallback(() => {
    if (clipboard.length === 0) return
    pushUndo()
    const pasted = clipboard.map(s => ({
      ...deepClone(s),
      id: generateId(),
      transform: { ...s.transform, x: s.transform.x + 30, y: s.transform.y + 30 }
    }))
    setShapes(prev => [...prev, ...pasted])
    showToast(`Pasted ${pasted.length} shape${pasted.length > 1 ? 's' : ''}`, 'success')
  }, [clipboard, pushUndo])

  const duplicate = useCallback(() => {
    if (selectedShapeIds.size === 0) return
    pushUndo()
    setShapes(prev => duplicateShapes(prev, selectedShapeIds))
  }, [selectedShapeIds, pushUndo])

  const group = useCallback(() => {
    if (selectedShapeIds.size < 2) return
    pushUndo()
    setShapes(prev => groupShapes(prev, selectedShapeIds))
    showToast('Grouped shapes', 'success')
  }, [selectedShapeIds, pushUndo])

  const ungroup = useCallback(() => {
    const selected = shapes.filter(s => selectedShapeIds.has(s.id))
    const hasGroup = selected.some(s => s.type === 'group')
    if (!hasGroup) return
    pushUndo()
    let result = shapes
    for (const s of selected) {
      if (s.type === 'group') result = ungroupShapes(result, s.id)
    }
    setShapes(result)
    showToast('Ungrouped shapes', 'success')
  }, [shapes, selectedShapeIds, pushUndo])

  const align = useCallback((mode: 'left' | 'right' | 'top' | 'bottom' | 'center-h' | 'center-v') => {
    if (selectedShapeIds.size < 2) return
    pushUndo()
    const selected = shapes.filter(s => selectedShapeIds.has(s.id))
    const aligned = alignShapes(selected, mode, 800, 450)
    setShapes(prev => prev.map(s => aligned.find(a => a.id === s.id) || s))
  }, [shapes, selectedShapeIds, pushUndo])

  const distribute = useCallback((mode: 'horizontal' | 'vertical') => {
    if (selectedShapeIds.size < 3) return
    pushUndo()
    const selected = shapes.filter(s => selectedShapeIds.has(s.id))
    const distributed = distributeShapes(selected, mode)
    setShapes(prev => prev.map(s => distributed.find(d => d.id === s.id) || s))
  }, [shapes, selectedShapeIds, pushUndo])

  const changeZOrderCb = useCallback((direction: 'up' | 'down' | 'top' | 'bottom') => {
    if (selectedShapeIds.size === 0) return
    pushUndo()
    setShapes(prev => changeZOrder(prev, selectedShapeIds, direction))
  }, [selectedShapeIds, pushUndo])

  const rotateCb = useCallback((angle: number, canvasWidth: number, canvasHeight: number) => {
    pushUndo()
    setShapes(prev => rotateCanvas(prev, angle, canvasWidth, canvasHeight))
  }, [pushUndo])

  const flipCb = useCallback((horizontal: boolean, canvasWidth: number, canvasHeight: number) => {
    pushUndo()
    setShapes(prev => flipCanvas(prev, horizontal, canvasWidth, canvasHeight))
  }, [pushUndo])

  const zoomToFit = useCallback((shapesParam: VectorShape[], canvasWidth: number, canvasHeight: number) => {
    const { zoom: z, pan } = zoomToFitFn(shapesParam, canvasWidth, canvasHeight)
    return { zoom: z, pan }
  }, [])

  const clearAll = useCallback(() => {
    if (shapes.length === 0) return
    if (window.confirm('Clear all shapes from the canvas?')) {
      pushUndo()
      setShapes([])
      setSelectedShapeIds(new Set())
    }
  }, [shapes, pushUndo])

  return {
    shapes,
    selectedShapeIds,
    clipboard,
    setShapes,
    setSelectedShapeIds,
    addShape,
    updateShape,
    updateShapeTransform,
    deleteSelectedShapes,
    selectShape,
    selectAllShapes,
    invertSelection: invertSelectionCb,
    copySelected,
    paste,
    duplicate,
    group,
    ungroup,
    align,
    distribute,
    changeZOrder: changeZOrderCb,
    rotate: rotateCb,
    flip: flipCb,
    zoomToFit,
    undo,
    redo,
    canUndo: undoStack.current.length > 0,
    canRedo: redoStack.current.length > 0,
    clearAll
  }
}
