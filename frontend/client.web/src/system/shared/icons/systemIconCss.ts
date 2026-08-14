import type { SystemIconName } from './SystemIcon.types'

const systemIconCssSharedNames = [
  'camera',
  'camera-off',
  'headphones-off',
  'headphones-on',
  'leave',
  'lock',
  'mic-off',
  'mic-on',
  'message',
  'pin',
  'plus',
  'screen',
  'screen-off',
  'send',
  'settings',
  'unlock',
] as const satisfies readonly SystemIconName[]

const systemIconCssOnlyNames = ['collapse', 'fullscreen'] as const

export const systemIconCssNames = [
  ...systemIconCssSharedNames,
  ...systemIconCssOnlyNames,
] as const

export type SystemIconCssName = (typeof systemIconCssNames)[number]

const systemIconSvgByName: Record<SystemIconCssName, string> = {
  'camera-off':
    `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'><path fill='none' stroke='#ff6478' stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M4 7h11a3 3 0 0 1 3 3v4a3 3 0 0 1-3 3H4a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2Zm15 3.5 3-2v7l-3-2v-3ZM4 4l16 16'/></svg>`,
  camera:
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="white" d="M4 7h11a3 3 0 0 1 3 3v4a3 3 0 0 1-3 3H4a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2Zm15 3.5 3-2v7l-3-2v-3Z"/></svg>',
  collapse:
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="white" d="M6 11h12v2H6v-2Z"/></svg>',
  fullscreen:
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="white" d="M4 4h7v2H7.4L11 9.6 9.6 11 6 7.4V11H4V4Zm9 0h7v7h-2V7.4L14.4 11 13 9.6 16.6 6H13V4ZM4 13h2v3.6l3.6-3.6 1.4 1.4L7.4 18H11v2H4v-7Zm14 0h2v7h-7v-2h3.6L13 14.4l1.4-1.4 3.6 3.6V13Z"/></svg>',
  'headphones-off':
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="none" stroke="#ff6478" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 14v-2a7 7 0 0 1 11.9-5"/><path fill="none" stroke="#ff6478" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 14v3a2 2 0 0 1-2 2h-1v-6h1a2 2 0 0 1 2 2ZM5 14v3a2 2 0 0 0 2 2h1v-6H7a2 2 0 0 0-2 2ZM4 4l16 16"/></svg>',
  'headphones-on':
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="none" stroke="white" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 14v-2a7 7 0 0 1 14 0v2"/><path fill="none" stroke="white" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 14v3a2 2 0 0 0 2 2h1v-6H7a2 2 0 0 0-2 2ZM19 14v3a2 2 0 0 1-2 2h-1v-6h1a2 2 0 0 1 2 2Z"/></svg>',
  leave:
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="#ff6478" d="M6.5 10.8c3.4-2.3 7.6-2.3 11 0l1.6 1.1c.8.5 1 1.6.4 2.4l-1 1.5c-.5.7-1.4.9-2.1.5l-2.2-1.2c-.5-.3-.8-.8-.8-1.4v-1.1a7 7 0 0 0-2.8 0v1.1c0 .6-.3 1.1-.8 1.4l-2.2 1.2c-.7.4-1.6.2-2.1-.5l-1-1.5c-.6-.8-.4-1.9.4-2.4l1.6-1.1Z"/></svg>',
  lock:
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><g fill="none" stroke="white" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8"><rect x="5" y="10" width="14" height="10" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3M12 14v2"/></g></svg>',
  'mic-off':
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="none" stroke="#ff6478" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 9V6a3 3 0 0 1 5.5-1.7M15 10.5V12a3 3 0 0 1-4.3 2.7"/><path fill="none" stroke="#ff6478" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 11.5a7 7 0 0 0 11.6 5.3M19 11.5a7 7 0 0 1-.5 2.5M12 19v3M8 22h8M4 4l16 16"/></svg>',
  'mic-on':
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="none" stroke="white" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 6a3 3 0 0 1 6 0v6a3 3 0 0 1-6 0V6Z"/><path fill="none" stroke="white" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 11.5a7 7 0 0 0 14 0M12 19v3M8 22h8"/></svg>',
  message:
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><g fill="none" stroke="white" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8"><path d="M5 5.5h14A2.5 2.5 0 0 1 21.5 8v7a2.5 2.5 0 0 1-2.5 2.5h-7.5L6 21v-3.5H5A2.5 2.5 0 0 1 2.5 15V8A2.5 2.5 0 0 1 5 5.5Z"/><path d="M7.5 10h9M7.5 13.5h5.5"/></g></svg>',
  pin:
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="white" d="m14.8 3.6 5.6 5.6-3.2 3.2.3 3.2-2.1 2.1-3.7-3.7-4.8 4.8-1.7-1.7 4.8-4.8-3.7-3.7 2.1-2.1 3.2.3 3.2-3.2Z"/></svg>',
  send:
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><defs><linearGradient id="a" x1="4" y1="3" x2="20" y2="21" gradientUnits="userSpaceOnUse"><stop stop-color="#f7efff"/><stop offset=".28" stop-color="#d9baff"/><stop offset=".66" stop-color="#a978ef"/><stop offset="1" stop-color="#7650cf"/></linearGradient></defs><path fill="url(#a)" stroke="#faf2ff" stroke-linejoin="round" stroke-width=".72" d="M2.8 10.55 20.85 3.28c.86-.35 1.68.48 1.34 1.34l-6.65 16.94c-.3.77-1.3.92-1.81.27l-4.52-5.72-2.48 2.72c-.5.55-1.42.25-1.51-.49l-.57-4.78-2.18-1.57c-.68-.49-.48-1.42.32-1.74Z"/><path fill="none" stroke="#fffaff" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.05" d="M4.96 13.55 18.18 6.2 9.21 16.11M5.98 18.47l3.23-2.36"/></svg>',
  plus:
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="white" d="M11 5h2v6h6v2h-6v6h-2v-6H5v-2h6V5Z"/></svg>',
  screen:
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="white" d="M3 5h18v12H3V5Zm2 2v8h14V7H5Zm5 12h4v2h-4v-2Z"/></svg>',
  'screen-off':
    `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'><path fill='none' stroke='#ff6478' stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M3 5h18v12H3V5Zm7 14h4M4 4l16 16'/></svg>`,
  settings:
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="white" d="M19.4 13.5c.1-.5.1-1 .1-1.5s0-1-.1-1.5l2-1.5-2-3.5-2.4 1a7 7 0 0 0-2.6-1.5L14 2h-4l-.4 2.5A7 7 0 0 0 7 6L4.6 5l-2 3.5 2 1.5c-.1.5-.1 1-.1 1.5s0 1 .1 1.5l-2 1.5 2 3.5L7 18a7 7 0 0 0 2.6 1.5L10 22h4l.4-2.5A7 7 0 0 0 17 18l2.4 1 2-3.5-2-1.5ZM12 15.5A3.5 3.5 0 1 1 12 8a3.5 3.5 0 0 1 0 7.5Z"/></svg>',
  unlock:
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><g fill="none" stroke="white" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8"><rect x="5" y="10" width="14" height="10" rx="2"/><path d="M16 10V7a4 4 0 0 0-7.6-1.75M12 14v2"/></g></svg>',
}

export function getSystemIconCss(name: SystemIconCssName) {
  return `${getSystemIconImageCss(name)} center / contain no-repeat`
}

export function getSystemIconImageCss(name: SystemIconCssName) {
  return `url("data:image/svg+xml,${encodeURIComponent(systemIconSvgByName[name])}")`
}
