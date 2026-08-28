import { useState, type FormEvent, type ReactNode } from 'react'
import {
  changeAccountLogin,
  changeAccountPassword,
  requestAccountEmailChange,
} from '../../../../shared/api/accountLifecycleApi'
import type { UserResponse } from '../../../../shared/types'
import { settingsCopy } from '../../../shared/copy'
import {
  isValidEmailChange,
  isValidLoginChange,
  isValidPasswordChange,
  type AccountCredentialEditor,
} from './accountCredentialModel'
import styles from './SystemSettingsAccount.module.css'

type EditorStatus = {
  tone: 'success' | 'error'
  text: string
} | null

export function AccountCredentialEditors({
  accessToken,
  user,
  editors = ['login', 'email', 'password'],
  onReauthenticationRequired,
}: {
  accessToken: string
  user: UserResponse
  editors?: readonly AccountCredentialEditor[]
  onReauthenticationRequired: (message: string) => void
}) {
  const [activeEditor, setActiveEditor] =
    useState<AccountCredentialEditor | null>(null)
  const [currentPassword, setCurrentPassword] = useState('')
  const [newLogin, setNewLogin] = useState(user.login)
  const [newEmail, setNewEmail] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmedPassword, setConfirmedPassword] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [status, setStatus] = useState<EditorStatus>(null)

  function openEditor(editor: AccountCredentialEditor) {
    setActiveEditor((current) => (current === editor ? null : editor))
    setCurrentPassword('')
    setNewPassword('')
    setConfirmedPassword('')
    setNewEmail('')
    setNewLogin(user.login)
    setStatus(null)
  }

  function closeEditor() {
    setActiveEditor(null)
    setCurrentPassword('')
    setNewPassword('')
    setConfirmedPassword('')
    setStatus(null)
  }

  async function submitLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!isValidLoginChange(newLogin, currentPassword)) return

    setIsSaving(true)
    setStatus(null)
    try {
      const response = await changeAccountLogin(
        accessToken,
        newLogin.trim(),
        currentPassword,
      )
      if (response.requiresReauthentication) {
        onReauthenticationRequired(settingsCopy.account.loginChangedReauthentication)
      }
    } catch {
      setStatus({ tone: 'error', text: settingsCopy.account.loginChangeFailed })
    } finally {
      setIsSaving(false)
    }
  }

  async function submitEmail(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!isValidEmailChange(newEmail, currentPassword)) return

    setIsSaving(true)
    setStatus(null)
    try {
      await requestAccountEmailChange(
        accessToken,
        newEmail.trim(),
        currentPassword,
      )
      setCurrentPassword('')
      setStatus({ tone: 'success', text: settingsCopy.account.emailChangeRequested })
    } catch {
      setStatus({ tone: 'error', text: settingsCopy.account.emailChangeFailed })
    } finally {
      setIsSaving(false)
    }
  }

  async function submitPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (
      !isValidPasswordChange(
        currentPassword,
        newPassword,
        confirmedPassword,
      )
    ) {
      setStatus({ tone: 'error', text: settingsCopy.account.passwordRequirements })
      return
    }

    setIsSaving(true)
    setStatus(null)
    try {
      await changeAccountPassword(accessToken, currentPassword, newPassword)
      onReauthenticationRequired(settingsCopy.account.passwordChangedReauthentication)
    } catch {
      setStatus({ tone: 'error', text: settingsCopy.account.passwordChangeFailed })
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className={styles.credentialList}>
      {editors.includes('login') && (
        <CredentialEditorRow
          label={settingsCopy.account.username}
          value={user.login}
          editor="login"
          isOpen={activeEditor === 'login'}
          onToggle={openEditor}
        >
          <form className={styles.credentialForm} onSubmit={submitLogin}>
          <CredentialInput
            label={settingsCopy.account.newLogin}
            name="newLogin"
            autoComplete="username"
            value={newLogin}
            onChange={setNewLogin}
          />
          <CredentialInput
            label={settingsCopy.account.currentPassword}
            name="currentPasswordForLogin"
            type="password"
            autoComplete="current-password"
            value={currentPassword}
            onChange={setCurrentPassword}
          />
          <CredentialActions
            disabled={!isValidLoginChange(newLogin, currentPassword)}
            isSaving={isSaving}
            onCancel={closeEditor}
          />
          <CredentialStatus status={status} />
          </form>
        </CredentialEditorRow>
      )}

      {editors.includes('email') && (
        <CredentialEditorRow
          label={settingsCopy.account.email}
          value={user.email}
          editor="email"
          isOpen={activeEditor === 'email'}
          onToggle={openEditor}
        >
          <form className={styles.credentialForm} onSubmit={submitEmail}>
          <CredentialInput
            label={settingsCopy.account.newEmail}
            name="newEmail"
            type="email"
            autoComplete="email"
            value={newEmail}
            onChange={setNewEmail}
          />
          <CredentialInput
            label={settingsCopy.account.currentPassword}
            name="currentPasswordForEmail"
            type="password"
            autoComplete="current-password"
            value={currentPassword}
            onChange={setCurrentPassword}
          />
          <CredentialActions
            disabled={!isValidEmailChange(newEmail, currentPassword)}
            isSaving={isSaving}
            onCancel={closeEditor}
          />
          <CredentialStatus status={status} />
          </form>
        </CredentialEditorRow>
      )}

      {editors.includes('password') && (
        <CredentialEditorRow
          label={settingsCopy.account.password}
          value="********"
          editor="password"
          isOpen={activeEditor === 'password'}
          onToggle={openEditor}
        >
          <form className={styles.credentialForm} onSubmit={submitPassword}>
          <CredentialInput
            label={settingsCopy.account.currentPassword}
            name="currentPasswordForPassword"
            type="password"
            autoComplete="current-password"
            value={currentPassword}
            onChange={setCurrentPassword}
          />
          <CredentialInput
            label={settingsCopy.account.newPassword}
            name="newPassword"
            type="password"
            autoComplete="new-password"
            value={newPassword}
            onChange={setNewPassword}
          />
          <CredentialInput
            label={settingsCopy.account.confirmNewPassword}
            name="confirmNewPassword"
            type="password"
            autoComplete="new-password"
            value={confirmedPassword}
            onChange={setConfirmedPassword}
          />
          <p className={styles.credentialHint}>
            {settingsCopy.account.passwordRequirements}
          </p>
          <CredentialActions
            disabled={
              !isValidPasswordChange(
                currentPassword,
                newPassword,
                confirmedPassword,
              )
            }
            isSaving={isSaving}
            onCancel={closeEditor}
          />
          <CredentialStatus status={status} />
          </form>
        </CredentialEditorRow>
      )}
    </div>
  )
}

