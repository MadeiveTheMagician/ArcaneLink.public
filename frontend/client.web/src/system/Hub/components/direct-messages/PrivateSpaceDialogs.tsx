import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { apiJson } from '../../../../shared/api/api'
import type {
  PrivateSpaceResponse,
  PublicUserProfileResponse,
  UserFriendResponse,
} from '../../../../shared/types'
import { commonCopy, communityCopy, PresenceName } from '../../../shared'
import { SystemCloseIcon } from '../../../shared/icons/components/SystemCloseIcon'
import { SystemIcon } from '../../../shared/icons/SystemIcon'
import { useDismissableLayer } from '../../../shared/hooks/useDismissableLayer'
import { PrivateSpaceAvatar, UserAvatar } from './DirectMessageAvatar'
import { getPrivateSpaceOtherMember } from './directMessageModel'
import styles from './PrivateSpaceDialogs.module.css'

type DialogShellProps = {
  title: string
  onClose: () => void
  children: ReactNode
  footer?: ReactNode
  wide?: boolean
}

export function DialogShell({
  title,
  onClose,
  children,
  footer,
  wide = false,
}: DialogShellProps) {
  const titleId = useId()
  const dialogRef = useRef<HTMLElement | null>(null)

  useDismissableLayer({
    isOpen: true,
    layerRef: dialogRef,
    onDismiss: onClose,
  })

  return (
    <div className={styles.overlay} role="presentation">
      <section
        ref={dialogRef}
        className={`${styles.dialog} ${wide ? styles.wide : ''}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <header>
          <h2 id={titleId}>{title}</h2>
          <button
            type="button"
            aria-label={commonCopy.actions.close}
            onClick={onClose}
          >
            <SystemCloseIcon size="medium" />
          </button>
        </header>
        <div className={styles.content}>{children}</div>
        {footer && <footer>{footer}</footer>}
      </section>
    </div>
  )
}

export function InvitePrivateSpaceMemberDialog({
  candidates,
  spaceKind,
  isLoadingCandidates,
  isSaving,
  onClose,
  onInvite,
}: {
  candidates: UserFriendResponse[]
  spaceKind: PrivateSpaceResponse['kind']
  isLoadingCandidates: boolean
  isSaving: boolean
  onClose: () => void
  onInvite: (userId: string) => Promise<PrivateSpaceResponse | null>
}) {
  const [pendingUserId, setPendingUserId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const isBusy = isSaving || pendingUserId !== null

  async function invite(userId: string) {
    if (isBusy) return

    setPendingUserId(userId)
    setError(null)

    try {
      const privateSpace = await onInvite(userId)
      if (!privateSpace) {
        setError(communityCopy.direct.addMemberFailed)
        return
      }

      onClose()
    } catch {
      setError(communityCopy.direct.addMemberFailed)
    } finally {
      setPendingUserId(null)
    }
  }

  return (
    <DialogShell
      title={communityCopy.direct.inviteParticipantTitle}
      onClose={onClose}
      wide
      footer={
        <button
          type="button"
          className={styles.secondary}
          disabled={isBusy}
          onClick={onClose}
        >
          {commonCopy.actions.close}
        </button>
      }
    >
      <p className={styles.hint}>
        {communityCopy.direct.inviteParticipantHint}
      </p>

      {spaceKind === 'direct' && (
        <p className={styles.warning}>
          {communityCopy.direct.inviteCreatesGroup}
        </p>
      )}

      {error && (
        <p className={styles.inviteError} role="alert">
          {error}
        </p>
      )}

      <div
        className={styles.peopleList}
        aria-busy={isLoadingCandidates || isBusy}
      >
        {isLoadingCandidates && candidates.length === 0 ? (
          <div className={styles.inviteLoading} role="status">
            <span aria-hidden="true" />
            {communityCopy.direct.inviteLoading}
          </div>
        ) : candidates.length === 0 ? (
          <p className={styles.empty}>{communityCopy.direct.inviteEmpty}</p>
        ) : (
          candidates.map((friend) => {
            const isPending = pendingUserId === friend.friendUserId

            return (
              <button
                key={friend.friendUserId}
                type="button"
                disabled={isBusy}
                aria-label={`${communityCopy.direct.invite}: ${friend.friend.displayName}`}
                onClick={() => void invite(friend.friendUserId)}
              >
                <UserAvatar
                  className={styles.avatar}
                  user={friend.friend}
                  title={friend.friend.displayName}
                />
                <span>
                  <PresenceName status={friend.friend.presenceStatus}>
                    <strong>{friend.friend.displayName}</strong>
                  </PresenceName>
                  <small>@{friend.friend.login}</small>
                </span>
                {isPending ? (
                  <span
                    className={styles.inviteRowSpinner}
                    aria-label={communityCopy.direct.inviteCreating}
                  />
                ) : (
                  <SystemIcon name="user-plus" size={17} />
                )}
              </button>
            )
          })
        )}
      </div>
    </DialogShell>
  )
}

export function CreatePrivateSpaceDialog({
  friends,
  isSaving,
  onClose,
  onCreate,
}: {
  friends: UserFriendResponse[]
  isSaving: boolean
  onClose: () => void
  onCreate: (memberUserIds: string[], title?: string | null) => Promise<void>
}) {
  const [selectedUserIds, setSelectedUserIds] = useState<Set<string>>(
    () => new Set(),
  )
  const [title, setTitle] = useState('')
  const isDirect = selectedUserIds.size === 1

  return (
    <DialogShell
      title={communityCopy.direct.createDialogTitle}
      onClose={onClose}
      footer={
        <>
          <button type="button" className={styles.secondary} onClick={onClose}>
            {commonCopy.actions.cancel}
          </button>
          <button
            type="button"
            className={styles.primary}
            disabled={isSaving}
            onClick={() =>
              void onCreate(
                [...selectedUserIds],
                isDirect ? null : title.trim() || null,
              )
            }
          >
            {isSaving
              ? communityCopy.direct.creating
              : isDirect
                ? communityCopy.direct.createDialogDirect
                : communityCopy.direct.createDialogGroup}
          </button>
        </>
      }
    >
      <p className={styles.hint}>{communityCopy.direct.createDialogHint}</p>
      {!isDirect && (
        <label className={styles.field}>
          <span>{communityCopy.direct.groupTitle}</span>
          <input
            value={title}
            maxLength={128}
            placeholder={communityCopy.direct.groupTitlePlaceholder}
            onChange={(event) => setTitle(event.target.value)}
          />
        </label>
      )}
      <div className={styles.peopleList}>
        {friends.length === 0 ? (
          <p className={styles.empty}>
            {communityCopy.direct.emptyFriendsCreateGroup}
          </p>
        ) : (
          friends.map((friend) => {
            const selected = selectedUserIds.has(friend.friendUserId)
            return (
              <button
                key={friend.friendUserId}
                type="button"
                className={selected ? styles.selectedPerson : ''}
                aria-pressed={selected}
                onClick={() =>
                  setSelectedUserIds((current) => {
                    const next = new Set(current)
                    if (next.has(friend.friendUserId)) {
                      next.delete(friend.friendUserId)
                    } else {
                      next.add(friend.friendUserId)
                    }
                    return next
                  })
                }
              >
                <UserAvatar
                  className={styles.avatar}
                  user={friend.friend}
                  title={friend.friend.displayName}
                />
                <span>
                  <PresenceName status={friend.friend.presenceStatus}>
                    <strong>{friend.friend.displayName}</strong>
                  </PresenceName>
                  <small>@{friend.friend.login}</small>
                </span>
                <SystemIcon
                  name={selected ? 'check' : 'plus'}
                  size={17}
                />
              </button>
            )
          })
        )}
      </div>
    </DialogShell>
  )
}

export function PrivateSpaceTextSettingDialog({
  title,
  label,
  initialValue,
  placeholder,
  maxLength = 64,
  isSaving,
  onClose,
  onSave,
}: {
  title: string
  label: string
  initialValue: string | null
  placeholder: string
  maxLength?: number
  isSaving: boolean
  onClose: () => void
  onSave: (value: string | null) => Promise<void>
}) {
  const [value, setValue] = useState(initialValue ?? '')

  return (
    <DialogShell
      title={title}
      onClose={onClose}
      footer={
        <>
          <button type="button" className={styles.secondary} onClick={onClose}>
            {commonCopy.actions.cancel}
          </button>
          <button
            type="button"
            className={styles.primary}
            disabled={isSaving}
            onClick={() => void onSave(value.trim() || null)}
          >
            {commonCopy.actions.save}
          </button>
        </>
      }
    >
      <label className={styles.field}>
        <span>{label}</span>
        <input
          autoFocus
          value={value}
          maxLength={maxLength}
          placeholder={placeholder}
          onChange={(event) => setValue(event.target.value)}
        />
        <small>
          {value.length}/{maxLength}
        </small>
      </label>
    </DialogShell>
  )
}

export function GroupPrivateSpaceSettingsDialog({
  space,
  isSaving,
  onClose,
  onSave,
}: {
  space: PrivateSpaceResponse
  isSaving: boolean
  onClose: () => void
  onSave: (value: {
    title: string
    description: string
    avatarFile: File | null
    clearAvatar: boolean
  }) => Promise<void>
}) {
  const [title, setTitle] = useState(space.title ?? '')
  const [description, setDescription] = useState(space.description ?? '')
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const [clearAvatar, setClearAvatar] = useState(false)

  return (
    <DialogShell
      title={communityCopy.direct.groupSettings}
      onClose={onClose}
      footer={
        <>
          <button type="button" className={styles.secondary} onClick={onClose}>
            {commonCopy.actions.cancel}
          </button>
          <button
            type="button"
            className={styles.primary}
            disabled={isSaving}
            onClick={() =>
              void onSave({
                title,
                description,
                avatarFile,
                clearAvatar,
              })
            }
          >
            {isSaving ? commonCopy.status.saving : commonCopy.actions.save}
          </button>
        </>
      }
    >
      <div className={styles.avatarEditor}>
        <PrivateSpaceAvatar
          className={styles.largeAvatar}
          space={space}
          currentUserId={space.ownerUserId}
          title={space.title ?? communityCopy.direct.groupAvatarFallback}
        />
        <label className={styles.fileButton}>
          <SystemIcon name="plus" size={15} />
          {communityCopy.direct.chooseGroupAvatar}
          <input
            type="file"
            accept="image/*"
            onChange={(event) => {
              setAvatarFile(event.target.files?.[0] ?? null)
              setClearAvatar(false)
            }}
          />
        </label>
        {(space.avatarAssetId || avatarFile) && (
          <button
            type="button"
            className={styles.linkButton}
            onClick={() => {
              setAvatarFile(null)
              setClearAvatar(true)
            }}
          >
            {communityCopy.direct.removeGroupAvatar}
          </button>
        )}
      </div>
      <label className={styles.field}>
        <span>{communityCopy.direct.groupName}</span>
        <input
          value={title}
          maxLength={128}
          onChange={(event) => setTitle(event.target.value)}
        />
      </label>
      <label className={styles.field}>
        <span>{communityCopy.direct.groupDescription}</span>
        <textarea
          value={description}
          maxLength={512}
          rows={4}
          onChange={(event) => setDescription(event.target.value)}
        />
      </label>
    </DialogShell>
  )
}

export function DirectUserProfileDialog({
  accessToken,
  currentUserId,
  space,
  onClose,
}: {
  accessToken: string
  currentUserId: string
  space: PrivateSpaceResponse
  onClose: () => void
}) {
  const member = getPrivateSpaceOtherMember(space, currentUserId)
  const targetUserId = member?.userId ?? null
  const [profile, setProfile] =
    useState<PublicUserProfileResponse | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [reloadVersion, setReloadVersion] = useState(0)

  useEffect(() => {
    if (!targetUserId) {
      setProfile(null)
      setIsLoading(false)
      setLoadError(communityCopy.direct.userUnavailable)
      return undefined
    }

    const request = new AbortController()
    let isCurrent = true

    setProfile(null)
    setIsLoading(true)
    setLoadError(null)

    apiJson<PublicUserProfileResponse>(
      `/api/users/${encodeURIComponent(targetUserId)}`,
      {
        accessToken,
        signal: request.signal,
      },
    )
      .then((loadedProfile) => {
        if (isCurrent) {
          setProfile(loadedProfile)
        }
      })
      .catch(() => {
        if (isCurrent && !request.signal.aborted) {
          setLoadError(communityCopy.direct.userProfileLoadFailed)
        }
      })
      .finally(() => {
        if (isCurrent) {
          setIsLoading(false)
        }
      })

    return () => {
      isCurrent = false
      request.abort()
    }
  }, [accessToken, reloadVersion, targetUserId])

  if (!member) return null

  const fallbackUser = member.user
  const displayName = profile?.displayName || fallbackUser.displayName
  const login = profile?.login || fallbackUser.login
  const presenceStatus =
    profile?.presenceStatus ?? fallbackUser.presenceStatus
  const avatarAssetId =
    profile?.avatarAssetId ?? fallbackUser.avatarAssetId
  const avatarCropOffsetX =
    profile?.avatarCropOffsetX ?? fallbackUser.avatarCropOffsetX
  const avatarCropOffsetY =
    profile?.avatarCropOffsetY ?? fallbackUser.avatarCropOffsetY
  const avatarCropZoom =
    profile?.avatarCropZoom ?? fallbackUser.avatarCropZoom

  return (
    <DialogShell
      title={communityCopy.direct.userProfileTitle}
      onClose={onClose}
      wide
    >
      <div className={styles.profileHero}>
        <span
          className={`${styles.profileAvatar} ui-frame`}
          aria-hidden="true"
        >
          {avatarAssetId ? (
            <img
              className="ui-media-fit"
              src={`/api/assets/${avatarAssetId}/content`}
              alt=""
              style={{
                transform: `translate(${avatarCropOffsetX * 100}%, ${
                  avatarCropOffsetY * 100
                }%) scale(${avatarCropZoom})`,
              }}
            />
          ) : (
            displayName.slice(0, 1).toUpperCase()
          )}
        </span>
        <div>
          <PresenceName status={presenceStatus}>
            <h3>{displayName}</h3>
          </PresenceName>
          <p>@{login}</p>
        </div>
      </div>

      {isLoading ? (
        <div
          className={styles.profileLoadState}
          aria-live="polite"
          aria-busy="true"
        >
          <span className={styles.profileSpinner} aria-hidden="true" />
          {communityCopy.direct.userProfileLoading}
        </div>
      ) : loadError || !profile ? (
        <div
          className={`${styles.profileLoadState} ${styles.profileLoadError}`}
          role="alert"
        >
          <span>
            {loadError || communityCopy.direct.userProfileLoadFailed}
          </span>
          <button
            type="button"
            onClick={() => setReloadVersion((current) => current + 1)}
          >
            {commonCopy.actions.retry}
          </button>
        </div>
      ) : (
        <>
          {profile.bio?.trim() && (
            <p className={styles.profileBio}>{profile.bio.trim()}</p>
          )}

          <dl className={styles.profileFacts}>
            <div>
              <dt>{communityCopy.direct.userProfileSubscription}</dt>
              <dd>
                {profile.subscriptionType?.title ||
                  commonCopy.empty.notSpecified}
              </dd>
            </div>
            <div>
              <dt>{communityCopy.direct.userProfileMemberSince}</dt>
              <dd>{formatProfileDate(profile.createdAt)}</dd>
            </div>
          </dl>

          {profile.websiteUrl?.trim() && (
            <a
              className={styles.profileWebsite}
              href={profile.websiteUrl}
              target="_blank"
              rel="noreferrer"
            >
              {profile.websiteUrl}
            </a>
          )}

          {profile.tags.length > 0 && (
            <div
              className={styles.profileTags}
              aria-label={communityCopy.direct.userProfileTags}
            >
              {profile.tags.map((tag) => (
                <span key={tag.id}>{tag.title}</span>
              ))}
            </div>
          )}
        </>
      )}
    </DialogShell>
  )
}

const profileDateFormatter = new Intl.DateTimeFormat('ru-RU', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
})

function formatProfileDate(value: string) {
  const timestamp = Date.parse(value)

  return Number.isFinite(timestamp)
    ? profileDateFormatter.format(timestamp)
    : commonCopy.empty.notSpecified
}

export function MarkAllPrivateSpacesReadDialog({
  isSaving,
  onClose,
  onConfirm,
}: {
  isSaving: boolean
  onClose: () => void
  onConfirm: () => Promise<void>
}) {
  return (
    <DialogShell
      title={communityCopy.direct.markAllReadTitle}
      onClose={onClose}
      footer={
        <>
          <button type="button" className={styles.secondary} onClick={onClose}>
            {commonCopy.actions.cancel}
          </button>
          <button
            type="button"
            className={styles.primary}
            disabled={isSaving}
            onClick={() => void onConfirm()}
          >
            {isSaving
              ? communityCopy.direct.markingRead
              : commonCopy.actions.confirm}
          </button>
        </>
      }
    >
      <p className={styles.warning}>
        {communityCopy.direct.markAllReadDescription}
      </p>
    </DialogShell>
  )
}

export type PrivateSpaceAction =
  | 'clear-history'
  | 'leave-group'
  | 'delete-direct'

export function PrivateSpaceActionDialog({
  action,
  isSaving,
  onClose,
  onConfirm,
}: {
  action: PrivateSpaceAction
  isSaving: boolean
  onClose: () => void
  onConfirm: () => Promise<void>
}) {
  const content =
    action === 'clear-history'
      ? {
          title: communityCopy.direct.clearHistoryTitle,
          description: communityCopy.direct.clearHistoryDescription,
          confirm: communityCopy.direct.clearHistory,
        }
      : action === 'leave-group'
        ? {
            title: communityCopy.direct.leaveGroupTitle,
            description: communityCopy.direct.leaveGroupDescription,
            confirm: communityCopy.direct.leaveGroup,
          }
        : {
            title: communityCopy.direct.deleteDirectTitle,
            description: communityCopy.direct.deleteDirectDescription,
            confirm: communityCopy.direct.deleteDirect,
          }

  return (
    <DialogShell
      title={content.title}
      onClose={onClose}
      footer={
        <>
          <button
            type="button"
            className={styles.secondary}
            disabled={isSaving}
            onClick={onClose}
          >
            {commonCopy.actions.cancel}
          </button>
          <button
            type="button"
            className={styles.danger}
            disabled={isSaving}
            onClick={() => void onConfirm()}
          >
            {isSaving ? commonCopy.status.processing : content.confirm}
          </button>
        </>
      }
    >
      <p className={styles.warning}>{content.description}</p>
    </DialogShell>
  )
}
