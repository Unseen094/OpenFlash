import DOMPurify from 'dompurify'

DOMPurify.addHook('afterSanitizeAttributes', (node) => {
  if (node.nodeType !== 1) return
  const el = node as Element
  for (const attr of Array.from(el.attributes)) {
    const val = attr.value.replace(/\s/g, '').toLowerCase()
    if (val.includes('javascript:') || val.includes('data:text/html')) {
      el.removeAttribute(attr.name)
    }
  }
})

export function sanitizeSvg(svg: string): string {
  return DOMPurify.sanitize(svg, {
    USE_PROFILES: { svg: true, svgFilters: true },
    FORBID_TAGS: ['script', 'foreignObject']
  })
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
