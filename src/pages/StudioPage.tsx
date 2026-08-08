import { useState, useEffect, useRef, useCallback } from 'react'
import { DrawingEngine, ToolState, defaultToolState, ToolType } from '../studio/engine/tools'
import { VectorShape, renderShape, FillStyle, StrokeStyle } from '../studio/engine/shapes'
import { TimelineState, Layer, createLayer, addKeyframe as addKeyframeToLayer, getShapesAtFrame, getOnionSkinFrames, removeKeyframe as removeKeyframeFromLayer } from '../studio/engine/timeline'
import { AudioEngine } from '../studio/audio/synth'
import { downloadExport, exportFrameAsPNG, exportFrameAsSVG } from '../studio/engine/exporter'
import { Vector2, Transform, generateId } from '../studio/engine/math'
import { applyShaderOverlay, ShaderType } from '../studio/engine/shaders'
import { OscillatorType } from '../studio/audio/synth'
import { StudioSandbox } from '../studio/runtime/sandbox'
import { useAuth } from '../context/AuthContext'
import {
  ProjectData, ProjectMeta, createEmptyProject, loadProject, saveProject, listProjects,
  exportProjectJson, importProjectJson
} from '../lib/projects'
import { sanitizeSvg } from '../lib/sanitize'
import {
  CANVAS_PRESETS, snapPoint, alignShapes, distributeShapes, duplicateShapes,
  changeZOrder, rotateCanvas, flipCanvas, zoomToFit, smoothPoints, getShapeBounds
} from '../studio/engine/canvas-features'
import {
  hexToRgb, rgbToHex, rgbToHsl, hslToRgb, formatColor, copyColorToClipboard,
  COLOR_PALETTES, parseColorInput
} from '../studio/engine/color-utils'
import { createSelection, selectAll, invertSelection, selectByColor, expandSelection, lassoSelect, marqueeSelect, groupShapes, ungroupShapes } from '../studio/engine/selection'
import { simplifyPath, closePath, openPath, reversePath, outlineStroke, bezierToPoints, pathUnion, pathSubtract, pathIntersect, pathExclude } from '../studio/engine/path-ops'
import { easingFunctions, interpolateValue, interpolateTransform, generateTweenFrames } from '../studio/engine/easing'
import { createEmitter, updateEmitter, renderParticles, ParticleEmitter } from '../studio/engine/particles'
import { createWorld, createBody, stepWorld, PhysicsWorld, PhysicsBody } from '../studio/engine/physics'
import { createLinearGradient, createRadialGradient, gradientToCss, gradientToCanvas, addGradientStop, removeGradientStop, updateGradientStop } from '../studio/engine/gradient'
import { showToast } from '../components/Toast'
import { importAudioFile } from '../studio/audio/audio-import'
import { ContextMenu } from '../components/ContextMenu'
import { KeyboardShortcuts } from '../components/KeyboardShortcuts'
import {
  IconArrowUpLeft, IconCircleFilled, IconPencil, IconCircleDotted, IconDiagonal,
  IconSquare, IconCircle, IconSquareHalf, IconDroplet, IconText, IconUndo, IconRedo,
  IconFullscreen, IconDiamond, IconClose, IconEye, IconLock, IconSave, IconDot,
  IconChevronDown, IconArrowDown, IconArrowUp, IconPlay, IconPause, IconSkipBack,
  IconSkipForward, IconStop, IconPackage, IconCheck, IconRefresh, IconArrowLeft,
  IconArrowRight, IconMinus, IconFolder, IconImage, IconLayers, IconStar,
  IconHexagon, IconTriangle, IconPen, IconMove, IconTrash, IconCopy, IconGrid,
  IconPlus, IconDownload, IconPaste
} from '../components/Icons'

const CODE_PLACEHOLDER = [
  '// OpenFlash TypeScript API Examples:',
  '',
  'const player = OpenFlash.createSprite({',
  '  color: \'#00F0FF\',',
  '  shape: \'rect\',',
  '  width: 40,',
  '  height: 24,',
  '  x: 80,',
  '  y: 200',
  '})',
  '',
  "OpenFlash.on('tick', (delta) => {",
  '  player.x += 100 * delta',
  '})',
  '',
  "OpenFlash.on('pointerDown', (e) => {",
  '  OpenFlash.drawParticle(e.x, e.y, {',
  "    color: '#FFE600',",
  '    count: 20',
  '  })',
  "  OpenFlash.playSound('hit')",
  '})',
  '',
  "OpenFlash.on('keyDown', (e) => {",
  "  if (e.key === 'ArrowRight') {",
  '    player.x += 5',
  '  }',
  '})'
].join('\n')

const STAGE_WIDTH = 800
const STAGE_HEIGHT = 450
const GRID_SIZE = 32

const buildContextMenuItems = (selIds: Set<string>, clip: VectorShape[], onCopy: () => void, onPaste: () => void, onDup: () => void, onGroup: () => void, onDel: () => void) => [
  { label: 'Copy', icon: <IconCopy size={13} />, shortcut: 'Ctrl+C', onClick: onCopy, disabled: selIds.size === 0 },
  { label: 'Paste', icon: <IconPaste size={13} />, shortcut: 'Ctrl+V', onClick: onPaste, disabled: clip.length === 0 },
  { label: 'Duplicate', icon: <IconCopy size={13} />, shortcut: 'Ctrl+D', onClick: onDup, disabled: selIds.size === 0 },
  { label: 'Group', icon: <IconLayers size={13} />, shortcut: 'Ctrl+G', onClick: onGroup, disabled: selIds.size < 2 },
  { label: 'Delete', icon: <IconTrash size={13} />, shortcut: 'Del', onClick: onDel, danger: true, disabled: selIds.size === 0 }
]

