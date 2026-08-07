import { useState, useEffect, useRef, useCallback } from 'react'
import { DrawingEngine, ToolState, defaultToolState, ToolType } from '../engine/tools'
import { VectorShape, renderShape, FillStyle, StrokeStyle } from '../engine/shapes'
import { TimelineState, Layer, createLayer, addKeyframe, getShapesAtFrame, getOnionSkinFrames } from '../engine/timeline'
import { AudioEngine } from '../audio/synth'
import { downloadExport, exportFrameAsPNG, exportFrameAsSVG } from '../engine/exporter'
import { Vector2, generateId } from '../engine/math'
import { applyShaderOverlay, ShaderType } from '../engine/shaders'

const STAGE_WIDTH = 800
const STAGE_HEIGHT = 450
const GRID_SIZE = 32

export default function StudioPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null)
  const drawEngineRef = useRef<DrawingEngine | null>(null)
  const audioEngineRef = useRef<AudioEngine | null>(null)
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
  const [showGrid, setShowGrid] = useState(true)
  const [zoom, setZoom] = useState(1)
  const [panOffset, setPanOffset] = useState<Vector2>({ x: 0, y: 0 })
  const [shapes, setShapes] = useState<VectorShape[]>([])
  const [selectedShapeIds, setSelectedShapeIds] = useState<Set<string>>(new Set())
  const [code, setCode] = useState('')
  const [codeOutput, setCodeOutput] = useState('[console] Ready')
  const [activePanel, setActivePanel] = useState<'properties' | 'code' | 'audio'>('properties')
  const [shaders, setShaders] = useState<Set<ShaderType>>(new Set())
  const [cursorPos, setCursorPos] = useState<Vector2>({ x: 0, y: 0 })
  const [fps, setFps] = useState(0)

  const isDrawingRef = useRef(false)
  const lastMousePosRef = useRef<Vector2>({ x: 0, y: 0 })
  const playStartTimeRef = useRef(0)
  const frameCountRef = useRef(0)
  const lastFpsTimeRef = useRef(performance.now())

  useEffect(() => {
    drawEngineRef.current = new DrawingEngine(toolState)
    audioEngineRef.current = new AudioEngine()
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current)
      audioEngineRef.current?.dispose()
    }
  }, [])

  const getCanvasPoint = useCallback((e: React.MouseEvent | MouseEvent): Vector2 => {
    const canvas = canvasRef.current
    if (!canvas) return { x: 0, y: 0 }
    const rect = canvas.getBoundingClientRect()
    return {
      x: (e.clientX - rect.left) / zoom - panOffset.x,
      y: (e.clientY - rect.top) / zoom - panOffset.y
    }
  }, [zoom, panOffset])

  const renderStage = useCallback(() => {
    const canvas = canvasRef.current
    const overlay = overlayCanvasRef.current
    if (!canvas || !overlay) return
    const ctx = canvas.getContext('2d')
    const overlayCtx = overlay.getContext('2d')
    if (!ctx || !overlayCtx) return

    ctx.fillStyle = '#0D0E12'
    ctx.fillRect(0, 0, canvas.width, canvas.height)

    ctx.save()
    ctx.translate(panOffset.x * zoom, panOffset.y * zoom)
    ctx.scale(zoom, zoom)

    if (showGrid) {
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)'
      ctx.lineWidth = 1 / zoom
      for (let x = 0; x <= STAGE_WIDTH; x += GRID_SIZE) {
        ctx.beginPath()
        ctx.moveTo(x, 0)
        ctx.lineTo(x, STAGE_HEIGHT)
        ctx.stroke()
      }
      for (let y = 0; y <= STAGE_HEIGHT; y += GRID_SIZE) {
        ctx.beginPath()
        ctx.moveTo(0, y)
        ctx.lineTo(STAGE_WIDTH, y)
        ctx.stroke()
      }
    }

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.06)'
    ctx.setLineDash([4 / zoom, 4 / zoom])
    ctx.strokeRect(0, 0, STAGE_WIDTH, STAGE_HEIGHT)
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

    overlayCtx.clearRect(0, 0, overlay.width, overlay.height)

    for (const id of selectedShapeIds) {
      const shape = shapes.find(s => s.id === id)
      if (shape) {
        drawSelectionOverlay(overlayCtx, shape)
      }
    }

    ctx.fillStyle = 'rgba(255, 255, 255, 0.2)'
    ctx.font = '10px "JetBrains Mono", monospace'
    ctx.fillText(`${STAGE_WIDTH} × ${STAGE_HEIGHT}`, 12, STAGE_HEIGHT - 12)
    ctx.fillText(`Frame ${timeline.currentFrame}/${timeline.totalFrames}`, STAGE_WIDTH - 100, STAGE_HEIGHT - 12)

    frameCountRef.current++
    const now = performance.now()
    if (now - lastFpsTimeRef.current >= 1000) {
      setFps(frameCountRef.current)
      frameCountRef.current = 0
      lastFpsTimeRef.current = now
    }
  }, [shapes, selectedShapeIds, timeline, showGrid, zoom, panOffset, onionSkin, shaders])

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
    }, 1000 / timeline.fps)
    return () => clearInterval(interval)
  }, [isPlaying, timeline.fps, timeline.loop])

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
    const updatedLayer = addKeyframe(layer, timeline.currentFrame, currentShape)
    setTimeline(prev => ({
      ...prev,
      layers: prev.layers.map(l => l.id === updatedLayer.id ? updatedLayer : l)
    }))
    audioEngineRef.current?.playClick(0.08)
  }

  const deleteKeyframe = () => {
    const layer = timeline.layers.find(l => l.id === selectedLayerId)
    if (!layer || layer.locked) return
    const { removeKeyframe: removeKf } = require('../engine/timeline')
    const updatedLayer = removeKf(layer, timeline.currentFrame)
    setTimeline(prev => ({
      ...prev,
      layers: prev.layers.map(l => l.id === updatedLayer.id ? updatedLayer : l)
    }))
  }

  const runCode = () => {
    setCodeOutput('[console] Running...')
    try {
      const userCode = code
      const lines = userCode.split('\n').filter(l => l.trim() && !l.trim().startsWith('//'))

      for (const line of lines) {
        const trimmed = line.trim()
        if (trimmed.includes('OpenFlash.on(')) {
          const match = trimmed.match(/OpenFlash\.on\('(\w+)'/)
          if (match) setCodeOutput(prev => prev + `\n[Runtime] Registered event: ${match[1]}`)
        } else if (trimmed.includes('OpenFlash.drawParticle')) {
          setCodeOutput(prev => prev + '\n[Runtime] Particle effect triggered')
        } else if (trimmed.includes('OpenFlash.playSound')) {
          setCodeOutput(prev => prev + '\n[Runtime] Sound played')
        }
      }
      setCodeOutput(prev => prev + '\n[Runtime] Script executed successfully')
    } catch (err: any) {
      setCodeOutput(`[Error] ${err.message}`)
    }
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

  const toggleShader = (type: ShaderType) => {
    setShaders(prev => {
      const next = new Set(prev)
      if (next.has(type)) next.delete(type)
      else next.add(type)
      return next
    })
  }

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLInputElement) return

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
          drawEngineRef.current?.undo()
        }
        break
      case 'y':
        if (e.ctrlKey || e.metaKey) {
          e.preventDefault()
          drawEngineRef.current?.redo()
        }
        break
    }
  }, [code, shapes, timeline, selectedShapeIds])

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  const tools: Array<{ id: ToolType; icon: string; label: string; shortcut: string }> = [
    { id: 'select', icon: '↖', label: 'Selection Tool', shortcut: 'V' },
    { id: 'node', icon: '◉', label: 'Node Tool', shortcut: 'A' },
    { id: 'pen', icon: '✎', label: 'Pen Tool', shortcut: 'P' },
    { id: 'brush', icon: '◌', label: 'Brush Tool', shortcut: 'B' },
    { id: 'line', icon: '╱', label: 'Line Tool', shortcut: 'L' },
    { id: 'rectangle', icon: '□', label: 'Rectangle', shortcut: 'R' },
    { id: 'ellipse', icon: '○', label: 'Ellipse', shortcut: 'O' },
    { id: 'text', icon: 'T', label: 'Text Tool', shortcut: 'T' },
    { id: 'bucket', icon: '◧', label: 'Paint Bucket', shortcut: 'G' },
    { id: 'eyedropper', icon: '💧', label: 'Eyedropper', shortcut: 'I' },
  ]

  const selectedShape = shapes.find(s => selectedShapeIds.has(s.id))

  return (
    <div style={{ height: 'calc(100vh - 60px)', display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'var(--bg-primary)' }}>
      <Toolbar
        tools={tools}
        activeTool={toolState.activeTool}
        onToolChange={handleToolChange}
        fillColor={toolState.fillColor}
        strokeColor={toolState.strokeColor}
        onFillColorChange={(c) => handleColorChange('fill', c)}
        onStrokeColorChange={(c) => handleColorChange('stroke', c)}
        strokeWidth={toolState.strokeWidth}
        onStrokeWidthChange={(w) => setToolState(p => ({ ...p, strokeWidth: w }))}
        onUndo={() => drawEngineRef.current?.undo()}
        onRedo={() => drawEngineRef.current?.redo()}
      />
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <CanvasArea
            canvasRef={canvasRef}
            overlayCanvasRef={overlayCanvasRef}
            zoom={zoom}
            onMouseDown={handleCanvasMouseDown}
            onMouseMove={handleCanvasMouseMove}
            onMouseUp={handleCanvasMouseUp}
            onMouseLeave={handleCanvasMouseUp}
          />
          <TimelineArea
            timeline={timeline}
            selectedLayerId={selectedLayerId}
            isPlaying={isPlaying}
            onionSkin={onionSkin}
            onFrameChange={(f) => setTimeline(p => ({ ...p, currentFrame: f }))}
            onTotalFramesChange={(f) => setTimeline(p => ({ ...p, totalFrames: f }))}
            onTogglePlay={() => setIsPlaying(!isPlaying)}
            onToggleOnionSkin={() => setOnionSkin(!onionSkin)}
            onAddKeyframe={addKeyframe}
            onDeleteKeyframe={deleteKeyframe}
            onAddLayer={addNewLayer}
            onDeleteLayer={deleteLayer}
            onSelectLayer={setSelectedLayerId}
            onToggleLayerVisibility={(id) => setTimeline(p => ({ ...p, layers: p.layers.map(l => l.id === id ? { ...l, visible: !l.visible } : l) }))}
            onToggleLayerLock={(id) => setTimeline(p => ({ ...p, layers: p.layers.map(l => l.id === id ? { ...l, locked: !l.locked } : l) }))}
          />
        </div>
        <SidePanel
          activePanel={activePanel}
          onPanelChange={setActivePanel}
          selectedShape={selectedShape}
          onUpdateShape={(t) => {
            setShapes(prev => prev.map(s => selectedShapeIds.has(s.id) ? { ...s, transform: { ...s.transform, ...t } } : s))
          }}
          code={code}
          codeOutput={codeOutput}
          onCodeChange={setCode}
          onRunCode={runCode}
          audioEngine={audioEngineRef.current}
          onExportHTML={handleExportHTML}
          onExportPNG={handleExportPNG}
          onExportSVG={handleExportSVG}
          shaders={shaders}
          onToggleShader={toggleShader}
          fps={fps}
          cursorPos={cursorPos}
          shapeCount={shapes.length}
        />
      </div>
    </div>
  )
}

