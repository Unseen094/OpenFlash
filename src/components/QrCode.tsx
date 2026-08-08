interface QrCodeProps {
  /** Data to encode (e.g. "bitcoin:bc1q...?amount=0.001") */
  data: string
  size?: number
  className?: string
}

/**
 * Renders a QR code as an <img> using the free qrserver.com API.
 * No client-side library needed — keeps the bundle small.
 * Falls back to a text placeholder if the image fails to load.
 */
export default function QrCode({ data, size = 200, className }: QrCodeProps) {
  const encoded = encodeURIComponent(data)
  const src = `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encoded}&margin=10&bgcolor=0d0e12&color=ffffff`

  return (
    <img
      src={src}
      width={size}
      height={size}
      alt="Payment QR code"
      className={className}
      style={{
        display: 'block',
        borderRadius: 'var(--radius-sm)',
        background: '#0D0E12'
      }}
      onError={e => {
        const target = e.currentTarget
        const parent = target.parentElement
        if (parent) {
          const span = document.createElement('span')
          span.style.fontSize = '10px'
          span.style.color = 'var(--text-muted)'
          span.style.fontFamily = 'var(--font-mono)'
          span.textContent = 'QR unavailable'
          parent.replaceChild(span, target)
        }
      }}
    />
  )
}
