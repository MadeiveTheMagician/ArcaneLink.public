import type { FormEvent } from 'react'
import { authCopy, SystemIcon } from '../../../system/shared/index'
import type { LoginForm } from '../model/AuthPageModel'
import { AuthPasswordField } from '../fields/AuthPasswordField'
import formStyles from './AuthFormControls.module.css'
import styles from './AuthLoginForm.module.css'

export function AuthLoginForm({
  loginForm,
  isLoading,
  onSubmit,
  onChange,
  onForgotPassword,
}: {
  loginForm: LoginForm
  isLoading: boolean
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
  onChange: (form: LoginForm) => void
  onForgotPassword: () => void
}) {
  return (
    <form
      className={`${formStyles.authForm} ${styles.authFormLogin}`}
      onSubmit={onSubmit}
    >
      <div className={styles.authFieldStack}>
        <label className={formStyles.authField}>
          <i aria-hidden="true">
            <SystemIcon name="mail" />
          </i>
          <span>{authCopy.fields.loginOrEmail}</span>
          <input
            name="loginOrEmail"
            autoComplete="username"
            placeholder={authCopy.fields.emailOrLogin}
            value={loginForm.loginOrEmail}
            onChange={(event) =>
              onChange({
                ...loginForm,
                loginOrEmail: event.target.value,
              })
            }
          />
        </label>
        <AuthPasswordField
          name="password"
          autoComplete="current-password"
          label={authCopy.fields.password}
          placeholder={authCopy.fields.password}
          value={loginForm.password}
          onChange={(event) =>
            onChange({ ...loginForm, password: event.target.value })
          }
        />
      </div>

      <div className={styles.authLoginOptions}>
        <label>
          <input name="rememberMe" type="checkbox" />
          <span>{authCopy.fields.rememberMe}</span>
        </label>
        <button type="button" onClick={onForgotPassword}>
          {authCopy.hints.forgotPassword}
        </button>
      </div>

      <button
        className={formStyles.authSubmit}
        disabled={isLoading}
        type="submit"
      >
        {isLoading ? authCopy.actions.loginLoading : authCopy.actions.login}
      </button>

      <div className={styles.authDeviceNote}>
        <span>{authCopy.labels.device}</span>
        <strong>{loginForm.deviceName}</strong>
      </div>
    </form>
  )
}
