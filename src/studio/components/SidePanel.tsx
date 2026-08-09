import { memo } from 'react'
import type { SidePanelProps } from './types'
import { PropertiesPanel } from './PropertiesPanel'
import { AssetsPanel } from './AssetsPanel'
import { SvgMakerPanel } from './SvgMakerPanel'
import { CodeEditor } from './CodeEditor'
import { AudioSynth } from './AudioSynth'


export const SidePanel = memo(function SidePanel({ activePanel, onPanelChange, selectedShape, onUpdateShape, code, codeOutput, onCodeChange, onRunCode, isRunning, audioEngine, audioClips, onExportHTML, onExportPNG, onExportSVG, shaders, onToggleShader, fps, cursorPos, shapeCount, assets, onImportAssets, onRemoveAsset, svgElements, svgSelectedId, svgTool, onSvgToolChange, onAddSvgElement, onUpdateSvgAttr, onUpdateSvgStyle, onRemoveSvgElement, onSelectSvgElement, onExportSvg, toolState, onToolStateChange, recentColors, onAddRecentColor }: SidePanelProps) {
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
})
