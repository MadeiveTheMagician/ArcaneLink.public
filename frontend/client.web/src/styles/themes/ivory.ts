import type { SystemTheme } from '../systemThemes';
import { themeCopy } from '../theme.copy';

export const ivoryTheme: SystemTheme = {
  code: 'ivory',
  title: themeCopy.titles.ivory,
  dominantColor: '#f4ead2',
  previewColors: ['#fbf6ea', '#f4ead2', '#b68d4c'],
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
    '--color-bg': '#fbf6ea',
    '--color-surface': 'rgba(255, 250, 239, 0.82)',
    '--color-surface-strong': 'rgba(255, 250, 239, 0.96)',
    '--color-border': '#d9c9a9',
    '--color-text': '#2d261a',
    '--color-muted': '#6f624f',
    '--color-sapphire': '#b68d4c',
    '--color-sapphire-light': '#72501f',
    '--color-violet': '#c28c5a',
    '--color-rune': '#7c5e2d',
    '--color-danger': '#b84254',
    '--color-success': '#287447',
    '--theme-accent-contrast': '#2d261a',
    '--theme-text-soft': '#554a3a',
    '--theme-text-faint': '#6f624f',
    '--theme-surface-accent': 'linear-gradient(135deg, #c49c5b, #b68d4c)',
    '--theme-surface-accent-strong':
      'linear-gradient(180deg, #c49c5b, #b68d4c)',
    '--shadow-sapphire': '0 26px 80px rgba(144, 106, 45, 0.2)'
  }
};
