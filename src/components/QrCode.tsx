import { useEffect, useRef, useState } from 'react'
import QRCode from 'qrcode'

interface QrCodeProps {
  /** Data to encode (e.g. "bitcoin:bc1q...?amount=0.001") */
  data: string
  size?: number
  className?: string
}

/**
 * Renders a QR code locally on a <canvas> using the `qrcode` library.
 * Payment data never leaves the browser — no third-party API is contacted.
 * Falls back to a text placeholder if encoding fails.
 */
export default function QrCode({ data, size = 200, className }: QrCodeProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    let cancelled = false

    QRCode.toCanvas(canvas, data, {
      width: size,
      margin: 2,
      errorCorrectionLevel: 'M',
      color: { dark: '#FFFFFFFF', light: '#0D0E12FF' }
    })
      .then(() => {
        if (!cancelled) setFailed(false)
      })
      .catch(() => {
        if (!cancelled) setFailed(true)
      })

    return () => { cancelled = true }
  }, [data, size])

  if (failed) {
    return (
      <span style={{
        fontSize: 10,
        color: 'var(--text-muted)',
        fontFamily: 'var(--font-mono)'
      }}>
        QR unavailable
      </span>
    )
  }

  return (
    <canvas
      ref={canvasRef}
      width={size}
      height={size}
      aria-label="Payment QR code"
      role="img"
      className={className}
      style={{
        display: 'block',
        width: size,
        height: size,
        borderRadius: 'var(--radius-sm)',
        background: '#0D0E12'
      }}
    />
  )
}
