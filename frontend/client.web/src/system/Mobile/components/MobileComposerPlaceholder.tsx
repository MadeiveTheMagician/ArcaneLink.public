import styles from './MobileComposerPlaceholder.module.css'

export function MobileComposerPlaceholder({ text }: { text: string }) {
  return <span className={styles.placeholder} aria-hidden="true">{text}</span>
}
