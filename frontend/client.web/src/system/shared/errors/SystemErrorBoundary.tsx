import {
  Component,
  type ErrorInfo,
  type ReactNode,
} from 'react'
import { SystemButton } from '../ui/SystemButton'
import {
  captureSystemError,
  createSystemErrorBoundaryState,
  formatSystemErrorDetails,
  haveSystemErrorResetKeysChanged,
  retrySystemErrorBoundary,
  type SystemErrorBoundaryState,
} from './systemErrorBoundaryModel'
import {
  reportSystemError,
  type SystemErrorTelemetryReporter,
} from './systemErrorTelemetry'
import { systemErrorCopy } from './systemError.ru'
import styles from './SystemErrorBoundary.module.css'

type SystemErrorBoundaryProps = {
  boundaryName: string
  children: ReactNode
  message?: string
  onError?: SystemErrorTelemetryReporter
  onReset?: () => void
  resetKeys?: readonly unknown[]
  title?: string
  variant?: 'root' | 'workspace'
}

export class SystemErrorBoundary extends Component<
  SystemErrorBoundaryProps,
  SystemErrorBoundaryState
> {
  state = createSystemErrorBoundaryState()

  static getDerivedStateFromError(error: unknown) {
    return captureSystemError(createSystemErrorBoundaryState(), error)
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    reportSystemError(
      {
        boundaryName: this.props.boundaryName,
        componentStack: errorInfo.componentStack ?? null,
        error,
        occurredAt: new Date().toISOString(),
      },
      this.props.onError,
    )
  }

  componentDidUpdate(previousProps: SystemErrorBoundaryProps) {
    if (
      this.state.error &&
      haveSystemErrorResetKeysChanged(
        previousProps.resetKeys,
        this.props.resetKeys,
      )
    ) {
      this.resetBoundary()
    }
  }

  private resetBoundary = () => {
    this.setState((currentState) => retrySystemErrorBoundary(currentState))
    this.props.onReset?.()
  }

  render() {
    const { error } = this.state
    const { children, message, title, variant = 'workspace' } = this.props

    if (!error) return children

    const fallbackCopy = systemErrorCopy[variant]

    return (
      <section
        className={`${styles.fallback} ${styles[variant]}`}
        role="alert"
        aria-live="assertive"
      >
        <div className={styles.card}>
          <span className={styles.eyebrow}>{systemErrorCopy.eyebrow}</span>
          <h1 className={styles.title}>{title ?? fallbackCopy.title}</h1>
          <p className={styles.message}>{message ?? fallbackCopy.message}</p>
          <SystemButton onClick={this.resetBoundary}>
            {systemErrorCopy.actions.retry}
          </SystemButton>
          {import.meta.env.DEV && (
            <details className={styles.details}>
              <summary>{systemErrorCopy.details.title}</summary>
              <pre>{formatSystemErrorDetails(error)}</pre>
            </details>
          )}
        </div>
      </section>
    )
  }
}
