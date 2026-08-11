import { Component, ReactNode } from 'react'

interface Props {
  children: ReactNode
  fallback?: ReactNode
  onError?: (_error: Error, _errorInfo: React.ErrorInfo) => void
}

interface State {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('[ErrorBoundary]', error, errorInfo)
    this.props.onError?.(error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback
      return (
        <div style={{
          minHeight: '80vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 14,
          padding: '40px 24px',
          textAlign: 'center'
        }}>
          <div style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 12,
            color: 'var(--accent-red, #FF3B3B)',
            letterSpacing: 2,
            textTransform: 'uppercase'
          }}>
            Runtime Error
          </div>
          <h1 style={{ fontSize: 20, fontWeight: 600, margin: 0 }}>Something exploded.</h1>
          <p style={{ fontSize: 13, color: 'var(--text-muted, #888)', maxWidth: 400, margin: 0 }}>
            The page hit an unexpected error. Reload and you are usually fine — no data is lost.
          </p>
          <button
            className="btn btn-amber"
            onClick={() => this.setState({ hasError: false, error: null })}
          >
            Reload Page
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
