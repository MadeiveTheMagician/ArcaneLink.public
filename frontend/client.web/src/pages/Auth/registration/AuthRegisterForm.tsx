import { useState } from 'react'
import type { FormEvent } from 'react'
import { authCopy } from '../../../system/shared/index'
import {
  getDisplayNameRequirements,
  getLoginRequirements,
  getPasswordRequirements,
  type ValidatedRegisterFieldKey,
} from './AuthPageValidation'
import type { RegisterForm } from '../model/AuthPageModel'
import { registerSteps } from '../model/AuthPageModel'
import { AuthDesktopRegisterForm } from './AuthDesktopRegisterForm'
import { AuthMobileRegisterWizard } from './AuthMobileRegisterWizard'
import { requirementTitles } from './AuthRegisterShared'
import formStyles from '../login/AuthFormControls.module.css'
import styles from './AuthRegisterForm.module.css'

export function AuthRegisterForm({
  registerForm,
  registerProgress,
  activeRegisterStep,
  isLoading,
  onSubmit,
  onChange,
}: {
  registerForm: RegisterForm
  registerProgress: boolean[]
  activeRegisterStep: number
  isLoading: boolean
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
  onChange: (form: RegisterForm) => void
}) {
  const [activeRequirements, setActiveRequirements] =
    useState<ValidatedRegisterFieldKey | null>(null)
  const [mobileRegisterStep, setMobileRegisterStep] =
    useState(activeRegisterStep)
  const [isPasswordVisible, setIsPasswordVisible] = useState(false)
  const requirementsByField = {
    login: getLoginRequirements(registerForm.login),
    displayName: getDisplayNameRequirements(registerForm.displayName),
    password: getPasswordRequirements(registerForm.password),
  }
  const activeRequirementList = activeRequirements
    ? requirementsByField[activeRequirements]
    : []
  const activeRequirementTitle = activeRequirements
    ? requirementTitles[activeRequirements]
    : authCopy.labels.requirements

  function changeMobileRegisterStep(nextStep: number) {
    setMobileRegisterStep(
      Math.min(Math.max(nextStep, 0), registerSteps.length - 1),
    )
  }

  return (
    <form
      className={`${formStyles.authForm} ${styles.authFormRegister}`}
      onSubmit={onSubmit}
    >
      <AuthDesktopRegisterForm
        registerForm={registerForm}
        registerProgress={registerProgress}
        activeRegisterStep={activeRegisterStep}
        activeRequirements={activeRequirements}
        activeRequirementTitle={activeRequirementTitle}
        activeRequirementList={activeRequirementList}
        isLoading={isLoading}
        isPasswordVisible={isPasswordVisible}
        onChange={onChange}
        onFocusRequirements={setActiveRequirements}
        onPasswordVisibilityChange={setIsPasswordVisible}
      />
      <AuthMobileRegisterWizard
        registerForm={registerForm}
        registerProgress={registerProgress}
        mobileRegisterStep={mobileRegisterStep}
        isLoading={isLoading}
        isPasswordVisible={isPasswordVisible}
        onChange={onChange}
        onChangeStep={changeMobileRegisterStep}
        onPasswordVisibilityChange={setIsPasswordVisible}
      />
    </form>
  )
}
