import { describe, it, expect } from 'vitest'
import { lerp, clamp, hexToColor, distance } from './math'
import { easingFunctions, generateTweenFrames } from './easing'
import { rgbToHsl, hslToRgb, hexToRgb } from './color-utils'

describe('math', () => {
  it('lerp returns endpoints exactly', () => {
    expect(lerp(0, 100, 0)).toBe(0)
    expect(lerp(0, 100, 1)).toBe(100)
  })

  it('lerp interpolates midpoint', () => {
    expect(lerp(0, 100, 0.5)).toBe(50)
  })

  it('clamp restricts to range', () => {
    expect(clamp(5, 0, 10)).toBe(5)
    expect(clamp(-1, 0, 10)).toBe(0)
    expect(clamp(15, 0, 10)).toBe(10)
  })

  it('hexToColor parses valid hex', () => {
    expect(hexToColor('#FF0000')).toEqual({ r: 255, g: 0, b: 0, a: 1 })
    expect(hexToColor('#00ff00')).toEqual({ r: 0, g: 255, b: 0, a: 1 })
  })

  it('hexToColor returns black for invalid hex', () => {
    expect(hexToColor('not-a-color')).toEqual({ r: 0, g: 0, b: 0, a: 1 })
  })

  it('distance computes euclidean distance', () => {
    expect(distance({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(5)
  })
})

describe('easing', () => {
  const easings = Object.keys(easingFunctions) as Array<keyof typeof easingFunctions>

  it.each(easings)('%s returns 0 at t=0', (name) => {
    expect(easingFunctions[name](0)).toBeCloseTo(0, 5)
  })

  it.each(easings)('%s returns 1 at t=1', (name) => {
    expect(easingFunctions[name](1)).toBeCloseTo(1, 5)
  })

  it('generateTweenFrames produces correct frame count', () => {
    const shape = { transform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, alpha: 1 } } as any
    const toShape = { transform: { x: 100, y: 0, rotation: 0, scaleX: 1, scaleY: 1, alpha: 1 } } as any
    const frames = generateTweenFrames(shape, toShape, 10)
    expect(frames).toHaveLength(11)
  })

  it('generateTweenFrames first frame equals from', () => {
    const shape = { transform: { x: 50, y: 0, rotation: 0, scaleX: 1, scaleY: 1, alpha: 1 } } as any
    const toShape = { transform: { x: 100, y: 0, rotation: 0, scaleX: 1, scaleY: 1, alpha: 1 } } as any
    const frames = generateTweenFrames(shape, toShape, 10)
    expect(frames[0].shape.transform.x).toBe(50)
    expect(frames[frames.length - 1].shape.transform.x).toBe(100)
  })
})

describe('color-utils', () => {
  it('hexToRgb parses valid hex', () => {
    expect(hexToRgb('#FF0000')).toEqual({ r: 255, g: 0, b: 0 })
    expect(hexToRgb('#0000FF')).toEqual({ r: 0, g: 0, b: 255 })
  })

  it('rgbToHsl and hslToRgb round-trip within tolerance', () => {
    const colors = [
      { r: 255, g: 0, b: 0 },
      { r: 0, g: 255, b: 0 },
      { r: 0, g: 0, b: 255 },
      { r: 128, g: 64, b: 200 }
    ]
    for (const { r, g, b } of colors) {
      const { h, s, l } = rgbToHsl(r, g, b)
      const back = hslToRgb(h, s, l)
      expect(Math.abs(back.r - r)).toBeLessThanOrEqual(2)
      expect(Math.abs(back.g - g)).toBeLessThanOrEqual(2)
      expect(Math.abs(back.b - b)).toBeLessThanOrEqual(2)
    }
  })
})
