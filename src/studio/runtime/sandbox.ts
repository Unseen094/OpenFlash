import { OpenFlashRuntime } from '../engine/runtime'

export type SandboxLogKind = 'info' | 'success' | 'warn' | 'error'

export interface SandboxLog {
  (kind: SandboxLogKind, message: string): void
}

export interface SandboxRunResult {
  ok: boolean
  message: string
}

export class StudioSandbox {
  private runtime: OpenFlashRuntime | null = null
  private canvas: HTMLCanvasElement | null = null
  private log: SandboxLog

  constructor(canvas: HTMLCanvasElement | null, log: SandboxLog) {
    this.canvas = canvas
    this.log = log
  }

  get isRunning(): boolean {
    return this.runtime !== null
  }

  getRuntime(): OpenFlashRuntime | null {
    return this.runtime
  }

   run(code: string): SandboxRunResult {
    this.stop()
    if (!this.canvas) {
      return { ok: false, message: 'Stage not ready.' }
    }

    if (code.length > 50000) {
      return { ok: false, message: 'Code exceeds maximum length (50,000 characters).' }
    }

    const bannedPatterns = [
      /\b(eval|Function|constructor|prototype)\b/,
      /\b(fetch|XMLHttpRequest|WebSocket|importScripts|Worker)\b/,
      /\b(localStorage|sessionStorage|cookie)\b/,
      /\b(process\.env|process\.\w+)/,
    ]

    for (const pattern of bannedPatterns) {
      if (pattern.test(code)) {
        return { ok: false, message: `Potentially unsafe code detected: ${pattern.source}` }
      }
    }

    const runtime = new OpenFlashRuntime({ transparent: true, attachInputHandlers: false })
    runtime.initialize(this.canvas)
    this.runtime = runtime

    const consoleFacade = this.createConsoleFacade()

    try {
      const compiled = new Function(
        'OpenFlash', 'Open',
        'console', 'Math', 'Date', 'JSON', 'performance', 'requestAnimationFrame',
        `"use strict";\n${stripTypeScript(code)}`
      )
      compiled(runtime, runtime, consoleFacade, Math, Date, JSON, performance, (fn: FrameRequestCallback) => requestAnimationFrame(fn))
      runtime.start()
      this.log('success', 'Script started — press Run again to stop.')
      return { ok: true, message: 'Running' }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err)
      this.log('error', message)
      this.stop()
      return { ok: false, message }
    }
  }

  stop(): void {
    if (this.runtime) {
      this.runtime.dispose()
      this.runtime = null
    }
  }

  forwardPointer(type: 'pointerDown' | 'pointerUp' | 'pointerMove', x: number, y: number): void {
    this.runtime?.dispatchEvent(type, { x, y })
  }

  forwardKey(type: 'keyDown' | 'keyUp', key: string): void {
    this.runtime?.dispatchEvent(type, { key })
  }

  dispose(): void {
    this.stop()
    this.canvas = null
  }

  private createConsoleFacade(): Console {
    const forward = (kind: SandboxLogKind, args: unknown[]) => {
      const text = args.map(formatArg).join(' ')
      if (kind === 'warn' || kind === 'error') {
        console[kind](...args)
      }
      this.log(kind, text)
    }
    return {
      log: (...args: unknown[]) => forward('info', args),
      info: (...args: unknown[]) => forward('info', args),
      debug: (...args: unknown[]) => forward('info', args),
      warn: (...args: unknown[]) => forward('warn', args),
      error: (...args: unknown[]) => forward('error', args)
    } as unknown as Console
  }
}

function formatArg(arg: unknown): string {
  if (typeof arg === 'string') return arg
  if (typeof arg === 'number' || typeof arg === 'boolean' || arg === null || arg === undefined) {
    return String(arg)
  }
  if (arg instanceof Error) return arg.message
  try {
    return JSON.stringify(arg, (_k, v) => {
      if (typeof v === 'function') return '[function]'
      if (v instanceof Map) return Array.from(v.entries())
      return v
    })
  } catch (e) {
    return String(arg)
  }
}

/**
 * Strips param type annotations like `e: any`, `e?: number`, `a: string, b: number`.
 * Scanner-based (not regex) so object literals inside calls like
 * `fn({ a: 1, b: 2 })` are never touched — annotations are only removed when the
 * identifier sits directly after `(` or `,` inside a paren depth, while not
 * inside an object-literal brace.
 */
