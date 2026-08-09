import { describe, it, expect } from 'vitest'
import { sanitizeSvg, createSvgElement } from './sanitize'

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

describe('sanitizeSvg — XSS payloads', () => {
  const payloads: Array<[string, string]> = [
    ['unquoted onload', '<svg onload=alert(1)>'],
    ['backtick onload', '<svg onload=`alert(1)`>'],
    ['quoted onload', '<svg onload="alert(1)">'],
    ['javascript: href', '<a href="javascript:alert(1)">click</a>'],
    ['self-closing script', '<script src=evil.js />'],
    ['script with src attr', '<script src="https://evil.example/x.js"></script>'],
    ['onerror on image', '<img src=x onerror=alert(1)>'],
    ['onmouseover', '<svg><rect onmouseover="alert(1)" /></svg>'],
    ['animate href', '<svg><animate attributeName="href" values="javascript:alert(1)" /></svg>'],
    ['foreignObject script', '<svg><foreignObject><script>alert(1)</script></foreignObject></svg>'],
    ['uppercase ONLOAD', '<svg ONLOAD="alert(1)">'],
    ['newline separated handler', '<svg\nonload="alert(1)">'],
    ['data uri html', '<svg><a href="data:text/html,<script>alert(1)</script>">x</a></svg>'],
    ['set attribute xss', '<svg><set attributeName="onload" to="alert(1)" /></svg>'],
    ['use xlink javascript', '<svg><use xlink:href="javascript:alert(1)" /></svg>'],
    ['comment hidden script', '<svg><!-- <script>alert(1)</script> --><rect /></svg>'],
    ['nested script casing', '<svg><ScRiPt>alert(1)</ScRiPt></svg>'],
    ['iframe injection', '<svg><iframe src="javascript:alert(1)"></iframe></svg>'],
    ['onfocus autofocus', '<svg><a onfocus="alert(1)" autofocus>x</a></svg>'],
    ['style expression', '<svg><rect style="background:url(javascript:alert(1))" /></svg>']
  ]

  it.each(payloads)('neutralises %s', (_name, payload) => {
    const result = sanitizeSvg(payload)
    expect(isNeutralised(result)).toBe(true)
  })

  it('renders no executable surface once inserted into the DOM', () => {
    for (const [, payload] of payloads) {
      const el = createSvgElement(payload)
      expect(el.querySelector('script')).toBeNull()
      for (const node of Array.from(el.querySelectorAll('*'))) {
        for (const attr of Array.from(node.attributes)) {
          expect(attr.name.toLowerCase().startsWith('on')).toBe(false)
          expect(attr.value.replace(/\s/g, '').toLowerCase()).not.toContain('javascript:')
        }
      }
    }
  })

  it('drops HTML comments that could hide payloads', () => {
    expect(sanitizeSvg('<svg><!-- <script>alert(1)</script> --></svg>')).toBe('<svg></svg>')
  })

  it('is idempotent — sanitizing twice yields the same output', () => {
    for (const [, payload] of payloads) {
      const once = sanitizeSvg(payload)
      expect(sanitizeSvg(once)).toBe(once)
    }
  })

  it('leaves legitimate presentational attributes alone', () => {
    const safe =
      '<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2"><path d="M4 4 L20 20"></path></svg>'
    expect(sanitizeSvg(safe)).toBe(safe)
  })
})

describe('createSvgElement', () => {
  it('wraps sanitized markup in a centred flex div', () => {
    const el = createSvgElement('<svg><rect /></svg>')
    expect(el.tagName).toBe('DIV')
    expect(el.style.display).toBe('flex')
    expect(el.style.alignItems).toBe('center')
    expect(el.style.justifyContent).toBe('center')
    expect(el.querySelector('rect')).not.toBeNull()
  })

  it('applies optional class name and dimensions', () => {
    const el = createSvgElement('<svg />', 'icon', 32, 48)
    expect(el.className).toBe('icon')
    expect(el.style.width).toBe('32px')
    expect(el.style.height).toBe('48px')
  })

  it('omits sizing when not provided', () => {
    const el = createSvgElement('<svg />')
    expect(el.className).toBe('')
    expect(el.style.width).toBe('')
    expect(el.style.height).toBe('')
  })
})

function isNeutralised(html: string): boolean {
  const lowered = html.toLowerCase()
  if (/<script\b/.test(lowered)) return false
  if (/\bon[a-z]+\s*=/.test(lowered)) return false
  if (/javascript\s*:/.test(lowered.replace(/\s/g, ' '))) return false
  if (/data\s*:\s*text\/html/.test(lowered)) return false
  return true
}