function Toolbar({ tools, activeTool, onToolChange, fillColor, strokeColor, onFillColorChange, onStrokeColorChange, strokeWidth, onStrokeWidthChange, onUndo, onRedo }: any) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8, padding: '8px 16px',
      background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-subtle)', flexShrink: 0
    }}>
      <div style={{ display: 'flex', gap: 2 }}>
        {tools.map((tool: any) => (
          <button
            key={tool.id}
            onClick={() => onToolChange(tool.id)}
            title={`${tool.label} (${tool.shortcut})`}
            style={{
              width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: activeTool === tool.id ? 'rgba(0, 240, 255, 0.15)' : 'transparent',
              border: activeTool === tool.id ? '1px solid var(--accent-cyan)' : '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-sm)', color: activeTool === tool.id ? 'var(--accent-cyan)' : 'var(--text-secondary)',
              cursor: 'pointer', fontSize: 14, transition: 'all var(--transition-fast)'
            }}
          >
            {tool.icon}
          </button>
        ))}
      </div>
      <div style={{ width: 1, height: 24, background: 'var(--border-subtle)' }} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <label style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>Fill</label>
        <input type="color" value={fillColor} onChange={e => onFillColorChange(e.target.value)}
          style={{ width: 28, height: 28, border: 'none', borderRadius: 'var(--radius-sm)', cursor: 'pointer', background: 'none' }} />
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <label style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>Stroke</label>
        <input type="color" value={strokeColor} onChange={e => onStrokeColorChange(e.target.value)}
          style={{ width: 28, height: 28, border: 'none', borderRadius: 'var(--radius-sm)', cursor: 'pointer', background: 'none' }} />
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <label style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>W:</label>
        <input type="number" value={strokeWidth} onChange={e => onStrokeWidthChange(Number(e.target.value))}
          min={0.5} max={50} step={0.5}
          className="input" style={{ width: 50, padding: '2px 6px', fontSize: 10 }} />
      </div>
      <div style={{ width: 1, height: 24, background: 'var(--border-subtle)' }} />
      <button className="btn btn-ghost" onClick={onUndo} title="Undo (Ctrl+Z)" style={{ padding: '4px 8px', fontSize: 11 }}>↩</button>
      <button className="btn btn-ghost" onClick={onRedo} title="Redo (Ctrl+Y)" style={{ padding: '4px 8px', fontSize: 11 }}>↪</button>
    </div>
  )
}

