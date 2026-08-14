import type { ReactElement } from 'react'
import styles from './SystemIcon.module.css'
import type { NavigationIconName } from './SystemIcon.types'
import { assertUnreachable, pathProps } from './systemIconGlyphUtils'

export function renderNavigationGlyph(name: NavigationIconName): ReactElement {
  switch (name) {
    case 'back':
      return <path {...pathProps()} d="M15 5 8 12l7 7M9 12h11" />
    case 'block':
      return (
        <>
          <circle {...pathProps()} cx="12" cy="12" r="8" />
          <path {...pathProps({ strokeWidth: 2 })} d="m6.4 6.4 11.2 11.2" />
        </>
      )
    case 'check':
      return <path {...pathProps({ strokeWidth: 2.2 })} d="m5 12.5 4.2 4.1L19 7" />
    case 'chevron-down':
      return <path {...pathProps({ strokeWidth: 2 })} d="m7 10 5 5 5-5" />
    case 'chevron-right':
      return <path className={styles.arcaneGlyph} d="M6.8 3.65a1.75 1.75 0 0 1 2.48 0l7.1 7.11a1.75 1.75 0 0 1 0 2.48l-7.1 7.11a1.75 1.75 0 1 1-2.48-2.48L12.67 12 6.8 6.13a1.75 1.75 0 0 1 0-2.48Z" />
    case 'close':
      return (
        <>
          <path {...pathProps({ strokeWidth: 2.1 })} d="M7 7l10 10" />
          <path {...pathProps({ strokeWidth: 2.1 })} d="M17 7 7 17" />
        </>
      )
    case 'copy':
      return (
        <>
          <rect {...pathProps()} x="8" y="8" width="11" height="12" rx="2" />
          <path {...pathProps()} d="M6 16H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
        </>
      )
    case 'download':
      return (
        <>
          <path {...pathProps({ strokeWidth: 2 })} d="M12 4v11m0 0-4-4m4 4 4-4" />
          <path {...pathProps({ strokeWidth: 2 })} d="M5 19h14" />
        </>
      )
    case 'eye':
      return (
        <>
          <path {...pathProps()} d="M2.5 12s3.4-6 9.5-6 9.5 6 9.5 6-3.4 6-9.5 6-9.5-6-9.5-6Z" />
          <circle {...pathProps()} cx="12" cy="12" r="3" />
        </>
      )
    case 'eye-off':
      return (
        <>
          <path {...pathProps({ strokeWidth: 2 })} d="m3 3 18 18" />
          <path {...pathProps()} d="M10.7 5.2A9 9 0 0 1 12 5c6.1 0 9.5 7 9.5 7a17 17 0 0 1-3.1 4.1" />
          <path {...pathProps()} d="M6.6 6.6A17 17 0 0 0 2.5 12s3.4 6 9.5 6a9 9 0 0 0 4.1-.9" />
          <path {...pathProps()} d="M9.9 9.9a3 3 0 0 0 4.2 4.2" />
        </>
      )
    case 'edit':
      return (
        <>
          <path {...pathProps()} d="m5 16.5-.8 3.3 3.3-.8L18.8 7.7l-2.5-2.5z" />
          <path {...pathProps()} d="m14.8 6.7 2.5 2.5M4 21h16" />
        </>
      )
    case 'flag':
      return (
        <>
          <path {...pathProps()} d="M6 21V4" />
          <path {...pathProps()} d="M6 5h10l-1.5 3L17 11H6" />
        </>
      )
    case 'menu':
      return (
        <>
          <path {...pathProps({ strokeWidth: 2.2 })} d="M5 7h14" />
          <path {...pathProps({ strokeWidth: 2.2 })} d="M5 12h14" />
          <path {...pathProps({ strokeWidth: 2.2 })} d="M5 17h14" />
        </>
      )
    case 'more':
      return (
        <>
          <circle className={styles.fill} cx="6.5" cy="12" r="1.35" />
          <circle className={styles.fill} cx="12" cy="12" r="1.35" />
          <circle className={styles.fill} cx="17.5" cy="12" r="1.35" />
        </>
      )
    case 'more-vertical':
      return (
        <>
          <circle className={styles.fill} cx="12" cy="6.5" r="1.35" />
          <circle className={styles.fill} cx="12" cy="12" r="1.35" />
          <circle className={styles.fill} cx="12" cy="17.5" r="1.35" />
        </>
      )
    case 'plus':
      return (
        <>
          <path {...pathProps({ strokeWidth: 2.1 })} d="M12 5v14" />
          <path {...pathProps({ strokeWidth: 2.1 })} d="M5 12h14" />
        </>
      )
    case 'search':
      return (
        <>
          <circle {...pathProps()} cx="11" cy="11" r="7" />
          <path {...pathProps()} d="m20 20-4-4" />
        </>
      )
    case 'sliders':
      return (
        <>
          <path {...pathProps()} d="M4 7h7M15 7h5M13 5v4" />
          <path {...pathProps()} d="M4 17h5M13 17h7M11 15v4" />
        </>
      )
    case 'trash':
      return (
        <>
          <path {...pathProps()} d="M5 7h14M9 7V4h6v3M7 7l1 13h8l1-13" />
          <path {...pathProps()} d="M10 11v5M14 11v5" />
        </>
      )
    default:
      return assertUnreachable(name)
  }
}
