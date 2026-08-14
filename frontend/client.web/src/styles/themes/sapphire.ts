import type { SystemTheme } from '../systemThemes'
import { getSystemIconImageCss } from '../../system/shared/icons/systemIconCss'
import { themeCopy } from '../theme.copy'

export const sapphireTheme: SystemTheme = {
  code: 'sapphire',
  title: themeCopy.titles.sapphire,
  dominantColor: '#7b61ff',
  previewColors: ['#0b1020', '#7b61ff', '#a898ff'],
  assetSet: 'sapphire',
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
   * --theme-overview-bg-image: server overview background layer.
   * --theme-settings-icon-image: settings icon asset.
   * --theme-pin-icon-image: pinned message icon asset.
   * --theme-plane-icon-image: send message icon asset.
   * --shadow-sapphire: theme shadow used by elevated UI.
   */
  variables: {
    '--color-bg': '#0b1020',
    '--color-surface': 'rgba(11, 16, 32, 0.78)',
    '--color-surface-strong': 'rgba(11, 16, 32, 0.94)',
    '--color-border': '#2a2f4a',
    '--color-text': '#e6e9f5',
    '--color-muted': '#a0a6c7',
    '--color-sapphire': '#7b61ff',
    '--color-sapphire-light': '#a898ff',
    '--color-violet': '#7b61ff',
    '--color-rune': '#c7bdff',
    '--color-danger': '#ff6b6b',
    '--color-success': '#8fffc1',
    '--theme-accent-contrast': '#fff',
    '--theme-bg-start': '#030815',
    '--theme-bg-mid': '#071126',
    '--theme-bg-end': '#171247',
    '--theme-frame-bg': 'rgba(8, 17, 42, 0.9)',
    '--theme-frame-bg-strong': 'rgba(10, 18, 42, 0.94)',
    '--theme-control-bg': 'rgba(9, 18, 42, 0.86)',
    '--theme-control-bg-strong': 'rgba(3, 8, 21, 0.98)',
    '--theme-hover-bg': 'rgba(55, 43, 125, 0.46)',
    '--theme-active-bg': 'rgba(65, 48, 122, 0.56)',
    '--theme-border-soft': 'rgba(77, 94, 151, 0.28)',
    '--theme-border-control': 'rgba(87, 106, 166, 0.34)',
    '--theme-border-accent': 'rgba(159, 133, 255, 0.58)',
    '--theme-section-border': 'rgba(120, 132, 202, 0.3)',
    '--theme-scrollbar-track': 'rgba(9, 15, 34, 0.7)',
    '--theme-scrollbar-thumb': 'rgba(159, 133, 255, 0.74)',
    '--theme-backdrop-glow': 'rgba(103, 63, 237, 0.22)',
    '--theme-glow': 'rgba(123, 97, 255, 0.24)',
    '--theme-glow-strong': 'rgba(132, 92, 255, 0.42)',
    '--theme-surface-raised':
      'radial-gradient(circle at 0% 0%, rgba(110, 76, 224, 0.24), transparent 34%), linear-gradient(180deg, rgba(13, 21, 49, 0.98), rgba(4, 9, 23, 0.98))',
    '--theme-surface-accent':
      'linear-gradient(135deg, rgba(101, 74, 223, 0.92), rgba(56, 169, 224, 0.72))',
    '--theme-surface-accent-strong':
      'linear-gradient(180deg, rgba(182, 122, 255, 0.95), rgba(68, 116, 255, 0.86))',
    '--theme-arcane-backdrop':
      'linear-gradient(180deg, rgba(8, 17, 42, 0.14), rgba(3, 8, 21, 0.2)), radial-gradient(circle at 76% 26%, rgba(103, 63, 237, 0.18), transparent 30%)',
    '--theme-profile-bg-image': 'url("/ui/arcane-profile-runes-bg.webp")',
    '--theme-overview-bg-image':
      'radial-gradient(circle at 18% 22%, rgba(123, 97, 255, 0.34), transparent 30%), radial-gradient(circle at 78% 36%, rgba(56, 169, 224, 0.22), transparent 34%), linear-gradient(135deg, rgba(13, 21, 49, 0.98), rgba(4, 9, 23, 0.98))',
    '--theme-settings-icon-image': getSystemIconImageCss('settings'),
    '--theme-pin-icon-image': getSystemIconImageCss('pin'),
    '--theme-plane-icon-image': getSystemIconImageCss('send'),
    '--shadow-sapphire': '0 26px 90px rgba(123, 97, 255, 0.24)',
  },
}