export default function StudioPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null)
  const drawEngineRef = useRef<DrawingEngine | null>(null)
  const audioEngineRef = useRef<AudioEngine | null>(null)
  const sandboxRef = useRef<StudioSandbox | null>(null)
  const animFrameRef = useRef<number>(0)

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
  const [shaders, setShaders] = useState<Set<ShaderType>>(new Set())
  const [cursorPos, setCursorPos] = useState<Vector2>({ x: 0, y: 0 })
  const [fps, setFps] = useState(0)
  const [playbackSpeed, setPlaybackSpeed] = useState(1)
  const [timelineFps, setTimelineFps] = useState(60)
  const [undoStack, setUndoStack] = useState<VectorShape[][]>([])
  const [redoStack, setRedoStack] = useState<VectorShape[][]>([])
  const [guides, setGuides] = useState<Array<{ id: string; orientation: 'horizontal' | 'vertical'; position: number }>>([])
  const [recentColors, setRecentColors] = useState<string[]>([])
  const [clipboard, setClipboard] = useState<VectorShape[]>([])
  const [onionSkinOpacity, setOnionSkinOpacity] = useState(0.3)
  const [onionSkinBefore, setOnionSkinBefore] = useState(2)
  const [onionSkinAfter, setOnionSkinAfter] = useState(2)
  const [loopRegion, setLoopRegion] = useState<{ start: number; end: number } | null>(null)
  const [showShortcuts, setShowShortcuts] = useState(false)
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null)
  const [assetSearch, setAssetSearch] = useState('')
  const [activePalette, setActivePalette] = useState<keyof typeof COLOR_PALETTES>('material')
  const [gradient, setGradient] = useState(createLinearGradient())
  const [emitters, setEmitters] = useState<ParticleEmitter[]>([])
  const [physicsWorld, setPhysicsWorld] = useState<PhysicsWorld | null>(null)
  const [audioClips, setAudioClips] = useState<Array<{ id: string; name: string; duration: number; waveform: number[] }>>([])
  const [showRulers, setShowRulers] = useState(false)
  const [unsavedChanges, setUnsavedChanges] = useState(false)
  const [lastSaved, setLastSaved] = useState<number | null>(null)

  // ─── Assets ─────────────────────────────────────────────────────────────────
  const [assets, setAssets] = useState<Asset[]>([])

  const [svgElements, setSvgElements] = useState<SvgElement[]>([])
  const [svgSelectedId, setSvgSelectedId] = useState<string | null>(null)
  const [svgTool, setSvgTool] = useState<SvgElement['type'] | 'select'>('select')
  const svgCanvasRef = useRef<HTMLCanvasElement>(null)

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
  const playStartTimeRef = useRef(0)
  const frameCountRef = useRef(0)
  const lastFpsTimeRef = useRef(performance.now())

  useEffect(() => {
    drawEngineRef.current = new DrawingEngine(toolState)
    audioEngineRef.current = new AudioEngine()
    sandboxRef.current = new StudioSandbox(overlayCanvasRef.current, (kind, message) => {
      if (kind === 'error') setCodeOutput(`[Error] ${message}`)
      else setCodeOutput(prev => prev === '[console] Ready' ? message : prev + '\n' + message)
    })
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current)
      sandboxRef.current?.dispose()
      audioEngineRef.current?.dispose()
    }
  }, [])

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

  const renderStage = useCallback(() => {
    const canvas = canvasRef.current
    const overlay = overlayCanvasRef.current
    if (!canvas || !overlay) return
    const ctx = canvas.getContext('2d')
    const overlayCtx = overlay.getContext('2d')
    if (!ctx || !overlayCtx) return

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

      for (const id of selectedShapeIds) {
        const shape = shapes.find(s => s.id === id)
        if (shape) {
          drawSelectionOverlay(overlayCtx, shape)
        }
      }
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
  }, [shapes, selectedShapeIds, timeline, zoom, panOffset, onionSkin, shaders, toolState, guides])

  const drawSelectionOverlay = (ctx: CanvasRenderingContext2D, shape: VectorShape) => {
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

  useEffect(() => {
    const loop = () => {
      renderStage()
      animFrameRef.current = requestAnimationFrame(loop)
    }
    animFrameRef.current = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(animFrameRef.current)
  }, [renderStage])

  useEffect(() => {
    if (!isPlaying) return
    const interval = setInterval(() => {
      setTimeline(prev => {
        let next = prev.currentFrame + 1
        if (next > prev.totalFrames) {
          if (prev.loop) next = 1
          else { setIsPlaying(false); return prev }
        }
        return { ...prev, currentFrame: next }
      })
    }, 1000 / (timelineFps * playbackSpeed))
    return () => clearInterval(interval)
  }, [isPlaying, timelineFps, playbackSpeed])

  useEffect(() => {
    const layer = timeline.layers.find(l => l.id === selectedLayerId)
    if (layer) {
      const kf = layer.keyframes.find(k => k.frame === timeline.currentFrame)
      if (kf) {
        setShapes([kf.shape])
      } else {
        const shapes: VectorShape[] = []
        for (const k of layer.keyframes) {
          if (k.frame <= timeline.currentFrame) {
            const idx = layer.keyframes.indexOf(k)
            if (idx === layer.keyframes.length - 1 || layer.keyframes[idx + 1].frame > timeline.currentFrame) {
              shapes.push(k.shape)
            }
          }
        }
        setShapes(shapes)
      }
    }
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
    setCursorPos({ x: Math.round(point.x), y: Math.round(point.y) })

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

  const refreshSavedProjects = () => {
    setSavedProjects(listProjects(owner))
  }

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
  }, [])

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
      autosave: projectAutosave
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
        autosave: true
      }
      saveProject(project)
      setCurrentProjectId(project.id)
    }, 800)
    return () => clearTimeout(timer)
  }, [shapes, code, timeline, shaders, projectAutosave])

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
      autosave: projectAutosave
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
      const p = importProjectJson(String(reader.result), owner)
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
        const src = String(reader.result)
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

  const addGuide = (orientation: 'horizontal' | 'vertical', position: number) => {
    setGuides(prev => [...prev, { id: `guide_${Date.now().toString(36)}_${Math.random().toString(36).substr(2, 6)}`, orientation, position }])
  }

  const removeGuide = (id: string) => {
    setGuides(prev => prev.filter(g => g.id !== id))
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

  const handleUngroup = () => {
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
  }

  const handleSelectAll = () => {
    setSelectedShapeIds(new Set(shapes.map(s => s.id)))
  }

  const handleInvertSelection = () => {
    setSelectedShapeIds(invertSelection(shapes, selectedShapeIds))
  }

  const handleCenterShape = () => {
    if (selectedShapeIds.size === 0) return
    pushUndo()
    setShapes(prev => prev.map(s => {
      if (!selectedShapeIds.has(s.id)) return s
      return { ...s, transform: { ...s.transform, x: toolState.canvasWidth / 2, y: toolState.canvasHeight / 2 } }
    }))
  }

  const handleAddEmitter = () => {
    const emitter = createEmitter(toolState.canvasWidth / 2, toolState.canvasHeight / 2)
    setEmitters(prev => [...prev, emitter])
    showToast('Particle emitter added', 'success')
  }

  const handleTogglePhysics = () => {
    if (physicsWorld) {
      setPhysicsWorld(null)
      showToast('Physics simulation stopped', 'info')
    } else {
      setPhysicsWorld(createWorld())
      showToast('Physics simulation started', 'success')
    }
  }

  const handleImportAudio = (file: File) => {
    importAudioFile(file).then((clip) => {
      setAudioClips(prev => [...prev, { id: clip.id, name: clip.name, duration: clip.duration, waveform: clip.waveform }])
      showToast(`Imported ${clip.name}`, 'success')
    }).catch(() => showToast('Failed to import audio', 'error'))
  }

  const handleSimplifyPath = () => {
    if (selectedShapeIds.size !== 1) return
    pushUndo()
    setShapes(prev => prev.map(s => {
      if (!selectedShapeIds.has(s.id) || !s.points) return s
      return { ...s, points: simplifyPath(s.points, 2) }
    }))
  }

  const handleOutlineStroke = () => {
    if (selectedShapeIds.size !== 1) return
    pushUndo()
    setShapes(prev => prev.map(s => selectedShapeIds.has(s.id) ? outlineStroke(s) : s))
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

  const handlePaste = () => {
    if (clipboard.length === 0) return
    pushUndo()
    const pasted = clipboard.map(s => ({ ...s, id: generateId(), transform: { ...s.transform, x: s.transform.x + 30, y: s.transform.y + 30 } }))
    setShapes(prev => [...prev, ...pasted])
    showToast(`Pasted ${pasted.length} shape${pasted.length > 1 ? 's' : ''}`, 'success')
  }

  const handleCanvasContextMenu = (e: React.MouseEvent) => {
    e.preventDefault()
    setContextMenu({ x: e.clientX, y: e.clientY })
  }

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

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
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
      case 'e': handleToolChange('eraser'); break
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
  }, [code, shapes, timeline, selectedShapeIds])

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

  const buildContextMenu = (selIds: Set<string>, clip: VectorShape[], onCopy: () => void, onPaste: () => void, onDup: () => void, onGroup: () => void, onDel: () => void) => [
    { label: 'Copy', icon: <IconCopy size={13} />, shortcut: 'Ctrl+C', onClick: onCopy, disabled: selIds.size === 0 },
    { label: 'Paste', icon: <IconPaste size={13} />, shortcut: 'Ctrl+V', onClick: onPaste, disabled: clip.length === 0 },
    { label: 'Duplicate', icon: <IconCopy size={13} />, shortcut: 'Ctrl+D', onClick: onDup, disabled: selIds.size === 0 },
    { label: 'Group', icon: <IconLayers size={13} />, shortcut: 'Ctrl+G', onClick: onGroup, disabled: selIds.size < 2 },
    { label: 'Delete', icon: <IconTrash size={13} />, shortcut: 'Del', onClick: onDel, danger: true, disabled: selIds.size === 0 }
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
            onMouseDown={handleCanvasMouseDown}
            onMouseMove={handleCanvasMouseMove}
            onMouseUp={handleCanvasMouseUp}
            onMouseLeave={handleCanvasMouseUp}
            onZoomIn={() => setZoom(z => Math.min(3, z + 0.1))}
            onZoomOut={() => setZoom(z => Math.max(0.2, z - 0.1))}
            onZoomReset={() => setZoom(1)}
            onToggleFullscreen={() => setIsFullscreen(true)}
            canvasWidth={toolState.canvasWidth}
            canvasHeight={toolState.canvasHeight}
            canvasBackground={toolState.canvasBackground}
            onContextMenu={handleCanvasContextMenu}
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
            onFpsChange={setTimelineFps}
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
    </div>
  )
}

interface Asset {
  id: string
  name: string
  type: 'image' | 'svg'
  src: string
  width: number
  height: number
  createdAt: number
}

interface SvgElement {
  id: string
  type: 'rect' | 'circle' | 'ellipse' | 'line' | 'polygon' | 'path' | 'text'
  attrs: Record<string, string | number>
  fill: string
  stroke: string
  strokeWidth: number
}

interface ToolbarProps {
  tools: Array<{ id: ToolType; icon: React.ReactNode; label: string; shortcut: string }>
  activeTool: ToolType
  onToolChange: (tool: ToolType) => void
  fillColor: string
  strokeColor: string
  onFillColorChange: (color: string) => void
  onStrokeColorChange: (color: string) => void
  strokeWidth: number
  onStrokeWidthChange: (width: number) => void
  onUndo: () => void
  onRedo: () => void
  toolState: ToolState
  onToolStateChange: React.Dispatch<React.SetStateAction<ToolState>>
  onAlign: (mode: 'left' | 'right' | 'top' | 'bottom' | 'center-h' | 'center-v') => void
  onDistribute: (mode: 'horizontal' | 'vertical') => void
  onZOrder: (direction: 'up' | 'down' | 'top' | 'bottom') => void
  onRotate: (angle: number) => void
  onFlip: (horizontal: boolean) => void
  onZoomToFit: () => void
  onClearCanvas: () => void
  onHandleDuplicate: () => void
}

