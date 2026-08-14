import type { ServerMemberResponse } from '../../../../shared/types'
import type { HubWorkspace } from '../../../Hub/components/shell/useHubWorkspace'
import { profileCopy } from '../../../shared'
import styles from './ProfileHeader.module.css'

type ProfileHeaderProps = {
  activeWorkspace: HubWorkspace
  selectedServerMembership: ServerMemberResponse | null
  onToggleServers: () => void
  onOpenServerSettings: () => void
  onLogout: () => void
}

export function ProfileHeader({
  activeWorkspace,
  selectedServerMembership,
  onToggleServers,
  onOpenServerSettings,
  onLogout,
}: ProfileHeaderProps) {
  return (
    <header className={styles.header}>
      <div className={styles.brand}>
        <img src="/brand/logo-mark.svg" alt="" />
        <span>ArcaneLink</span>
      </div>
      {activeWorkspace === 'server' && selectedServerMembership ? (
        <div className={styles.serverTitleStrip}>
          <span>{profileCopy.labels.server}</span>
          <strong>{selectedServerMembership.server.title}</strong>
          <button
            className={styles.serverSettingsButton}
            type="button"
            onClick={onOpenServerSettings}
            aria-label={profileCopy.actions.openServerSettings}
            title={profileCopy.actions.serverSettings}
          >
            {profileCopy.actions.settings}
          </button>
        </div>
      ) : (
        <div className={styles.actions}>
          <button
            className={styles.toggle}
            type="button"
            onClick={onToggleServers}
          >
            {profileCopy.actions.servers}
          </button>
          <button className={styles.logout} type="button" onClick={onLogout}>
            {profileCopy.actions.logout}
          </button>
        </div>
      )}
    </header>
  )
}
