import { cloneElement, type PointerEvent, type ReactElement, type ReactNode } from 'react'
import { serverCopy, SystemIcon } from '../../../shared'
import type { ServerDetail } from '../../utils/serverWorkspaceModel'
import styles from '../shell/ServerWorkspace.module.css'
import chromeStyles from './ServerWorkspaceChrome.module.css'
import mobileToolbarStyles from './ServerWorkspaceMobileToolbar.module.css'
import viewportStyles from './ServerWorkspaceViewport.module.css'

type ServerWorkspaceLayoutProps = {
  channelTree: ReactNode
  detail: ReactNode
  hasSelectedDetail: boolean
  isMembersPanelCollapsed: boolean
  membersPanel: ReactElement<{
    className?: string
    id: string
    isCollapsed?: boolean
  }>
  pinnedSpaceMessagePreview: string | null
  visibleChannel: Extract<ServerDetail, { type: 'channel' }> | null
  visibleDetail: ServerDetail | null
  onCloseDetail: () => void
  onStartPaneResize: (
    pane: 'spaces' | 'members',
    event: PointerEvent<HTMLButtonElement>,
  ) => void
}

export function ServerWorkspaceLayout({
  channelTree,
  detail,
  hasSelectedDetail,
  isMembersPanelCollapsed,
  membersPanel,
  pinnedSpaceMessagePreview,
  visibleChannel,
  visibleDetail,
  onCloseDetail,
  onStartPaneResize,
}: ServerWorkspaceLayoutProps) {
  function handleStartPaneResize(
    pane: 'spaces' | 'members',
    event: PointerEvent<HTMLButtonElement>,
  ) {
    const workspace = event.currentTarget.closest<HTMLElement>(
      '[data-server-workspace]',
    )

    workspace?.setAttribute('data-pane-resizing', 'true')

    const finishResize = () => {
      workspace?.removeAttribute('data-pane-resizing')
      window.removeEventListener('pointerup', finishResize)
      window.removeEventListener('pointercancel', finishResize)
    }

    window.addEventListener('pointerup', finishResize)
    window.addEventListener('pointercancel', finishResize)
    onStartPaneResize(pane, event)
  }

  return (
    <section
      data-server-workspace="true"
      data-members-panel-collapsed={isMembersPanelCollapsed ? 'true' : 'false'}
      tabIndex={-1}
      className={`${styles.workspace} ui-panel ${
        hasSelectedDetail ? styles.withDetail : styles.spacesOnly
      }`}
    >
      <header
        className={chromeStyles.topbar}
        aria-live="polite"
        aria-label={serverCopy.labels.systemNotifications}
      />

      {channelTree}

      <button
        className={`${chromeStyles.resizer} ${chromeStyles.spaceResizer}`}
        type="button"
        aria-label="Resize spaces panel"
        aria-hidden="true"
        tabIndex={-1}
        onPointerDown={(event) => handleStartPaneResize('spaces', event)}
      />

      <section
        className={`${styles.spaceViewport} ${viewportStyles.spaceViewport} ${
          visibleChannel?.kind === 'text'
            ? `${styles.textChannel} ${viewportStyles.textChannel}`
            : ''
        } ${
          visibleChannel?.kind === 'voice'
            ? `${styles.voiceChannel} ${viewportStyles.voiceChannel}`
            : ''
        } ${
          hasSelectedDetail ? `${styles.open} ${viewportStyles.open}` : ''
        }`}
        data-space-kind={visibleChannel?.kind ?? visibleDetail?.type ?? 'none'}
        data-space-open={hasSelectedDetail ? 'true' : 'false'}
        data-workspace-transition-content="true"
      >
        <div
          className={`${styles.mobileSpaceToolbar} ${mobileToolbarStyles.mobileSpaceToolbar}`}
        >
          <button
            className={mobileToolbarStyles.mobileSpaceBack}
            type="button"
            onClick={onCloseDetail}
            aria-label={serverCopy.navigation.backToSpaces}
          >
            <SystemIcon name="back" size={18} />
          </button>
          <span className={mobileToolbarStyles.mobileSpaceTitle}>
            {visibleChannel ? (
              <>
                <i aria-hidden="true">#</i>
                {visibleChannel.title}
              </>
            ) : visibleDetail?.type === 'overview' ? (
              serverCopy.labels.overview
            ) : (
              serverCopy.labels.spaces
            )}
          </span>
          <button className={mobileToolbarStyles.mobileSpacePinned} type="button">
            {pinnedSpaceMessagePreview ?? ''}
          </button>
          <button
            className={mobileToolbarStyles.mobileSpaceSearch}
            type="button"
            aria-label={serverCopy.labels.searchSpace}
          >
            <SystemIcon name="search" size={22} />
          </button>
        </div>

        {detail}
      </section>

      <button
        className={`${chromeStyles.resizer} ${chromeStyles.memberResizer}`}
        data-members-resizer="true"
        type="button"
        aria-label="Resize members panel"
        aria-hidden="true"
        tabIndex={-1}
        onPointerDown={(event) => handleStartPaneResize('members', event)}
      />

      {cloneElement(membersPanel, {
        isCollapsed: isMembersPanelCollapsed,
        className: [membersPanel.props.className, chromeStyles.memberPanelSlot]
          .filter(Boolean)
          .join(' '),
      })}
    </section>
  )
}
