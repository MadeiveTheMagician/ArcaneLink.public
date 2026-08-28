import { useState } from 'react'
import type { ChangeEventHandler, FocusEventHandler } from 'react'
import { authCopy, SystemIcon } from '../../../system/shared'
import formStyles from '../login/AuthFormControls.module.css'
import { getAuthPasswordFieldPresentation } from './authPasswordFieldModel'

type AuthPasswordFieldProps = {
  autoComplete: string
  className?: string
  isVisible?: boolean
  label: string
  name: string
  onChange: ChangeEventHandler<HTMLInputElement>
  onFocus?: FocusEventHandler<HTMLInputElement>
  onVisibilityChange?: (isVisible: boolean) => void
  placeholder: string
  required?: boolean
  value: string
}

export function AuthPasswordField({
  autoComplete,
  className = '',
  isVisible: controlledIsVisible,
  label,
  name,
  onChange,
  onFocus,
  onVisibilityChange,
  placeholder,
  required = false,
  value,
}: AuthPasswordFieldProps) {
  const [localIsVisible, setLocalIsVisible] = useState(false)
  const isVisible = controlledIsVisible ?? localIsVisible
  const presentation = getAuthPasswordFieldPresentation({
    isVisible,
    fieldLabel: label,
    showLabel: authCopy.aria.showPassword,
    hideLabel: authCopy.aria.hidePassword,
  })

  function toggleVisibility() {
    const nextValue = !isVisible

    if (controlledIsVisible === undefined) {
      setLocalIsVisible(nextValue)
    }

    onVisibilityChange?.(nextValue)
  }

  return (
    <label
      className={`${formStyles.authField} ${formStyles.authPasswordField} ${className}`.trim()}
    >
      <i aria-hidden="true">
        <SystemIcon name="lock" />
      </i>
      <span>{label}</span>
      <input
        name={name}
        autoComplete={autoComplete}
        placeholder={placeholder}
        required={required}
        type={presentation.inputType}
        value={value}
        onFocus={onFocus}
        onChange={onChange}
      />
      <button
        className={formStyles.authPasswordToggle}
        type="button"
        aria-label={presentation.toggleLabel}
        aria-pressed={isVisible}
        onClick={toggleVisibility}
      >
        <SystemIcon name={presentation.toggleIcon} />
      </button>
    </label>
  )
}
