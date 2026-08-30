import { type FormEvent, useEffect, useRef, useState } from 'react';

import {
  type ConfirmEmailResponse,
  confirmAccountEmail,
  requestPasswordReset,
  resendVerificationEmail,
  resetAccountPassword
} from '../../../shared/api/accountLifecycleApi';
import { SystemIcon, authCopy } from '../../../system/shared';
import { AuthPasswordField } from '../fields/AuthPasswordField';
import type { AuthView } from '../model/AuthPageModel';
import { getPasswordRequirements } from '../registration/AuthPageValidation';

import formStyles from '../login/AuthFormControls.module.css';
import styles from './AuthAccountFlow.module.css';

type AccountFlowView = Exclude<AuthView, 'login' | 'register'>;

type AuthAccountFlowProps = {
  view: AccountFlowView;
  token?: string;
  initialEmail?: string;
  onBackToLogin: () => void;
  onAccountActionSettled: () => void;
  onRequiresReauthentication: () => void;
};

type FlowStatus = 'idle' | 'loading' | 'success' | 'error';

export function AuthAccountFlow({
  view,
  token = '',
  initialEmail = '',
  onBackToLogin,
  onAccountActionSettled,
  onRequiresReauthentication
}: AuthAccountFlowProps) {
  const processedConfirmationRef = useRef<string | null>(null);
  const [email, setEmail] = useState(initialEmail);
  const [loginOrEmail, setLoginOrEmail] = useState(initialEmail);
  const [newPassword, setNewPassword] = useState('');
  const [confirmedPassword, setConfirmedPassword] = useState('');
  const [status, setStatus] = useState<FlowStatus>(
    view === 'confirm-email' ? 'loading' : 'idle'
  );
  const [statusMessage, setStatusMessage] = useState(
    view === 'confirm-email'
      ? authCopy.messages.confirmingEmail
      : view === 'verify-email'
        ? authCopy.messages.checkVerificationInbox
        : ''
  );

  useEffect(() => {
    if (
      view !== 'confirm-email' ||
      !token ||
      processedConfirmationRef.current === token
    ) {
      return;
    }

    processedConfirmationRef.current = token;
    setStatus('loading');
    setStatusMessage(authCopy.messages.confirmingEmail);

    void confirmAccountEmail(token)
      .then((response: ConfirmEmailResponse) => {
        if (response.requiresReauthentication) {
          onRequiresReauthentication();
        }

        setStatus('success');
        setStatusMessage(
          response.emailChanged
            ? authCopy.messages.emailChangeConfirmed
            : authCopy.messages.emailConfirmed
        );
        onAccountActionSettled();
      })
      .catch(() => {
        setStatus('error');
        setStatusMessage(authCopy.messages.emailConfirmationFailed);
      });
  }, [onAccountActionSettled, onRequiresReauthentication, token, view]);

  async function submitResend(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus('loading');
    setStatusMessage(authCopy.messages.sendingVerification);

    try {
      await resendVerificationEmail(email.trim());
      setStatus('success');
      setStatusMessage(authCopy.messages.verificationSent);
    } catch {
      setStatus('error');
      setStatusMessage(authCopy.messages.verificationSendFailed);
    }
  }

  async function submitRecovery(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus('loading');
    setStatusMessage(authCopy.messages.sendingRecovery);

    try {
      await requestPasswordReset(loginOrEmail.trim());
      setStatus('success');
      setStatusMessage(authCopy.messages.recoverySent);
    } catch {
      setStatus('error');
      setStatusMessage(authCopy.messages.recoverySendFailed);
    }
  }

  async function submitReset(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (newPassword !== confirmedPassword) {
      setStatus('error');
      setStatusMessage(authCopy.messages.passwordsDoNotMatch);
      return;
    }

    if (!getPasswordRequirements(newPassword).every((item) => item.isMet)) {
      setStatus('error');
      setStatusMessage(authCopy.messages.passwordRequirementsNotMet);
      return;
    }

    setStatus('loading');
    setStatusMessage(authCopy.messages.resettingPassword);

    try {
      await resetAccountPassword(token, newPassword);
      onRequiresReauthentication();
      setStatus('success');
      setStatusMessage(authCopy.messages.passwordResetSuccess);
      setNewPassword('');
      setConfirmedPassword('');
      onAccountActionSettled();
    } catch {
      setStatus('error');
      setStatusMessage(authCopy.messages.passwordResetFailed);
    }
  }

  if (view === 'confirm-email') {
    return (
      <div className={styles.actionState} aria-live="polite">
        <StatusMark status={status} />
        <p>{statusMessage}</p>
        {status !== 'loading' && (
          <button
            className={formStyles.authSubmit}
            type="button"
            onClick={onBackToLogin}
          >
            {authCopy.actions.backToLogin}
          </button>
        )}
      </div>
    );
  }

  if (view === 'verify-email') {
    return (
      <AccountActionForm
        inputName="verificationEmail"
        inputType="email"
        autoComplete="email"
        value={email}
        placeholder="Email"
        isLoading={status === 'loading'}
        submitLabel={authCopy.actions.resendVerification}
        loadingLabel={authCopy.actions.sending}
        status={status}
        statusMessage={statusMessage}
        onSubmit={submitResend}
        onValueChange={setEmail}
        onBack={onBackToLogin}
      />
    );
  }

  if (view === 'forgot-password') {
    return (
      <AccountActionForm
        inputName="loginOrEmail"
        autoComplete="username"
        value={loginOrEmail}
        placeholder={authCopy.fields.emailOrLogin}
        isLoading={status === 'loading'}
        submitLabel={authCopy.actions.sendRecoveryLink}
        loadingLabel={authCopy.actions.sending}
        status={status}
        statusMessage={statusMessage}
        onSubmit={submitRecovery}
        onValueChange={setLoginOrEmail}
        onBack={onBackToLogin}
      />
    );
  }

  const passwordRequirements = getPasswordRequirements(newPassword);

  return (
    <form
      className={`${formStyles.authForm} ${styles.accountForm}`}
      onSubmit={submitReset}
    >
      <AuthPasswordField
        name="newPassword"
        autoComplete="new-password"
        label={authCopy.fields.newPassword}
        placeholder={authCopy.fields.newPassword}
        value={newPassword}
        onChange={(event) => setNewPassword(event.target.value)}
      />
      <AuthPasswordField
        name="confirmPassword"
        autoComplete="new-password"
        label={authCopy.fields.confirmPassword}
        placeholder={authCopy.fields.confirmPassword}
        value={confirmedPassword}
        onChange={(event) => setConfirmedPassword(event.target.value)}
      />
      <ul
        className={styles.passwordRequirements}
        aria-label={authCopy.requirements.password}
      >
        {passwordRequirements.map((requirement) => (
          <li key={requirement.id} data-met={requirement.isMet || undefined}>
            <SystemIcon
              name={requirement.isMet ? 'check' : 'close'}
              size={12}
            />
            <span>{requirement.label}</span>
          </li>
        ))}
      </ul>
      <FlowMessage status={status} message={statusMessage} />
      <button
        className={formStyles.authSubmit}
        disabled={status === 'loading' || !token}
        type="submit"
      >
        {status === 'loading'
          ? authCopy.actions.saving
          : authCopy.actions.resetPassword}
      </button>
      <button
        className={styles.backButton}
        type="button"
        onClick={onBackToLogin}
      >
        {authCopy.actions.backToLogin}
      </button>
    </form>
  );
}

