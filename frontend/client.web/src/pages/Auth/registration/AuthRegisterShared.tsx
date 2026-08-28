import type { ReactNode } from 'react';

import {
  SystemIcon,
  type SystemIconName,
  authCopy
} from '../../../system/shared/index';
import { AuthPasswordField } from '../fields/AuthPasswordField';
import type { RegisterForm } from '../model/AuthPageModel';
import type { AuthRequirement } from './AuthPageValidation';
import {
  getDisplayNameRequirements,
  getLoginRequirements,
  getPasswordRequirements
} from './AuthPageValidation';

import formStyles from '../login/AuthFormControls.module.css';
import styles from './AuthRegisterForm.module.css';

export const requirementTitles = {
  login: authCopy.requirements.login,
  displayName: authCopy.requirements.displayName,
  password: authCopy.requirements.password
};

export const registerStepRequirementTitles: Record<keyof RegisterForm, string> =
  {
    login: authCopy.requirements.login,
    displayName: authCopy.requirements.displayName,
    email: authCopy.requirements.email,
    password: authCopy.requirements.password
  };

export function getRegisterStepRequirements(
  registerForm: RegisterForm,
  key: keyof RegisterForm
): AuthRequirement[] {
  if (key === 'login') return getLoginRequirements(registerForm.login);
  if (key === 'displayName') {
    return getDisplayNameRequirements(registerForm.displayName);
  }
  if (key === 'password') return getPasswordRequirements(registerForm.password);

  return [
    {
      id: 'email-required',
      label: authCopy.fields.emailComplete,
      isMet: registerForm.email.trim().length > 0
    }
  ];
}

export function RegisterWizardField({
  stepKey,
  registerForm,
  isPasswordVisible,
  onChange,
  onPasswordVisibilityChange
}: {
  stepKey: keyof RegisterForm;
  registerForm: RegisterForm;
  isPasswordVisible: boolean;
  onChange: (form: RegisterForm) => void;
  onPasswordVisibilityChange: (isVisible: boolean) => void;
}) {
  if (stepKey === 'password') {
    return (
      <AuthPasswordField
        name="password"
        autoComplete="new-password"
        isVisible={isPasswordVisible}
        label={authCopy.fields.password}
        placeholder={authCopy.fields.password}
        value={registerForm.password}
        onChange={(event) =>
          onChange({ ...registerForm, password: event.target.value })
        }
        onVisibilityChange={onPasswordVisibilityChange}
      />
    );
  }

  const field = {
    login: {
      icon: 'user' as const,
      label: authCopy.fields.login,
      autoComplete: 'username',
      placeholder: authCopy.fields.loginRegisterPlaceholder,
      type: 'text'
    },
    displayName: {
      icon: 'user' as const,
      label: authCopy.fields.displayName,
      autoComplete: 'name',
      placeholder: authCopy.fields.displayNamePlaceholder,
      type: 'text'
    },
    email: {
      icon: 'mail' as const,
      label: 'Email',
      autoComplete: 'email',
      placeholder: 'Email',
      type: 'email'
    }
  }[stepKey];

  return (
    <label className={formStyles.authField}>
      <i aria-hidden="true">
        <SystemIcon name={field.icon} />
      </i>
      <span>{field.label}</span>
      <input
        name={stepKey}
        autoComplete={field.autoComplete}
        placeholder={field.placeholder}
        type={field.type}
        value={registerForm[stepKey]}
        onChange={(event) =>
          onChange({ ...registerForm, [stepKey]: event.target.value })
        }
      />
    </label>
  );
}

export function ValidatedRegisterField({
  icon,
  label,
  children
}: {
  icon: SystemIconName;
  label: string;
  children: ReactNode;
}) {
  return (
    <div className={styles.authValidatedField}>
      <label className={`${formStyles.authField} ${styles.authValidatedInput}`}>
        <i aria-hidden="true">
          <SystemIcon name={icon} />
        </i>
        <span>{label}</span>
        {children}
      </label>
    </div>
  );
}

export function RegisterRequirementsPanel({
  title,
  requirements,
  isVisible
}: {
  title: string;
  requirements: AuthRequirement[];
  isVisible: boolean;
}) {
  return (
    <aside
      className={`${styles.authRequirementsPanel} ${
        isVisible ? styles.isVisible : ''
      }`}
      aria-hidden={!isVisible}
    >
      <h2>{title}</h2>
      <ul className={styles.authRequirementsList}>
        {requirements.map((requirement) => (
          <li
            key={requirement.id}
            className={
              requirement.isMet
                ? styles.authRequirementMet
                : styles.authRequirementMissing
            }
          >
            <span aria-hidden="true">
              <SystemIcon
                name={requirement.isMet ? 'check' : 'close'}
                size={14}
              />
            </span>
            <strong>{requirement.label}</strong>
          </li>
        ))}
      </ul>
    </aside>
  );
}
