import { authCopy, SystemIcon } from '../../../system/shared/index'
import type { AuthRequirement, ValidatedRegisterFieldKey } from './AuthPageValidation'
import type { RegisterForm } from '../model/AuthPageModel'
import { registerSteps } from '../model/AuthPageModel'
import {
  RegisterRequirementsPanel,
  ValidatedRegisterField,
} from './AuthRegisterShared'
import formStyles from '../login/AuthFormControls.module.css'
import styles from './AuthRegisterForm.module.css'

export function AuthDesktopRegisterForm({
  registerForm,
  registerProgress,
  activeRegisterStep,
  activeRequirements,
  activeRequirementTitle,
  activeRequirementList,
  isLoading,
  onChange,
  onFocusRequirements,
}: {
  registerForm: RegisterForm
  registerProgress: boolean[]
  activeRegisterStep: number
  activeRequirements: ValidatedRegisterFieldKey | null
  activeRequirementTitle: string
  activeRequirementList: AuthRequirement[]
  isLoading: boolean
  onChange: (form: RegisterForm) => void
  onFocusRequirements: (field: ValidatedRegisterFieldKey | null) => void
}) {
  return (
    <>
      <ol
        className={`${styles.authRegisterSteps} ${styles.authRegisterStepsDesktop}`}
        aria-label={authCopy.aria.registerSteps}
      >
        {registerSteps.map((step, index) => {
          const isComplete = registerProgress[index]
          const isActive = index === activeRegisterStep

          return (
            <li
              key={step.key}
              className={`${isComplete ? styles.isComplete : ''} ${
                isActive ? styles.isActive : ''
              }`}
            >
              <span>
                {isComplete ? <SystemIcon name="check" size={14} /> : index + 1}
              </span>
              <strong>{step.label}</strong>
            </li>
          )
        })}
      </ol>

      <div
        className={`${styles.authRegisterCredentials} ${styles.authRegisterCredentialsDesktop}`}
      >
        <RegisterRequirementsPanel
          title={activeRequirementTitle}
          requirements={activeRequirementList}
          isVisible={activeRequirements !== null}
        />
        <div className={styles.authRegisterGrid}>
          <ValidatedRegisterField icon="user" label={authCopy.fields.login}>
            <input
              name="login"
              autoComplete="username"
              placeholder={authCopy.fields.loginPlaceholder}
              value={registerForm.login}
              onFocus={() => onFocusRequirements('login')}
              onChange={(event) =>
                onChange({ ...registerForm, login: event.target.value })
              }
            />
          </ValidatedRegisterField>
          <ValidatedRegisterField
            icon="user"
            label={authCopy.fields.displayName}
          >
            <input
              name="displayName"
              autoComplete="name"
              placeholder={authCopy.fields.displayNameRegisterPlaceholder}
              value={registerForm.displayName}
              onFocus={() => onFocusRequirements('displayName')}
              onChange={(event) =>
                onChange({ ...registerForm, displayName: event.target.value })
              }
            />
          </ValidatedRegisterField>
          <label className={formStyles.authField}>
            <i aria-hidden="true">
              <SystemIcon name="mail" />
            </i>
            <span>Email</span>
            <input
              name="email"
              autoComplete="email"
              placeholder="Email"
              type="email"
              value={registerForm.email}
              onFocus={() => onFocusRequirements(null)}
              onChange={(event) =>
                onChange({ ...registerForm, email: event.target.value })
              }
            />
          </label>
          <ValidatedRegisterField icon="lock" label={authCopy.fields.password}>
            <input
              name="password"
              autoComplete="new-password"
              placeholder={authCopy.fields.password}
              type="password"
              value={registerForm.password}
              onFocus={() => onFocusRequirements('password')}
              onChange={(event) =>
                onChange({ ...registerForm, password: event.target.value })
              }
            />
          </ValidatedRegisterField>
        </div>
      </div>

      <button
        className={`${formStyles.authSubmit} ${styles.authRegisterSubmitDesktop}`}
        disabled={isLoading}
        type="submit"
      >
        {isLoading
          ? authCopy.actions.creatingSeal
          : authCopy.actions.createAccount}
      </button>
    </>
  )
}