function AccountActionForm({
  inputName,
  inputType = 'text',
  autoComplete,
  value,
  placeholder,
  isLoading,
  submitLabel,
  loadingLabel,
  status,
  statusMessage,
  onSubmit,
  onValueChange,
  onBack
}: {
  inputName: string;
  inputType?: string;
  autoComplete: string;
  value: string;
  placeholder: string;
  isLoading: boolean;
  submitLabel: string;
  loadingLabel: string;
  status: FlowStatus;
  statusMessage: string;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onValueChange: (value: string) => void;
  onBack: () => void;
}) {
  return (
    <form
      className={`${formStyles.authForm} ${styles.accountForm}`}
      onSubmit={onSubmit}
    >
      <label className={formStyles.authField}>
        <i aria-hidden="true">
          <SystemIcon name="mail" />
        </i>
        <span>{placeholder}</span>
        <input
          name={inputName}
          type={inputType}
          autoComplete={autoComplete}
          required
          placeholder={placeholder}
          value={value}
          onChange={(event) => onValueChange(event.target.value)}
        />
      </label>
      <FlowMessage status={status} message={statusMessage} />
      <button
        className={formStyles.authSubmit}
        disabled={isLoading || !value.trim()}
        type="submit"
      >
        {isLoading ? loadingLabel : submitLabel}
      </button>
      <button className={styles.backButton} type="button" onClick={onBack}>
        {authCopy.actions.backToLogin}
      </button>
    </form>
  );
}

function FlowMessage({
  status,
  message
}: {
  status: FlowStatus;
  message: string;
}) {
  if (!message) return null;

  return (
    <p
      className={styles.flowMessage}
      data-status={status}
      role={status === 'error' ? 'alert' : 'status'}
    >
      {message}
    </p>
  );
}

function StatusMark({ status }: { status: FlowStatus }) {
  return (
    <span className={styles.statusMark} data-status={status} aria-hidden="true">
      <SystemIcon
        name={
          status === 'success'
            ? 'check'
            : status === 'error'
              ? 'close'
              : 'settings'
        }
        size={24}
      />
    </span>
  );
}
