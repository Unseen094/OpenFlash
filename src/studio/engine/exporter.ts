import { TimelineState } from './timeline'
import { VectorShape } from './shapes'

export interface ExportConfig {
  title: string
  width: number
  height: number
  fps: number
  loop: boolean
  autoStart: boolean
  backgroundColor: string
  scripts: string
  shapes: VectorShape[]
  timeline: TimelineState | null
  includeRuntime: boolean
}

export const defaultExportConfig: ExportConfig = {
  title: 'OpenFlash Project',
  width: 800,
  height: 450,
  fps: 60,
  loop: true,
  autoStart: true,
  backgroundColor: '#0A0B0E',
  scripts: '',
  shapes: [],
  timeline: null,
  includeRuntime: true
}

const RUNTIME_CODE = `(function(){
'use strict';
var OF={version:'1.0.0',sprites:{},scenes:{},particles:[],running:!1,lastTime:0,frame:0,fps:0,canvas:null,ctx:null,handlers:{},init:function(c){this.canvas=c;this.ctx=c.getContext('2d');this.bindInput();},bindInput:function(){var t=this;this.canvas.addEventListener('pointerdown',function(e){var r=t.canvas.getBoundingClientRect();t.emit('pointerDown',{x:e.clientX-r.left,y:e.clientY-r.top})});this.canvas.addEventListener('pointermove',function(e){var r=t.canvas.getBoundingClientRect();t.emit('pointerMove',{x:e.clientX-r.left,y:e.clientY-r.top})});window.addEventListener('keydown',function(e){t.emit('keyDown',{key:e.key})});},on:function(e,f){if(!this.handlers[e])this.handlers[e]=[];this.handlers[e].push(f);return function(){var i=t.handlers[e].indexOf(f);if(i>=0)t.handlers[e].splice(i,1)};},emit:function(e,d){var h=this.handlers[e];if(h)for(var i=0;i<h.length;i++){try{h[i](d||{});}catch(ex){console.error('OF Error:',ex);}}},create:function(n,o){var s={id:Date.now()+Math.random(),name:n,x:o.x||0,y:o.y||0,w:o.w||50,h:o.h||50,r:0,a:1,vx:0,vy:0,sx:1,sy:1,vis:!0};this.sprites[n]=s;return s;},remove:function(n){delete this.sprites[n];},get:function(n){return this.sprites[n];},drawRect:function(x,y,w,h,c){this.ctx.fillStyle=c||'#fff';this.ctx.fillRect(x,y,w,h);},drawCircle:function(x,y,r,c){this.ctx.fillStyle=c||'#fff';this.ctx.beginPath();this.ctx.arc(x,y,r,0,6.28);this.ctx.fill();},drawText:function(t,x,y,c,s){this.ctx.fillStyle=c||'#fff';this.ctx.font=(s||16)+"px sans-serif";this.ctx.fillText(t,x,y);},particle:function(x,y,o){o=o||{};for(var i=0;i<(o.count||10);i++){var a=Math.random()*6.28,v=Math.random()*(o.speed||5);this.particles.push({x:x,y:y,vx:Math.cos(a)*v,vy:Math.sin(a)*v,life:1,max:1,color:o.color||'#FFE600',size:o.size||4});}},sound:function(t){try{var c=new AudioContext();var o=c.createOscillator();var g=c.createGain();o.connect(g);g.connect(c.destination);if(t==='hit'){o.type='square';o.frequency.setValueAtTime(200,c.currentTime);o.frequency.exponentialRampToValueAtTime(50,c.currentTime+0.1);}else if(t==='jump'){o.type='sine';o.frequency.setValueAtTime(300,c.currentTime);o.frequency.exponentialRampToValueAtTime(600,c.currentTime+0.15);}else{o.type='square';o.frequency.setValueAtTime(800,c.currentTime);}g.gain.setValueAtTime(0.15,c.currentTime);g.gain.exponentialRampToValueAtTime(0.01,c.currentTime+0.15);o.start(c.currentTime);o.stop(c.currentTime+0.2);}catch(e){}},start:function(){if(this.running)return;this.running=!0;this.lastTime=performance.now();this.loop();},stop:function(){this.running=!1;},loop:function(){if(!this.running)return;var now=performance.now();var dt=Math.min((now-this.lastTime)/1000,0.1);this.lastTime=now;this.frame++;this.update(dt);this.render();requestAnimationFrame(this.loop.bind(this));},update:function(dt){for(var i=0;i<this.particles.length;i++){var p=this.particles[i];p.x+=p.vx;p.y+=p.vy;p.vy+=100*dt;p.life-=dt*2;}this.particles=this.particles.filter(function(p){return p.life>0;});this.emit('tick',{delta:dt});},render:function(){var w=this.canvas.width;var h=this.canvas.height;this.ctx.fillStyle='#0A0B0E';this.ctx.fillRect(0,0,w,h);__SHAPES__;for(var i=0;i<this.particles.length;i++){var p=this.particles[i];this.ctx.globalAlpha=p.life/p.max;this.ctx.fillStyle=p.color;this.ctx.fillRect(p.x-p.size/2,p.y-p.size/2,p.size,p.size);}this.ctx.globalAlpha=1;}};
window.OpenFlash=OF;window.OF=OF;__USER_SCRIPTS__;})();`