interface CanvasAreaProps {
  canvasRef: React.RefObject<HTMLCanvasElement>
  overlayCanvasRef: React.RefObject<HTMLCanvasElement>
  zoom: number
  onMouseDown: (e: React.MouseEvent) => void
  onMouseMove: (e: React.MouseEvent) => void
  onMouseUp: (e: React.MouseEvent) => void
  onMouseLeave: () => void
  onZoomIn: () => void
  onZoomOut: () => void
  onZoomReset: () => void
  onToggleFullscreen: () => void
  canvasWidth: number
  canvasHeight: number
  canvasBackground: string
  onContextMenu: (e: React.MouseEvent) => void
}

interface TimelineAreaProps {
  timeline: TimelineState
  selectedLayerId: string | null
  isPlaying: boolean
  onionSkin: boolean
  onFrameChange: (frame: number) => void
  onTotalFramesChange: (frames: number) => void
  onTogglePlay: () => void
  onToggleOnionSkin: () => void
  onAddKeyframe: () => void
  onDeleteKeyframe: () => void
  onAddLayer: () => void
  onDeleteLayer: (id: string) => void
  onSelectLayer: (id: string) => void
  onToggleLayerVisibility: (id: string) => void
  onToggleLayerLock: (id: string) => void
  playbackSpeed: number
  onPlaybackSpeedChange: (speed: number) => void
  fps: number
  onFpsChange: (fps: number) => void
  loop: boolean
  onToggleLoop: () => void
}

interface SidePanelProps {
  activePanel: 'properties' | 'assets' | 'svg-maker' | 'code' | 'audio'
  onPanelChange: (panel: 'properties' | 'assets' | 'svg-maker' | 'code' | 'audio') => void
  selectedShape: VectorShape | undefined
  onUpdateShape: (transform: Partial<Transform>) => void
  code: string
  codeOutput: string
  onCodeChange: (code: string) => void
  onRunCode: () => void
  isRunning: boolean
  audioEngine: AudioEngine | null
  audioClips: Array<{ id: string; name: string; duration: number; waveform: number[] }>
  onExportHTML: () => void
  onExportPNG: () => void
  onExportSVG: () => void
  shaders: Set<ShaderType>
  onToggleShader: (type: ShaderType) => void
  fps: number
  cursorPos: Vector2 | null
  shapeCount: number
  assets: Asset[]
  onImportAssets: (files: FileList | File[]) => void
  onRemoveAsset: (id: string) => void
  svgElements: SvgElement[]
  svgSelectedId: string | null
  svgTool: SvgElement['type'] | 'select'
  onSvgToolChange: (tool: SvgElement['type'] | 'select') => void
  onAddSvgElement: (type: SvgElement['type']) => void
  onUpdateSvgAttr: (id: string, attr: string, value: string | number) => void
  onUpdateSvgStyle: (id: string, style: Partial<Pick<SvgElement, 'fill' | 'stroke' | 'strokeWidth'>>) => void
  onRemoveSvgElement: (id: string) => void
  onSelectSvgElement: (id: string) => void
  onExportSvg: () => void
  toolState: ToolState
  onToolStateChange: React.Dispatch<React.SetStateAction<ToolState>>
  recentColors: string[]
  onAddRecentColor: (color: string) => void
}

interface PropertiesPanelProps {
  selectedShape: VectorShape | undefined
  onUpdateShape: (transform: Partial<Transform>) => void
  onExportHTML: () => void
  onExportPNG: () => void
  onExportSVG: () => void
  shaders: Set<ShaderType>
  onToggleShader: (type: ShaderType) => void
  fps: number
  cursorPos: Vector2 | null
  shapeCount: number
  toolState: ToolState
  onToolStateChange: React.Dispatch<React.SetStateAction<ToolState>>
  recentColors: string[]
  onAddRecentColor: (color: string) => void
}

interface CodeEditorProps {
  code: string
  codeOutput: string
  onCodeChange: (code: string) => void
  onRunCode: () => void
  isRunning: boolean
}

interface ProjectBarProps {
  projectName: string
  onProjectNameChange: (name: string) => void
  projectAutosave: boolean
  onToggleAutosave: () => void
  onSave: () => void
  onNewProject: () => void
  savedProjects: ProjectMeta[]
  isProjectsOpen: boolean
  onToggleProjects: () => void
  onOpenProject: (id: string) => void
  onExportJson: () => void
  onImportJson: (file: File) => void
  isSaved: boolean
}

interface FullscreenPreviewProps {
  shapes: VectorShape[]
  code: string
  shaders: Set<ShaderType>
  fps: number
  onClose: () => void
}

interface ExplorerPanelProps {
  explorerTab: 'layers' | 'assets' | 'shapes'
  onTabChange: (tab: 'layers' | 'assets' | 'shapes') => void
  layers: Layer[]
  selectedLayerId: string | null
  onSelectLayer: (id: string) => void
  onToggleLayerVisibility: (id: string) => void
  onToggleLayerLock: (id: string) => void
  onAddLayer: () => void
  onDeleteLayer: (id: string) => void
  assets: Asset[]
  onImportAssets: (files: FileList | File[]) => void
  onRemoveAsset: (id: string) => void
  shapes: VectorShape[]
  selectedShapeIds: Set<string>
  onSelectShape: (id: string) => void
}

interface AssetsPanelProps {
  assets: Asset[]
  onImportAssets: (files: FileList | File[]) => void
  onRemoveAsset: (id: string) => void
}

interface SvgMakerPanelProps {
  elements: SvgElement[]
  selectedId: string | null
  tool: SvgElement['type'] | 'select'
  onToolChange: (tool: SvgElement['type'] | 'select') => void
  onAddElement: (type: SvgElement['type']) => void
  onUpdateAttr: (id: string, attr: string, value: string | number) => void
  onUpdateStyle: (id: string, style: Partial<Pick<SvgElement, 'fill' | 'stroke' | 'strokeWidth'>>) => void
  onRemoveElement: (id: string) => void
  onSelectElement: (id: string) => void
  onExport: () => void
}

function Toolbar({ tools, activeTool, onToolChange, fillColor, strokeColor, onFillColorChange, onStrokeColorChange, strokeWidth, onStrokeWidthChange, onUndo, onRedo, toolState, onToolStateChange, onAlign, onDistribute, onZOrder, onRotate, onFlip, onZoomToFit, onClearCanvas, onHandleDuplicate }: ToolbarProps) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px',
      background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-subtle)', flexShrink: 0, overflowX: 'auto'
    }}>
      <div style={{ display: 'flex', gap: 2 }}>
        {tools.map((tool) => (
          <button key={tool.id} onClick={() => onToolChange(tool.id)} title={`${tool.label} (${tool.shortcut})`}
            style={{
              width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: activeTool === tool.id ? 'rgba(0, 240, 255, 0.15)' : 'transparent',
              border: activeTool === tool.id ? '1px solid var(--accent-cyan)' : '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-sm)', color: activeTool === tool.id ? 'var(--accent-cyan)' : 'var(--text-secondary)',
              cursor: 'pointer', transition: 'all var(--transition-fast)', flexShrink: 0
            }}>
            {tool.icon}
          </button>
        ))}
      </div>
      <div style={{ width: 1, height: 24, background: 'var(--border-subtle)', flexShrink: 0 }} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <label style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>Fill</label>
        <input type="color" value={fillColor} onChange={e => onFillColorChange(e.target.value)}
          style={{ width: 26, height: 26, border: 'none', borderRadius: 'var(--radius-sm)', cursor: 'pointer', background: 'none' }} />
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <label style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>Stroke</label>
        <input type="color" value={strokeColor} onChange={e => onStrokeColorChange(e.target.value)}
          style={{ width: 26, height: 26, border: 'none', borderRadius: 'var(--radius-sm)', cursor: 'pointer', background: 'none' }} />
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
        <label style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>W:</label>
        <input type="number" value={strokeWidth} onChange={e => onStrokeWidthChange(Number(e.target.value))}
          min={0.5} max={50} step={0.5} className="input" style={{ width: 46, padding: '2px 4px', fontSize: 10 }} />
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
        <label style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>Brush:</label>
        <input type="range" min={1} max={100} value={toolState.brushSize} onChange={e => onToolStateChange({ ...toolState, brushSize: Number(e.target.value) })}
          style={{ width: 50, accentColor: 'var(--accent-cyan)' }} />
        <span style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', width: 18 }}>{toolState.brushSize}</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
        <label style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>Op:</label>
        <input type="range" min={0} max={1} step={0.05} value={toolState.brushOpacity} onChange={e => onToolStateChange({ ...toolState, brushOpacity: Number(e.target.value) })}
          style={{ width: 40, accentColor: 'var(--accent-cyan)' }} />
        <span style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', width: 20 }}>{Math.round(toolState.brushOpacity * 100)}%</span>
      </div>
      <div style={{ width: 1, height: 24, background: 'var(--border-subtle)', flexShrink: 0 }} />
      <button className="btn btn-ghost" onClick={onUndo} title="Undo (Ctrl+Z)" style={{ padding: '4px 6px', flexShrink: 0 }}>
        <IconUndo size={13} />
      </button>
      <button className="btn btn-ghost" onClick={onRedo} title="Redo (Ctrl+Y)" style={{ padding: '4px 6px', flexShrink: 0 }}>
        <IconRedo size={13} />
      </button>
      <div style={{ width: 1, height: 24, background: 'var(--border-subtle)', flexShrink: 0 }} />
      <button className="btn btn-ghost" onClick={onHandleDuplicate} title="Duplicate (Ctrl+D)" style={{ padding: '4px 6px', flexShrink: 0 }}>
        <IconCopy size={13} />
      </button>
      <button className="btn btn-ghost" onClick={onClearCanvas} title="Clear Canvas" style={{ padding: '4px 6px', flexShrink: 0 }}>
        <IconTrash size={13} />
      </button>
      <div style={{ width: 1, height: 24, background: 'var(--border-subtle)', flexShrink: 0 }} />
      <button className={`btn ${toolState.snapToGrid ? 'btn-cyan' : 'btn-ghost'}`} onClick={() => onToolStateChange({ ...toolState, snapToGrid: !toolState.snapToGrid })} title="Snap to Grid" style={{ padding: '4px 6px', flexShrink: 0 }}>
        <IconGrid size={13} />
      </button>
      <button className="btn btn-ghost" onClick={onZoomToFit} title="Zoom to Fit" style={{ padding: '4px 6px', fontSize: 10, flexShrink: 0 }}>
        Fit
      </button>
      <div style={{ width: 1, height: 24, background: 'var(--border-subtle)', flexShrink: 0 }} />
      <button className="btn btn-ghost" onClick={() => onAlign('left')} title="Align Left" style={{ padding: '4px 5px', fontSize: 10, flexShrink: 0 }}>◧</button>
      <button className="btn btn-ghost" onClick={() => onAlign('center-h')} title="Align Center H" style={{ padding: '4px 5px', fontSize: 10, flexShrink: 0 }}>⊞</button>
      <button className="btn btn-ghost" onClick={() => onAlign('right')} title="Align Right" style={{ padding: '4px 5px', fontSize: 10, flexShrink: 0 }}>◨</button>
      <button className="btn btn-ghost" onClick={() => onDistribute('horizontal')} title="Distribute H" style={{ padding: '4px 5px', fontSize: 10, flexShrink: 0 }}>⋮⋮</button>
      <button className="btn btn-ghost" onClick={() => onZOrder('top')} title="Bring to Front" style={{ padding: '4px 5px', fontSize: 10, flexShrink: 0 }}>⤒</button>
      <button className="btn btn-ghost" onClick={() => onZOrder('bottom')} title="Send to Back" style={{ padding: '4px 5px', fontSize: 10, flexShrink: 0 }}>⤓</button>
      <div style={{ width: 1, height: 24, background: 'var(--border-subtle)', flexShrink: 0 }} />
      <button className="btn btn-ghost" onClick={() => onRotate(90)} title="Rotate 90°" style={{ padding: '4px 6px', flexShrink: 0 }}>
        <IconRefresh size={12} />
      </button>
      <button className="btn btn-ghost" onClick={() => onFlip(true)} title="Flip Horizontal" style={{ padding: '4px 5px', fontSize: 11, flexShrink: 0 }}>⇋</button>
    </div>
  )
}

