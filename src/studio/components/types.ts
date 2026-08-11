import type { ToolState } from '../engine/tools'
import type { TimelineState, Layer } from '../engine/timeline'
import type { Transform, Vector2 } from '../engine/math'
import type { VectorShape } from '../engine/shapes'
import type { ShaderType } from '../engine/shaders'
import type { AudioEngine } from '../audio/synth'
import type { ToolType } from '../engine/tools'
import type { ProjectMeta } from '../../lib/projects'

export interface Asset {
  id: string
  name: string
  src: string
  type: 'image' | 'svg'
  width?: number
  height?: number
  createdAt?: number
}

export interface SvgElement {
  id: string
  type: 'rect' | 'circle' | 'ellipse' | 'line' | 'polygon' | 'path' | 'text'
  attrs: Record<string, string | number>
  fill: string
  stroke: string
  strokeWidth: number
}

export interface ToolbarProps {
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

export interface CanvasAreaProps {
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
  isEmpty?: boolean
}

export interface TimelineAreaProps {
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

export interface PropertiesPanelProps {
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

export interface SidePanelProps extends PropertiesPanelProps {
  activePanel: 'properties' | 'assets' | 'svg-maker' | 'code' | 'audio'
  onPanelChange: (panel: 'properties' | 'assets' | 'svg-maker' | 'code' | 'audio') => void
  code: string
  codeOutput: string
  onCodeChange: (code: string) => void
  onRunCode: () => void
  isRunning: boolean
  audioEngine: AudioEngine | null
  audioClips: Array<{ id: string; name: string; duration: number; waveform: number[] }>
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
}

export interface ProjectBarProps {
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

export interface ExplorerPanelProps {
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

export interface CodeEditorProps {
  code: string
  codeOutput: string
  onCodeChange: (code: string) => void
  onRunCode: () => void
  isRunning: boolean
}

export interface AudioSynthProps {
  audioEngine: AudioEngine | null
}

export interface AssetsPanelProps {
  assets: Asset[]
  onImportAssets: (files: FileList | File[]) => void
  onRemoveAsset: (id: string) => void
}

export interface FullscreenPreviewProps {
  shapes: VectorShape[]
  code: string
  shaders: Set<ShaderType>
  fps: number
  onClose: () => void
}

export interface SvgMakerPanelProps {
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
