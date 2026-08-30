import { SystemIcon, type SystemIconName, commonCopy } from '../../shared';

import styles from './MobileHubNav.module.css';

export type MobileHubTab = 'servers' | 'messages' | 'profile' | 'menu';

type MobileHubNavProps = {
  activeTab: MobileHubTab;
  messagesBadge?: number;
  onOpenServers: () => void;
  onOpenMessages: () => void;
  onOpenProfile: () => void;
  onOpenMenu: () => void;
};

const navItems: Array<{
  id: MobileHubTab;
  label: string;
  icon: SystemIconName;
}> = [
  { id: 'servers', label: commonCopy.navigation.servers, icon: 'globe' },
  { id: 'messages', label: commonCopy.navigation.messages, icon: 'message' },
  { id: 'profile', label: commonCopy.navigation.profile, icon: 'user' },
  { id: 'menu', label: commonCopy.navigation.menu, icon: 'menu' }
];

export function MobileHubNav({
  activeTab,
  messagesBadge = 0,
  onOpenServers,
  onOpenMessages,
  onOpenProfile,
  onOpenMenu
}: MobileHubNavProps) {
  const handlers: Record<MobileHubTab, () => void> = {
    servers: onOpenServers,
    messages: onOpenMessages,
    profile: onOpenProfile,
    menu: onOpenMenu
  };

  return (
    <nav className={styles.nav} aria-label={commonCopy.navigation.mobile}>
      {navItems.map((item) => (
        <button
          key={item.id}
          className={`${styles.button} ${
            activeTab === item.id ? styles.active : ''
          }`}
          type="button"
          aria-label={item.label}
          aria-current={activeTab === item.id ? 'page' : undefined}
          onClick={handlers[item.id]}
        >
          <span className={styles.icon} aria-hidden="true">
            <SystemIcon name={item.icon} size={24} />
            {item.id === 'messages' && messagesBadge > 0 && (
              <em>{messagesBadge > 9 ? '9+' : messagesBadge}</em>
            )}
          </span>
        </button>
      ))}
    </nav>
  );
}
