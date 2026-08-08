import { Link } from 'react-router-dom'
import { IconArrowLeft, IconHome } from '../components/Icons'

export default function NotFoundPage() {
  return (
    <div style={{
      minHeight: 'calc(100vh - 60px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '40px 24px'
    }}>
      <div style={{ textAlign: 'center', maxWidth: 480 }}>
        <div style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 96,
          fontWeight: 700,
          lineHeight: 1,
          color: 'var(--accent-yellow)',
          textShadow: '0 0 40px rgba(255, 230, 0, 0.3)',
          marginBottom: 8
        }}>
          404
        </div>
        <h1 style={{
          fontFamily: 'var(--font-sans)',
          fontSize: 24,
          fontWeight: 700,
          marginBottom: 12
        }}>
          Page not found
        </h1>
        <p style={{
          fontSize: 14,
          color: 'var(--text-secondary)',
          lineHeight: 1.6,
          marginBottom: 32
        }}>
          The page you're looking for doesn't exist or has been moved.
          Double-check the URL or head back to the homepage.
        </p>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
          <Link
            to="/"
            className="btn btn-primary"
            style={{
              padding: '10px 22px',
              fontSize: 13,
              textDecoration: 'none',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6
            }}
          >
            <IconHome size={15} />
            Go Home
          </Link>
          <button
            onClick={() => window.history.back()}
            className="btn btn-ghost"
            style={{
              padding: '10px 22px',
              fontSize: 13,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6
            }}
          >
            <IconArrowLeft size={15} />
            Go Back
          </button>
        </div>
      </div>
    </div>
  )
}
