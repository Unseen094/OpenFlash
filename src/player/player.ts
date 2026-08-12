import { OpenFlashRuntime } from '../studio/engine/runtime'
import { stripTypeScript } from '../studio/runtime/sandbox'

/**
 * Sandboxed player host.
 *
 * Runs inside an opaque-origin <iframe sandbox="allow-scripts"> — no
 * same-origin privileges, no parent storage access, no DOM access to the
 * host page. The only bridge to the parent is postMessage:
 *
 *   parent → player  { kind: 'of:load', code }   load/restart a game
 *                    { kind: 'of:key', action: 'down'|'up', key }
 *   player → parent  { kind: 'of:ready' }        handshake after boot
 *                    { kind: 'of:score', score } game posted a score
 *                    { kind: 'of:error', message }
 */

const canvas = document.getElementById('stage') as HTMLCanvasElement
const parent = window.parent

let runtime: OpenFlashRuntime | null = null

function send(message: Record<string, unknown>): void {
  parent.postMessage({ source: 'openflash-player', ...message }, '*')
}

function load(code: string): void {
  runtime?.dispose()
  runtime = null

  const rt = new OpenFlashRuntime({
    dataChannel: (name, value) => {
      if (name === 'score') {
        const score = (value as { score: number }).score
        if (Number.isFinite(score)) send({ kind: 'of:score', score })
      }
    }
  })
  rt.initialize(canvas)
  runtime = rt

  try {
    const compiled = new Function(
      'OpenFlash', 'Open',
      'console', 'Math', 'Date', 'JSON', 'performance', 'requestAnimationFrame',
      `"use strict";\n${stripTypeScript(code)}`
    )
    compiled(rt, rt, console, Math, Date, JSON, performance, requestAnimationFrame)
    rt.start()
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    send({ kind: 'of:error', message })
  }
}

window.addEventListener('message', (event: MessageEvent) => {
  const data = event.data as { source?: string; kind?: string }
  if (!data || typeof data !== 'object' || data.source !== 'openflash-host') return
  switch (data.kind) {
    case 'of:load': {
      const code = (data as { code?: string }).code
      if (typeof code === 'string' && code.length <= 60000) load(code)
      break
    }
    case 'of:key': {
      const action = (data as { action?: string }).action
      const key = (data as { key?: string }).key
      if ((action === 'down' || action === 'up') && typeof key === 'string') {
        runtime?.dispatchEvent(action === 'down' ? 'keyDown' : 'keyUp', { key })
      }
      break
    }
  }
})

send({ kind: 'of:ready' })