import { Component } from 'react'

export class ErrorBoundary extends Component {
  state = { error: null }

  static getDerivedStateFromError(error) {
    return { error }
  }

  render() {
    if (this.state.error) {
      return (
        <div
          style={{
            minHeight: '100dvh',
            padding: '2rem',
            fontFamily: 'system-ui, sans-serif',
            background: '#f4f7fc',
            color: '#0c1929',
            textAlign: 'left',
          }}
        >
          <h1 style={{ fontSize: '1.25rem', marginBottom: '0.75rem' }}>Something broke</h1>
          <p style={{ marginBottom: '1rem', opacity: 0.85 }}>
            Open the browser console (Developer tools) for the full stack trace.
          </p>
          <pre
            style={{
              fontSize: '0.85rem',
              overflow: 'auto',
              padding: '1rem',
              background: '#fff',
              border: '1px solid #cbd5e1',
              borderRadius: '8px',
              whiteSpace: 'pre-wrap',
            }}
          >
            {String(this.state.error?.message ?? this.state.error)}
          </pre>
        </div>
      )
    }
    return this.props.children
  }
}