function CredentialEditorRow({
  label,
  value,
  editor,
  isOpen,
  onToggle,
  children,
}: {
  label: string
  value: string
  editor: AccountCredentialEditor
  isOpen: boolean
  onToggle: (editor: AccountCredentialEditor) => void
  children: ReactNode
}) {
  return (
    <div className={styles.credentialRow}>
      <div className={styles.credentialSummary}>
        <span>{label}</span>
        <strong>{value}</strong>
        <button type="button" aria-expanded={isOpen} onClick={() => onToggle(editor)}>
          {isOpen ? settingsCopy.account.cancelChange : settingsCopy.account.change}
        </button>
      </div>
      <div
        className={`${styles.credentialDisclosure} ${
          isOpen ? styles.credentialDisclosureOpen : ''
        }`}
        aria-hidden={!isOpen}
        inert={!isOpen ? true : undefined}
      >
        <div>{children}</div>
      </div>
    </div>
  )
}

function CredentialInput({
  label,
  name,
  type = 'text',
  autoComplete,
  value,
  onChange,
}: {
  label: string
  name: string
  type?: string
  autoComplete: string
  value: string
  onChange: (value: string) => void
}) {
  return (
    <label className={styles.credentialInput}>
      <span>{label}</span>
      <input
        name={name}
        type={type}
        autoComplete={autoComplete}
        required
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  )
}

function CredentialActions({
  disabled,
  isSaving,
  onCancel,
}: {
  disabled: boolean
  isSaving: boolean
  onCancel: () => void
}) {
  return (
    <div className={styles.credentialActions}>
      <button type="submit" disabled={disabled || isSaving}>
        {isSaving ? settingsCopy.account.savingChange : settingsCopy.account.saveChange}
      </button>
      <button type="button" disabled={isSaving} onClick={onCancel}>
        {settingsCopy.account.cancelChange}
      </button>
    </div>
  )
}

function CredentialStatus({ status }: { status: EditorStatus }) {
  if (!status) return null

  return (
    <p className={styles.credentialStatus} data-tone={status.tone} role={status.tone === 'error' ? 'alert' : 'status'}>
      {status.text}
    </p>
  )
}
