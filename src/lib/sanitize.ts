export function sanitizeSvg(svg: string): string {
  const dangerousAttrPattern = /\s+(on\w+|javascript:|data:text\/html)\s*=\s*["'][^"']*["']/gi
  let cleaned = svg.replace(dangerousAttrPattern, '')
  cleaned = cleaned.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
  cleaned = cleaned.replace(/<!--[\s\S]*?-->/g, '')
  return cleaned
}

export function createSvgElement(svgString: string, className?: string, width?: number, height?: number): HTMLDivElement {
  const wrapper = document.createElement('div')
  wrapper.style.display = 'flex'
  wrapper.style.alignItems = 'center'
  wrapper.style.justifyContent = 'center'
  if (className) wrapper.className = className
  if (width) wrapper.style.width = `${width}px`
  if (height) wrapper.style.height = `${height}px`
  wrapper.innerHTML = sanitizeSvg(svgString)
  return wrapper
}
