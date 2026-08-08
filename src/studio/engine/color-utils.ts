export interface RGB { r: number; g: number; b: number }
export interface HSL { h: number; s: number; l: number }

export const hexToRgb = (hex: string): RGB => ({
  r: parseInt(hex.slice(1, 3), 16),
  g: parseInt(hex.slice(3, 5), 16),
  b: parseInt(hex.slice(5, 7), 16)
})

export const rgbToHex = (r: number, g: number, b: number): string =>
  '#' + [r, g, b].map(c => Math.round(c).toString(16).padStart(2, '0')).join('')

export const rgbToHsl = (r: number, g: number, b: number): HSL => {
  r /= 255; g /= 255; b /= 255
  const max = Math.max(r, g, b), min = Math.min(r, g, b)
  let h = 0, s = 0
  const l = (max + min) / 2
  if (max !== min) {
    const d = max - min
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break
      case g: h = ((b - r) / d + 2) / 6; break
      case b: h = ((r - g) / d + 4) / 6; break
    }
  }
  return { h: h * 360, s: s * 100, l: l * 100 }
}

export const hslToRgb = (h: number, s: number, l: number): RGB => {
  h /= 360; s /= 100; l /= 100
  let r: number, g: number, b: number
  if (s === 0) { r = g = b = l } else {
    const hue2rgb = (p: number, q: number, t: number) => {
      if (t < 0) t++
      if (t > 1) t--
      if (t < 1 / 6) return p + (q - p) * 6 * t
      if (t < 1 / 2) return q
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6
      return p
    }
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s
    const p = 2 * l - q
    r = hue2rgb(p, q, h + 1 / 3)
    g = hue2rgb(p, q, h)
    b = hue2rgb(p, q, h - 1 / 3)
  }
  return { r: r * 255, g: g * 255, b: b * 255 }
}

export const formatColor = (color: RGB, format: 'hex' | 'rgb' | 'hsl'): string => {
  switch (format) {
    case 'hex': return rgbToHex(color.r, color.g, color.b)
    case 'rgb': return `rgb(${Math.round(color.r)}, ${Math.round(color.g)}, ${Math.round(color.b)})`
    case 'hsl': {
      const hsl = rgbToHsl(color.r, color.g, color.b)
      return `hsl(${Math.round(hsl.h)}, ${Math.round(hsl.s)}%, ${Math.round(hsl.l)}%)`
    }
  }
}

export const copyColorToClipboard = async (color: RGB, format: 'hex' | 'rgb' | 'hsl') => {
  try {
    await navigator.clipboard.writeText(formatColor(color, format))
  } catch (e) {
    console.error('[color-utils] Clipboard write failed:', e)
  }
}

export const COLOR_PALETTES = {
  material: ['#F44336', '#E91E63', '#9C27B0', '#673AB7', '#3F51B5', '#2196F3', '#03A9F4', '#00BCD4', '#009688', '#4CAF50', '#8BC34A', '#CDDC39', '#FFEB3B', '#FFC107', '#FF9800', '#FF5722'],
  pastel: ['#FFB3BA', '#FFDFBA', '#FFFFBA', '#BAFFC9', '#BAE1FF', '#E8BAFF', '#FFB3DE', '#B3FFE0', '#B3D4FF', '#FFE0B3'],
  retro: ['#FF6B35', '#F7C59F', '#EFEFD0', '#004E89', '#1A659E', '#7B2D8E', '#C73E1D', '#2A9D8F', '#E9C46A', '#F4A261'],
  neon: ['#FF00FF', '#00FFFF', '#FF0080', '#80FF00', '#FF8000', '#0080FF', '#8000FF', '#FF0040', '#40FF00', '#00FF80'],
  mono: ['#000000', '#1A1A1A', '#333333', '#4D4D4D', '#666666', '#808080', '#999999', '#B3B3B3', '#CCCCCC', '#E6E6E6', '#FFFFFF']
}

export const parseColorInput = (input: string): RGB | null => {
  input = input.trim()
  if (input.startsWith('#')) return hexToRgb(input)
  if (input.startsWith('rgb')) {
    const match = input.match(/(\d+),\s*(\d+),\s*(\d+)/)
    if (match) return { r: parseInt(match[1]), g: parseInt(match[2]), b: parseInt(match[3]) }
  }
  if (input.startsWith('hsl')) {
    const match = input.match(/(\d+),\s*(\d+)%,\s*(\d+)%/)
    if (match) return hslToRgb(parseInt(match[1]), parseInt(match[2]), parseInt(match[3]))
  }
  return null
}
