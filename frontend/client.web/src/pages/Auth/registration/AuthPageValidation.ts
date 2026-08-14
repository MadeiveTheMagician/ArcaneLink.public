import type { RegisterForm } from '../model/AuthPageModel'
import { authCopy } from '../../../system/shared/index'

export type AuthRequirement = {
  id: string
  label: string
  isMet: boolean
}

export type ValidatedRegisterFieldKey = 'login' | 'displayName' | 'password'

export function getLoginRequirements(login: string): AuthRequirement[] {
  const trimmedLogin = login.trim()

  return [
    {
      id: 'login-required',
      label: authCopy.requirements.loginRequired,
      isMet: trimmedLogin.length > 0,
    },
    {
      id: 'login-min-length',
      label: authCopy.requirements.loginMinLength,
      isMet: trimmedLogin.length >= 3,
    },
    {
      id: 'login-max-length',
      label: authCopy.requirements.loginMaxLength,
      isMet: trimmedLogin.length <= 50,
    },
  ]
}

export function getDisplayNameRequirements(
  displayName: string,
): AuthRequirement[] {
  const trimmedDisplayName = displayName.trim()

  return [
    {
      id: 'profile-required',
      label: authCopy.requirements.displayNameRequired,
      isMet: trimmedDisplayName.length > 0,
    },
    {
      id: 'profile-min-length',
      label: authCopy.requirements.displayNameMinLength,
      isMet: trimmedDisplayName.length >= 3,
    },
    {
      id: 'profile-max-length',
      label: authCopy.requirements.displayNameMaxLength,
      isMet: trimmedDisplayName.length <= 128,
    },
  ]
}

export function getPasswordRequirements(password: string): AuthRequirement[] {
  return [
    {
      id: 'password-min-length',
      label: authCopy.requirements.passwordMinLength,
      isMet: password.length >= 8,
    },
    {
      id: 'password-max-length',
      label: authCopy.requirements.passwordMaxLength,
      isMet: password.length <= 128,
    },
    {
      id: 'password-lowercase',
      label: authCopy.requirements.passwordLowercase,
      isMet: /[a-z]/.test(password),
    },
    {
      id: 'password-uppercase',
      label: authCopy.requirements.passwordUppercase,
      isMet: /[A-Z]/.test(password),
    },
    {
      id: 'password-digit',
      label: authCopy.requirements.passwordDigit,
      isMet: /\d/.test(password),
    },
    {
      id: 'password-special',
      label: authCopy.requirements.passwordSpecial,
      isMet: /[^A-Za-z0-9\s]/.test(password),
    },
    {
      id: 'password-no-whitespace',
      label: authCopy.requirements.passwordNoWhitespace,
      isMet: password.length > 0 && !/\s/.test(password),
    },
  ]
}

export function isRegisterStepComplete(
  registerForm: RegisterForm,
  key: keyof RegisterForm,
) {
  if (key === 'login') {
    return getLoginRequirements(registerForm.login).every(
      (requirement) => requirement.isMet,
    )
  }

  if (key === 'displayName') {
    return getDisplayNameRequirements(registerForm.displayName).every(
      (requirement) => requirement.isMet,
    )
  }

  if (key === 'password') {
    return getPasswordRequirements(registerForm.password).every(
      (requirement) => requirement.isMet,
    )
  }

  return registerForm[key].trim().length > 0
}
