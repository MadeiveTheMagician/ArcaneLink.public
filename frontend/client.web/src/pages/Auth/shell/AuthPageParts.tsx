import { authCopy } from '../../../system/shared/index'
import type { AuthMessage, AuthMode, AuthView } from '../model/AuthPageModel'
import styles from './AuthShell.module.css'

export { AuthLoginForm } from '../login/AuthLoginForm'
export { AuthRegisterForm } from '../registration/AuthRegisterForm'
export { registerSteps } from '../model/AuthPageModel'
export type {
  AuthMessage,
  AuthMode,
  AuthView,
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

const authViewCopy: Record<AuthView, { title: string; description: string }> = {
  login: {
    title: authCopy.tabs.login,
    description: authCopy.hints.loginCopy,
  },
  register: {
    title: authCopy.actions.createAccount,
    description: authCopy.hints.registerCopy,
  },
  'verify-email': {
    title: authCopy.titles.verifyEmail,
    description: authCopy.hints.registrationEmailVerification,
  },
  'forgot-password': {
    title: authCopy.titles.forgotPassword,
    description: authCopy.hints.forgotPasswordCopy,
  },
  'confirm-email': {
    title: authCopy.titles.confirmEmail,
    description: authCopy.hints.confirmEmailCopy,
  },
  'reset-password': {
    title: authCopy.titles.resetPassword,
    description: authCopy.hints.resetPasswordCopy,
  },
}

export function AuthCopy({ view }: { view: AuthView }) {
  const copy = authViewCopy[view]

  return (
    <div className={styles.authCopy}>
      <p className={styles.authKicker}>ArcaneLink</p>
      <h1 id="auth-title">{copy.title}</h1>
      <p>{copy.description}</p>
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