function stripParamAnnotations(src: string): string {
  let out = ''
  let i = 0
  const n = src.length
  let parenDepth = 0
  let objectDepth = 0
  const isIdent = (c: string) => /[A-Za-z0-9_$]/.test(c)

  const classifyBrace = (at: number): boolean => {
    let j = at - 1
    while (j >= 0 && /\s/.test(src[j])) j--
    if (j < 0) return false
    const last = src[j]
    if (last === ')' || last === '}' || last === '>') return false
    if (last === '(' || last === ',' || last === '=' || last === '[' || last === '{' ||
        last === ':' || last === ';' || last === '?' || last === '!' || last === '&' || last === '|') return true
    if (!isIdent(last)) return true
    let k = j
    while (k >= 0 && isIdent(src[k])) k--
    const word = src.slice(k + 1, j + 1)
    if (['if', 'for', 'while', 'switch', 'try', 'catch', 'finally', 'else', 'function', 'class', 'interface', 'do'].includes(word)) return false
    let p = k
    while (p >= 0 && /\s/.test(src[p])) p--
    const beforeWord = p >= 0 ? src[p] : ''
    if (beforeWord === ')' || beforeWord === '>' || beforeWord === ':') return false
    return true
  }

  const walkToDelimiter = (from: number): number => {
    let depth = 0
    let k2 = from
    while (k2 < n) {
      const c2 = src[k2]
      if (c2 === '=' && src[k2 + 1] === '>') { k2 += 2; continue }
      if (c2 === '<' || c2 === '(' || c2 === '[' || c2 === '{') depth++
      else if (c2 === '>' || c2 === ')' || c2 === ']' || c2 === '}') {
        if (depth === 0) break
        depth--
      } else if ((c2 === ',' || c2 === '=') && depth === 0) break
      k2++
    }
    return k2
  }

  while (i < n) {
    const ch = src[i]

    if (ch === '(') { parenDepth++; out += ch; i++; continue }
    if (ch === ')') { parenDepth = Math.max(0, parenDepth - 1); out += ch; i++; continue }
    if (ch === '{') {
      if (classifyBrace(i)) objectDepth++
      out += ch; i++; continue
    }
    if (ch === '}') { objectDepth = Math.max(0, objectDepth - 1); out += ch; i++; continue }

    if (ch === ':' && parenDepth > 0 && objectDepth === 0) {
      let j = i - 1
      while (j >= 0 && /\s/.test(src[j])) j--
      const hasOptional = src[j] === '?'
      if (hasOptional) j--
      if (j >= 0 && isIdent(src[j])) {
        let k = j
        while (k >= 0 && isIdent(src[k])) k--
        let p = k
        while (p >= 0 && /\s/.test(src[p])) p--
        const before = p >= 0 ? src[p] : ''
        if (before === '(' || before === ',') {
          const k2 = walkToDelimiter(i + 1)
          if (src[k2] !== '{') {
            if (hasOptional) out = out.replace(/\s*\?$/, '')
            i = k2
            continue
          }
        }
      }
    }

    out += ch
    i++
  }
  return out
}


/**
 * Conservative TypeScript→JavaScript stripper built on the
 * mask-then-transform pattern: string literals and comments are replaced by
 * inert placeholders, regex transforms run on the rest, then originals are
 * restored. Valid JS passes through untouched.
 */
export function stripTypeScript(code: string): string {
  // 1. Mask strings + comments
  let masked = ''
  const restored: string[] = []
  let i = 0
  const n = code.length
  while (i < n) {
    const ch = code[i]
    const next = code[i + 1]
    if (ch === '/' && next === '/') {
      const start = i
      while (i < n && code[i] !== '\n') i++
      const seg = code.slice(start, i)
      restored.push(seg)
      masked += `§${restored.length - 1}§`
      continue
    }
    if (ch === '/' && next === '*') {
      const start = i
      i += 2
      while (i < n && !(code[i] === '*' && code[i + 1] === '/')) i++
      i = Math.min(i + 2, n)
      const seg = code.slice(start, i)
      restored.push(seg)
      masked += `§${restored.length - 1}§`
      continue
    }
    if (ch === "'" || ch === '"' || ch === '`') {
      const quote = ch
      const start = i
      i++
      while (i < n) {
        if (code[i] === '\\') { i += 2; continue }
        if (code[i] === quote) { i++; break }
        i++
      }
      const seg = code.slice(start, i)
      restored.push(seg)
      masked += `§${restored.length - 1}§`
      continue
    }
    masked += ch
    i++
  }

  // 2. Transforms (masked code only — placeholders are §N§ so no accidental hits)
  //    `=>` is masked too so it can't be mistaken for a type/return boundary.
  let t = masked.replace(/=>/g, '__ARROW__')

  // a) `const x: Type = ...` / `let y: Type = ...`
  t = t.replace(/\b(const|let|var)\s+([A-Za-z_$][\w$]*)\s*:\s*[^=\n;]+?(?==)/g, '$1 $2 ')

  // b) param annotations: `e: any` `e?: any` `a: string, b: number`
  t = stripParamAnnotations(t)

  // c) arrow/function return types: `): Type =>` `): Type {`
  t = t.replace(/\)\s*:\s*[^;{=)\n]+?(?==>|__ARROW__|\s*\{|;)/g, ') ')

  // d) `as Type` / `as const`
  t = t.replace(/\bas\s+(const|[A-Za-z_$][\w$]*)\b/g, '')

  // e) `readonly` modifiers
  t = t.replace(/\breadonly\s+/g, '')

  // f) standalone `declare`
  t = t.replace(/\bdeclare\s+/g, '')

  // 3. Restore strings/comments (and arrows)
  return t
    .replace(/§(\d+)§/g, (_m, idx: string) => restored[Number(idx)] ?? '')
    .replace(/__ARROW__/g, '=>')
}