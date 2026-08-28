import { authCopy } from '../../../system/shared/index'

export type AuthMode = 'login' | 'register'

export type AuthView =
  | AuthMode
  | 'verify-email'
  | 'forgot-password'
  | 'confirm-email'
  | 'reset-password'

export type RegisterForm = {
  login: string
  displayName: string
  email: string
  password: string
}

export type LoginForm = {
  loginOrEmail: string
  password: string
  deviceName: string
}

export type AuthMessage = {
  tone: 'neutral' | 'success' | 'error'
  text: string
}

export const registerSteps: Array<{
  key: keyof RegisterForm
  label: string
}> = [
  { key: 'login', label: authCopy.steps.login },
  { key: 'displayName', label: authCopy.steps.displayName },
  { key: 'email', label: authCopy.steps.email },
  { key: 'password', label: authCopy.steps.password },
]