function CanvasArea({ canvasRef, overlayCanvasRef, zoom, onMouseDown, onMouseMove, onMouseUp, onMouseLeave, onZoomIn, onZoomOut, onZoomReset, onToggleFullscreen, canvasWidth, canvasHeight, canvasBackground, onContextMenu }: CanvasAreaProps) {
  return (
    <div style={{
      flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 20, overflow: 'hidden', background: 'var(--bg-primary)', position: 'relative'
    }}>
      <div style={{ position: 'relative', transform: `scale(${zoom})`, transformOrigin: 'center center', boxShadow: '0 0 60px rgba(0, 0, 0, 0.5)' }}>
        <canvas ref={canvasRef} width={canvasWidth} height={canvasHeight}
          style={{ display: 'block', background: canvasBackground, borderRadius: 'var(--radius-sm)', maxWidth: canvasWidth, maxHeight: canvasHeight }}
        />
        <canvas
          ref={overlayCanvasRef} width={canvasWidth} height={canvasHeight}
          style={{ position: 'absolute', top: 0, left: 0, width: canvasWidth, height: canvasHeight, pointerEvents: 'auto', cursor: 'crosshair' }}
          onMouseDown={onMouseDown} onMouseMove={onMouseMove} onMouseUp={onMouseUp} onMouseLeave={onMouseLeave}
          onContextMenu={onContextMenu}
        />
      </div>
      <div style={{ position: 'absolute', top: 12, right: 12, display: 'flex', flexDirection: 'column', gap: 4, zIndex: 50 }}>
        <button className="btn btn-ghost" onClick={onZoomIn} title="Zoom In" style={{ padding: '4px 8px', fontSize: 12 }}>+</button>
        <button className="btn btn-ghost" onClick={onZoomOut} title="Zoom Out" style={{ padding: '4px 8px', fontSize: 12 }}>
          <IconMinus size={14} />
        </button>
        <button className="btn btn-ghost" onClick={onZoomReset} title="Reset Zoom" style={{ padding: '4px 8px', fontSize: 10, fontFamily: 'var(--font-mono)' }}>{Math.round(zoom * 100)}%</button>
        <button className="btn btn-ghost" onClick={onToggleFullscreen} title="Fullscreen Preview" style={{ padding: '4px 8px' }}>
          <IconFullscreen size={13} />
        </button>
      </div>
      <div style={{ position: 'absolute', bottom: 12, left: 12, fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)' }}>
        Drag: draw &nbsp;•&nbsp; Space: play &nbsp;•&nbsp; V: select
      </div>
    </div>
  )
}

function TimelineArea({ timeline, selectedLayerId, isPlaying, onionSkin, onFrameChange, onTotalFramesChange, onTogglePlay, onToggleOnionSkin, onAddKeyframe, onDeleteKeyframe, onAddLayer, onDeleteLayer, onSelectLayer, onToggleLayerVisibility, onToggleLayerLock, playbackSpeed, onPlaybackSpeedChange, fps, onFpsChange, loop, onToggleLoop }: TimelineAreaProps) {
  return (
    <div style={{
      height: 180, background: 'var(--bg-secondary)', borderTop: '1px solid var(--border-subtle)',
      display: 'flex', flexDirection: 'column', flexShrink: 0
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', borderBottom: '1px solid var(--border-subtle)'
      }}>
        <button className={`btn ${isPlaying ? 'btn-primary' : ''}`} onClick={onTogglePlay} style={{ padding: '4px 10px' }}>
          {isPlaying ? <IconPause size={12} /> : <IconPlay size={12} />}
        </button>
        <button className="btn btn-ghost" onClick={() => onFrameChange(Math.max(1, timeline.currentFrame - 1))} style={{ padding: '4px 8px' }}>
          <IconSkipBack size={12} />
        </button>
        <button className="btn btn-ghost" onClick={() => onFrameChange(Math.min(timeline.totalFrames, timeline.currentFrame + 1))} style={{ padding: '4px 6px' }}>
          <IconSkipForward size={12} />
        </button>
        <div style={{
          fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--accent-yellow)',
          padding: '2px 8px', background: 'rgba(255, 230, 0, 0.08)', borderRadius: 'var(--radius-sm)'
        }}>
          Frame {timeline.currentFrame} / {timeline.totalFrames}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
          <label style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>Speed:</label>
          <select value={playbackSpeed} onChange={e => onPlaybackSpeedChange(Number(e.target.value))}
            className="input" style={{ padding: '1px 4px', fontSize: 9, width: 50 }}>
            <option value="0.25">0.25x</option>
            <option value="0.5">0.5x</option>
            <option value="1">1x</option>
            <option value="1.5">1.5x</option>
            <option value="2">2x</option>
          </select>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
          <label style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>FPS:</label>
          <select value={fps} onChange={e => onFpsChange(Number(e.target.value))}
            className="input" style={{ padding: '1px 4px', fontSize: 9, width: 46 }}>
            <option value="12">12</option>
            <option value="24">24</option>
            <option value="30">30</option>
            <option value="60">60</option>
          </select>
        </div>
        <label style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 10, color: 'var(--text-secondary)', cursor: 'pointer' }}>
          <input type="checkbox" checked={loop} onChange={onToggleLoop} style={{ accentColor: 'var(--accent-cyan)' }} />
          Loop
        </label>
        <div style={{ flex: 1 }} />
        <label style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 10, color: 'var(--text-secondary)', cursor: 'pointer' }}>
          <input type="checkbox" checked={onionSkin} onChange={onToggleOnionSkin} style={{ accentColor: 'var(--accent-cyan)' }} />
          Onion
        </label>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-muted)' }}>Total:</span>
        <input type="number" value={timeline.totalFrames} onChange={e => onTotalFramesChange(Number(e.target.value))}
          className="input" style={{ width: 50, padding: '1px 4px', fontSize: 9 }} />
        <button onClick={onAddKeyframe} className="btn btn-ghost" style={{ padding: '3px 6px', fontSize: 9 }} title="Insert Keyframe (F6)">
          <IconDiamond size={10} /> KF
        </button>
        <button onClick={onDeleteKeyframe} className="btn btn-ghost" style={{ padding: '3px 6px', fontSize: 9 }} title="Delete Keyframe">
          <IconClose size={10} /> KF
        </button>
      </div>
      <div style={{ flex: 1, display: 'flex', overflow: 'auto' }}>
        <div style={{ width: 140, flexShrink: 0, borderRight: '1px solid var(--border-subtle)' }}>
          <div style={{ height: 22, borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 8px' }}>
            <span style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Layers</span>
            <button onClick={onAddLayer} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 12, padding: 0 }}>+</button>
          </div>
          {timeline.layers.map((layer: Layer) => (
            <div key={layer.id} onClick={() => onSelectLayer(layer.id)}
              style={{
                height: 28, display: 'flex', alignItems: 'center', padding: '0 8px', fontSize: 11,
                cursor: 'pointer', background: selectedLayerId === layer.id ? 'rgba(0, 240, 255, 0.08)' : 'transparent',
                borderBottom: '1px solid var(--border-subtle)'
              }}
            >
              <button onClick={e => { e.stopPropagation(); onToggleLayerVisibility(layer.id); }}
                style={{ background: 'none', border: 'none', color: layer.visible ? 'var(--text-secondary)' : 'var(--text-muted)', cursor: 'pointer', padding: '0 4px' }}>
                {layer.visible ? <IconEye size={13} /> : <span style={{ fontSize: 10 }}>—</span>}
              </button>
              <button onClick={e => { e.stopPropagation(); onToggleLayerLock(layer.id); }}
                style={{ background: 'none', border: 'none', color: layer.locked ? 'var(--accent-yellow)' : 'var(--text-muted)', cursor: 'pointer', padding: '0 4px' }}>
                {layer.locked ? <IconLock size={12} /> : <span style={{ fontSize: 9 }}>—</span>}
              </button>
              <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginLeft: 4 }}>{layer.name}</span>
              <button onClick={e => { e.stopPropagation(); onDeleteLayer(layer.id); }}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 10, padding: '0 2px' }}>
                <IconClose size={12} />
              </button>
            </div>
          ))}
        </div>
        <div style={{ flex: 1, position: 'relative' }}>
          <div style={{ height: 22, display: 'flex', borderBottom: '1px solid var(--border-subtle)' }}>
            {Array.from({ length: timeline.totalFrames }, (_, i) => (
              <div key={i} onClick={() => onFrameChange(i + 1)}
                style={{
                  flex: 1, minWidth: 20, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontFamily: 'var(--font-mono)', fontSize: 8, color: (i + 1) % 5 === 0 ? 'var(--text-muted)' : 'transparent',
                  cursor: 'pointer', borderRight: '1px solid rgba(255,255,255,0.02)',
                  background: timeline.currentFrame === i + 1 ? 'rgba(0, 240, 255, 0.1)' : 'transparent'
                }}>
                {(i + 1) % 5 === 0 ? i + 1 : ''}
              </div>
            ))}
          </div>
          {timeline.layers.map((layer: Layer) => (
            <div key={layer.id}
              style={{
                height: 28, display: 'flex', borderBottom: '1px solid var(--border-subtle)',
                background: selectedLayerId === layer.id ? 'rgba(0, 240, 255, 0.03)' : 'transparent'
              }}
            >
              {Array.from({ length: timeline.totalFrames }, (_, i) => {
                const hasKeyframe = layer.keyframes.some(kf => kf.frame === i + 1)
                const isFirst = layer.keyframes[0]?.frame === i + 1
                return (
                  <div key={i} style={{
                    flex: 1, minWidth: 20, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    borderRight: '1px solid rgba(255,255,255,0.02)'
                  }} onClick={() => onFrameChange(i + 1)}>
                    {hasKeyframe && (
                      <div style={{
                        width: 10, height: 10, borderRadius: isFirst ? '50%' : '2px',
                        background: isFirst ? 'var(--accent-cyan)' : 'var(--accent-yellow)',
                        border: isFirst ? 'none' : '1px solid var(--accent-yellow)'
                      }} />
                    )}
                  </div>
                )
              })}
            </div>
          ))}
          <div style={{
            position: 'absolute', top: 0, bottom: 0, left: 140 + (timeline.currentFrame - 1) * 20,
            width: 2, background: 'var(--accent-cyan)', pointerEvents: 'none', boxShadow: '0 0 8px var(--accent-cyan)', zIndex: 10
          }} />
        </div>
      </div>
    </div>
  )
}

