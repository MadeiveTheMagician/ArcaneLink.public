import { authCopy, SystemIcon } from '../../../system/shared/index'
import type { RegisterForm } from '../model/AuthPageModel'
import { registerSteps } from '../model/AuthPageModel'
import {
  getRegisterStepRequirements,
  registerStepRequirementTitles,
  RegisterRequirementsPanel,
  RegisterWizardField,
} from './AuthRegisterShared'
import formStyles from '../login/AuthFormControls.module.css'
import styles from './AuthRegisterForm.module.css'

export function AuthMobileRegisterWizard({
  registerForm,
  registerProgress,
  mobileRegisterStep,
  isLoading,
  isPasswordVisible,
  onChange,
  onChangeStep,
  onPasswordVisibilityChange,
}: {
  registerForm: RegisterForm
  registerProgress: boolean[]
  mobileRegisterStep: number
  isLoading: boolean
  isPasswordVisible: boolean
  onChange: (form: RegisterForm) => void
  onChangeStep: (step: number) => void
  onPasswordVisibilityChange: (isVisible: boolean) => void
}) {
  const mobileStep = registerSteps[mobileRegisterStep] ?? registerSteps[0]
  const mobileStepRequirements = getRegisterStepRequirements(
    registerForm,
    mobileStep.key,
  )
  const isMobileStepComplete = registerProgress[mobileRegisterStep] ?? false
  const isLastMobileStep = mobileRegisterStep === registerSteps.length - 1

  return (
    <div className={styles.authRegisterWizard}>
      <ol
        className={styles.authRegisterWizardSteps}
        aria-label={authCopy.aria.registerSteps}
      >
        {registerSteps.map((step, index) => {
          const isComplete = registerProgress[index]
          const isActive = index === mobileRegisterStep

          return (
            <li
              key={step.key}
              className={`${isComplete ? styles.isComplete : ''} ${
                isActive ? styles.isActive : ''
              }`}
            >
              <button
                type="button"
                aria-label={authCopy.aria.step(index + 1, step.label)}
                onClick={() => onChangeStep(index)}
              >
                <span>
                  {isComplete ? <SystemIcon name="check" size={14} /> : index + 1}
                </span>
                <strong>{step.label}</strong>
              </button>
            </li>
          )
        })}
      </ol>

      <div className={styles.authRegisterWizardBody}>
        <p className={styles.authRegisterStepKicker}>
          {authCopy.labels.stepOf(mobileRegisterStep + 1, registerSteps.length)}
        </p>
        <h2>{mobileStep.label}</h2>

        {mobileRegisterStep === 0 && (
          <p className={styles.authRegistrationNotice}>
            <SystemIcon name="mail" size={16} />
            <span>{authCopy.hints.registrationEmailVerification}</span>
          </p>
        )}

        <RegisterWizardField
          stepKey={mobileStep.key}
          registerForm={registerForm}
          isPasswordVisible={isPasswordVisible}
          onChange={onChange}
          onPasswordVisibilityChange={onPasswordVisibilityChange}
        />

        <RegisterRequirementsPanel
          title={registerStepRequirementTitles[mobileStep.key]}
          requirements={mobileStepRequirements}
          isVisible={mobileStepRequirements.length > 0}
        />
      </div>

      <div className={styles.authRegisterWizardActions}>
        <button
          className={styles.authRegisterBack}
          type="button"
          disabled={mobileRegisterStep === 0 || isLoading}
          onClick={() => onChangeStep(mobileRegisterStep - 1)}
        >
          {authCopy.actions.back}
        </button>
        {isLastMobileStep ? (
          <button
            className={`${formStyles.authSubmit} ${styles.authRegisterSubmit}`}
            disabled={isLoading || !registerProgress.every(Boolean)}
            type="submit"
          >
            {isLoading ? authCopy.actions.creating : authCopy.actions.create}
          </button>
        ) : (
          <button
            className={`${formStyles.authSubmit} ${styles.authRegisterSubmit}`}
            disabled={!isMobileStepComplete || isLoading}
            type="button"
            onClick={() => onChangeStep(mobileRegisterStep + 1)}
          >
            {authCopy.actions.next}
          </button>
        )}
      </div>
    </div>
  )
}
