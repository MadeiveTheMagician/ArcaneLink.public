import type { SystemTheme } from '../systemThemes'
import { themeCopy } from '../theme.copy'

export const greenAppleTheme: SystemTheme = {
  code: 'green-apple',
  title: themeCopy.titles.greenApple,
  dominantColor: '#557c35',
  previewColors: ['#1d2b17', '#c7cc82', '#557c35'],
  assetSet: 'none',
  /*
   * Color variable guide:
   * --color-bg: base app background, for example the main workspace field.
   * --color-surface: default cards and panels.
   * --color-surface-strong: denser modal/sidebar surfaces.
   * --color-border: neutral borders around frames, inputs, and cards.
   * --color-text: primary readable text.
   * --color-muted: secondary labels, hints, timestamps.
   * --color-sapphire: main theme accent, buttons, toggles, selected states.
   * --color-sapphire-light: lighter accent for highlights and gradients.
   * --color-violet: companion accent used by legacy violet-tinted controls.
   * --color-rune: decorative/highlight text and arcane details.
   * --color-danger: destructive buttons and error states.
   * --color-success: online, ready, success, and positive status states.
   * --theme-accent-contrast: text/icons placed on accent backgrounds.
   * --theme-bg-start/mid/end: global app gradient background stops.
   * --theme-text-soft: computed soft primary text fallback.
   * --theme-text-faint: computed faint text fallback.
   * --theme-border-soft: subtle separators between settings sections.
   * --theme-border-control: input/button border color.
   * --theme-border-accent: active/focused border color.
   * --theme-frame-bg: large frames, dialogs, sidebars.
   * --theme-frame-bg-strong: heavier headers and nested frame layers.
   * --theme-control-bg: inputs, search fields, inactive controls.
   * --theme-control-bg-strong: pressed controls and deep wells.
   * --theme-hover-bg: hover rows, channel hover, menu item hover.
   * --theme-active-bg: selected tabs, active channels, chosen theme cards.
   * --theme-section-border: visible dividers between setting groups.
   * --theme-scrollbar-track/thumb: custom scrollbars.
   * --theme-glow: soft theme glow around cards and avatars.
   * --theme-glow-strong: stronger glow for logos and active accents.
   * --theme-backdrop-glow: large background radial glow.
   * --theme-surface-raised: raised card gradient.
   * --theme-surface-accent: primary accent button/control gradient.
   * --theme-surface-accent-strong: stronger accent gradient.
   * --theme-arcane-backdrop: decorative page overlay gradient.
   * --theme-profile-bg-image: profile page thematic image.
   * --theme-overview-bg-image: server overview thematic image.
   * --theme-settings-icon-image: settings icon asset.
   * --theme-pin-icon-image: pinned message icon asset.
   * --theme-plane-icon-image: send message icon asset.
   * --shadow-sapphire: theme shadow used by elevated UI.
   */
  variables: {
    '--color-bg': '#1d2b17',
    '--color-surface': 'rgba(0, 241, 32, 0.84)',
    '--color-surface-strong': 'rgba(199, 204, 130, 0.96)',
    '--color-border': '#7b8447',
    '--color-text': '#253219',
    '--color-muted': '#59673d',
    '--color-sapphire': '#557c35',
    '--color-sapphire-light': '#c7cc82',
    '--color-violet': '#6f8e4b',
    '--color-rune': '#f4f6d6',
    '--color-danger': '#d78679',
    '--color-success': '#b9c98c',
    '--theme-accent-contrast': '#f7f8ed',
    '--theme-bg-start': '#0d160c',
    '--theme-bg-mid': '#1a2916',
    '--theme-bg-end': '#2d3a18',
    '--theme-frame-bg': 'rgba(199, 204, 130, 0.82)',
    '--theme-frame-bg-strong': 'rgba(199, 204, 130, 0.95)',
    '--theme-control-bg': 'rgba(188, 195, 118, 0.74)',
    '--theme-control-bg-strong': 'rgba(151, 161, 88, 0.88)',
    '--theme-hover-bg': 'rgba(85, 124, 53, 0.18)',
    '--theme-active-bg': 'rgba(85, 124, 53, 0.28)',
    '--theme-border-soft': 'rgba(85, 124, 53, 0.24)',
    '--theme-border-control': 'rgba(85, 124, 53, 0.32)',
    '--theme-border-accent': 'rgba(85, 124, 53, 0.48)',
    '--theme-section-border': 'rgba(85, 124, 53, 0.24)',
    '--theme-scrollbar-track': 'rgba(14, 24, 12, 0.72)',
    '--theme-scrollbar-thumb': 'rgba(108, 143, 75, 0.56)',
    '--theme-backdrop-glow': 'rgba(104, 141, 69, 0.12)',
    '--theme-glow': 'rgba(104, 141, 69, 0.14)',
    '--theme-glow-strong': 'rgba(104, 141, 69, 0.22)',
    '--theme-surface-raised':
      'radial-gradient(circle at 0% 0%, rgba(244, 246, 214, 0.24), transparent 34%), linear-gradient(180deg, rgba(207, 212, 144, 0.98), rgba(141, 188, 110, 0.98))',
    '--theme-surface-accent':
      'linear-gradient(135deg, rgba(85, 124, 53, 0.92), rgba(116, 145, 77, 0.78))',
    '--theme-surface-accent-strong':
      'linear-gradient(180deg, rgba(203, 216, 154, 0.92), rgba(85, 124, 53, 0.86))',
    '--theme-arcane-backdrop':
      'linear-gradient(180deg, rgba(24, 37, 19, 0.16), rgba(13, 23, 11, 0.24)), radial-gradient(circle at 76% 26%, rgba(104, 141, 69, 0.12), transparent 30%)',
    '--shadow-sapphire': '0 26px 90px rgba(85, 124, 53, 0.16)',
  },
}
