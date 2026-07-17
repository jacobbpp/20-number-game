import { Component, type ErrorInfo, type ReactNode } from 'react'

const STORAGE_PREFIX = 'order20-'

interface ErrorBoundaryProps {
  children: ReactNode
}

interface ErrorBoundaryState {
  hasError: boolean
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false }

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true }
  }

  componentDidCatch(error: unknown, info: ErrorInfo) {
    console.error('Order 20 crashed:', error, info.componentStack)
  }

  handleReset = () => {
    try {
      // Every key this app writes uses the order20- prefix, so clearing by
      // prefix (rather than an explicit list of keys) self-maintains as new
      // ones get added — an explicit list is exactly what silently fell out
      // of date here before: this used to remove only the best-score and
      // stats keys from when those were the only two that existed, leaving
      // 11 more (including the in-progress game itself, read on every
      // mount) untouched. If a crash was ever caused by corrupted data in
      // one of those, this button would reload straight into the same
      // corrupted state and crash again.
      const keysToRemove: string[] = []
      for (let i = 0; i < window.localStorage.length; i++) {
        const key = window.localStorage.key(i)
        if (key?.startsWith(STORAGE_PREFIX)) keysToRemove.push(key)
      }
      keysToRemove.forEach(key => window.localStorage.removeItem(key))
    } catch {
      // Storage already unavailable — nothing to clear.
    }
    window.location.reload()
  }

  render() {
    if (!this.state.hasError) return this.props.children

    return (
      <div className="app">
        <div className="crash">
          <span className="crash__title">Something went wrong</span>
          <p className="crash__body">Order 20 hit an unexpected error. Resetting your saved data should fix it.</p>
          <button type="button" className="btn btn--primary" onClick={this.handleReset}>
            Reset and reload
          </button>
        </div>
      </div>
    )
  }
}