function CanvasArea({ canvasRef, overlayCanvasRef, zoom, onMouseDown, onMouseMove, onMouseUp, onMouseLeave }: any) {
  return (
    <div style={{
      flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 20, overflow: 'hidden', background: 'var(--bg-primary)', position: 'relative'
    }}>
      <div style={{ position: 'relative', boxShadow: '0 0 60px rgba(0, 0, 0, 0.5)' }}>
        <canvas ref={canvasRef} width={800} height={450}
          style={{ display: 'block', background: '#0D0E12', borderRadius: 'var(--radius-sm)', maxWidth: '100%', height: 'auto' }}
        />
        <canvas
          ref={overlayCanvasRef} width={800} height={450}
          style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'auto', cursor: 'crosshair' }}
          onMouseDown={onMouseDown} onMouseMove={onMouseMove} onMouseUp={onMouseUp} onMouseLeave={onMouseLeave}
        />
      </div>
    </div>
  )
}

function TimelineArea({ timeline, selectedLayerId, isPlaying, onionSkin, onFrameChange, onTotalFramesChange, onTogglePlay, onToggleOnionSkin, onAddKeyframe, onDeleteKeyframe, onAddLayer, onDeleteLayer, onSelectLayer, onToggleLayerVisibility, onToggleLayerLock }: any) {
  return (
    <div style={{
      height: 180, background: 'var(--bg-secondary)', borderTop: '1px solid var(--border-subtle)',
      display: 'flex', flexDirection: 'column', flexShrink: 0
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', borderBottom: '1px solid var(--border-subtle)'
      }}>
        <button className={`btn ${isPlaying ? 'btn-primary' : ''}`} onClick={onTogglePlay} style={{ padding: '4px 10px', fontSize: 11 }}>
          {isPlaying ? '⏸' : '▶'}
        </button>
        <button className="btn btn-ghost" onClick={() => onFrameChange(Math.max(1, timeline.currentFrame - 1))} style={{ padding: '4px 8px', fontSize: 11 }}>⏮</button>
        <button className="btn btn-ghost" onClick={() => onFrameChange(Math.min(timeline.totalFrames, timeline.currentFrame + 1))} style={{ padding: '4px 8px', fontSize: 11 }}>⏭</button>
        <div style={{
          fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--accent-yellow)',
          padding: '2px 8px', background: 'rgba(255, 230, 0, 0.08)', borderRadius: 'var(--radius-sm)'
        }}>
          Frame {timeline.currentFrame} / {timeline.totalFrames}
        </div>
        <div style={{ flex: 1 }} />
        <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--text-secondary)', cursor: 'pointer' }}>
          <input type="checkbox" checked={onionSkin} onChange={onToggleOnionSkin} style={{ accentColor: 'var(--accent-cyan)' }} />
          Onion Skin
        </label>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)' }}>Total:</span>
        <input type="number" value={timeline.totalFrames} onChange={e => onTotalFramesChange(Number(e.target.value))}
          className="input" style={{ width: 60, padding: '2px 6px', fontSize: 10 }} />
        <button onClick={onAddKeyframe} className="btn btn-ghost" style={{ padding: '4px 8px', fontSize: 10 }} title="Insert Keyframe (F6)">◇ KF</button>
        <button onClick={onDeleteKeyframe} className="btn btn-ghost" style={{ padding: '4px 8px', fontSize: 10 }} title="Delete Keyframe">✕ KF</button>
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
                style={{ background: 'none', border: 'none', color: layer.visible ? 'var(--text-secondary)' : 'var(--text-muted)', cursor: 'pointer', fontSize: 10, padding: '0 4px' }}>
                {layer.visible ? '👁' : '—'}
              </button>
              <button onClick={e => { e.stopPropagation(); onToggleLayerLock(layer.id); }}
                style={{ background: 'none', border: 'none', color: layer.locked ? 'var(--accent-yellow)' : 'var(--text-muted)', cursor: 'pointer', fontSize: 9, padding: '0 4px' }}>
                {layer.locked ? '🔒' : '—'}
              </button>
              <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginLeft: 4 }}>{layer.name}</span>
              <button onClick={e => { e.stopPropagation(); onDeleteLayer(layer.id); }}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 10, padding: '0 2px' }}>×</button>
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

