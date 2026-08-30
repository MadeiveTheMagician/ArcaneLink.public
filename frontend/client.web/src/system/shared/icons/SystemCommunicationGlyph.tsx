import type { ReactElement } from 'react';

import type { CommunicationIconName } from './SystemIcon.types';
import { assertUnreachable, pathProps } from './systemIconGlyphUtils';

import styles from './SystemIcon.module.css';

export function renderCommunicationGlyph(
  name: CommunicationIconName
): ReactElement {
  switch (name) {
    case 'archive':
      return (
        <>
          <path {...pathProps()} d="M4 7h16v13H4zM3 4h18v4H3z" />
          <path {...pathProps()} d="M10 12h4" />
        </>
      );
    case 'camera-off':
      return (
        <>
          <path
            {...pathProps()}
            d="M4 8.5A2.5 2.5 0 0 1 6.5 6h7A2.5 2.5 0 0 1 16 8.5v7a2.5 2.5 0 0 1-2.5 2.5h-7A2.5 2.5 0 0 1 4 15.5z"
          />
          <path {...pathProps()} d="m16 10 4-2.5v9L16 14" />
          <path {...pathProps({ strokeWidth: 2 })} d="M4 4l16 16" />
        </>
      );
    case 'camera':
      return (
        <>
          <path
            {...pathProps()}
            d="M4 8.5A2.5 2.5 0 0 1 6.5 6h7A2.5 2.5 0 0 1 16 8.5v7a2.5 2.5 0 0 1-2.5 2.5h-7A2.5 2.5 0 0 1 4 15.5z"
          />
          <path {...pathProps()} d="m16 10 4-2.5v9L16 14" />
        </>
      );
    case 'file':
      return (
        <>
          <path {...pathProps()} d="M6 3h8l4 4v14H6z" />
          <path {...pathProps()} d="M14 3v5h4M9 13h6M9 17h5" />
        </>
      );
    case 'folder':
      return (
        <path
          {...pathProps()}
          d="M3.5 6.5A2.5 2.5 0 0 1 6 4h4l2 2h6A2.5 2.5 0 0 1 20.5 8.5v8A2.5 2.5 0 0 1 18 19H6a2.5 2.5 0 0 1-2.5-2.5z"
        />
      );
    case 'headphones-off':
      return (
        <>
          <path {...pathProps()} d="M5 14v-2a7 7 0 0 1 11.9-5" />
          <path
            {...pathProps()}
            d="M19 14v3a2 2 0 0 1-2 2h-1v-6h1a2 2 0 0 1 2 2ZM5 14v3a2 2 0 0 0 2 2h1v-6H7a2 2 0 0 0-2 2Z"
          />
          <path {...pathProps({ strokeWidth: 2 })} d="M4 4l16 16" />
        </>
      );
    case 'headphones-on':
      return (
        <>
          <path {...pathProps()} d="M5 14v-2a7 7 0 0 1 14 0v2" />
          <path
            {...pathProps()}
            d="M5 14v3a2 2 0 0 0 2 2h1v-6H7a2 2 0 0 0-2 2ZM19 14v3a2 2 0 0 1-2 2h-1v-6h1a2 2 0 0 1 2 2Z"
          />
        </>
      );
    case 'leave':
      return (
        <path
          {...pathProps()}
          d="M6.6 10.8a12.2 12.2 0 0 1 10.8 0l1.5.7a2 2 0 0 1 1.1 1.8v1.1a2 2 0 0 1-2.6 1.9l-2.4-.8a1.8 1.8 0 0 1-1.2-1.7v-1a8.5 8.5 0 0 0-3.6 0v1a1.8 1.8 0 0 1-1.2 1.7l-2.4.8A2 2 0 0 1 4 14.4v-1.1a2 2 0 0 1 1.1-1.8z"
        />
      );
    case 'mail':
      return (
        <g>
          <rect
            className={styles.arcaneGlyph}
            x="2.65"
            y="5.7"
            width="18.7"
            height="12.6"
            rx="1.35"
          />
          <path
            className={styles.envelopeSeam}
            d="m3.55 6.85 7.12 5.95c.79.66 1.87.66 2.66 0l7.12-5.95M3.45 17.15l5.9-5.15M20.55 17.15 14.65 12"
          />
        </g>
      );
    case 'message':
      return (
        <>
          <path
            {...pathProps()}
            d="M5 5.5h14a2.5 2.5 0 0 1 2.5 2.5v7a2.5 2.5 0 0 1-2.5 2.5h-7.5L6 21v-3.5H5A2.5 2.5 0 0 1 2.5 15V8A2.5 2.5 0 0 1 5 5.5Z"
          />
          <path {...pathProps({ opacity: 0.8 })} d="M7.5 10h9M7.5 13.5h5.5" />
        </>
      );
    case 'mic-off':
      return (
        <>
          <path
            {...pathProps()}
            d="M9 9V6a3 3 0 0 1 5.5-1.7M15 10.5V12a3 3 0 0 1-4.3 2.7"
          />
          <path
            {...pathProps()}
            d="M5 11.5a7 7 0 0 0 11.6 5.3M19 11.5a7 7 0 0 1-.5 2.5M12 19v3M8 22h8"
          />
          <path {...pathProps({ strokeWidth: 2 })} d="M4 4l16 16" />
        </>
      );
    case 'mic-on':
      return (
        <>
          <path {...pathProps()} d="M9 6a3 3 0 0 1 6 0v6a3 3 0 0 1-6 0z" />
          <path {...pathProps()} d="M5 11.5a7 7 0 0 0 14 0M12 19v3M8 22h8" />
        </>
      );
    case 'paperclip':
      return (
        <path
          {...pathProps()}
          d="M7.5 12.8 14 6.3a3.2 3.2 0 0 1 4.5 4.5l-7.6 7.6a4.5 4.5 0 0 1-6.4-6.4l7.9-7.9"
        />
      );
    case 'phone':
      return (
        <path
          {...pathProps()}
          d="M7.2 5.3 9.5 4l2.1 4.6-1.9 1.2a10.6 10.6 0 0 0 4.5 4.5l1.2-1.9 4.6 2.1-1.3 2.3c-.5.9-1.5 1.4-2.5 1.1C10.7 16.7 7.3 13.3 6.1 7.8c-.2-1 .2-2 1.1-2.5Z"
        />
      );
    case 'phone-call':
      return (
        <>
          <path
            className={styles.arcaneGlyph}
            d="M6.55 5.05 9.2 3.7l2.2 4.85-2.02 1.18a10.8 10.8 0 0 0 4.88 4.88l1.18-2.02 4.86 2.2-1.36 2.66c-.5.98-1.63 1.48-2.7 1.17C10.55 16.98 7.02 13.45 5.38 7.76c-.31-1.07.19-2.2 1.17-2.71Z"
          />
          <path
            className={styles.phoneCallWaves}
            d="M14.2 4.35a5.45 5.45 0 0 1 5.45 5.45M14.45 7.3a2.25 2.25 0 0 1 2.25 2.25"
          />
        </>
      );
    case 'screen-off':
      return (
        <>
          <path {...pathProps()} d="M4 6.5h16v10H4z" />
          <path {...pathProps()} d="M9 20h6M12 16.5V20" />
          <path {...pathProps({ strokeWidth: 2 })} d="M4 4l16 16" />
        </>
      );
    case 'screen':
      return (
        <>
          <path {...pathProps()} d="M4 6.5h16v10H4z" />
          <path {...pathProps()} d="M9 20h6M12 16.5V20" />
        </>
      );
    case 'send':
      return (
        <g>
          <path
            className={styles.paperPlaneBody}
            d="M2.8 10.55 20.85 3.28c.86-.35 1.68.48 1.34 1.34l-6.65 16.94c-.3.77-1.3.92-1.81.27l-4.52-5.72-2.48 2.72c-.5.55-1.42.25-1.51-.49l-.57-4.78-2.18-1.57c-.68-.49-.48-1.42.32-1.74Z"
          />
          <path
            className={styles.paperPlaneSeam}
            d="M4.96 13.55 18.18 6.2 9.21 16.11M5.98 18.47l3.23-2.36"
          />
        </g>
      );
    case 'smile':
      return (
        <>
          <circle {...pathProps()} cx="12" cy="12" r="8.5" />
          <path
            {...pathProps()}
            d="M8.8 10h.01M15.2 10h.01M8.5 14a4.8 4.8 0 0 0 7 0"
          />
        </>
      );
    case 'speaker':
      return (
        <g className={styles.arcaneGlyph}>
          <path d="M3.2 9.2h4.25l6.1-4.65v14.9l-6.1-4.65H3.2V9.2Z" />
          <path
            fillRule="evenodd"
            d="M15.25 8.35a.9.9 0 0 1 1.27.08 5.45 5.45 0 0 1 0 7.14.9.9 0 1 1-1.35-1.19 3.65 3.65 0 0 0 0-4.76.9.9 0 0 1 .08-1.27Zm2.78-2.6a.9.9 0 0 1 1.27.08 9.37 9.37 0 0 1 0 12.34.9.9 0 1 1-1.35-1.19 7.57 7.57 0 0 0 0-9.96.9.9 0 0 1 .08-1.27Z"
          />
        </g>
      );
    case 'video':
      return (
        <>
          <rect {...pathProps()} x="4" y="5" width="16" height="14" rx="2" />
          <path {...pathProps()} d="m10 9 5 3-5 3z" />
        </>
      );
    default:
      return assertUnreachable(name);
  }
}