function SidePanel({ activePanel, onPanelChange, selectedShape, onUpdateShape, code, codeOutput, onCodeChange, onRunCode, isRunning, audioEngine, audioClips, onExportHTML, onExportPNG, onExportSVG, shaders, onToggleShader, fps, cursorPos, shapeCount, assets, onImportAssets, onRemoveAsset, svgElements, svgSelectedId, svgTool, onSvgToolChange, onAddSvgElement, onUpdateSvgAttr, onUpdateSvgStyle, onRemoveSvgElement, onSelectSvgElement, onExportSvg, toolState, onToolStateChange, recentColors, onAddRecentColor }: SidePanelProps) {
  const panels = ['properties', 'assets', 'svg-maker', 'code', 'audio'] as const
  const panelLabels: Record<string, string> = {
    properties: 'Props',
    assets: 'Assets',
    'svg-maker': 'SVG',
    code: 'Code',
    audio: 'Audio'
  }
  return (
    <div style={{
      width: 300, display: 'flex', flexDirection: 'column', borderLeft: '1px solid var(--border-subtle)',
      background: 'var(--bg-secondary)', overflow: 'hidden', flexShrink: 0
    }}>
      <div style={{ display: 'flex', borderBottom: '1px solid var(--border-subtle)', overflowX: 'auto' }}>
        {panels.map(panel => (
          <button key={panel} onClick={() => onPanelChange(panel)}
            style={{
              flex: 1, padding: '8px 6px', fontSize: 10, fontWeight: 500, background: 'none', border: 'none',
              borderBottom: activePanel === panel ? '2px solid var(--accent-yellow)' : '2px solid transparent',
              color: activePanel === panel ? 'var(--text-primary)' : 'var(--text-muted)',
              cursor: 'pointer', transition: 'all var(--transition-fast)', whiteSpace: 'nowrap'
            }}>
            {panelLabels[panel] || panel}
          </button>
        ))}
      </div>
      <div style={{ flex: 1, overflow: 'auto' }}>
        {activePanel === 'properties' && (
          <PropertiesPanel
            selectedShape={selectedShape}
            onUpdateShape={onUpdateShape}
            onExportHTML={onExportHTML}
            onExportPNG={onExportPNG}
            onExportSVG={onExportSVG}
            shaders={shaders}
            onToggleShader={onToggleShader}
            fps={fps}
            cursorPos={cursorPos}
            shapeCount={shapeCount}
            toolState={toolState}
            onToolStateChange={onToolStateChange}
            recentColors={recentColors}
            onAddRecentColor={onAddRecentColor}
          />
        )}
        {activePanel === 'assets' && (
          <AssetsPanel
            assets={assets}
            onImportAssets={onImportAssets}
            onRemoveAsset={onRemoveAsset}
          />
        )}
        {activePanel === 'svg-maker' && (
          <SvgMakerPanel
            elements={svgElements}
            selectedId={svgSelectedId}
            tool={svgTool}
            onToolChange={onSvgToolChange}
            onAddElement={onAddSvgElement}
            onUpdateAttr={onUpdateSvgAttr}
            onUpdateStyle={onUpdateSvgStyle}
            onRemoveElement={onRemoveSvgElement}
            onSelectElement={onSelectSvgElement}
            onExport={onExportSvg}
          />
        )}
        {activePanel === 'code' && (
          <CodeEditor code={code} codeOutput={codeOutput} onCodeChange={onCodeChange} onRunCode={onRunCode} isRunning={isRunning} />
        )}
        {activePanel === 'audio' && (
          <AudioSynth audioEngine={audioEngine} />
        )}
      </div>
    </div>
  )
}

