import { authCopy } from '../../../system/shared/index'
import type { AuthMessage, AuthMode } from '../model/AuthPageModel'
import styles from './AuthShell.module.css'

export { AuthLoginForm } from '../login/AuthLoginForm'
export { AuthRegisterForm } from '../registration/AuthRegisterForm'
export { registerSteps } from '../model/AuthPageModel'
export type {
  AuthMessage,
  AuthMode,
  LoginForm,
  RegisterForm,
} from '../model/AuthPageModel'

export function AuthModeSwitch({
  mode,
  isSwitchingMode,
  onSwitchMode,
}: {
  mode: AuthMode
  isSwitchingMode: boolean
  onSwitchMode: (mode: AuthMode) => void
}) {
  return (
    <nav className={styles.authModeSwitch} aria-label={authCopy.aria.changeForm}>
      <button
        className={mode === 'login' ? styles.isActive : ''}
        type="button"
        onClick={() => onSwitchMode('login')}
        disabled={isSwitchingMode}
      >
        {authCopy.tabs.login}
      </button>
      <button
        className={mode === 'register' ? styles.isActive : ''}
        type="button"
        onClick={() => onSwitchMode('register')}
        disabled={isSwitchingMode}
      >
        {authCopy.tabs.register}
      </button>
    </nav>
  )
}

export function AuthCopy({ mode }: { mode: AuthMode }) {
  return (
    <div className={styles.authCopy}>
      <p className={styles.authKicker}>ArcaneLink</p>
      <h1 id="auth-title">
        {mode === 'login' ? authCopy.tabs.login : authCopy.actions.createAccount}
      </h1>
      <p>
        {mode === 'login'
          ? authCopy.hints.loginCopy
          : authCopy.hints.registerCopy}
      </p>
    </div>
  )
}

export function AuthMessageView({ message }: { message: AuthMessage }) {
  return (
    <div
      className={`${styles.authMessage} ${
        message.tone === 'success'
          ? styles.authMessageSuccess
          : message.tone === 'error'
            ? styles.authMessageError
            : ''
      }`}
    >
      {message.text}
    </div>
  )
}