export const generateExportHTML = (config: ExportConfig): string => {
  const shapesCode = generateShapesCode(config.shapes)
  const userScripts = config.scripts || '// OpenFlash TypeScript API\n'
  const runtime = RUNTIME_CODE
    .replace('__SHAPES__', shapesCode)
    .replace('__USER_SCRIPTS__', userScripts)

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escapeHtml(config.title)}</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{background:#0A0B0E;display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100vh;font-family:'Space Grotesk',system-ui,sans-serif}
#stage{position:relative;max-width:100%;box-shadow:0 0 60px rgba(0,0,0,0.5)}
canvas{display:block;max-width:100%;height:auto;border-radius:4px}
#controls{display:flex;gap:8px;margin-top:16px}
.btn{padding:8px 16px;background:#1A1B22;border:1px solid rgba(255,255,255,0.08);border-radius:6px;color:#fff;cursor:pointer;font-size:12px;font-family:inherit;transition:all .12s}
.btn:hover{background:rgba(26,27,34,0.85);border-color:rgba(255,255,255,0.16);transform:translateY(-1px)}
.btn-primary{background:#FFE600;color:#0A0B0E;border-color:#FFE600}
#info{position:fixed;bottom:16px;left:50%;transform:translateX(-50%);font-family:'JetBrains Mono',monospace;font-size:10px;color:rgba(255,255,255,0.4)}
</style>
</head>
<body>
<div id="stage">
<canvas id="of-canvas" width="${config.width}" height="${config.height}"></canvas>
</div>
<div id="controls">
<button class="btn btn-primary" id="btn-play">
  <svg viewBox="0 0 24 24" fill="currentColor" width="14" height="14" style="vertical-align:middle;margin-right:4px"><path d="M8 5.14v13.72a1 1 0 001.5.86l11.04-6.86a1 1 0 000-1.72L9.5 4.28A1 1 0 008 5.14z"/></svg>
  Play
</button>
<button class="btn" id="btn-pause">
  <svg viewBox="0 0 24 24" fill="currentColor" width="14" height="14" style="vertical-align:middle;margin-right:4px"><rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/></svg>
  Pause
</button>
<button class="btn" id="btn-restart">
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="14" height="14" style="vertical-align:middle;margin-right:4px"><path d="M3 7v6h6"/><path d="M3 13a9 9 0 0115.36-6.36"/></svg>
  Restart
</button>
</div>
<div id="info">Powered by OPENFLASH Runtime v1.0</div>
<script>
${runtime}
(function(){
var canvas=document.getElementById('of-canvas');
OF.init(canvas);
${config.autoStart ? 'OF.start();' : ''}
document.getElementById('btn-play').addEventListener('click',function(){OF.start()});
document.getElementById('btn-pause').addEventListener('click',function(){OF.stop()});
document.getElementById('btn-restart').addEventListener('click',function(){OF.stop();OF.start()});
})();
</script>
</body>
</html>`
}

const generateShapesCode = (shapes: VectorShape[]): string => {
  if (shapes.length === 0) return ''

  const renderCalls: string[] = []
  for (const shape of shapes) {
    const fill = shape.fill ? `'rgba(${shape.fill.color.r},${shape.fill.color.g},${shape.fill.color.b},${shape.fill.color.a})'` : "'#FFE600'"
    const stroke = shape.stroke ? `'rgba(${shape.stroke.color.r},${shape.stroke.color.g},${shape.stroke.color.b},${shape.stroke.color.a})` : "'none'"
    const x = shape.transform.x
    const y = shape.transform.y
    const w = shape.points && shape.points.length > 1 ? Math.abs(shape.points[1].x - shape.points[0].x) : 50
    const h = shape.points && shape.points.length > 2 ? Math.abs(shape.points[2].y - shape.points[1].y) : 50

    switch (shape.type) {
      case 'rectangle':
        renderCalls.push(`this.ctx.save();this.ctx.globalAlpha=${shape.transform.alpha};this.ctx.translate(${x},${y});this.ctx.rotate(${shape.transform.rotation}*Math.PI/180);this.ctx.fillStyle=${fill};this.ctx.fillRect(0,0,${w},${h});this.ctx.restore();`)
        break
      case 'ellipse':
        const rx = w / 2
        const ry = h / 2
        renderCalls.push(`this.ctx.save();this.ctx.globalAlpha=${shape.transform.alpha};this.ctx.translate(${x},${y});this.ctx.beginPath();this.ctx.ellipse(${rx},${ry},${rx},${ry},0,0,6.28);this.ctx.fillStyle=${fill};this.ctx.fill();this.ctx.restore();`)
        break
      case 'polygon':
        if (shape.points && shape.points.length >= 3) {
          const pts = shape.points.map(p => `${p.x},${p.y}`).join(',')
          renderCalls.push(`this.ctx.save();this.ctx.globalAlpha=${shape.transform.alpha};this.ctx.translate(${x},${y});this.ctx.beginPath();this.ctx.moveTo(${shape.points![0].x},${shape.points![0].y});${shape.points!.slice(1).map(p => `this.ctx.lineTo(${p.x},${p.y});`).join('')}this.ctx.closePath();this.ctx.fillStyle=${fill};this.ctx.fill();this.ctx.restore();`)
        }
        break
      case 'path':
        if (shape.points && shape.points.length >= 2) {
          renderCalls.push(`this.ctx.save();this.ctx.globalAlpha=${shape.transform.alpha};this.ctx.translate(${x},${y});this.ctx.beginPath();this.ctx.moveTo(${shape.points![0].x},${shape.points![0].y});${shape.points!.slice(1).map(p => `this.ctx.lineTo(${p.x},${p.y});`).join('')}this.ctx.strokeStyle=${stroke};this.ctx.lineWidth=${shape.stroke?.width || 2};this.ctx.stroke();this.ctx.restore();`)
        }
        break
    }
  }

  return renderCalls.join('\n')
}

const escapeHtml = (str: string): string =>
  str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

export const exportToHTML = (config: ExportConfig): Blob => {
  const html = generateExportHTML(config)
  return new Blob([html], { type: 'text/html' })
}

export const downloadExport = (config: ExportConfig, filename?: string): void => {
  const blob = exportToHTML(config)
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename || `${config.title.replace(/\s+/g, '_').toLowerCase()}.html`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

export const exportFrameAsPNG = (canvas: HTMLCanvasElement): void => {
  const url = canvas.toDataURL('image/png')
  const a = document.createElement('a')
  a.href = url
  a.download = `frame_${Date.now()}.png`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
}

export const exportFrameAsSVG = (shapes: VectorShape[], width: number, height: number): void => {
  let svgContent = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`
  svgContent += `<rect width="100%" height="100%" fill="#0A0B0E"/>`

  for (const shape of shapes) {
    if (!shape.visible || !shape.points) continue
    const fill = shape.fill ? `rgba(${shape.fill.color.r},${shape.fill.color.g},${shape.fill.color.b},${shape.fill.color.a})` : 'none'
    const stroke = shape.stroke ? `rgba(${shape.stroke.color.r},${shape.stroke.color.g},${shape.stroke.color.b},${shape.stroke.color.a})` : 'none'

    switch (shape.type) {
      case 'rectangle':
        if (shape.points.length >= 4) {
          const w = Math.abs(shape.points[1].x - shape.points[0].x)
          const h = Math.abs(shape.points[2].y - shape.points[1].y)
          svgContent += `<rect x="${shape.transform.x}" y="${shape.transform.y}" width="${w}" height="${h}" fill="${fill}" stroke="${stroke}" stroke-width="${shape.stroke?.width || 1}"/>`
        }
        break
      case 'ellipse':
        if (shape.points.length >= 1) {
          svgContent += `<ellipse cx="${shape.transform.x + shape.points[0].x}" cy="${shape.transform.y + shape.points[0].y}" rx="${shape.points[0].x}" ry="${shape.points[0].y}" fill="${fill}" stroke="${stroke}" stroke-width="${shape.stroke?.width || 1}"/>`
        }
        break
      case 'polygon':
      case 'path':
        if (shape.points.length >= 2) {
          const d = `M ${shape.points.map(p => `${shape.transform.x + p.x},${shape.transform.y + p.y}`).join(' L ')}`
          svgContent += `<path d="${d}" fill="${shape.type === 'polygon' ? fill : 'none'}" stroke="${stroke}" stroke-width="${shape.stroke?.width || 1}"/>`
        }
        break
    }
  }

  svgContent += '</svg>'
  const blob = new Blob([svgContent], { type: 'image/svg+xml' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `frame_${Date.now()}.svg`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
