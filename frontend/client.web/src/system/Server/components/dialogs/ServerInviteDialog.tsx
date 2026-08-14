import {
  type CSSProperties,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { createPortal } from 'react-dom'
import type {
  CreateServerInviteRequest,
  ServerInviteResponse,
  ServerResponse,
  UserFriendResponse,
} from '../../../../shared/types'
import {
  SystemButton,
  SystemSearchInput,
  SystemSelect,
  SystemTabPanel,
  SystemTabs,
} from '../../../shared'
import { serverCopy } from '../../../shared/copy/index'
import { useAnimatedOverlayClose } from '../../../shared/hooks/useAnimatedOverlayClose'
import { useDismissableLayer } from '../../../shared/hooks/useDismissableLayer'
import { SystemCloseIcon } from '../../../shared/icons/components/SystemCloseIcon'
import dialogStyles from '../../../shared/styles/Dialog.module.css'
import styles from './ServerInviteDialog.module.css'

type ServerInviteDialogProps = {
  server: ServerResponse
  invites: ServerInviteResponse[]
  friends: UserFriendResponse[]
  canInviteMembers: boolean
  isLoading: boolean
  loadError: string | null
  isMutating: boolean
  onCreateInvite: (
    request?: CreateServerInviteRequest,
  ) => Promise<ServerInviteResponse | null>
  onClose: () => void
}

type ServerInviteDialogTab = 'friends' | 'link'

type ServerInviteDialogNotice = {
  message: string
  tone: 'error' | 'status'
}

type ServerInviteDialogStyle = CSSProperties & {
  '--server-invite-close-duration': string
}

const serverInviteCloseDurationMs = 200
const serverInviteDialogStyle: ServerInviteDialogStyle = {
  '--server-invite-close-duration': String(serverInviteCloseDurationMs) + 'ms',
}

const modalFocusableSelector = [
  'a[href]:not([tabindex="-1"])',
  'button:not(:disabled)',
  'input:not(:disabled)',
  'select:not(:disabled)',
  '[tabindex]:not([tabindex="-1"])',
].join(',')

const expirationOptions = [
  { label: serverCopy.invites.expirationOptions.never, value: 'never', milliseconds: null },
  { label: serverCopy.invites.expirationOptions.minutes30, value: '30m', milliseconds: 30 * 60 * 1000 },
  { label: serverCopy.invites.expirationOptions.hours1, value: '1h', milliseconds: 60 * 60 * 1000 },
  { label: serverCopy.invites.expirationOptions.hours6, value: '6h', milliseconds: 6 * 60 * 60 * 1000 },
  { label: serverCopy.invites.expirationOptions.day1, value: '1d', milliseconds: 24 * 60 * 60 * 1000 },
  { label: serverCopy.invites.expirationOptions.days7, value: '7d', milliseconds: 7 * 24 * 60 * 60 * 1000 },
  { label: serverCopy.invites.expirationOptions.days30, value: '30d', milliseconds: 30 * 24 * 60 * 60 * 1000 },
]

const maxUseOptions = [
  { label: serverCopy.invites.maxUsesOptions.unlimited, value: 'unlimited', maxUses: null },
  { label: serverCopy.invites.maxUsesOptions.use1, value: '1', maxUses: 1 },
  { label: serverCopy.invites.maxUsesOptions.uses5, value: '5', maxUses: 5 },
  { label: serverCopy.invites.maxUsesOptions.uses10, value: '10', maxUses: 10 },
  { label: serverCopy.invites.maxUsesOptions.uses25, value: '25', maxUses: 25 },
  { label: serverCopy.invites.maxUsesOptions.uses50, value: '50', maxUses: 50 },
  { label: serverCopy.invites.maxUsesOptions.uses100, value: '100', maxUses: 100 },
]

function createExpiresAt(value: string) {
  const option = expirationOptions.find((item) => item.value === value)
  if (!option?.milliseconds) {
    return null
  }

  return new Date(Date.now() + option.milliseconds).toISOString()
}

function buildInviteUrl(code: string | null) {
  if (!code) {
    return ''
  }

  return window.location.origin + '/invite/' + code
}

export function ServerInviteDialog({
  server,
  invites,
  friends,
  canInviteMembers,
  isLoading,
  loadError,
  isMutating,
  onCreateInvite,
  onClose,
}: ServerInviteDialogProps) {
  const [activeTab, setActiveTab] =
    useState<ServerInviteDialogTab>('friends')
  const [search, setSearch] = useState('')
  const [expiration, setExpiration] = useState('30d')
  const [maxUses, setMaxUses] = useState('unlimited')
  const [notice, setNotice] = useState<ServerInviteDialogNotice | null>(null)
  const inviteDialogRef = useRef<HTMLElement | null>(null)
  const closeButtonRef = useRef<HTMLButtonElement | null>(null)
  const { isClosing, requestClose } = useAnimatedOverlayClose(
    serverInviteCloseDurationMs,
  )
  const closeDialog = useCallback(() => {
    requestClose(onClose)
  }, [onClose, requestClose])

  useDismissableLayer({
    isOpen: !isClosing,
    layerRef: inviteDialogRef,
    onDismiss: closeDialog,
  })

  useEffect(() => {
    const previouslyFocusedElement =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null
    const focusFrame = window.requestAnimationFrame(() => {
      closeButtonRef.current?.focus()
    })

    function keepFocusInsideDialog(event: KeyboardEvent) {
      if (event.key !== 'Tab') return

      const dialog = inviteDialogRef.current
      if (!dialog) return

      const focusableElements = Array.from(
        dialog.querySelectorAll<HTMLElement>(modalFocusableSelector),
      ).filter((element) => element.getClientRects().length > 0)
      const firstElement = focusableElements[0]
      const lastElement = focusableElements[focusableElements.length - 1]

      if (!firstElement || !lastElement) {
        event.preventDefault()
        dialog.focus()
        return
      }

      const activeElement = document.activeElement
      if (
        event.shiftKey &&
        (activeElement === firstElement || !dialog.contains(activeElement))
      ) {
        event.preventDefault()
        lastElement.focus()
        return
      }

      if (
        !event.shiftKey &&
        (activeElement === lastElement || !dialog.contains(activeElement))
      ) {
        event.preventDefault()
        firstElement.focus()
      }
    }

    document.addEventListener('keydown', keepFocusInsideDialog)
    return () => {
      window.cancelAnimationFrame(focusFrame)
      document.removeEventListener('keydown', keepFocusInsideDialog)
      if (previouslyFocusedElement?.isConnected) {
        previouslyFocusedElement.focus()
      }
    }
  }, [])

  const activeLinkInvite = useMemo(
    () =>
      invites.find(
        (invite) =>
          invite.kindCode === 'link' && invite.isActive && Boolean(invite.code),
      ) ?? null,
    [invites],
  )
  const inviteUrl = buildInviteUrl(activeLinkInvite?.code ?? null)
  const maxUseOption = maxUseOptions.find((item) => item.value === maxUses)
  const filteredFriends = useMemo(() => {
    const normalizedSearch = search.trim().toUpperCase()

    return friends.filter((friend) => {
      if (!normalizedSearch) {
        return true
      }

      return (
        friend.friend.displayName.toUpperCase().includes(normalizedSearch) ||
        friend.friend.login.toUpperCase().includes(normalizedSearch)
      )
    })
  }, [friends, search])

  function handleTabChange(value: ServerInviteDialogTab) {
    setActiveTab(value)
    setNotice(null)
  }

  async function handleCopyInvite() {
    if (!inviteUrl) {
      return
    }

    setNotice(null)

    try {
      if (!navigator.clipboard?.writeText) {
        throw new Error('Clipboard API is unavailable')
      }

      await navigator.clipboard.writeText(inviteUrl)
      setNotice({
        message: serverCopy.invites.copied,
        tone: 'status',
      })
    } catch {
      setNotice({
        message: serverCopy.invites.copyFailed,
        tone: 'error',
      })
    }
  }

  async function handleCreateInvite() {
    if (!canInviteMembers) {
      return
    }

    setNotice(null)

    try {
      await onCreateInvite({
        kindCode: 'link',
        expiresAt: createExpiresAt(expiration),
        maxUses: maxUseOption?.maxUses ?? null,
      })
      setNotice({
        message: serverCopy.invites.created,
        tone: 'status',
      })
    } catch {
      setNotice({
        message: serverCopy.invites.createFailed,
        tone: 'error',
      })
    }
  }

  async function handleCreateDirectInvite(targetUserId: string) {
    if (!canInviteMembers) {
      return
    }

    setNotice(null)

    try {
      await onCreateInvite({
        kindCode: 'direct',
        targetUserId,
      })
      setNotice({
        message: serverCopy.invites.directCreated,
        tone: 'status',
      })
    } catch {
      setNotice({
        message: serverCopy.invites.directFailed,
        tone: 'error',
      })
    }
  }

  return createPortal(
    <div
      className={[
        dialogStyles.backdrop,
        styles.backdrop,
        isClosing ? styles.backdropClosing : '',
      ].filter(Boolean).join(' ')}
      data-state={isClosing ? 'closing' : 'open'}
      role="presentation"
      style={serverInviteDialogStyle}
    >
      <section
        ref={inviteDialogRef}
        className={[
          dialogStyles.dialog,
          styles.dialog,
          isClosing ? styles.dialogClosing : '',
        ].filter(Boolean).join(' ')}
        role="dialog"
        aria-busy={isLoading || isMutating}
        aria-modal="true"
        aria-labelledby="server-invite-title"
        tabIndex={-1}
      >
        <header className={styles.heading}>
          <div>
            <h2 id="server-invite-title">
              {serverCopy.invites.inviteMembersTitle(server.title)}
            </h2>
            <p>{getServerInviteDescription(server.accessMode)}</p>
          </div>
          <button
            ref={closeButtonRef}
            className={styles.closeButton}
            type="button"
            onClick={closeDialog}
            disabled={isClosing}
            aria-label={serverCopy.invites.close}
          >
            <SystemCloseIcon size="medium" />
          </button>
        </header>

        <SystemTabs
          className={styles.tabs}
          idBase="server-invite"
          label={serverCopy.invites.tabsAria}
          onChange={handleTabChange}
          options={[
            {
              badge: friends.length,
              disabled: isClosing,
              label: serverCopy.invites.friendsTab,
              value: 'friends',
            },
            {
              disabled: isClosing,
              label: serverCopy.invites.linkTab,
              value: 'link',
            },
          ]}
          value={activeTab}
        />

        <SystemTabPanel
          className={styles.tabPanel}
          idBase="server-invite"
          value={activeTab}
        >
          {activeTab === 'friends' ? (
            <div className={styles.friendsTab}>
              <div className={styles.friendsToolbar}>
                {!canInviteMembers && (
                  <div className={styles.warning}>
                    {serverCopy.invites.notAllowed}
                  </div>
                )}
                <SystemSearchInput
                  className={styles.search}
                  name="friendSearch"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder={serverCopy.invites.searchFriends}
                  aria-label={serverCopy.invites.searchFriends}
                  autoComplete="off"
                />
                {notice && (
                  <p
                    className={[
                      styles.status,
                      notice.tone === 'error' ? styles.statusError : '',
                    ].filter(Boolean).join(' ')}
                    role={notice.tone === 'error' ? 'alert' : 'status'}
                  >
                    {notice.message}
                  </p>
                )}
              </div>

              <div
                className={`${styles.friends} ui-scroll-list`}
                role="list"
                aria-label={serverCopy.invites.friendsListAria}
                aria-busy={isMutating}
                aria-live="polite"
              >
                {filteredFriends.length > 0 ? (
                  filteredFriends.map((friend) => (
                    <article
                      key={friend.friendUserId}
                      className={`${styles.friend} ui-list-row`}
                      role="listitem"
                    >
                      <div className={styles.friendIdentity}>
                        <strong>{friend.friend.displayName}</strong>
                        <span>@{friend.friend.login}</span>
                      </div>
                      <SystemButton
                        className={styles.inviteButton}
                        size="small"
                        type="button"
                        disabled={
                          !canInviteMembers || isMutating || isClosing
                        }
                        onClick={() =>
                          void handleCreateDirectInvite(friend.friendUserId)
                        }
                        aria-label={
                          serverCopy.invites.inviteFriend +
                          ': ' +
                          friend.friend.displayName
                        }
                      >
                        {serverCopy.invites.inviteFriend}
                      </SystemButton>
                    </article>
                  ))
                ) : (
                  <div className={styles.empty}>
                    <strong>
                      {friends.length === 0
                        ? serverCopy.invites.emptyFriendsTitle
                        : serverCopy.invites.searchMissTitle}
                    </strong>
                    <span>
                      {friends.length === 0
                        ? serverCopy.invites.emptyFriendsHint
                        : serverCopy.invites.searchMissHint}
                    </span>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className={styles.linkTab}>
              {!canInviteMembers && (
                <div className={styles.warning}>
                  {serverCopy.invites.notAllowed}
                </div>
              )}

              {loadError && !isLoading && (
                <div className={styles.loadError} role="alert">
                  <strong>{serverCopy.invites.loadFailedTitle}</strong>
                  <span>{loadError}</span>
                </div>
              )}

              <section className={styles.linkCard}>
                <div className={styles.linkSummary}>
                  <strong>{serverCopy.invites.linkPanelTitle}</strong>
                  <span>
                    {isLoading
                      ? serverCopy.invites.linkLoading
                      : loadError
                        ? serverCopy.invites.linkUnavailable
                        : activeLinkInvite?.expiresAt
                        ? serverCopy.invites.expiresAt(
                            new Intl.DateTimeFormat('ru-RU').format(
                              new Date(activeLinkInvite.expiresAt),
                            ),
                          )
                        : activeLinkInvite
                          ? serverCopy.invites.linkWithoutExpiration
                          : serverCopy.invites.linkEmptyHint}
                    {!isLoading && !loadError && activeLinkInvite?.maxUses
                      ? serverCopy.invites.useCount(
                          activeLinkInvite.usedCount,
                          activeLinkInvite.maxUses,
                        )
                      : ''}
                  </span>
                </div>

                <div className={styles.linkRow}>
                  <input
                    className={['ui-field-control', styles.linkInput].join(' ')}
                    name="inviteUrl"
                    readOnly
                    value={
                      isLoading
                        ? serverCopy.invites.linkLoading
                        : loadError
                          ? serverCopy.invites.linkUnavailable
                          : inviteUrl || serverCopy.invites.linkEmpty
                    }
                    aria-label={serverCopy.invites.linkPanelTitle}
                    aria-invalid={Boolean(loadError)}
                  />
                  <SystemButton
                    size="medium"
                    variant="ghost"
                    type="button"
                    onClick={() => void handleCopyInvite()}
                    disabled={
                      !inviteUrl ||
                      isLoading ||
                      Boolean(loadError) ||
                      !canInviteMembers ||
                      isMutating ||
                      isClosing
                    }
                  >
                    {serverCopy.invites.copy}
                  </SystemButton>
                </div>
              </section>

              <section
                className={styles.linkSettings}
                aria-labelledby="server-invite-link-settings-title"
              >
                <header className={styles.linkSettingsHeading}>
                  <h3 id="server-invite-link-settings-title">
                    {serverCopy.invites.linkSettingsTitle}
                  </h3>
                  <p>{serverCopy.invites.linkTabDescription}</p>
                </header>

                <div className={styles.linkSettingsGrid}>
                  <label className={styles.field}>
                    <span>{serverCopy.invites.expirationLabel}</span>
                    <SystemSelect
                      name="inviteExpiration"
                      value={expiration}
                      onChange={(event) => setExpiration(event.target.value)}
                      disabled={
                        isLoading ||
                        !canInviteMembers ||
                        isMutating ||
                        isClosing
                      }
                    >
                      {expirationOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </SystemSelect>
                  </label>

                  <label className={styles.field}>
                    <span>{serverCopy.invites.maxUsesLabel}</span>
                    <SystemSelect
                      name="inviteMaxUses"
                      value={maxUses}
                      onChange={(event) => setMaxUses(event.target.value)}
                      disabled={
                        isLoading ||
                        !canInviteMembers ||
                        isMutating ||
                        isClosing
                      }
                    >
                      {maxUseOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </SystemSelect>
                  </label>
                </div>

                <SystemButton
                  className={styles.createLinkButton}
                  fullWidth
                  size="large"
                  type="button"
                  onClick={() => void handleCreateInvite()}
                  disabled={
                    isLoading ||
                    isMutating ||
                    !canInviteMembers ||
                    isClosing
                  }
                >
                  {serverCopy.invites.submitNewLink}
                </SystemButton>
              </section>

              {notice && (
                <p
                  className={[
                    styles.status,
                    notice.tone === 'error' ? styles.statusError : '',
                  ].filter(Boolean).join(' ')}
                  role={notice.tone === 'error' ? 'alert' : 'status'}
                >
                  {notice.message}
                </p>
              )}
            </div>
          )}
        </SystemTabPanel>
      </section>
    </div>,
    document.body,
  )
}

function getServerInviteDescription(
  accessMode: ServerResponse['accessMode'],
) {
  if (accessMode === 'public') {
    return serverCopy.invites.publicServerDescription
  }

  if (accessMode === 'restricted') {
    return serverCopy.invites.restrictedServerDescription
  }

  return serverCopy.invites.privateServerDescription
}