function SidePanel({ activePanel, onPanelChange, selectedShape, onUpdateShape, code, codeOutput, onCodeChange, onRunCode, audioEngine, onExportHTML, onExportPNG, onExportSVG, shaders, onToggleShader, fps, cursorPos, shapeCount }: any) {
  return (
    <div style={{
      width: 320, display: 'flex', flexDirection: 'column', borderLeft: '1px solid var(--border-subtle)',
      background: 'var(--bg-secondary)', overflow: 'hidden', flexShrink: 0
    }}>
      <div style={{ display: 'flex', borderBottom: '1px solid var(--border-subtle)' }}>
        {(['properties', 'code', 'audio'] as const).map(panel => (
          <button key={panel} onClick={() => onPanelChange(panel)}
            style={{
              flex: 1, padding: '8px 12px', fontSize: 11, fontWeight: 500, background: 'none', border: 'none',
              borderBottom: activePanel === panel ? '2px solid var(--accent-yellow)' : '2px solid transparent',
              color: activePanel === panel ? 'var(--text-primary)' : 'var(--text-muted)',
              cursor: 'pointer', transition: 'all var(--transition-fast)', textTransform: 'capitalize'
            }}>
            {panel}
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
          />
        )}
        {activePanel === 'code' && (
          <CodeEditor code={code} codeOutput={codeOutput} onCodeChange={onCodeChange} onRunCode={onRunCode} />
        )}
        {activePanel === 'audio' && (
          <AudioSynth audioEngine={audioEngine} />
        )}
      </div>
    </div>
  )
}

function PropertiesPanel({ selectedShape, onUpdateShape, onExportHTML, onExportPNG, onExportSVG, shaders, onToggleShader, fps, cursorPos, shapeCount }: any) {
  const t = selectedShape?.transform || { x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0, alpha: 1 }

  return (
    <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div>
        <h3 style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 }}>Transform</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          {(['x', 'y', 'scaleX', 'scaleY', 'rotation', 'alpha'] as const).map(prop => (
            <div key={prop}>
              <label style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-muted)', display: 'block', marginBottom: 2 }}>{prop}</label>
              <input type="number" value={Math.round(t[prop] * 100) / 100}
                onChange={e => onUpdateShape({ [prop]: parseFloat(e.target.value) || 0 })}
                className="input" style={{ width: '100%', padding: '4px 8px', fontSize: 11 }}
                disabled={!selectedShape} step={prop === 'rotation' ? 1 : prop.includes('scale') ? 0.1 : 1} />
            </div>
          ))}
        </div>
      </div>
      <div>
        <h3 style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted'), textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 }}>Filters</h3>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
          {(['Blur', 'Glow', 'Drop Shadow', 'Bevel'] as const).map(filter => (
            <button key={filter} className="btn btn-ghost" style={{ padding: '3px 8px', fontSize: 10 }}>{filter}</button>
          ))}
        </div>
      </div>
      <div>
        <h3 style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted'), textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 }}>Shaders</h3>
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
        <h3 style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted'), textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 }}>Export</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <button className="btn btn-primary" onClick={onExportHTML}>📦 Export HTML (Offline)</button>
          <div style={{ display: 'flex', gap: 6 }}>
            <button className="btn" onClick={onExportPNG} style={{ flex: 1 }}>PNG Frame</button>
            <button className="btn" onClick={onExportSVG} style={{ flex: 1 }}>SVG Frame</button>
          </div>
        </div>
      </div>
      <div>
        <h3 style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted'), textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 }}>Stats</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 11 }}>
          <div><span style={{ color: 'var(--text-muted)' }}>FPS:</span> <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--accent-green)' }}>{fps}</span></div>
          <div><span style={{ color: 'var(--text-muted)' }}>Shapes:</span> <span style={{ fontFamily: 'var(--font-mono)' }}>{shapeCount}</span></div>
          <div><span style={{ color: 'var(--text-muted)' }}>Cursor:</span> <span style={{ fontFamily: 'var(--font-mono)' }}>{cursorPos.x}, {cursorPos.y}</span></div>
          <div><span style={{ color: 'var(--text-muted)' }}>Selection:</span> <span style={{ fontFamily: 'var(--font-mono)' }}>{selectedShape ? '1' : '0'}</span></div>
        </div>
      </div>
    </div>
  )
}

