import { useState, useEffect, useRef, useCallback } from 'react'
import { DrawingEngine, ToolState, defaultToolState, ToolType } from '../studio/engine/tools'
import { VectorShape, renderShape } from '../studio/engine/shapes'
import { TimelineState, createLayer, addKeyframe as addKeyframeToLayer, getOnionSkinFrames, removeKeyframe as removeKeyframeFromLayer } from '../studio/engine/timeline'
import { AudioEngine } from '../studio/audio/synth'
import { downloadExport, exportFrameAsPNG, exportFrameAsSVG } from '../studio/engine/exporter'
import { Vector2, Transform, generateId } from '../studio/engine/math'
import { applyShaderOverlay, ShaderType } from '../studio/engine/shaders'
import { StudioSandbox } from '../studio/runtime/sandbox'
import { useAuth } from '../context/AuthContext'
import {
  ProjectData, ProjectMeta, createEmptyProject, loadProject, saveProject, listProjects,
  exportProjectJson, importProjectJson
} from '../lib/projects'
import {
  snapPoint, alignShapes, distributeShapes, duplicateShapes,
  changeZOrder, rotateCanvas, flipCanvas, zoomToFit
} from '../studio/engine/canvas-features'
import { groupShapes } from '../studio/engine/selection'
import { showToast } from '../components/Toast'
import { FullscreenPreview } from '../studio/components/FullscreenPreview'
import { Toolbar } from '../studio/components/Toolbar'
import { CanvasArea } from '../studio/components/CanvasArea'
import { TimelineArea } from '../studio/components/TimelineArea'
import { SidePanel } from '../studio/components/SidePanel'
import { ProjectBar } from '../studio/components/ProjectBar'
import { ExplorerPanel } from '../studio/components/ExplorerPanel'
import type { Asset, SvgElement } from '../studio/components/types'
import { ContextMenu } from '../components/ContextMenu'
import { KeyboardShortcuts } from '../components/KeyboardShortcuts'
import { CollabBus } from '../studio/collab/collabBus'
import { applyOp } from '../studio/collab/merge'
import { CollabPanel } from '../studio/collab/CollabPanel'
import type { PeerInfo } from '../studio/collab/types'
import { IconArrowUpLeft, IconCircleFilled, IconPencil, IconCircleDotted, IconDiagonal,
  IconSquare, IconCircle, IconSquareHalf, IconDroplet, IconText,
  IconLayers, IconTrash, IconCopy, IconPaste, IconUsers
} from '../components/Icons'

const STAGE_WIDTH = 800
const STAGE_HEIGHT = 450

/**
 * Returns a callback with a stable identity that always invokes the latest
 * closure. Needed so memoized children aren't invalidated every render by
 * freshly-allocated handler props.
 */
function useStableCallback<A extends unknown[], R>(fn: (..._a: A) => R): (..._a: A) => R {
  const ref = useRef(fn)
  ref.current = fn
  return useCallback((...args: A) => ref.current(...args), [])
}

