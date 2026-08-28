import { SystemIcon, commonCopy } from '../../shared';
import { mobileMenuCopy } from './mobileMenuCopy.ru';

import styles from './MobileMenuTab.module.css';

type MobileMenuTabProps = {
  onOpenSystemSettings: () => void;
};

export function MobileMenuTab({ onOpenSystemSettings }: MobileMenuTabProps) {
  return (
    <section
      className={styles.panel}
      aria-label={commonCopy.navigation.mobileMenu}
    >
      <nav
        className={styles.actions}
        aria-label={commonCopy.navigation.mobileMenu}
      >
        <button
          className={styles.action}
          type="button"
          aria-label={mobileMenuCopy.systemSettings}
          title={mobileMenuCopy.systemSettings}
          onClick={onOpenSystemSettings}
        >
          <SystemIcon name="settings" size={30} />
        </button>
      </nav>
    </section>
  );
}
