export const SYSTEM_THEME_STORAGE_KEY = 'arcanelink.systemThemeCode';

export type SystemThemeVariableMap = Record<string, string>;

export const SYSTEM_THEME_VARIABLE_NAMES = [
  '--color-bg',
  '--color-surface',
  '--color-surface-strong',
  '--color-border',
  '--color-text',
  '--color-muted',
  '--color-sapphire',
  '--color-sapphire-light',
  '--color-violet',
  '--color-rune',
  '--color-danger',
  '--color-success',
  '--theme-accent',
  '--theme-accent-light',
  '--theme-accent-contrast',
  '--theme-bg-start',
  '--theme-bg-mid',
  '--theme-bg-end',
  '--theme-text-soft',
  '--theme-text-faint',
  '--theme-border-soft',
  '--theme-border-control',
  '--theme-border-accent',
  '--theme-frame-bg',
  '--theme-frame-bg-strong',
  '--theme-control-bg',
  '--theme-control-bg-strong',
  '--theme-hover-bg',
  '--theme-active-bg',
  '--theme-section-border',
  '--theme-scrollbar-track',
  '--theme-scrollbar-thumb',
  '--theme-glow',
  '--theme-glow-strong',
  '--theme-icon-gradient-start',
  '--theme-icon-gradient-middle',
  '--theme-icon-gradient-end',
  '--theme-icon-outline',
  '--theme-icon-glow-color',
  '--theme-backdrop-glow',
  '--theme-surface-raised',
  '--theme-surface-accent',
  '--theme-surface-accent-strong',
  '--theme-avatar-bg',
  '--theme-avatar-contrast',
  '--theme-arcane-backdrop',
  '--theme-profile-bg-image',
  '--theme-overview-bg-image',
  '--theme-settings-icon-image',
  '--theme-pin-icon-image',
  '--theme-plane-icon-image',
  '--shadow-sapphire'
];

export function buildSystemThemeVariables(
  variables: SystemThemeVariableMap
): SystemThemeVariableMap {
  return {
    '--theme-accent': 'var(--color-sapphire)',
    '--theme-accent-light': 'var(--color-sapphire-light)',
    '--theme-bg-start': 'color-mix(in srgb, var(--color-bg), #000 48%)',
    '--theme-bg-mid': 'var(--color-bg)',
    '--theme-bg-end': 'color-mix(in srgb, var(--color-bg), #000 34%)',
    '--theme-text-soft':
      'color-mix(in srgb, var(--color-text), transparent 20%)',
    '--theme-text-faint':
      'color-mix(in srgb, var(--color-text), transparent 42%)',
    '--theme-border-soft':
      'color-mix(in srgb, var(--color-border), var(--theme-accent) 16%)',
    '--theme-border-control':
      'color-mix(in srgb, var(--color-border), var(--theme-accent) 12%)',
    '--theme-border-accent':
      'color-mix(in srgb, var(--theme-accent), transparent 42%)',
    '--theme-frame-bg': 'color-mix(in srgb, var(--color-bg), transparent 18%)',
    '--theme-frame-bg-strong': 'color-mix(in srgb, var(--color-bg), #000 8%)',
    '--theme-control-bg':
      'color-mix(in srgb, var(--color-bg), transparent 30%)',
    '--theme-control-bg-strong':
      'color-mix(in srgb, var(--color-bg), #000 16%)',
    '--theme-hover-bg':
      'color-mix(in srgb, var(--theme-accent), transparent 78%)',
    '--theme-active-bg':
      'color-mix(in srgb, var(--theme-accent), transparent 68%)',
    '--theme-section-border':
      'color-mix(in srgb, var(--theme-accent-light), transparent 72%)',
    '--theme-scrollbar-track': 'color-mix(in srgb, var(--color-bg), #000 18%)',
    '--theme-scrollbar-thumb':
      'color-mix(in srgb, var(--theme-accent), transparent 26%)',
    '--theme-glow': 'color-mix(in srgb, var(--theme-accent), transparent 76%)',
    '--theme-glow-strong':
      'color-mix(in srgb, var(--theme-accent), transparent 60%)',
    '--theme-icon-gradient-start':
      'color-mix(in srgb, var(--theme-accent-light), #ffffff 38%)',
    '--theme-icon-gradient-middle': 'var(--theme-accent-light)',
    '--theme-icon-gradient-end':
      'color-mix(in srgb, var(--theme-accent), #000000 10%)',
    '--theme-icon-outline':
      'color-mix(in srgb, var(--color-text), transparent 8%)',
    '--theme-icon-glow-color':
      'color-mix(in srgb, var(--theme-accent-light), transparent 34%)',
    '--theme-backdrop-glow':
      'color-mix(in srgb, var(--theme-accent), transparent 82%)',
    '--theme-surface-raised':
      'radial-gradient(circle at 0% 0%, color-mix(in srgb, var(--theme-accent), transparent 84%), transparent 32%), linear-gradient(180deg, color-mix(in srgb, var(--color-bg), #ffffff 5%), color-mix(in srgb, var(--color-bg), #000 10%))',
    '--theme-surface-accent':
      'linear-gradient(135deg, color-mix(in srgb, var(--theme-accent), #ffffff 4%), color-mix(in srgb, var(--theme-accent), #000 22%))',
    '--theme-surface-accent-strong':
      'linear-gradient(180deg, color-mix(in srgb, var(--theme-accent), #ffffff 4%), color-mix(in srgb, var(--theme-accent), #000 26%))',
    '--theme-avatar-bg': 'var(--theme-surface-accent)',
    '--theme-avatar-contrast': 'var(--theme-accent-contrast)',
    '--theme-arcane-backdrop':
      'linear-gradient(180deg, color-mix(in srgb, var(--color-bg), transparent 16%), color-mix(in srgb, var(--color-bg), #000 8%)), radial-gradient(circle at 76% 26%, var(--theme-backdrop-glow), transparent 30%)',
    '--theme-profile-bg-image': 'none',
    '--theme-overview-bg-image': 'none',
    '--theme-settings-icon-image': 'none',
    '--theme-pin-icon-image': 'none',
    '--theme-plane-icon-image': 'none',
    ...variables
  };
}
