import type { SystemTheme } from '../systemThemes'
import { themeCopy } from '../theme.copy'

export const pinkTheme: SystemTheme = {
  code: 'pink',
  title: themeCopy.titles.pink,
  dominantColor: '#ff77ba',
  previewColors: ['#25101d', '#ff77ba', '#ffd1e7'],
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
    '--color-bg': '#25101d',
    '--color-surface': 'rgba(37, 16, 29, 0.78)',
    '--color-surface-strong': 'rgba(37, 16, 29, 0.95)',
    '--color-border': '#713656',
    '--color-text': '#fff0f7',
    '--color-muted': '#d6a2bd',
    '--color-sapphire': '#ff77ba',
    '--color-sapphire-light': '#ffafd5',
    '--color-violet': '#ff77ba',
    '--color-rune': '#ffd1e7',
    '--color-danger': '#ff6b75',
    '--color-success': '#98f0bd',
    '--theme-accent-contrast': '#25101d',
    '--shadow-sapphire': '0 26px 90px rgba(255, 119, 186, 0.22)',
  },
}
