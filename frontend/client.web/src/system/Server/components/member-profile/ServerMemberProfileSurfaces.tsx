import {
  useEffect,
  useId,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from 'react'
import { createPortal } from 'react-dom'
import type {
  ServerMemberDetailsResponse,
  ServerMemberProfileMutualFriendResponse,
  ServerMemberProfileMutualServerResponse,
  ServerMemberViewerProfileResponse,
} from '../../../../shared/types'
import { PresenceDot } from '../../../shared'
import { SystemCloseIcon } from '../../../shared/icons/components/SystemCloseIcon'
import { SystemIcon } from '../../../shared/icons/SystemIcon'
import { useDismissableLayer } from '../../../shared/hooks/useDismissableLayer'
import {
  buildServerMemberProfileStyle,
  formatServerMemberJoinedAt,
  isServerMemberProfileOwnedByViewer,
  isServerMemberMutualListTruncated,
  resolveCompactProfilePosition,
  resolveServerMemberMutualTabKey,
  type ServerMemberProfileAnchor,
  type ServerMemberProfileViewerTheme,
  type ServerMemberMutualTab,
} from './serverMemberProfileModel'
import { serverMemberProfileCopy as copy } from './serverMemberProfile.ru'
import { useBodyModalInert } from './useBodyModalInert'
import styles from './ServerMemberProfileSurfaces.module.css'

const modalFocusableSelector = [
  'a[href]:not([tabindex="-1"])',
  'button:not(:disabled)',
  'input:not(:disabled)',
  'select:not(:disabled)',
  'textarea:not(:disabled)',
  '[tabindex]:not([tabindex="-1"])',
].join(',')

type ServerMemberProfileSurfaceProps = {
  currentUserId: string
  member: ServerMemberDetailsResponse
  profile: ServerMemberViewerProfileResponse | null
  viewerTheme: ServerMemberProfileViewerTheme
  isLoading: boolean
  error: string | null
  onRetry: () => void
  onClose: () => void
}

export function ServerMemberCompactProfile({
  anchor,
  onOpenFull,
  ...props
}: ServerMemberProfileSurfaceProps & {
  anchor: ServerMemberProfileAnchor
  onOpenFull: () => void
}) {
  const cardRef = useRef<HTMLElement | null>(null)
  const closeProfile = props.onClose
  const position = resolveCompactProfilePosition(anchor, {
    width: typeof window === 'undefined' ? 1280 : window.innerWidth,
    height: typeof window === 'undefined' ? 720 : window.innerHeight,
  })
  const isOwnProfile = isServerMemberProfileOwnedByViewer(
    props.currentUserId,
    props.profile?.userId ?? props.member.userId,
  )
  useDismissableLayer({
    isOpen: true,
    layerRef: cardRef,
    onDismiss: closeProfile,
  })

  useEffect(() => {
    const closeFromResize = () => closeProfile()
    const closeFromExternalScroll = (event: Event) => {
      if (
        event.target instanceof Node &&
        cardRef.current?.contains(event.target)
      ) {
        return
      }

      closeProfile()
    }

    window.addEventListener('resize', closeFromResize)
    window.addEventListener('scroll', closeFromExternalScroll, true)
    return () => {
      window.removeEventListener('resize', closeFromResize)
      window.removeEventListener('scroll', closeFromExternalScroll, true)
    }
  }, [closeProfile])

  return createPortal(
    <section
      ref={cardRef}
      className={styles.compactCard}
      style={{
        ...(props.profile
          ? buildServerMemberProfileStyle(props.profile, props.viewerTheme)
          : {}),
        ...position,
      }}
      aria-label={`${copy.labels.profile}: ${props.member.user.displayName}`}
    >
      <ProfileBanner profile={props.profile} />
      <button
        className={styles.openFullButton}
        type="button"
        aria-label={copy.actions.openFull}
        title={copy.actions.openFull}
        onClick={onOpenFull}
      >
        <SystemIcon name="eye" size={18} />
      </button>
      <ProfileIdentity member={props.member} profile={props.profile} compact />
      <ProfileLoadState {...props}>
        {props.profile ? (
          <div className={styles.compactContent}>
            <p className={styles.about}>
              {props.profile.about?.trim() || copy.state.noAbout}
            </p>
            <RoleList profile={props.profile} />
            {!isOwnProfile ? (
              <div className={styles.mutualSummary}>
                <span>
                  <SystemIcon name="friends" size={15} />
                  <strong>{props.profile.mutualFriendCount}</strong>
                  {copy.labels.mutualFriends.toLocaleLowerCase('ru-RU')}
                </span>
                <span>
                  <SystemIcon name="server" size={15} />
                  <strong>{props.profile.mutualServerCount}</strong>
                  {copy.labels.mutualServers.toLocaleLowerCase('ru-RU')}
                </span>
              </div>
            ) : null}
          </div>
        ) : null}
      </ProfileLoadState>
    </section>,
    document.body,
  )
}

export function ServerMemberFullProfile(
  props: ServerMemberProfileSurfaceProps,
) {
  const backdropRef = useRef<HTMLDivElement | null>(null)
  const dialogRef = useRef<HTMLElement | null>(null)
  const closeButtonRef = useRef<HTMLButtonElement | null>(null)
  const serverTabRef = useRef<HTMLButtonElement | null>(null)
  const friendTabRef = useRef<HTMLButtonElement | null>(null)
  const titleId = useId()
  const mutualTabsLabelId = useId()
  const serverTabId = useId()
  const friendTabId = useId()
  const serverPanelId = useId()
  const friendPanelId = useId()
  const [mutualTab, setMutualTab] = useState<ServerMemberMutualTab>('servers')
  const isOwnProfile = isServerMemberProfileOwnedByViewer(
    props.currentUserId,
    props.profile?.userId ?? props.member.userId,
  )

  useDismissableLayer({
    isOpen: true,
    layerRef: dialogRef,
    onDismiss: props.onClose,
  })
  useBodyModalInert(true, backdropRef)

  useEffect(() => {
    const focusFrame = window.requestAnimationFrame(() => {
      closeButtonRef.current?.focus({ preventScroll: true })
    })

    function keepFocusInsideDialog(event: KeyboardEvent) {
      if (event.key !== 'Tab') return

      const dialog = dialogRef.current
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
      } else if (
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
    }
  }, [])

  useEffect(() => {
    setMutualTab('servers')
  }, [props.member.userId])

  function handleMutualTabKeyDown(
    event: ReactKeyboardEvent<HTMLButtonElement>,
    currentTab: ServerMemberMutualTab,
  ) {
    const nextTab = resolveServerMemberMutualTabKey(currentTab, event.key)
    if (!nextTab) return

    event.preventDefault()
    setMutualTab(nextTab)
    const nextTabRef = nextTab === 'servers' ? serverTabRef : friendTabRef
    nextTabRef.current?.focus()
  }

  return createPortal(
    <div ref={backdropRef} className={styles.fullBackdrop}>
      <section
        ref={dialogRef}
        className={styles.fullDialog}
        style={props.profile
          ? buildServerMemberProfileStyle(props.profile, props.viewerTheme)
          : undefined}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
      >
        <header className={styles.dialogHeader}>
          <span>
            <small>{copy.labels.profile}</small>
            <strong id={titleId}>
              {props.member.user.displayName}
            </strong>
          </span>
          <button
            ref={closeButtonRef}
            className={styles.dialogCloseButton}
            type="button"
            aria-label={copy.actions.close}
            onClick={props.onClose}
          >
            <SystemCloseIcon size="medium" />
          </button>
        </header>

        <div
          className={`${styles.fullLayout} ${
            isOwnProfile ? styles.fullLayoutOwnProfile : ''
          }`}
        >
          <main className={styles.fullProfile}>
            <ProfileBanner profile={props.profile} large />
            <ProfileIdentity member={props.member} profile={props.profile} />
            <ProfileLoadState {...props}>
              {props.profile ? (
                <div className={styles.fullProfileContent}>
                  <section className={styles.profileSection}>
                    <h2>{copy.labels.about}</h2>
                    <p className={styles.about}>
                      {props.profile.about?.trim() || copy.state.noAbout}
                    </p>
                  </section>
                  <section className={styles.profileSection}>
                    <h2>{copy.labels.roles}</h2>
                    <RoleList profile={props.profile} />
                  </section>
                  <dl className={styles.profileFacts}>
                    <div>
                      <dt>{copy.labels.login}</dt>
                      <dd>@{props.profile.login}</dd>
                    </div>
                    <div>
                      <dt>{copy.labels.joined}</dt>
                      <dd>{formatServerMemberJoinedAt(props.profile.joinedAt)}</dd>
                    </div>
                  </dl>
                </div>
              ) : null}
            </ProfileLoadState>
          </main>

          {!isOwnProfile ? (
            <aside
              className={styles.mutualPanel}
              aria-labelledby={mutualTabsLabelId}
            >
            <span id={mutualTabsLabelId} className={styles.visuallyHidden}>
              {copy.labels.mutualConnections}
            </span>
            <div
              className={styles.mutualTabs}
              role="tablist"
              aria-labelledby={mutualTabsLabelId}
            >
              <button
                ref={serverTabRef}
                id={serverTabId}
                type="button"
                role="tab"
                aria-selected={mutualTab === 'servers'}
                aria-controls={serverPanelId}
                tabIndex={mutualTab === 'servers' ? 0 : -1}
                onClick={() => setMutualTab('servers')}
                onKeyDown={(event) => handleMutualTabKeyDown(event, 'servers')}
              >
                {copy.labels.mutualServers}
                {props.profile ? <strong>{props.profile.mutualServerCount}</strong> : null}
              </button>
              <button
                ref={friendTabRef}
                id={friendTabId}
                type="button"
                role="tab"
                aria-selected={mutualTab === 'friends'}
                aria-controls={friendPanelId}
                tabIndex={mutualTab === 'friends' ? 0 : -1}
                onClick={() => setMutualTab('friends')}
                onKeyDown={(event) => handleMutualTabKeyDown(event, 'friends')}
              >
                {copy.labels.mutualFriends}
                {props.profile ? <strong>{props.profile.mutualFriendCount}</strong> : null}
              </button>
            </div>
            <div
              id={serverPanelId}
              className={styles.mutualTabPanel}
              role="tabpanel"
              aria-labelledby={serverTabId}
              hidden={mutualTab !== 'servers'}
              tabIndex={0}
            >
              {props.profile ? (
                <MutualServerList
                  items={props.profile.mutualServers}
                  totalCount={props.profile.mutualServerCount}
                />
              ) : (
                <p className={styles.mutualEmpty}>{copy.state.loading}</p>
              )}
            </div>
            <div
              id={friendPanelId}
              className={styles.mutualTabPanel}
              role="tabpanel"
              aria-labelledby={friendTabId}
              hidden={mutualTab !== 'friends'}
              tabIndex={0}
            >
              {props.profile ? (
                <MutualFriendList
                  items={props.profile.mutualFriends}
                  totalCount={props.profile.mutualFriendCount}
                />
              ) : (
                <p className={styles.mutualEmpty}>{copy.state.loading}</p>
              )}
            </div>
            </aside>
          ) : null}
        </div>
      </section>
    </div>,
    document.body,
  )
}

function ProfileLoadState({
  isLoading,
  error,
  onRetry,
  children,
}: ServerMemberProfileSurfaceProps & { children: ReactNode }) {
  if (isLoading) {
    return <p className={styles.loadState} aria-live="polite">{copy.state.loading}</p>
  }

  if (error) {
    return (
      <div className={styles.loadState} role="alert">
        <span>{copy.state.loadFailed}</span>
        <button type="button" onClick={onRetry}>{copy.actions.retry}</button>
      </div>
    )
  }

  return children
}

function ProfileBanner({
  profile,
  large = false,
}: {
  profile: ServerMemberViewerProfileResponse | null
  large?: boolean
}) {
  const bannerUrl = profile?.bannerAssetId
    ? `/api/assets/${profile.bannerAssetId}/content`
    : null

  return (
    <div
      className={`${styles.banner} ${large ? styles.largeBanner : ''}`}
      style={bannerUrl ? { backgroundImage: `url("${bannerUrl}")` } : undefined}
      aria-hidden="true"
    />
  )
}

function ProfileIdentity({
  member,
  profile,
  compact = false,
}: {
  member: ServerMemberDetailsResponse
  profile: ServerMemberViewerProfileResponse | null
  compact?: boolean
}) {
  const displayName = profile?.displayName ?? member.user.displayName
  const avatarAssetId = profile?.avatarAssetId ?? member.user.avatarAssetId
  const crop = profile ?? member.user

  return (
    <div className={`${styles.identity} ${compact ? styles.compactIdentity : ''}`}>
      <ProfileAsset
        className={styles.avatar}
        assetId={avatarAssetId}
        fallback={displayName.slice(0, 1).toUpperCase()}
        crop={crop}
      />
      <span>
        <strong>{displayName} <PresenceDot status={member.user.presenceStatus} /></strong>
        <small>@{profile?.login ?? member.user.login}</small>
        {profile?.statusText ? <em>{profile.statusText}</em> : null}
      </span>
    </div>
  )
}

function RoleList({ profile }: { profile: ServerMemberViewerProfileResponse }) {
  return profile.roles.length > 0 ? (
    <div className={styles.roles} aria-label={copy.labels.roles}>
      {profile.roles.map((role) => (
        <span
          key={role.id}
          style={{ '--server-member-role-color': role.color ?? 'var(--theme-accent)' } as CSSProperties}
        >
          {role.title}
        </span>
      ))}
    </div>
  ) : (
    <p className={styles.noRoles}>{copy.state.noRoles}</p>
  )
}

function MutualFriendList({
  items,
  totalCount,
}: {
  items: ServerMemberProfileMutualFriendResponse[]
  totalCount: number
}) {
  if (items.length === 0) {
    return totalCount > 0
      ? <MutualListTruncation returnedCount={0} totalCount={totalCount} />
      : <p className={styles.mutualEmpty}>{copy.state.noMutualFriends}</p>
  }

  return (
    <div className={styles.mutualList}>
      {items.map((friend) => (
        <article key={friend.userId}>
          <ProfileAsset
            className={styles.mutualAvatar}
            assetId={friend.avatarAssetId}
            fallback={friend.displayName.slice(0, 1).toUpperCase()}
            crop={friend}
          />
          <span><strong>{friend.displayName}</strong><small>@{friend.login}</small></span>
        </article>
      ))}
      <MutualListTruncation returnedCount={items.length} totalCount={totalCount} />
    </div>
  )
}

function MutualServerList({
  items,
  totalCount,
}: {
  items: ServerMemberProfileMutualServerResponse[]
  totalCount: number
}) {
  if (items.length === 0) {
    return totalCount > 0
      ? <MutualListTruncation returnedCount={0} totalCount={totalCount} />
      : <p className={styles.mutualEmpty}>{copy.state.noMutualServers}</p>
  }

  return (
    <div className={styles.mutualList}>
      {items.map((server) => (
        <article key={server.serverId}>
          <ProfileAsset
            className={styles.mutualAvatar}
            assetId={server.iconAssetId}
            fallback={server.title.slice(0, 1).toUpperCase()}
            crop={server}
            cropPrefix="icon"
          />
          <span><strong>{server.title}</strong></span>
        </article>
      ))}
      <MutualListTruncation returnedCount={items.length} totalCount={totalCount} />
    </div>
  )
}

function MutualListTruncation({
  returnedCount,
  totalCount,
}: {
  returnedCount: number
  totalCount: number
}) {
  if (!isServerMemberMutualListTruncated(totalCount, returnedCount)) return null

  return (
    <p className={styles.mutualTruncation} role="status">
      {copy.state.partialMutualList(returnedCount, totalCount)}
    </p>
  )
}

function ProfileAsset({
  className,
  assetId,
  fallback,
  crop,
  cropPrefix = 'avatar',
}: {
  className: string
  assetId: string | null
  fallback: string
  crop: Record<string, unknown>
  cropPrefix?: 'avatar' | 'icon'
}) {
  const offsetX = Number(crop[`${cropPrefix}CropOffsetX`] ?? 0)
  const offsetY = Number(crop[`${cropPrefix}CropOffsetY`] ?? 0)
  const zoom = Number(crop[`${cropPrefix}CropZoom`] ?? 1)

  return (
    <span className={className}>
      {assetId ? (
        <img
          src={`/api/assets/${assetId}/content`}
          alt=""
          style={{ transform: `translate(${offsetX * 100}%, ${offsetY * 100}%) scale(${zoom})` }}
        />
      ) : fallback}
    </span>
  )
}