function PropertiesPanel({ selectedShape, onUpdateShape, onExportHTML, onExportPNG, onExportSVG, shaders, onToggleShader, fps, cursorPos, shapeCount, toolState, onToolStateChange, recentColors, onAddRecentColor }: PropertiesPanelProps) {
  const t = selectedShape?.transform || { x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0, alpha: 1 }
  const blendModes = ['normal', 'multiply', 'screen', 'overlay', 'darken', 'lighten', 'color-dodge', 'color-burn', 'hard-light', 'soft-light', 'difference', 'exclusion']
  const colorPresets = ['#FFE600', '#00F0FF', '#FF00AA', '#00FF88', '#FF6600', '#FFFFFF', '#000000', '#FF5F75', '#7B61FF', '#00B4D8', '#F72585', '#7209B7']

  return (
    <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div>
        <h3 style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 }}>Transform</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
          {(['x', 'y', 'scaleX', 'scaleY', 'rotation', 'alpha'] as const).map(prop => (
            <div key={prop}>
              <label style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-muted)', display: 'block', marginBottom: 2 }}>{prop}</label>
              <input type="number" value={Math.round(t[prop] * 100) / 100}
                onChange={e => onUpdateShape({ [prop]: parseFloat(e.target.value) || 0 })}
                className="input" style={{ width: '100%', padding: '3px 6px', fontSize: 10 }}
                disabled={!selectedShape} step={prop === 'rotation' ? 1 : prop.includes('scale') ? 0.1 : 1} />
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 4, marginTop: 6 }}>
          <button onClick={() => onUpdateShape({ x: 0, y: 0 })} className="btn btn-ghost" style={{ flex: 1, padding: '3px', fontSize: 9 }} disabled={!selectedShape}>Reset</button>
          <button onClick={() => onUpdateShape({ scaleX: 1, scaleY: 1 })} className="btn btn-ghost" style={{ flex: 1, padding: '3px', fontSize: 9 }} disabled={!selectedShape}>1:1</button>
          <button onClick={() => onUpdateShape({ rotation: 0 })} className="btn btn-ghost" style={{ flex: 1, padding: '3px', fontSize: 9 }} disabled={!selectedShape}>0°</button>
        </div>
      </div>
      <div>
        <h3 style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 }}>Color Palettes</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 4 }}>
          {colorPresets.map(color => (
            <button key={color} onClick={() => { onToolStateChange({ ...toolState, fillColor: color }); onAddRecentColor(color) }} title={color}
              style={{ width: '100%', height: 22, background: color, border: toolState.fillColor === color ? '2px solid var(--text-primary)' : '1px solid var(--border-subtle)', borderRadius: 'var(--radius-sm)', cursor: 'pointer' }} />
          ))}
        </div>
        {recentColors.length > 0 && (
          <div style={{ marginTop: 6 }}>
            <label style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', display: 'block', marginBottom: 3 }}>Recent</label>
            <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
              {recentColors.slice(0, 12).map((color: string, i: number) => (
                <button key={i} onClick={() => onToolStateChange({ ...toolState, fillColor: color })}
                  style={{ width: 18, height: 18, background: color, border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-sm)', cursor: 'pointer' }} />
              ))}
            </div>
          </div>
        )}
      </div>
      <div>
        <h3 style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 }}>Blend Mode</h3>
        <select value={toolState.blendMode || 'normal'} onChange={e => onToolStateChange({ ...toolState, blendMode: e.target.value })}
          className="input" style={{ width: '100%', padding: '3px 6px', fontSize: 10 }}>
          {blendModes.map(mode => <option key={mode} value={mode}>{mode}</option>)}
        </select>
      </div>
      <div>
        <h3 style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 }}>Text & Shape</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <select value={toolState.fontFamily} onChange={e => onToolStateChange({ ...toolState, fontFamily: e.target.value })}
            className="input" style={{ width: '100%', padding: '3px 6px', fontSize: 10 }}>
            <option value="Space Grotesk, sans-serif">Space Grotesk</option>
            <option value="JetBrains Mono, monospace">JetBrains Mono</option>
            <option value="Arial, sans-serif">Arial</option>
            <option value="Georgia, serif">Georgia</option>
            <option value="Courier New, monospace">Courier New</option>
            <option value="Verdana, sans-serif">Verdana</option>
            <option value="Impact, sans-serif">Impact</option>
          </select>
          <div style={{ display: 'flex', gap: 4 }}>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>Size</label>
              <input type="number" value={toolState.fontSize} onChange={e => onToolStateChange({ ...toolState, fontSize: Number(e.target.value) })}
                min={6} max={200} className="input" style={{ width: '100%', padding: '3px 6px', fontSize: 10 }} />
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>Polygon</label>
              <input type="number" value={toolState.polygonSides} onChange={e => onToolStateChange({ ...toolState, polygonSides: Number(e.target.value) })}
                min={3} max={20} className="input" style={{ width: '100%', padding: '3px 6px', fontSize: 10 }} />
            </div>
          </div>
          <div style={{ display: 'flex', gap: 4 }}>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>Star Points</label>
              <input type="number" value={toolState.starPoints} onChange={e => onToolStateChange({ ...toolState, starPoints: Number(e.target.value) })}
                min={3} max={20} className="input" style={{ width: '100%', padding: '3px 6px', fontSize: 10 }} />
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>Star Inner</label>
              <input type="number" value={toolState.starInnerRadius} onChange={e => onToolStateChange({ ...toolState, starInnerRadius: Number(e.target.value) })}
                min={0.1} max={0.9} step={0.05} className="input" style={{ width: '100%', padding: '3px 6px', fontSize: 10 }} />
            </div>
          </div>
        </div>
      </div>
      <div>
        <h3 style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 }}>Filters</h3>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
          {(['Blur', 'Glow', 'Drop Shadow', 'Bevel'] as const).map(filter => (
            <button key={filter} className="btn btn-ghost" style={{ padding: '3px 8px', fontSize: 10 }}>{filter}</button>
          ))}
        </div>
      </div>
      <div>
        <h3 style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 }}>Shaders</h3>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
          {(['crt', 'bloom', 'glow', 'chromatic', 'grain'] as const).map(shader => (
            <button key={shader} onClick={() => onToggleShader(shader)}
              className={`btn ${shaders.has(shader) ? 'btn-cyan' : 'btn-ghost'}`}
              style={{ padding: '3px 8px', fontSize: 10, textTransform: 'uppercase' }}>
              {shader}
            </button>
          ))}
        </div>
      </div>
      <div>
        <h3 style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 }}>Export</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <button className="btn btn-primary" onClick={onExportHTML}>
            <IconPackage size={13} /> Export HTML (Offline)
          </button>
          <div style={{ display: 'flex', gap: 6 }}>
            <button className="btn" onClick={onExportPNG} style={{ flex: 1 }}>PNG Frame</button>
            <button className="btn" onClick={onExportSVG} style={{ flex: 1 }}>SVG Frame</button>
          </div>
        </div>
      </div>
      <div>
        <h3 style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 }}>Stats</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, fontSize: 10 }}>
          <div><span style={{ color: 'var(--text-muted)' }}>FPS:</span> <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--accent-green)' }}>{fps}</span></div>
          <div><span style={{ color: 'var(--text-muted)' }}>Shapes:</span> <span style={{ fontFamily: 'var(--font-mono)' }}>{shapeCount}</span></div>
          <div><span style={{ color: 'var(--text-muted)' }}>Cursor:</span> <span style={{ fontFamily: 'var(--font-mono)' }}>{cursorPos ? `${cursorPos.x}, ${cursorPos.y}` : '—'}</span></div>
          <div><span style={{ color: 'var(--text-muted)' }}>Selected:</span> <span style={{ fontFamily: 'var(--font-mono)' }}>{selectedShape ? '1' : '0'}</span></div>
        </div>
      </div>
    </div>
  )
}

function CodeEditor({ code, codeOutput, onCodeChange, onRunCode, isRunning }: CodeEditorProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ padding: '8px 12px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)' }}>TypeScript</span>
        <button className="btn btn-primary" onClick={onRunCode} style={{ padding: '4px 10px', fontSize: 10 }}>
          {isRunning ? <><IconStop size={11} /> Stop</> : <><IconPlay size={11} /> Run</>}
        </button>
      </div>
      <textarea value={code} onChange={e => onCodeChange(e.target.value)} spellCheck={false}
        placeholder={CODE_PLACEHOLDER}
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
}

function AudioSynth({ audioEngine }: { audioEngine: AudioEngine | null }) {
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
}

function ProjectBar({ projectName, onProjectNameChange, projectAutosave, onToggleAutosave, onSave, onNewProject, savedProjects, isProjectsOpen, onToggleProjects, onOpenProject, onExportJson, onImportJson, isSaved }: ProjectBarProps) {
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
}

