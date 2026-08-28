export type AuthPasswordFieldPresentation = {
  inputType: 'password' | 'text'
  toggleIcon: 'eye' | 'eye-off'
  toggleLabel: string
}

export function getAuthPasswordFieldPresentation({
  isVisible,
  fieldLabel,
  showLabel,
  hideLabel,
}: {
  isVisible: boolean
  fieldLabel: string
  showLabel: string
  hideLabel: string
}): AuthPasswordFieldPresentation {
  return {
    inputType: isVisible ? 'text' : 'password',
    toggleIcon: isVisible ? 'eye-off' : 'eye',
    toggleLabel: `${isVisible ? hideLabel : showLabel}: ${fieldLabel}`,
  }
}
