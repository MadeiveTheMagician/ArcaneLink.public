import { useState } from 'react'
import type { FormEvent } from 'react'
import { authCopy, SystemIcon } from '../../../system/shared/index'
import type { LoginForm } from '../model/AuthPageModel'
import formStyles from './AuthFormControls.module.css'
import styles from './AuthLoginForm.module.css'

export function AuthLoginForm({
  loginForm,
  isLoading,
  onSubmit,
  onChange,
}: {
  loginForm: LoginForm
  isLoading: boolean
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
  onChange: (form: LoginForm) => void
}) {
  const [isPasswordVisible, setIsPasswordVisible] = useState(false)

  return (
    <form
      className={`${formStyles.authForm} ${styles.authFormLogin}`}
      onSubmit={onSubmit}
    >
      <div className={styles.authFieldStack}>
        <label className={formStyles.authField}>
          <i aria-hidden="true">
            <SystemIcon name="user" />
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
        <label
          className={`${formStyles.authField} ${formStyles.authPasswordField}`}
        >
          <i aria-hidden="true">
            <SystemIcon name="lock" />
          </i>
          <span>{authCopy.fields.password}</span>
          <input
            name="password"
            autoComplete="current-password"
            placeholder={authCopy.fields.password}
            type={isPasswordVisible ? 'text' : 'password'}
            value={loginForm.password}
            onChange={(event) =>
              onChange({ ...loginForm, password: event.target.value })
            }
          />
          <button
            className={formStyles.authPasswordToggle}
            type="button"
            aria-label={
              isPasswordVisible
                ? authCopy.aria.hidePassword
                : authCopy.aria.showPassword
            }
            aria-pressed={isPasswordVisible}
            onClick={() => setIsPasswordVisible((isVisible) => !isVisible)}
          >
            <SystemIcon name={isPasswordVisible ? 'eye-off' : 'eye'} />
          </button>
        </label>
      </div>

      <div className={styles.authLoginOptions}>
        <label>
          <input name="rememberMe" type="checkbox" />
          <span>{authCopy.fields.rememberMe}</span>
        </label>
        <button type="button">{authCopy.hints.forgotPassword}</button>
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