function FullscreenPreview({ shapes, code, shaders, fps, onClose }: FullscreenPreviewProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const previewCanvasRef = useRef<HTMLCanvasElement>(null)
  const animRef = useRef(0)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  useEffect(() => {
    const canvas = previewCanvasRef.current
    const container = containerRef.current
    if (!canvas || !container) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const fit = () => {
      const cw = container.clientWidth - 40
      const ch = container.clientHeight - 40
      const scale = Math.min(cw / 800, ch / 450)
      canvas.style.width = `${800 * scale}px`
      canvas.style.height = `${450 * scale}px`
    }
    fit()
    window.addEventListener('resize', fit)

    const loop = () => {
      ctx.fillStyle = '#0D0E12'
      ctx.fillRect(0, 0, 800, 450)
      for (const shape of shapes) {
        renderShape(ctx, shape)
      }
      for (const shaderType of shaders) {
        applyShaderOverlay(ctx, shaderType, 800, 450, 0.6)
      }
      animRef.current = requestAnimationFrame(loop)
    }
    animRef.current = requestAnimationFrame(loop)
    return () => {
      window.removeEventListener('resize', fit)
      cancelAnimationFrame(animRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 1000,
      background: 'rgba(5, 6, 10, 0.94)', display: 'flex', flexDirection: 'column'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px', borderBottom: '1px solid var(--border-subtle)', flexShrink: 0 }}>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-muted)' }}>{code ? 'PREVIEW · RUNTIME ACTIVE' : `PREVIEW · ${fps} FPS`}</span>
        <div style={{ flex: 1 }} />
        <button onClick={onClose} className="btn btn-ghost" style={{ padding: '4px 12px', fontSize: 11 }}>
          <IconClose size={14} /> Close (Esc)
        </button>
      </div>
      <div ref={containerRef} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
        <canvas ref={previewCanvasRef} width={800} height={450}
          style={{ display: 'block', background: '#0D0E12', borderRadius: 'var(--radius-sm)', boxShadow: '0 0 80px rgba(0, 0, 0, 0.7)' }} />
      </div>
    </div>
  )
}

// ─── Explorer Panel (left sidebar) ────────────────────────────────────────────

function ExplorerPanel({ explorerTab, onTabChange, layers, selectedLayerId, onSelectLayer, onToggleLayerVisibility, onToggleLayerLock, onAddLayer, onDeleteLayer, assets, onImportAssets, onRemoveAsset, shapes, selectedShapeIds, onSelectShape }: ExplorerPanelProps) {
  const importRef = useRef<HTMLInputElement>(null)

  return (
    <div style={{
      width: 200, display: 'flex', flexDirection: 'column', borderRight: '1px solid var(--border-subtle)',
      background: 'var(--bg-secondary)', overflow: 'hidden', flexShrink: 0
    }}>
      <div style={{ display: 'flex', borderBottom: '1px solid var(--border-subtle)' }}>
        {(['layers', 'assets', 'shapes'] as const).map(tab => (
          <button key={tab} onClick={() => onTabChange(tab)}
            style={{
              flex: 1, padding: '8px 6px', fontSize: 10, fontWeight: 500, background: 'none', border: 'none',
              borderBottom: explorerTab === tab ? '2px solid var(--accent-yellow)' : '2px solid transparent',
              color: explorerTab === tab ? 'var(--text-primary)' : 'var(--text-muted)',
              cursor: 'pointer', textTransform: 'capitalize', whiteSpace: 'nowrap'
            }}>
            {tab}
          </button>
        ))}
      </div>
      <div style={{ flex: 1, overflow: 'auto' }}>
        {explorerTab === 'layers' && (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 8px', borderBottom: '1px solid var(--border-subtle)' }}>
              <span style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Layers</span>
              <button onClick={onAddLayer} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 12, padding: 0 }} title="Add layer">+</button>
            </div>
            {layers.map((layer) => (
              <div key={layer.id} onClick={() => onSelectLayer(layer.id)}
                style={{
                  display: 'flex', alignItems: 'center', padding: '6px 8px', fontSize: 11, cursor: 'pointer',
                  background: selectedLayerId === layer.id ? 'rgba(0, 240, 255, 0.08)' : 'transparent',
                  borderBottom: '1px solid var(--border-subtle)', gap: 4
                }}>
                <button onClick={e => { e.stopPropagation(); onToggleLayerVisibility(layer.id); }}
                  style={{ background: 'none', border: 'none', color: layer.visible ? 'var(--text-secondary)' : 'var(--text-muted)', cursor: 'pointer', padding: 0 }}>
                  {layer.visible ? <IconEye size={12} /> : <span style={{ fontSize: 10, opacity: 0.4 }}>—</span>}
                </button>
                <button onClick={e => { e.stopPropagation(); onToggleLayerLock(layer.id); }}
                  style={{ background: 'none', border: 'none', color: layer.locked ? 'var(--accent-yellow)' : 'var(--text-muted)', cursor: 'pointer', padding: 0 }}>
                  {layer.locked ? <IconLock size={11} /> : <span style={{ fontSize: 10, opacity: 0.4 }}>—</span>}
                </button>
                <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{layer.name}</span>
                <button onClick={e => { e.stopPropagation(); onDeleteLayer(layer.id); }}
                  style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 10, padding: 0 }}>
                  <IconClose size={10} />
                </button>
              </div>
            ))}
          </div>
        )}
        {explorerTab === 'assets' && (
          <div style={{ display: 'flex', flexDirection: 'column', padding: 8, gap: 8 }}>
            <input ref={importRef} type="file" multiple accept="image/*,.svg" style={{ display: 'none' }}
              onChange={e => { if (e.target.files) onImportAssets(e.target.files); e.currentTarget.value = '' }} />
            <button onClick={() => importRef.current?.click()} className="btn btn-primary" style={{ padding: '6px', fontSize: 11 }}>
              <IconImage size={12} /> Import Assets
            </button>
            <p style={{ fontSize: 10, color: 'var(--text-muted)', lineHeight: 1.5 }}>
              Import images or SVGs. Supported: PNG, JPG, GIF, SVG, WebP.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {assets.length === 0 ? (
                <span style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', textAlign: 'center', padding: '12px 0' }}>
                  No assets imported.
                </span>
              ) : assets.map((asset) => (
                <div key={asset.id} style={{
                  display: 'flex', alignItems: 'center', gap: 8, padding: '6px',
                  background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-sm)'
                }}>
                  <div style={{
                    width: 36, height: 36, borderRadius: 'var(--radius-sm)', overflow: 'hidden',
                    background: '#0D0E12', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
                  }}>
                    {asset.type === 'svg' ? (
                      <div
                        key={asset.id + '-preview'}
                        style={{ width: 36, height: 36 }}
                        ref={el => {
                          if (el) {
                            el.innerHTML = sanitizeSvg(asset.src.replace(/<svg([^>]*)>/, '<svg$1 width="36" height="36">'))
                          }
                        }}
                      />
                    ) : (
                      <img src={asset.src} alt={asset.name} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                    )}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 10, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{asset.name}</div>
                    <div style={{ fontSize: 9, color: 'var(--text-muted)' }}>{asset.width}×{asset.height}</div>
                  </div>
                  <button onClick={() => onRemoveAsset(asset.id)}
                    style={{ background: 'none', border: 'none', color: '#FF5F75', cursor: 'pointer', padding: 0 }}>
                    <IconTrash size={11} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
        {explorerTab === 'shapes' && (
          <div style={{ display: 'flex', flexDirection: 'column', padding: '6px 0' }}>
            {shapes.length === 0 ? (
              <span style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', textAlign: 'center', padding: '12px 0' }}>
                No shapes on canvas.
              </span>
            ) : shapes.map((shape, i: number) => (
              <div key={shape.id} onClick={() => onSelectShape(shape.id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6, padding: '5px 8px', fontSize: 11, cursor: 'pointer',
                  background: selectedShapeIds.has(shape.id) ? 'rgba(0, 240, 255, 0.08)' : 'transparent',
                  borderBottom: '1px solid var(--border-subtle)'
                }}>
                <span style={{ color: 'var(--text-muted)', fontSize: 9, fontFamily: 'var(--font-mono)', width: 20 }}>#{i + 1}</span>
                <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {shape.name || shape.type}
                </span>
                <span style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                  {shape.type}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Assets Panel ─────────────────────────────────────────────────────────────

function AssetsPanel({ assets, onImportAssets, onRemoveAsset }: AssetsPanelProps) {
  const importRef = useRef<HTMLInputElement>(null)
  const [dragOver, setDragOver] = useState(false)

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    if (e.dataTransfer.files.length > 0) onImportAssets(e.dataTransfer.files)
  }

  return (
    <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div>
        <h3 style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>Import Assets</h3>
        <input ref={importRef} type="file" multiple accept="image/*,.svg" style={{ display: 'none' }}
          onChange={e => { if (e.target.files) onImportAssets(e.target.files); e.currentTarget.value = '' }} />
        <div
          onDragOver={e => { e.preventDefault(); setDragOver(true) }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => importRef.current?.click()}
          style={{
            border: `2px dashed ${dragOver ? 'var(--accent-cyan)' : 'var(--border-subtle)'}`,
            borderRadius: 'var(--radius-md)', padding: '24px 16px', textAlign: 'center',
            cursor: 'pointer', transition: 'border var(--transition-fast)',
            background: dragOver ? 'rgba(0, 240, 255, 0.04)' : 'transparent'
          }}
        >
          <div style={{ marginBottom: 8 }}><IconImage size={24} style={{ color: 'var(--text-muted)' }} /></div>
          <div style={{ fontSize: 12, color: 'var(--text-primary)', marginBottom: 4 }}>Drop files here</div>
          <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>or click to browse</div>
          <div style={{ fontSize: 9, color: 'var(--text-muted)', marginTop: 6, fontFamily: 'var(--font-mono)' }}>
            PNG · JPG · GIF · SVG · WebP
          </div>
        </div>
      </div>

      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <h3 style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1 }}>
            Library ({assets.length})
          </h3>
          {assets.length > 0 && (
            <button onClick={() => importRef.current?.click()} className="btn btn-ghost" style={{ padding: '2px 8px', fontSize: 10 }}>
              <IconPlus size={10} /> Add
            </button>
          )}
        </div>
        {assets.length === 0 ? (
          <div style={{
            textAlign: 'center', padding: '24px 12px', fontFamily: 'var(--font-mono)',
            fontSize: 11, color: 'var(--text-muted)', background: 'var(--bg-tertiary)',
            borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)'
          }}>
            No assets yet. Import images or SVGs to use in your project.
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {assets.map((asset) => (
              <div key={asset.id} style={{
                background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-sm)', overflow: 'hidden',
                border: '1px solid var(--border-subtle)'
              }}>
                <div style={{
                  height: 70, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: '#0D0E12', overflow: 'hidden'
                }}>
                  {asset.type === 'svg' ? (
                    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                      ref={el => {
                        if (el) {
                          el.innerHTML = sanitizeSvg(asset.src.replace(/<svg([^>]*)>/, '<svg$1 style="max-width:100%;max-height:100%">'))
                        }
                      }} />
                  ) : (
                    <img src={asset.src} alt={asset.name} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
                  )}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 6px' }}>
                  <span style={{ flex: 1, fontSize: 10, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {asset.name}
                  </span>
                  <button onClick={() => onRemoveAsset(asset.id)}
                    style={{ background: 'none', border: 'none', color: '#FF5F75', cursor: 'pointer', padding: 0 }}>
                    <IconTrash size={10} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div>
        <h3 style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>Usage Tips</h3>
        <div style={{ fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.7 }}>
          <div>• Drag & drop images directly onto the canvas</div>
          <div>• SVG files remain scalable at any size</div>
          <div>• Use assets as sprites or reference images</div>
          <div>• Export preserves embedded images</div>
        </div>
      </div>
    </div>
  )
}

// ─── SVG Maker Panel ──────────────────────────────────────────────────────────

function SvgMakerPanel({ elements, selectedId, tool, onToolChange, onAddElement, onUpdateAttr, onUpdateStyle, onRemoveElement, onSelectElement, onExport }: SvgMakerPanelProps) {
  const selected = elements.find((el) => el.id === selectedId)
  const svgTools: Array<{ id: SvgElement['type'] | 'select'; icon: React.ReactNode; label: string }> = [
    { id: 'select', icon: <IconMove size={13} />, label: 'Select' },
    { id: 'rect', icon: <IconSquare size={13} />, label: 'Rect' },
    { id: 'circle', icon: <IconCircle size={13} />, label: 'Circle' },
    { id: 'ellipse', icon: <IconCircle size={13} />, label: 'Ellipse' },
    { id: 'line', icon: <IconDiagonal size={13} />, label: 'Line' },
    { id: 'polygon', icon: <IconTriangle size={13} />, label: 'Poly' },
    { id: 'path', icon: <IconPen size={13} />, label: 'Path' },
    { id: 'text', icon: <IconText size={13} />, label: 'Text' },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Tool palette */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3, padding: '8px', borderBottom: '1px solid var(--border-subtle)' }}>
        {svgTools.map(t => (
          <button key={t.id} onClick={() => { onToolChange(t.id); if (t.id !== 'select') onAddElement(t.id) }}
            title={t.label}
            style={{
              width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: tool === t.id ? 'rgba(0, 240, 255, 0.15)' : 'transparent',
              border: tool === t.id ? '1px solid var(--accent-cyan)' : '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-sm)', color: tool === t.id ? 'var(--accent-cyan)' : 'var(--text-secondary)',
              cursor: 'pointer', transition: 'all var(--transition-fast)'
            }}>
            {t.icon}
          </button>
        ))}
      </div>

      {/* Canvas preview */}
      <div style={{
        height: 140, background: '#0D0E12', borderBottom: '1px solid var(--border-subtle)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden'
      }}>
        <svg viewBox="0 0 280 200" width="260" height="130" style={{ background: '#0D0E12' }}>
          <defs><pattern id="svg-grid" width="20" height="20" patternUnits="userSpaceOnUse">
            <path d="M 20 0 L 0 0 0 20" fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth="0.5" />
          </pattern></defs>
          <rect width="280" height="200" fill="url(#svg-grid)" />
          {elements.map((el) => {
            const a = el.attrs
            const style = { fill: el.fill, stroke: el.stroke, strokeWidth: el.strokeWidth }
            const props = { style, onClick: () => onSelectElement(el.id), cursor: 'pointer' }
            switch (el.type) {
              case 'rect': return <rect key={el.id} x={a.x} y={a.y} width={a.width} height={a.height} {...props} />
              case 'circle': return <circle key={el.id} cx={a.cx} cy={a.cy} r={a.r} {...props} />
              case 'ellipse': return <ellipse key={el.id} cx={a.cx} cy={a.cy} rx={a.rx} ry={a.ry} {...props} />
              case 'line': return <line key={el.id} x1={a.x1} y1={a.y1} x2={a.x2} y2={a.y2} {...props} stroke={el.stroke} />
              case 'polygon': return <polygon key={el.id} points={a.points as string} {...props} />
              case 'path': return <path key={el.id} d={a.d as string} {...props} fill="none" />
              case 'text': return <text key={el.id} x={a.x} y={a.y} fontSize={a.fontSize} textAnchor="middle" {...props}>{a.text}</text>
              default: return null
            }
          })}
        </svg>
      </div>

      {/* Element list */}
      <div style={{ borderBottom: '1px solid var(--border-subtle)', maxHeight: 100, overflow: 'auto' }}>
        <div style={{ padding: '6px 8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border-subtle)' }}>
          <span style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Elements</span>
          <span style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>{elements.length}</span>
        </div>
        {elements.length === 0 ? (
          <div style={{ padding: '10px 8px', fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', textAlign: 'center' }}>
            Click a tool to add shapes.
          </div>
        ) : elements.map((el, i: number) => (
          <div key={el.id} onClick={() => onSelectElement(el.id)}
            style={{
              display: 'flex', alignItems: 'center', gap: 6, padding: '4px 8px', fontSize: 10, cursor: 'pointer',
              background: selectedId === el.id ? 'rgba(0, 240, 255, 0.08)' : 'transparent',
              borderBottom: '1px solid var(--border-subtle)'
            }}>
            <span style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontSize: 9, width: 16 }}>#{i + 1}</span>
            <span style={{ flex: 1, textTransform: 'capitalize' }}>{el.type}</span>
            <button onClick={e => { e.stopPropagation(); onRemoveElement(el.id); }}
              style={{ background: 'none', border: 'none', color: '#FF5F75', cursor: 'pointer', padding: 0 }}>
              <IconClose size={10} />
            </button>
          </div>
        ))}
      </div>

      {/* Properties for selected element */}
      <div style={{ flex: 1, overflow: 'auto', padding: 12 }}>
        {selected ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <h3 style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1 }}>
              {selected.type} Properties
            </h3>
            {Object.entries(selected.attrs).map(([key, val]) => (
              <div key={key}>
                <label style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-muted)', display: 'block', marginBottom: 2 }}>{key}</label>
                {key === 'text' ? (
                  <input type="text" value={val as string} onChange={e => onUpdateAttr(selected.id, key, e.target.value)}
                    className="input" style={{ width: '100%', padding: '4px 8px', fontSize: 11 }} />
                ) : (
                  <input type="number" value={val as number} onChange={e => onUpdateAttr(selected.id, key, Number(e.target.value))}
                    className="input" style={{ width: '100%', padding: '4px 8px', fontSize: 11 }} />
                )}
              </div>
            ))}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <div>
                <label style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-muted)', display: 'block', marginBottom: 2 }}>Fill</label>
                <input type="color" value={selected.fill} onChange={e => onUpdateStyle(selected.id, { fill: e.target.value })}
                  style={{ width: '100%', height: 28, border: 'none', borderRadius: 'var(--radius-sm)', cursor: 'pointer', background: 'none' }} />
              </div>
              <div>
                <label style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-muted)', display: 'block', marginBottom: 2 }}>Stroke</label>
                <input type="color" value={selected.stroke} onChange={e => onUpdateStyle(selected.id, { stroke: e.target.value })}
                  style={{ width: '100%', height: 28, border: 'none', borderRadius: 'var(--radius-sm)', cursor: 'pointer', background: 'none' }} />
              </div>
            </div>
            <div>
              <label style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-muted)', display: 'block', marginBottom: 2 }}>Stroke Width</label>
              <input type="number" value={selected.strokeWidth} onChange={e => onUpdateStyle(selected.id, { strokeWidth: Number(e.target.value) })}
                min={0} max={20} step={0.5} className="input" style={{ width: '100%', padding: '4px 8px', fontSize: 11 }} />
            </div>
          </div>
        ) : (
          <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', textAlign: 'center', padding: '20px 0' }}>
            Select an element to edit its properties.
          </div>
        )}
      </div>

      {/* Actions */}
      <div style={{ padding: '8px 12px', borderTop: '1px solid var(--border-subtle)', display: 'flex', gap: 6 }}>
        <button onClick={onExport} className="btn btn-primary" style={{ flex: 1, padding: '6px', fontSize: 11 }} disabled={elements.length === 0}>
          <IconDownload size={11} /> Export SVG
        </button>
        <button onClick={() => { if (selectedId) onRemoveElement(selectedId) }} className="btn btn-ghost" style={{ padding: '6px 10px', fontSize: 11 }} disabled={!selectedId}>
          <IconTrash size={11} />
        </button>
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
