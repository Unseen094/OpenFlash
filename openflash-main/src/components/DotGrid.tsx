import { useEffect, useRef } from 'react'

export default function DotGrid() {
  const gridRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (gridRef.current) {
        const x = (e.clientX / window.innerWidth - 0.5) * 8
        const y = (e.clientY / window.innerHeight - 0.5) * 8
        gridRef.current.style.backgroundPosition = `${x}px ${y}px`
      }
    }
    window.addEventListener('mousemove', handleMouseMove)
    return () => window.removeEventListener('mousemove', handleMouseMove)
  }, [])

  return (
    <div
      ref={gridRef}
      className="dot-grid"
      style={{ position: 'fixed', inset: 0, zIndex: 0 }}
    />
  )
}
