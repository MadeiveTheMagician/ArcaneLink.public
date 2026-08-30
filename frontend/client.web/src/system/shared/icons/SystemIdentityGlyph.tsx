import type { ReactElement } from 'react';

import type { IdentityIconName } from './SystemIcon.types';
import { assertUnreachable, pathProps } from './systemIconGlyphUtils';

import styles from './SystemIcon.module.css';

export function renderIdentityGlyph(name: IdentityIconName): ReactElement {
  switch (name) {
    case 'friends':
      return (
        <g className={styles.referenceFriends}>
          <circle
            className={styles.referenceFriendsBack}
            cx="6.75"
            cy="8.25"
            r="2.7"
          />
          <circle
            className={styles.referenceFriendsBack}
            cx="17.25"
            cy="8.25"
            r="2.7"
          />
          <path
            className={styles.referenceFriendsBack}
            d="M1.75 19.25c.22-3.72 2.02-5.72 5-5.72 1.25 0 2.29.35 3.08 1.03-1.3 1.34-2.03 3.05-2.2 5.12-2.34.03-4.32-.12-5.88-.43Z"
          />
          <path
            className={styles.referenceFriendsBack}
            d="M22.25 19.25c-.22-3.72-2.02-5.72-5-5.72-1.25 0-2.29.35-3.08 1.03 1.3 1.34 2.03 3.05 2.2 5.12 2.34.03 4.32-.12 5.88-.43Z"
          />
          <circle cx="12" cy="7.25" r="3.35" />
          <path d="M5.25 21c.3-5.1 2.7-7.65 6.75-7.65S18.45 15.9 18.75 21c-3.85.86-9.65.86-13.5 0Z" />
        </g>
      );
    case 'globe':
      return (
        <g className={styles.arcaneStroke}>
          <circle cx="12" cy="12" r="8.15" />
          <path d="M4.22 9.55c2.15.66 4.74.99 7.78.99s5.63-.33 7.78-.99M4.22 14.45c2.15-.66 4.74-.99 7.78-.99s5.63.33 7.78.99M12 3.85c2.13 2.26 3.2 4.98 3.2 8.15s-1.07 5.89-3.2 8.15M12 3.85C9.87 6.11 8.8 8.83 8.8 12s1.07 5.89 3.2 8.15" />
        </g>
      );
    case 'lock':
      return (
        <>
          <rect {...pathProps()} x="5" y="10" width="14" height="10" rx="2" />
          <path {...pathProps()} d="M8 10V7a4 4 0 0 1 8 0v3M12 14v2" />
        </>
      );
    case 'pin':
      return (
        <>
          <path
            {...pathProps({ strokeWidth: 2 })}
            d="m15 4.5 4.5 4.5-3 1.5-1.5 4.5-4.5 4.5-6-6L9 9l4.5-1.5z"
          />
          <path {...pathProps({ strokeWidth: 2 })} d="M9 15 4.5 19.5" />
          <path {...pathProps({ strokeWidth: 2 })} d="m14.5 5.5 4 4" />
        </>
      );
    case 'server':
      return (
        <>
          <path {...pathProps()} d="m12 3.5 7 4v8l-7 4-7-4v-8z" />
          <path {...pathProps()} d="m5 7.5 7 4 7-4M12 11.5v8" />
        </>
      );
    case 'settings':
      return (
        <path
          className={styles.arcaneGlyph}
          fillRule="evenodd"
          d="M9.54 2.55h4.92l.48 2.46c.55.2 1.08.5 1.55.89l2.38-.82 2.46 4.26-1.9 1.64a7.5 7.5 0 0 1 0 1.79l1.9 1.64-2.46 4.26-2.38-.82c-.47.39-1 .69-1.55.89l-.48 2.46H9.54l-.48-2.46a7.2 7.2 0 0 1-1.55-.89l-2.38.82-2.46-4.26 1.9-1.64a7.5 7.5 0 0 1 0-1.79l-1.9-1.64 2.46-4.26 2.38.82c.47-.39 1-.69 1.55-.89l.48-2.46ZM12 8.15a3.73 3.73 0 1 0 0 7.46 3.73 3.73 0 0 0 0-7.46Z"
        />
      );
    case 'user':
      return (
        <>
          <circle {...pathProps()} cx="12" cy="8" r="4" />
          <path
            {...pathProps()}
            d="M4.8 21c.8-4.1 3.5-6.3 7.2-6.3s6.4 2.2 7.2 6.3"
          />
        </>
      );
    case 'user-plus':
      return (
        <>
          <circle {...pathProps()} cx="10" cy="8" r="3.6" />
          <path
            {...pathProps()}
            d="M4.6 20c.7-3.7 2.8-5.7 5.4-5.7 1.7 0 3.2.8 4.2 2.3"
          />
          <path {...pathProps({ strokeWidth: 2 })} d="M18.5 7v6M15.5 10h6" />
        </>
      );
    case 'unlock':
      return (
        <>
          <rect {...pathProps()} x="5" y="10" width="14" height="10" rx="2" />
          <path {...pathProps()} d="M16 10V7a4 4 0 0 0-7.6-1.75M12 14v2" />
        </>
      );
    default:
      return assertUnreachable(name);
  }
}
