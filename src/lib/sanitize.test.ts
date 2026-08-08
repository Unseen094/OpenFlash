import { describe, it, expect } from 'vitest'
import { sanitizeSvg } from '../lib/sanitize'

describe('sanitizeSvg', () => {
  it('strips onload event handlers', () => {
    const malicious = '<svg onload="alert(\'xss\')"><rect /></svg>'
    const result = sanitizeSvg(malicious)
    expect(result).not.toContain('onload')
  })

  it('strips onclick event handlers', () => {
    const malicious = '<svg onclick="steal()"><circle /></svg>'
    const result = sanitizeSvg(malicious)
    expect(result).not.toContain('onclick')
  })

  it('preserves safe SVG content', () => {
    const safe = '<svg width="100" height="100"><rect width="50" height="50" /></svg>'
    const result = sanitizeSvg(safe)
    expect(result).toContain('rect')
    expect(result).toContain('width')
  })

  it('strips script tags', () => {
    const malicious = '<svg><script>alert(1)</script><rect /></svg>'
    const result = sanitizeSvg(malicious)
    expect(result).not.toContain('<script')
  })

  it('handles empty strings', () => {
    expect(sanitizeSvg('')).toBe('')
  })
})
