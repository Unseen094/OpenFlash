import { describe, it, expect } from 'vitest'
import { stripTypeScript } from './sandbox'

describe('stripTypeScript', () => {
  it('returns valid JS unchanged', () => {
    const code = 'const x = 1 + 2\nconsole.log(x)'
    expect(stripTypeScript(code)).toBe(code)
  })

  it('preserves strings containing type-like syntax', () => {
    const code = 'const msg = "hello: world as string"'
    expect(stripTypeScript(code)).toContain('"hello: world as string"')
  })

  it('preserves template literals with type-like syntax', () => {
    const code = 'const tmpl = `value: ${42} as number`'
    expect(stripTypeScript(code)).toContain('value: ${42} as number')
  })

  it('preserves arrow functions', () => {
    const code = 'const fn = (x: number) => x * 2'
    expect(stripTypeScript(code)).toContain('=>')
  })

  it('is idempotent — stripping twice yields the same output', () => {
    const code = 'const x: number = 5\nconst y = (a: string): void => {}'
    const once = stripTypeScript(code)
    expect(stripTypeScript(once)).toBe(once)
  })
})
