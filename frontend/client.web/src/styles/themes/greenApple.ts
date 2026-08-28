import type { SystemTheme } from '../systemThemes';
import { themeCopy } from '../theme.copy';

export const greenAppleTheme: SystemTheme = {
  code: 'green-apple',
  title: themeCopy.titles.greenApple,
  dominantColor: '#96ad78',
  previewColors: ['#182019', '#a8bd8c', '#98735a'],
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
    '--color-bg': '#182019',
    '--color-surface': 'rgba(31, 40, 31, 0.84)',
    '--color-surface-strong': 'rgba(34, 44, 34, 0.96)',
    '--color-border': '#596657',
    '--color-text': '#edf2e7',
    '--color-muted': '#b4bda8',
    '--color-sapphire': '#96ad78',
    '--color-sapphire-light': '#c2d2ad',
    '--color-violet': '#98735a',
    '--color-rune': '#d8c5ae',
    '--color-danger': '#d78679',
    '--color-success': '#b9c98c',
    '--theme-accent-contrast': '#172018',
    '--theme-bg-start': '#0f1510',
    '--theme-bg-mid': '#1b251c',
    '--theme-bg-end': '#30261f',
    '--theme-frame-bg': 'rgba(26, 35, 27, 0.9)',
    '--theme-frame-bg-strong': 'rgba(29, 38, 30, 0.96)',
    '--theme-control-bg': 'rgba(42, 52, 41, 0.74)',
    '--theme-control-bg-strong': 'rgba(25, 33, 26, 0.92)',
    '--theme-hover-bg': 'rgba(150, 173, 120, 0.16)',
    '--theme-active-bg': 'rgba(150, 173, 120, 0.24)',
    '--theme-border-soft': 'rgba(194, 210, 173, 0.2)',
    '--theme-border-control': 'rgba(194, 210, 173, 0.28)',
    '--theme-border-accent': 'rgba(168, 189, 140, 0.5)',
    '--theme-section-border': 'rgba(152, 115, 90, 0.34)',
    '--theme-scrollbar-track': 'rgba(14, 24, 12, 0.72)',
    '--theme-scrollbar-thumb': 'rgba(108, 143, 75, 0.56)',
    '--theme-backdrop-glow': 'rgba(104, 141, 69, 0.12)',
    '--theme-glow': 'rgba(104, 141, 69, 0.14)',
    '--theme-glow-strong': 'rgba(104, 141, 69, 0.22)',
    '--theme-surface-raised':
      'radial-gradient(circle at 0% 0%, rgba(194, 210, 173, 0.14), transparent 34%), linear-gradient(180deg, rgba(38, 49, 38, 0.98), rgba(25, 33, 26, 0.98))',
    '--theme-surface-accent':
      'linear-gradient(135deg, rgba(150, 173, 120, 0.92), rgba(152, 115, 90, 0.82))',
    '--theme-surface-accent-strong':
      'linear-gradient(180deg, rgba(194, 210, 173, 0.94), rgba(130, 102, 79, 0.9))',
    '--theme-arcane-backdrop':
      'linear-gradient(180deg, rgba(24, 37, 19, 0.16), rgba(13, 23, 11, 0.24)), radial-gradient(circle at 76% 26%, rgba(104, 141, 69, 0.12), transparent 30%)',
    '--shadow-sapphire': '0 26px 90px rgba(85, 124, 53, 0.16)'
  }
};