export default function StudioPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null)
  const drawEngineRef = useRef<DrawingEngine | null>(null)
  const audioEngineRef = useRef<AudioEngine | null>(null)
  const sandboxRef = useRef<StudioSandbox | null>(null)

  const [toolState, setToolState] = useState<ToolState>(defaultToolState)
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
  const [zoom, setZoom] = useState(1)
  const [panOffset, setPanOffset] = useState<Vector2>({ x: 0, y: 0 })
  const [shapes, setShapes] = useState<VectorShape[]>([])
  const [selectedShapeIds, setSelectedShapeIds] = useState<Set<string>>(new Set())
  const [code, setCode] = useState('')
  const [codeOutput, setCodeOutput] = useState('[console] Ready')
  const [isRunning, setIsRunning] = useState(false)
  const [activePanel, setActivePanel] = useState<'properties' | 'assets' | 'svg-maker' | 'code' | 'audio'>('properties')
  const activePanelRef = useRef(activePanel)
  activePanelRef.current = activePanel
  const [shaders, setShaders] = useState<Set<ShaderType>>(new Set())
  const [cursorPos, setCursorPos] = useState<Vector2>({ x: 0, y: 0 })
  const [fps, setFps] = useState(0)
  const [playbackSpeed, setPlaybackSpeed] = useState(1)
  const [timelineFps, setTimelineFps] = useState(60)
  const [undoStack, setUndoStack] = useState<VectorShape[][]>([])
  const [redoStack, setRedoStack] = useState<VectorShape[][]>([])
  const [guides] = useState<Array<{ id: string; orientation: 'horizontal' | 'vertical'; position: number }>>([])
  const [recentColors, setRecentColors] = useState<string[]>([])
  const [clipboard, setClipboard] = useState<VectorShape[]>([])
  const [showShortcuts, setShowShortcuts] = useState(false)
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null)
  const [audioClips] = useState<Array<{ id: string; name: string; duration: number; waveform: number[] }>>([])
  const [unsavedChanges, setUnsavedChanges] = useState(false)
  const [, setLastSaved] = useState<number | null>(null)

  // ─── Collab ─────────────────────────────────────────────────────────────────
  const collabBusRef = useRef<CollabBus | null>(null)
  const [collabEnabled, setCollabEnabled] = useState(false)
  const [collabPeers, setCollabPeers] = useState<PeerInfo[]>([])
  const [collabConnected, setCollabConnected] = useState(false)
  const [collabName, setCollabName] = useState('')
  const shapesSnapshotRef = useRef<VectorShape[]>([])

  // ─── Assets ─────────────────────────────────────────────────────────────────
  const [assets, setAssets] = useState<Asset[]>([])

  const [svgElements, setSvgElements] = useState<SvgElement[]>([])
  const [svgSelectedId, setSvgSelectedId] = useState<string | null>(null)
  const [svgTool, setSvgTool] = useState<SvgElement['type'] | 'select'>('select')

  // ─── Explorer ───────────────────────────────────────────────────────────────
  const [explorerTab, setExplorerTab] = useState<'layers' | 'assets' | 'shapes'>('layers')

  const { user } = useAuth()
  const owner = user?.email || user?.uid || 'anonymous'
  const [currentProjectId, setCurrentProjectId] = useState<string | null>(null)
  const [projectName, setProjectName] = useState('Untitled Project')
  const [projectAutosave, setProjectAutosave] = useState(false)
  const [projectsMenuOpen, setProjectsMenuOpen] = useState(false)
  const [savedProjects, setSavedProjects] = useState<ProjectMeta[]>([])
  const [isFullscreen, setIsFullscreen] = useState(false)
  const loadedProjectRef = useRef(false)

  const isDrawingRef = useRef(false)
  const lastMousePosRef = useRef<Vector2>({ x: 0, y: 0 })
  const frameCountRef = useRef(0)
  const lastFpsTimeRef = useRef(performance.now())

  useEffect(() => {
    drawEngineRef.current = new DrawingEngine(defaultToolState)
    audioEngineRef.current = new AudioEngine()
    sandboxRef.current = new StudioSandbox(overlayCanvasRef.current, (kind, message) => {
      if (kind === 'error') setCodeOutput(`[Error] ${message}`)
      else setCodeOutput(prev => prev === '[console] Ready' ? message : prev + '\n' + message)
    })
    return () => {
      sandboxRef.current?.dispose()
      audioEngineRef.current?.dispose()
    }
  }, [])

  useEffect(() => {
    drawEngineRef.current?.setToolState(toolState)
  }, [toolState])

  useEffect(() => {
    drawEngineRef.current?.setShapes(shapes)
  }, [shapes])

  const getCanvasPoint = useCallback((e: React.MouseEvent | MouseEvent): Vector2 => {
    const canvas = canvasRef.current
    if (!canvas) return { x: 0, y: 0 }
    const rect = canvas.getBoundingClientRect()
    let pt = {
      x: (e.clientX - rect.left) / zoom - panOffset.x,
      y: (e.clientY - rect.top) / zoom - panOffset.y
    }
    if (toolState.snapToGrid) {
      pt = snapPoint(pt, toolState.gridSize)
    }
    return pt
  }, [zoom, panOffset, toolState.snapToGrid, toolState.gridSize])

  const renderStage = useCallback((scene: typeof sceneRef.current) => {
    const canvas = canvasRef.current
    const overlay = overlayCanvasRef.current
    if (!canvas || !overlay) return
    const ctx = canvas.getContext('2d')
    const overlayCtx = overlay.getContext('2d')
    if (!ctx || !overlayCtx) return

    const { shapes, selectedShapeIds, timeline, zoom, panOffset, onionSkin, shaders, toolState, guides } = scene

    const cw = toolState.canvasWidth
    const ch = toolState.canvasHeight

    ctx.fillStyle = toolState.canvasBackground
    ctx.fillRect(0, 0, canvas.width, canvas.height)

    ctx.save()
    ctx.translate(panOffset.x * zoom, panOffset.y * zoom)
    ctx.scale(zoom, zoom)

    if (toolState.showGrid) {
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)'
      ctx.lineWidth = 1 / zoom
      for (let x = 0; x <= cw; x += toolState.gridSize) {
        ctx.beginPath()
        ctx.moveTo(x, 0)
        ctx.lineTo(x, ch)
        ctx.stroke()
      }
      for (let y = 0; y <= ch; y += toolState.gridSize) {
        ctx.beginPath()
        ctx.moveTo(0, y)
        ctx.lineTo(cw, y)
        ctx.stroke()
      }
    }

    if (toolState.showGuides) {
      for (const guide of guides) {
        ctx.strokeStyle = 'rgba(0, 240, 255, 0.5)'
        ctx.lineWidth = 1 / zoom
        ctx.setLineDash([])
        if (guide.orientation === 'vertical') {
          ctx.beginPath()
          ctx.moveTo(guide.position, 0)
          ctx.lineTo(guide.position, ch)
          ctx.stroke()
        } else {
          ctx.beginPath()
          ctx.moveTo(0, guide.position)
          ctx.lineTo(cw, guide.position)
          ctx.stroke()
        }
      }
    }

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.06)'
    ctx.setLineDash([4 / zoom, 4 / zoom])
    ctx.strokeRect(0, 0, cw, ch)
    ctx.setLineDash([])

    if (onionSkin) {
      const onionFrames = getOnionSkinFrames(timeline)
      for (const of of onionFrames) {
        const layerShapes = timeline.layers
          .filter(l => l.visible)
          .flatMap(l => {
            const kf = l.keyframes.find(k => k.frame === of.frame)
            return kf ? [kf.shape] : []
          })
        ctx.globalAlpha = of.alpha
        for (const shape of layerShapes) {
          renderShape(ctx, shape)
        }
      }
      ctx.globalAlpha = 1
    }

    for (const shape of shapes) {
      renderShape(ctx, shape)
    }

    if (drawEngineRef.current) {
      const preview = drawEngineRef.current.getCurrentPreview()
      if (preview) {
        ctx.globalAlpha = 0.7
        renderShape(ctx, preview)
        ctx.globalAlpha = 1
      }
    }

    ctx.restore()

    for (const shaderType of shaders) {
      applyShaderOverlay(ctx, shaderType, canvas.width, canvas.height, 0.8)
    }

    if (!sandboxRef.current?.isRunning) {
      overlayCtx.clearRect(0, 0, overlay.width, overlay.height)

      overlayCtx.save()
      overlayCtx.translate(panOffset.x * zoom, panOffset.y * zoom)
      overlayCtx.scale(zoom, zoom)
      for (const id of selectedShapeIds) {
        const shape = shapes.find(s => s.id === id)
        if (shape) {
          drawSelectionOverlay(overlayCtx, shape, zoom)
        }
      }
      overlayCtx.restore()
    }

    ctx.fillStyle = 'rgba(255, 255, 255, 0.2)'
    ctx.font = '10px "JetBrains Mono", monospace'
    ctx.fillText(`${cw} × ${ch}`, 12, ch - 12)
    ctx.fillText(`Frame ${timeline.currentFrame}/${timeline.totalFrames}`, cw - 100, ch - 12)

    frameCountRef.current++
    const now = performance.now()
    if (now - lastFpsTimeRef.current >= 1000) {
      setFps(frameCountRef.current)
      frameCountRef.current = 0
      lastFpsTimeRef.current = now
    }
  }, [])

  const drawSelectionOverlay = (ctx: CanvasRenderingContext2D, shape: VectorShape, zoom: number) => {
    ctx.save()
    ctx.strokeStyle = '#00F0FF'
    ctx.lineWidth = 1 / zoom
    ctx.setLineDash([4 / zoom, 4 / zoom])

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
    if (shape.points) {
      for (const p of shape.points) {
        if (p.x < minX) minX = p.x
        if (p.y < minY) minY = p.y
        if (p.x > maxX) maxX = p.x
        if (p.y > maxY) maxY = p.y
      }
    } else {
      minX = shape.transform.x
      minY = shape.transform.y
      maxX = shape.transform.x + 50
      maxY = shape.transform.y + 50
    }

    ctx.strokeRect(minX - 4, minY - 4, maxX - minX + 8, maxY - minY + 8)
    ctx.setLineDash([])
    ctx.restore()
  }

  const sceneRef = useRef({ shapes, selectedShapeIds, timeline, zoom, panOffset, onionSkin, shaders, toolState, guides })
  sceneRef.current = { shapes, selectedShapeIds, timeline, zoom, panOffset, onionSkin, shaders, toolState, guides }

  const playbackRef = useRef({ isPlaying, timelineFps, playbackSpeed })
  playbackRef.current = { isPlaying, timelineFps, playbackSpeed }

  useEffect(() => {
    let id = 0
    let lastTime = performance.now()
    let accumulator = 0

    const loop = (now: number) => {
      const { isPlaying: playing, timelineFps: pFps, playbackSpeed: pSpeed } = playbackRef.current
      if (document.hidden) {
        accumulator = 0
        lastTime = now
        id = requestAnimationFrame(loop)
        return
      }
      // Clamp delta so a backgrounded tab (rAF throttled/paused) never
      // fast-forwards a burst of frames when it becomes visible again.
      const delta = Math.min(now - lastTime, 100)
      lastTime = now

      if (playing) {
        const frameDuration = 1000 / Math.max(1, pFps * pSpeed)
        accumulator += delta
        let advance = 0
        while (accumulator >= frameDuration) {
          accumulator -= frameDuration
          advance++
        }
        if (advance > 0) {
          setTimeline(prev => {
            let next = prev.currentFrame + advance
            if (next > prev.totalFrames) {
              if (prev.loop) next = ((next - 1) % prev.totalFrames) + 1
              else { setIsPlaying(false); return { ...prev, currentFrame: prev.totalFrames } }
            }
            return prev.currentFrame === next ? prev : { ...prev, currentFrame: next }
          })
        }
      } else {
        accumulator = 0
      }

      renderStage(sceneRef.current)
      id = requestAnimationFrame(loop)
    }

    id = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(id)
  }, [renderStage])

  // A backgrounded tab throttles rAF, so playback would silently desync and
  // burn battery. Pause it outright and let the user resume when they return.
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) setIsPlaying(false)
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
  }, [])

  // ─── Collab connect / disconnect ──────────────────────────────────────────────
  useEffect(() => {
    if (!collabEnabled) return
    const bus = new CollabBus(user?.displayName || user?.email?.split('@')[0] || undefined)
    collabBusRef.current = bus
    bus.connect()
    setCollabConnected(true)
    setCollabName(bus.getPeerName())

    const unsub = bus.onOp(op => {
      if (op.type === 'join' || op.type === 'presence' || op.type === 'leave' || op.type === 'cursor-move') {
        setCollabPeers(bus.getPeers())
        return
      }
      // Shape operations from remote peers
      if (op.type !== 'shape-add' && op.type !== 'shape-update' && op.type !== 'shape-delete' && op.type !== 'shapes-sync') return
      if (op.peerId === bus.getPeerId()) return
      setShapes(prev => applyOp(prev, op))
    })

    return () => {
      unsub()
      bus.disconnect()
      collabBusRef.current = null
      setCollabConnected(false)
      setCollabPeers([])
    }
  }, [collabEnabled, user])

  // Broadcast local shape changes to collab peers
  useEffect(() => {
    const bus = collabBusRef.current
    if (!bus) return
    const prev = shapesSnapshotRef.current
    shapesSnapshotRef.current = shapes
    if (prev.length === 0 && shapes.length === 0) return
    if (prev === shapes) return

    // Simple diff: find added, updated, deleted
    const prevIds = new Set(prev.map(s => s.id))
    const currIds = new Set(shapes.map(s => s.id))

    for (const s of shapes) {
      if (!prevIds.has(s.id)) {
        bus.broadcastShapeAdd(s)
      } else {
        const old = prev.find(p => p.id === s.id)
        if (old && JSON.stringify(old) !== JSON.stringify(s)) {
          bus.broadcastShapeUpdate(s)
        }
      }
    }
    for (const id of prevIds) {
      if (!currIds.has(id)) {
        bus.broadcastShapeDelete(id)
      }
    }
  }, [shapes])

  useEffect(() => {
    const layer = timeline.layers.find(l => l.id === selectedLayerId)
    if (!layer) return

    const kf = layer.keyframes.find(k => k.frame === timeline.currentFrame)
    if (!kf) return

    const nextShapes: VectorShape[] = [kf.shape]

    // Only replace the working shapes when the timeline actually resolves to a
    // different set of shapes. Without this guard, unrelated timeline updates
    // (layer visibility/lock toggles, renames) clobber in-progress user edits.
    setShapes(prev => {
      if (prev.length === nextShapes.length && prev.every((s, i) => s.id === nextShapes[i].id)) {
        return prev
      }
      return nextShapes
    })
  }, [timeline.currentFrame, selectedLayerId, timeline.layers])

  const handleCanvasMouseDown = (e: React.MouseEvent) => {
    const point = getCanvasPoint(e)
    lastMousePosRef.current = point
    isDrawingRef.current = true

    if (sandboxRef.current?.isRunning) {
      sandboxRef.current.forwardPointer('pointerDown', point.x, point.y)
      return
    }

    if (toolState.activeTool === 'select') {
      const hit = drawEngineRef.current?.hitTest(point)
      if (hit) {
        if (e.shiftKey) {
          setSelectedShapeIds(prev => {
            const next = new Set(prev)
            if (next.has(hit.id)) next.delete(hit.id)
            else next.add(hit.id)
            return next
          })
        } else {
          setSelectedShapeIds(new Set([hit.id]))
        }
      } else {
        setSelectedShapeIds(new Set())
      }
    } else if (toolState.activeTool === 'bucket') {
      if (drawEngineRef.current) {
        drawEngineRef.current.saveState()
        const targetShape = drawEngineRef.current.hitTest(point)
        if (targetShape) {
          const updated = shapes.map(s => {
            if (s.id === targetShape.id) {
              return { ...s, fill: { type: 'solid' as const, color: hexToColor(toolState.fillColor) } }
            }
            return s
          })
          setShapes(updated)
        }
      }
    } else if (toolState.activeTool === 'eyedropper') {
      const targetShape = drawEngineRef.current?.hitTest(point)
      if (targetShape?.fill) {
        const c = targetShape.fill.color
        const hex = `#${c.r.toString(16).padStart(2, '0')}${c.g.toString(16).padStart(2, '0')}${c.b.toString(16).padStart(2, '0')}`
        setToolState(prev => ({ ...prev, fillColor: hex }))
      }
    } else {
      drawEngineRef.current?.startDrawing(point)
    }
  }

  const handleCanvasMouseMove = (e: React.MouseEvent) => {
    const point = getCanvasPoint(e)
    if (activePanelRef.current === 'properties') {
      setCursorPos({ x: Math.round(point.x), y: Math.round(point.y) })
    }
    collabBusRef.current?.updateCursor(point.x, point.y)

    if (sandboxRef.current?.isRunning) {
      sandboxRef.current.forwardPointer('pointerMove', point.x, point.y)
      return
    }

    if (isDrawingRef.current && drawEngineRef.current) {
      if (toolState.activeTool === 'select' && selectedShapeIds.size > 0) {
        const dx = point.x - lastMousePosRef.current.x
        const dy = point.y - lastMousePosRef.current.y
        setShapes(prev => prev.map(s => {
          if (selectedShapeIds.has(s.id)) {
            return { ...s, transform: { ...s.transform, x: s.transform.x + dx, y: s.transform.y + dy } }
          }
          return s
        }))
      } else if (!['select', 'bucket', 'eyedropper'].includes(toolState.activeTool)) {
        drawEngineRef.current.updateDrawing(point)
      }
      lastMousePosRef.current = point
    }
  }

  const handleCanvasMouseUp = () => {
    if (sandboxRef.current?.isRunning) {
      sandboxRef.current.forwardPointer('pointerUp', lastMousePosRef.current.x, lastMousePosRef.current.y)
      isDrawingRef.current = false
      return
    }
    if (isDrawingRef.current && drawEngineRef.current && !['select', 'bucket', 'eyedropper'].includes(toolState.activeTool)) {
      const newShape = drawEngineRef.current.endDrawing()
      if (newShape) {
        setShapes(prev => [...prev, newShape])
      }
    }
    isDrawingRef.current = false
  }

  const handleToolChange = (tool: ToolType) => {
    setToolState(prev => ({ ...prev, activeTool: tool }))
    audioEngineRef.current?.playClick(0.05)
  }

  const handleColorChange = (type: 'fill' | 'stroke', color: string) => {
    setToolState(prev => ({
      ...prev,
      [type === 'fill' ? 'fillColor' : 'strokeColor']: color
    }))
  }

  const addNewLayer = () => {
    const newLayer = createLayer(`Layer ${timeline.layers.length + 1}`)
    setTimeline(prev => ({ ...prev, layers: [...prev.layers, newLayer] }))
    setSelectedLayerId(newLayer.id)
  }

  const deleteLayer = (id: string) => {
    if (timeline.layers.length <= 1) return
    setTimeline(prev => ({
      ...prev,
      layers: prev.layers.filter(l => l.id !== id)
    }))
    if (selectedLayerId === id) {
      setSelectedLayerId(timeline.layers[0].id)
    }
  }

  const addKeyframe = () => {
    const layer = timeline.layers.find(l => l.id === selectedLayerId)
    if (!layer || layer.locked) return
    if (shapes.length === 0) {
      setCodeOutput('[console] Nothing on the stage yet — draw a shape first.')
      return
    }
    if (shapes.length > 1) {
      setCodeOutput('[console] Keyframes capture one shape per layer. Use a fresh layer for each element.')
    }
    const currentShape = shapes[0]
    const updatedLayer = addKeyframeToLayer(layer, timeline.currentFrame, currentShape)
    setTimeline(prev => ({
      ...prev,
      layers: prev.layers.map(l => l.id === updatedLayer.id ? updatedLayer : l)
    }))
    audioEngineRef.current?.playClick(0.08)
  }

  const deleteKeyframe = () => {
    const layer = timeline.layers.find(l => l.id === selectedLayerId)
    if (!layer || layer.locked) return
    const updatedLayer = removeKeyframeFromLayer(layer, timeline.currentFrame)
    setTimeline(prev => ({
      ...prev,
      layers: prev.layers.map(l => l.id === updatedLayer.id ? updatedLayer : l)
    }))
  }

  const runCode = () => {
    if (!sandboxRef.current) {
      setCodeOutput('[Error] Runtime not initialized')
      return
    }
    if (sandboxRef.current.isRunning) {
      sandboxRef.current.stop()
      setIsRunning(false)
      setCodeOutput(prev => prev + '\n[console] Script stopped')
      return
    }
    setCodeOutput('[console] Running...')
    const result = sandboxRef.current.run(code)
    setIsRunning(result.ok)
  }

  const handleExportHTML = () => {
    const config = {
      title: 'OpenFlash Project',
      width: STAGE_WIDTH,
      height: STAGE_HEIGHT,
      fps: timeline.fps,
      loop: true,
      autoStart: true,
      backgroundColor: '#0A0B0E',
      scripts: code,
      shapes: shapes,
      timeline: timeline,
      includeRuntime: true
    }
    downloadExport(config, 'openflash-project.html')
  }

  const handleExportPNG = () => {
    const canvas = canvasRef.current
    if (canvas) exportFrameAsPNG(canvas)
  }

  const handleExportSVG = () => {
    exportFrameAsSVG(shapes, STAGE_WIDTH, STAGE_HEIGHT)
  }

  const refreshSavedProjects = useCallback(() => {
    setSavedProjects(listProjects(owner))
  }, [owner])

  const applyProject = (p: ProjectData) => {
    setCurrentProjectId(p.id)
    setProjectName(p.name)
    setShapes(p.shapes)
    setCode(p.code)
    setTimeline(p.timeline)
    setShaders(new Set(p.shaders as ShaderType[]))
    setProjectAutosave(p.autosave)
    setIsPlaying(false)
    setSelectedShapeIds(new Set())
  }

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const id = params.get('project')
    if (id) {
      const p = loadProject(id)
      if (p) applyProject(p)
    }
    refreshSavedProjects()
    loadedProjectRef.current = true
  }, [refreshSavedProjects])

  const saveCurrentProject = () => {
    const project: ProjectData = {
      id: currentProjectId || createEmptyProject(owner, projectName).id,
      name: projectName.trim() || 'Untitled Project',
      owner,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      shapes,
      code,
      timeline,
      shaders: Array.from(shaders),
      autosave: projectAutosave,
      version: 1
    }
    saveProject(project)
    setCurrentProjectId(project.id)
    refreshSavedProjects()
    audioEngineRef.current?.playClick(0.08)
  }

  useEffect(() => {
    if (!projectAutosave || !loadedProjectRef.current) return
    const timer = setTimeout(() => {
      const project: ProjectData = {
        id: currentProjectId || createEmptyProject(owner, projectName).id,
        name: projectName.trim() || 'Untitled Project',
        owner,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        shapes,
        code,
        timeline,
        shaders: Array.from(shaders),
        autosave: true,
        version: 1
      }
      saveProject(project)
      setCurrentProjectId(project.id)
    }, 800)
    return () => clearTimeout(timer)
  }, [shapes, code, timeline, shaders, projectAutosave, currentProjectId, owner, projectName])

  const handleNewProject = () => {
    const fresh = createEmptyProject(owner, 'Untitled Project')
    applyProject({ ...fresh, id: '' })
    setCurrentProjectId(null)
  }

  const handleOpenProject = (id: string) => {
    const p = loadProject(id)
    if (p) {
      applyProject(p)
      setProjectsMenuOpen(false)
      audioEngineRef.current?.playClick(0.05)
    }
  }

  const handleExportJson = () => {
    const project: ProjectData = {
      id: currentProjectId || `proj_${Date.now().toString(36)}`,
      name: projectName,
      owner,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      shapes,
      code,
      timeline,
      shaders: Array.from(shaders),
      autosave: projectAutosave,
      version: 1
    }
    const blob = new Blob([exportProjectJson(project)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${projectName.replace(/[^a-z0-9-_]/gi, '_') || 'project'}.openflash.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleImportJson = (file: File) => {
    const reader = new FileReader()
    reader.onload = () => {
      const p = importProjectJson(typeof reader.result === 'string' ? reader.result : '', owner)
      if (p) {
        applyProject(p)
        audioEngineRef.current?.playClick(0.08)
      } else {
        audioEngineRef.current?.playSound('explode')
      }
    }
    reader.readAsText(file)
  }

  // ─── Asset import ──────────────────────────────────────────────────────────
  const handleImportAssets = (files: FileList | File[]) => {
    Array.from(files).forEach(file => {
      if (!file.type.startsWith('image/') && !file.type.includes('svg')) return
      const reader = new FileReader()
      reader.onload = () => {
        const src = typeof reader.result === 'string' ? reader.result : ''
        const isSvg = file.type.includes('svg') || file.name.endsWith('.svg')
        if (isSvg) {
          const asset: Asset = {
            id: `asset_${Date.now().toString(36)}_${Math.random().toString(36).substr(2, 6)}`,
            name: file.name.replace(/\.[^.]+$/, ''),
            type: 'svg',
            src,
            width: 100,
            height: 100,
            createdAt: Date.now()
          }
          setAssets(prev => [...prev, asset])
        } else {
          const img = new Image()
          img.onload = () => {
            const asset: Asset = {
              id: `asset_${Date.now().toString(36)}_${Math.random().toString(36).substr(2, 6)}`,
              name: file.name.replace(/\.[^.]+$/, ''),
              type: 'image',
              src,
              width: img.naturalWidth,
              height: img.naturalHeight,
              createdAt: Date.now()
            }
            setAssets(prev => [...prev, asset])
          }
          img.src = src
        }
      }
      reader.readAsDataURL(file)
    })
  }

  const removeAsset = (id: string) => {
    setAssets(prev => prev.filter(a => a.id !== id))
  }

  // ─── SVG maker ──────────────────────────────────────────────────────────────
  const addSvgElement = (type: SvgElement['type']) => {
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
  }

  const updateSvgAttr = (id: string, attr: string, value: string | number) => {
    setSvgElements(prev => prev.map(el => el.id === id ? { ...el, attrs: { ...el.attrs, [attr]: value } } : el))
  }

  const updateSvgStyle = (id: string, style: Partial<Pick<SvgElement, 'fill' | 'stroke' | 'strokeWidth'>>) => {
    setSvgElements(prev => prev.map(el => el.id === id ? { ...el, ...style } : el))
  }

  const removeSvgElement = (id: string) => {
    setSvgElements(prev => prev.filter(el => el.id !== id))
    if (svgSelectedId === id) setSvgSelectedId(null)
  }

  const exportSvg = () => {
    const svgAttrs = `xmlns="http://www.w3.org/2000/svg" viewBox="0 0 280 200"`
    const elements = svgElements.map(el => {
      const a = el.attrs
      const style = `fill:${el.fill};stroke:${el.stroke};stroke-width:${el.strokeWidth}`
      switch (el.type) {
        case 'rect': return `<rect x="${a.x}" y="${a.y}" width="${a.width}" height="${a.height}" style="${style}" />`
        case 'circle': return `<circle cx="${a.cx}" cy="${a.cy}" r="${a.r}" style="${style}" />`
        case 'ellipse': return `<ellipse cx="${a.cx}" cy="${a.cy}" rx="${a.rx}" ry="${a.ry}" style="${style}" />`
        case 'line': return `<line x1="${a.x1}" y1="${a.y1}" x2="${a.x2}" y2="${a.y2}" style="${style}" />`
        case 'polygon': return `<polygon points="${a.points}" style="${style}" />`
        case 'path': return `<path d="${a.d}" style="${style}" fill="none" />`
        case 'text': return `<text x="${a.x}" y="${a.y}" font-size="${a.fontSize}" style="${style}" text-anchor="middle">${a.text}</text>`
        default: return ''
      }
    }).join('\n  ')
    const svg = `<svg ${svgAttrs}>\n  ${elements}\n</svg>`
    const blob = new Blob([svg], { type: 'image/svg+xml' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'openflash-graphic.svg'
    a.click()
    URL.revokeObjectURL(url)
  }

  const toggleShader = (type: ShaderType) => {
    setShaders(prev => {
      const next = new Set(prev)
      if (next.has(type)) next.delete(type)
      else next.add(type)
      return next
    })
  }

  const pushUndo = () => {
    setUndoStack(prev => [...prev.slice(-49), shapes])
    setRedoStack([])
  }

  const handleUndo = () => {
    if (undoStack.length === 0) return
    const prev = undoStack[undoStack.length - 1]
    setRedoStack(r => [...r, shapes])
    setUndoStack(u => u.slice(0, -1))
    setShapes(prev)
  }

  const handleRedo = () => {
    if (redoStack.length === 0) return
    const next = redoStack[redoStack.length - 1]
    setUndoStack(u => [...u, shapes])
    setRedoStack(r => r.slice(0, -1))
    setShapes(next)
  }

  const handleDuplicate = () => {
    if (selectedShapeIds.size === 0) return
    pushUndo()
    setShapes(prev => duplicateShapes(prev, selectedShapeIds))
  }

  const handleAlign = (mode: 'left' | 'right' | 'top' | 'bottom' | 'center-h' | 'center-v') => {
    if (selectedShapeIds.size < 2) return
    pushUndo()
    const selected = shapes.filter(s => selectedShapeIds.has(s.id))
    const aligned = alignShapes(selected, mode, toolState.canvasWidth, toolState.canvasHeight)
    setShapes(prev => prev.map(s => aligned.find(a => a.id === s.id) || s))
  }

  const handleDistribute = (mode: 'horizontal' | 'vertical') => {
    if (selectedShapeIds.size < 3) return
    pushUndo()
    const selected = shapes.filter(s => selectedShapeIds.has(s.id))
    const distributed = distributeShapes(selected, mode)
    setShapes(prev => prev.map(s => distributed.find(d => d.id === s.id) || s))
  }

  const handleZOrder = (direction: 'up' | 'down' | 'top' | 'bottom') => {
    if (selectedShapeIds.size === 0) return
    pushUndo()
    setShapes(prev => changeZOrder(prev, selectedShapeIds, direction))
  }

  const handleRotateCanvas = (angle: number) => {
    pushUndo()
    setShapes(prev => rotateCanvas(prev, angle, toolState.canvasWidth, toolState.canvasHeight))
  }

  const handleFlipCanvas = (horizontal: boolean) => {
    pushUndo()
    setShapes(prev => flipCanvas(prev, horizontal, toolState.canvasWidth, toolState.canvasHeight))
  }

  const handleZoomToFit = () => {
    const { zoom: z, pan } = zoomToFit(shapes, toolState.canvasWidth, toolState.canvasHeight)
    setZoom(z)
    setPanOffset(pan)
  }

  const addRecentColor = (color: string) => {
    setRecentColors(prev => [color, ...prev.filter(c => c !== color)].slice(0, 12))
  }

  const handleDeleteSelected = () => {
    if (selectedShapeIds.size === 0) return
    pushUndo()
    setShapes(prev => prev.filter(s => !selectedShapeIds.has(s.id)))
    setSelectedShapeIds(new Set())
  }

  const handleCopyShapes = () => {
    const selected = shapes.filter(s => selectedShapeIds.has(s.id))
    setClipboard(selected)
    showToast(`Copied ${selected.length} shape${selected.length > 1 ? 's' : ''}`, 'info')
  }

  const handleGroup = () => {
    if (selectedShapeIds.size < 2) return
    pushUndo()
    setShapes(prev => groupShapes(prev, selectedShapeIds))
    showToast('Grouped shapes', 'success')
  }

const handlePaste = () => {
    if (clipboard.length === 0) return
    pushUndo()
    const pasted = clipboard.map(s => ({ ...s, id: generateId(), transform: { ...s.transform, x: s.transform.x + 30, y: s.transform.y + 30 } }))
    setShapes(prev => [...prev, ...pasted])
    showToast(`Pasted ${pasted.length} shape${pasted.length > 1 ? 's' : ''}`, 'success')
  }

  const saveToLocalStorage = useCallback(() => {
    const data = { shapes, timeline, toolState, assets, projectName }
    localStorage.setItem('openflash_autosave', JSON.stringify(data))
  }, [shapes, timeline, toolState, assets, projectName])

  const handleAutoSave = useCallback(() => {
    saveToLocalStorage()
    setUnsavedChanges(false)
    setLastSaved(Date.now())
  }, [saveToLocalStorage])

  const handleCanvasContextMenu = useStableCallback((e: React.MouseEvent) => {
    e.preventDefault()
    setContextMenu({ x: e.clientX, y: e.clientY })
  })

  // Stable identities for CanvasArea: pointer handlers fire on every mousemove,
  // so unstable props here would defeat the memo() wrapper entirely.
  const stableCanvasMouseDown = useStableCallback(handleCanvasMouseDown)
  const stableCanvasMouseMove = useStableCallback(handleCanvasMouseMove)
  const stableCanvasMouseUp = useStableCallback(handleCanvasMouseUp)
  const handleZoomIn = useCallback(() => setZoom(z => Math.min(3, z + 0.1)), [])
  const handleZoomOut = useCallback(() => setZoom(z => Math.max(0.2, z - 0.1)), [])
  const handleZoomReset = useCallback(() => setZoom(1), [])
  const handleOpenFullscreen = useCallback(() => setIsFullscreen(true), [])

  useEffect(() => {
    if (unsavedChanges) {
      const interval = setInterval(handleAutoSave, 30000)
      return () => clearInterval(interval)
    }
    return undefined
  }, [unsavedChanges, handleAutoSave])

  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (unsavedChanges) { e.preventDefault(); e.returnValue = '' }
    }
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [unsavedChanges])

  const handleClearCanvas = () => {
    if (shapes.length === 0) return
    if (window.confirm('Clear all shapes from the canvas?')) {
      pushUndo()
      setShapes([])
      setSelectedShapeIds(new Set())
    }
  }

  const handleKeyDown = useStableCallback((e: KeyboardEvent) => {
    if (e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLInputElement) return

    if (sandboxRef.current?.isRunning) {
      sandboxRef.current.forwardKey('keyDown', e.key)
    }

    switch (e.key) {
      case 'v': handleToolChange('select'); break
      case 'a': handleToolChange('node'); break
      case 'p': handleToolChange('pen'); break
      case 'b': handleToolChange('brush'); break
      case 'r': handleToolChange('rectangle'); break
      case 'o': handleToolChange('ellipse'); break
      case 't': handleToolChange('text'); break
      case 'g': handleToolChange('bucket'); break
      case 'i': handleToolChange('eyedropper'); break
      case 'l': handleToolChange('line'); break
      case 'F5': e.preventDefault(); break
      case 'F6': e.preventDefault(); addKeyframe(); break
      case 'F7': e.preventDefault(); addKeyframe(); break
      case 'Delete':
      case 'Backspace':
        if (selectedShapeIds.size > 0) {
          pushUndo()
          setShapes(prev => prev.filter(s => !selectedShapeIds.has(s.id)))
          setSelectedShapeIds(new Set())
        }
        break
      case ' ':
        e.preventDefault()
        setIsPlaying(prev => !prev)
        break
      case 'z':
        if (e.ctrlKey || e.metaKey) {
          e.preventDefault()
          if (e.shiftKey) handleRedo()
          else handleUndo()
        }
        break
      case 'y':
        if (e.ctrlKey || e.metaKey) {
          e.preventDefault()
          handleRedo()
        }
        break
      case 'd':
        if (e.ctrlKey || e.metaKey) {
          e.preventDefault()
          handleDuplicate()
        }
        break
      case '?':
        e.preventDefault()
        setShowShortcuts(prev => !prev)
        break
      case 'Escape':
        setContextMenu(null)
        setShowShortcuts(false)
        break
    }
  })

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    const onKeyUp = (e: KeyboardEvent) => {
      sandboxRef.current?.forwardKey('keyUp', e.key)
    }
    window.addEventListener('keyup', onKeyUp)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', onKeyUp)
    }
  }, [handleKeyDown])

  const tools: Array<{ id: ToolType; icon: React.ReactNode; label: string; shortcut: string }> = [
    { id: 'select', icon: <IconArrowUpLeft size={14} />, label: 'Selection Tool', shortcut: 'V' },
    { id: 'node', icon: <IconCircleFilled size={14} />, label: 'Node Tool', shortcut: 'A' },
    { id: 'pen', icon: <IconPencil size={14} />, label: 'Pen Tool', shortcut: 'P' },
    { id: 'brush', icon: <IconCircleDotted size={14} />, label: 'Brush Tool', shortcut: 'B' },
    { id: 'line', icon: <IconDiagonal size={14} />, label: 'Line Tool', shortcut: 'L' },
    { id: 'rectangle', icon: <IconSquare size={14} />, label: 'Rectangle', shortcut: 'R' },
    { id: 'ellipse', icon: <IconCircle size={14} />, label: 'Ellipse', shortcut: 'O' },
    { id: 'text', icon: <IconText size={14} />, label: 'Text Tool', shortcut: 'T' },
    { id: 'bucket', icon: <IconSquareHalf size={14} />, label: 'Paint Bucket', shortcut: 'G' },
    { id: 'eyedropper', icon: <IconDroplet size={14} />, label: 'Eyedropper', shortcut: 'I' },
  ]

  const contextMenuItems = [
    { label: 'Copy', icon: <IconCopy size={13} />, shortcut: 'Ctrl+C', onClick: handleCopyShapes, disabled: selectedShapeIds.size === 0 },
    { label: 'Paste', icon: <IconPaste size={13} />, shortcut: 'Ctrl+V', onClick: handlePaste, disabled: clipboard.length === 0 },
    { label: 'Duplicate', icon: <IconCopy size={13} />, shortcut: 'Ctrl+D', onClick: handleDuplicate, disabled: selectedShapeIds.size === 0 },
    { label: 'Group', icon: <IconLayers size={13} />, shortcut: 'Ctrl+G', onClick: handleGroup, disabled: selectedShapeIds.size < 2 },
    { label: 'Delete', icon: <IconTrash size={13} />, shortcut: 'Del', onClick: handleDeleteSelected, danger: true, disabled: selectedShapeIds.size === 0 }
  ]

  const selectedShape = shapes.find(s => selectedShapeIds.has(s.id))

  return (
    <div style={{ height: 'calc(100vh - 60px)', display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'var(--bg-primary)' }}>
      <ProjectBar
        projectName={projectName}
        onProjectNameChange={setProjectName}
        projectAutosave={projectAutosave}
        onToggleAutosave={() => setProjectAutosave(p => !p)}
        onSave={saveCurrentProject}
        onNewProject={handleNewProject}
        savedProjects={savedProjects}
        isProjectsOpen={projectsMenuOpen}
        onToggleProjects={() => setProjectsMenuOpen(o => !o)}
        onOpenProject={handleOpenProject}
        onExportJson={handleExportJson}
        onImportJson={handleImportJson}
        isSaved={!!currentProjectId}
      />
      <Toolbar
        tools={tools}
        activeTool={toolState.activeTool}
        onToolChange={handleToolChange}
        fillColor={toolState.fillColor}
        strokeColor={toolState.strokeColor}
        onFillColorChange={(c: string) => handleColorChange('fill', c)}
        onStrokeColorChange={(c: string) => handleColorChange('stroke', c)}
        strokeWidth={toolState.strokeWidth}
        onStrokeWidthChange={(w: number) => setToolState(p => ({ ...p, strokeWidth: w }))}
        toolState={toolState}
        onToolStateChange={setToolState}
        onAlign={handleAlign}
        onDistribute={handleDistribute}
        onZOrder={handleZOrder}
        onRotate={handleRotateCanvas}
        onFlip={handleFlipCanvas}
        onZoomToFit={handleZoomToFit}
        onClearCanvas={handleClearCanvas}
        onHandleDuplicate={handleDuplicate}
        onUndo={handleUndo}
        onRedo={handleRedo}
      />
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* ─── Left Explorer Panel ─────────────────────────────────────────── */}
        <ExplorerPanel
          explorerTab={explorerTab}
          onTabChange={setExplorerTab}
          layers={timeline.layers}
          selectedLayerId={selectedLayerId}
          onSelectLayer={setSelectedLayerId}
          onToggleLayerVisibility={(id: string) => setTimeline(p => ({ ...p, layers: p.layers.map(l => l.id === id ? { ...l, visible: !l.visible } : l) }))}
          onToggleLayerLock={(id: string) => setTimeline(p => ({ ...p, layers: p.layers.map(l => l.id === id ? { ...l, locked: !l.locked } : l) }))}
          onAddLayer={addNewLayer}
          onDeleteLayer={deleteLayer}
          assets={assets}
          onImportAssets={handleImportAssets}
          onRemoveAsset={removeAsset}
          shapes={shapes}
          selectedShapeIds={selectedShapeIds}
          onSelectShape={(id: string) => setSelectedShapeIds(new Set([id]))}
        />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <CanvasArea
            canvasRef={canvasRef}
            overlayCanvasRef={overlayCanvasRef}
            zoom={zoom}
            onMouseDown={stableCanvasMouseDown}
            onMouseMove={stableCanvasMouseMove}
            onMouseUp={stableCanvasMouseUp}
            onMouseLeave={stableCanvasMouseUp}
            onZoomIn={handleZoomIn}
            onZoomOut={handleZoomOut}
            onZoomReset={handleZoomReset}
            onToggleFullscreen={handleOpenFullscreen}
            canvasWidth={toolState.canvasWidth}
            canvasHeight={toolState.canvasHeight}
            canvasBackground={toolState.canvasBackground}
            onContextMenu={handleCanvasContextMenu}
            isEmpty={shapes.length === 0}
          />
          <TimelineArea
            timeline={timeline}
            selectedLayerId={selectedLayerId}
            isPlaying={isPlaying}
            onionSkin={onionSkin}
            onFrameChange={(f: number) => setTimeline(p => ({ ...p, currentFrame: f }))}
            onTotalFramesChange={(f: number) => setTimeline(p => ({ ...p, totalFrames: f }))}
            onTogglePlay={() => setIsPlaying(!isPlaying)}
            onToggleOnionSkin={() => setOnionSkin(!onionSkin)}
            onAddKeyframe={addKeyframe}
            onDeleteKeyframe={deleteKeyframe}
            onAddLayer={addNewLayer}
            onDeleteLayer={deleteLayer}
            onSelectLayer={setSelectedLayerId}
            onToggleLayerVisibility={(id: string) => setTimeline(p => ({ ...p, layers: p.layers.map(l => l.id === id ? { ...l, visible: !l.visible } : l) }))}
            onToggleLayerLock={(id: string) => setTimeline(p => ({ ...p, layers: p.layers.map(l => l.id === id ? { ...l, locked: !l.locked } : l) }))}
            playbackSpeed={playbackSpeed}
            onPlaybackSpeedChange={setPlaybackSpeed}
            fps={timelineFps}
            onFpsChange={(f: number) => { setTimelineFps(f); setTimeline(p => ({ ...p, fps: f })) }}
            loop={timeline.loop}
            onToggleLoop={() => setTimeline(p => ({ ...p, loop: !p.loop }))}
          />
        </div>
        <SidePanel
          activePanel={activePanel}
          onPanelChange={setActivePanel}
          selectedShape={selectedShape}
          onUpdateShape={(t: Partial<Transform>) => {
            setShapes(prev => prev.map(s => selectedShapeIds.has(s.id) ? { ...s, transform: { ...s.transform, ...t } } : s))
          }}
          code={code}
          codeOutput={codeOutput}
          onCodeChange={setCode}
          onRunCode={runCode}
          isRunning={isRunning}
          audioEngine={audioEngineRef.current}
          audioClips={audioClips}
          onExportHTML={handleExportHTML}
          onExportPNG={handleExportPNG}
          onExportSVG={handleExportSVG}
          shaders={shaders}
          onToggleShader={toggleShader}
          fps={fps}
          cursorPos={cursorPos}
          shapeCount={shapes.length}
          assets={assets}
          onImportAssets={handleImportAssets}
          onRemoveAsset={removeAsset}
          svgElements={svgElements}
          svgSelectedId={svgSelectedId}
          svgTool={svgTool}
          onSvgToolChange={setSvgTool}
          onAddSvgElement={addSvgElement}
          onUpdateSvgAttr={updateSvgAttr}
          onUpdateSvgStyle={updateSvgStyle}
          onRemoveSvgElement={removeSvgElement}
          onSelectSvgElement={setSvgSelectedId}
          onExportSvg={exportSvg}
          toolState={toolState}
          onToolStateChange={setToolState}
          recentColors={recentColors}
          onAddRecentColor={addRecentColor}
        />
      </div>
      {isFullscreen && (
        <FullscreenPreview
          shapes={shapes}
          code={code}
          shaders={shaders}
          fps={timeline.fps}
          onClose={() => setIsFullscreen(false)}
        />
      )}
      {showShortcuts && <KeyboardShortcuts onClose={() => setShowShortcuts(false)} />}
      {contextMenu && <ContextMenu x={contextMenu.x} y={contextMenu.y} onClose={() => setContextMenu(null)} items={contextMenuItems} />}
      {/* ─── Collab floating panel ──────────────────────────────────────────── */}
      <div style={{ position: 'fixed', bottom: 16, left: 16, zIndex: 100, width: 220 }}>
        {!collabEnabled ? (
          <button
            onClick={() => setCollabEnabled(true)}
            className="btn btn-ghost btn-sm"
            style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, width: '100%', justifyContent: 'center', border: '1px solid var(--line)' }}
          >
            <IconUsers size={13} /> Start Collab
          </button>
        ) : (
          <>
            <CollabPanel
              peers={collabPeers}
              peerName={collabName}
              onNameChange={(name) => { collabBusRef.current?.setPeerName(name); setCollabName(name) }}
              connected={collabConnected}
            />
            <button
              onClick={() => setCollabEnabled(false)}
              className="btn btn-ghost btn-sm"
              style={{ fontSize: 10, width: '100%', justifyContent: 'center', border: '1px solid var(--line)', marginTop: 4 }}
            >
              Disconnect
            </button>
          </>
        )}
      </div>
    </div>
  )
}

const hexToColor = (hex: string) => ({
  r: parseInt(hex.slice(1, 3), 16),
  g: parseInt(hex.slice(3, 5), 16),
  b: parseInt(hex.slice(5, 7), 16),
  a: 1
})
