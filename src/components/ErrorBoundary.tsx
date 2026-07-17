import { Component, type ErrorInfo, type ReactNode } from 'react'
import { clearAllData } from '../utils/resetData'

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
      clearAllData()
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