function CodeEditor({ code, codeOutput, onCodeChange, onRunCode }: any) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ padding: '8px 12px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)' }}>TypeScript</span>
        <button className="btn btn-primary" onClick={onRunCode} style={{ padding: '4px 10px', fontSize: 10 }}>▶ Run</button>
      </div>
      <textarea value={code} onChange={e => onCodeChange(e.target.value)} spellCheck={false}
        placeholder={`// OpenFlash TypeScript API Examples:\n\nOpenFlash.on('tick', (delta) => {\n  const player = OpenFlash.getSprite('player')\n  player.x += 100 * delta\n})\n\nOpenFlash.on('pointerDown', (e) => {\n  OpenFlash.drawParticle(e.x, e.y, {\n    color: '#FFE600',\n    count: 20\n  })\n  OpenFlash.playSound('hit')\n})\n\nOpenFlash.on('keyDown', (e) => {\n  if (e.key === 'ArrowRight') {\n    const p = OpenFlash.getSprite('player')\n    p.x += 5\n  }\n})`}
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
        <h3 style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted'), textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 }}>Oscillator</h3>
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
        <h3 style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted'), textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 }}>Piano Keys</h3>
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
        <h3 style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted'), textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 }}>Controls</h3>
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
        <h3 style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted'), textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 }}>SFX Presets</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}>
          {[
            { name: 'Click', type: 'click' }, { name: 'Hit', type: 'hit' },
            { name: 'Jump', type: 'jump' }, { name: 'Shoot', type: 'shoot' },
            { name: 'Explode', type: 'explode' }
          ].map(sfx => (
            <button key={sfx.type} onClick={() => audioEngine?.playSound(sfx.type as any)}
              className="btn btn-ghost" style={{ padding: '6px', fontSize: 10 }}>
              {sfx.name}
            </button>
          ))}
        </div>
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

import { OscillatorType } from '../audio/synth'
