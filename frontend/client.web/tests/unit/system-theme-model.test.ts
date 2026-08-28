import { expect, test } from '@playwright/test'
import {
  buildSystemThemeVariables,
  SYSTEM_THEME_VARIABLE_NAMES,
} from '../../src/styles/systemThemeTokens'
import {
  getThemeDominantTextColor,
  SYSTEM_THEMES,
} from '../../src/styles/systemThemes'

function relativeLuminance(color: string) {
  const channels = [1, 3, 5].map(
    (offset) => Number.parseInt(color.slice(offset, offset + 2), 16) / 255,
  )
  const [red, green, blue] = channels.map((channel) =>
    channel <= 0.04045
      ? channel / 12.92
      : ((channel + 0.055) / 1.055) ** 2.4,
  )

  return red * 0.2126 + green * 0.7152 + blue * 0.0722
}

function contrastRatio(first: string, second: string) {
  const luminances = [relativeLuminance(first), relativeLuminance(second)]
  const lighter = Math.max(...luminances)
  const darker = Math.min(...luminances)

  return (lighter + 0.05) / (darker + 0.05)
}

const READABLE_THEME_TOKENS = [
  '--color-text',
  '--color-muted',
  '--color-sapphire-light',
  '--color-rune',
  '--color-danger',
  '--color-success',
  '--theme-text-soft',
  '--theme-text-faint',
] as const

function expectReadableThemeTokens(themeCode: 'graphite' | 'snow') {
  const theme = SYSTEM_THEMES.find((item) => item.code === themeCode)!
  const variables = buildSystemThemeVariables(theme.variables)
  const background = variables['--color-bg']

  for (const token of READABLE_THEME_TOKENS) {
    expect(
      contrastRatio(variables[token], background),
      `${themeCode}: ${token} should meet WCAG AA contrast`,
    ).toBeGreaterThanOrEqual(4.5)
  }
}

function expectAchromaticCssColor(value: string, label: string) {
  const channels = [
    ...value.matchAll(/#([0-9a-f]{6})\b/gi),
  ].map((match) => [
    Number.parseInt(match[1].slice(0, 2), 16),
    Number.parseInt(match[1].slice(2, 4), 16),
    Number.parseInt(match[1].slice(4, 6), 16),
  ])

  for (const match of value.matchAll(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/gi)) {
    channels.push(match.slice(1, 4).map(Number))
  }

  for (const colorChannels of channels) {
    expect(
      Math.max(...colorChannels) - Math.min(...colorChannels),
      `${label} should not introduce a chromatic tint: ${value}`,
    ).toBe(0)
  }
}

test.describe('system theme model', () => {
  test('every theme resolves the shared SVG icon palette', () => {
    for (const theme of SYSTEM_THEMES) {
      const variables = buildSystemThemeVariables(theme.variables)

      for (const name of SYSTEM_THEME_VARIABLE_NAMES) {
        expect(variables[name], `${theme.code}: ${name}`).toBeTruthy()
      }

      expect(variables['--theme-icon-gradient-start']).not.toBe('none')
      expect(variables['--theme-icon-gradient-end']).not.toBe('none')
      expect(variables['--theme-icon-outline']).not.toBe('none')
    }
  })

  test('green apple combines a pastel green accent with a brown companion', () => {
    const theme = SYSTEM_THEMES.find((item) => item.code === 'green-apple')!

    expect(theme.dominantColor).toBe('#96ad78')
    expect(theme.previewColors).toContain('#98735a')
    expect(theme.variables['--color-violet']).toBe('#98735a')
    expect(theme.variables['--color-surface']).not.toContain('0, 241, 32')
  })

  test('graphite keeps every decorative layer achromatic', () => {
    const theme = SYSTEM_THEMES.find((item) => item.code === 'graphite')!

    expect(theme.title).toBe('Графитовая')
    expect(theme.dominantColor).toBe('#313131')
    expect(theme.previewColors).toEqual(['#121212', '#313131', '#666666'])
    expect(theme.variables['--color-bg']).toBe('#121212')
    expect(theme.variables['--color-surface']).toBe('#1a1a1a')
    expect(theme.variables['--color-text']).toBe('#f2f2f2')
    expect(theme.variables['--color-muted']).toBe('#b8b8b8')
    expect(theme.variables['--color-sapphire']).toBe('#666666')
    expect(theme.variables['--color-sapphire-light']).toBe('#b8b8b8')
    expect(theme.variables['--color-violet']).toBe('#909090')
    expect(theme.variables['--theme-hover-bg']).toBe('#252525')
    expect(theme.variables['--theme-active-bg']).toBe('#2c2c2c')
    expect(theme.variables['--theme-icon-gradient-start']).toBe('#f2f2f2')
    expect(theme.variables['--theme-icon-gradient-middle']).toBe('#b8b8b8')
    expect(theme.variables['--theme-icon-gradient-end']).toBe('#808080')
    expect(theme.variables['--theme-avatar-bg']).toBe(
      'linear-gradient(135deg, #444444, #2c2c2c)',
    )
    expect(theme.variables['--theme-avatar-contrast']).toBe('#f2f2f2')
    expect(
      contrastRatio(
        theme.variables['--theme-accent-contrast'],
        theme.variables['--color-sapphire'],
      ),
    ).toBeGreaterThanOrEqual(4.5)

    const strongAccentStops = ['#666666', '#4e4e4e']
    expect(theme.variables['--theme-surface-accent-strong']).toBe(
      `linear-gradient(180deg, ${strongAccentStops.join(', ')})`,
    )
    for (const accentStop of strongAccentStops) {
      expect(contrastRatio('#ffffff', accentStop)).toBeGreaterThanOrEqual(4.5)
    }
    for (const [name, value] of Object.entries(theme.variables)) {
      if (name === '--color-danger' || name === '--color-success') {
        continue
      }
      expectAchromaticCssColor(value, `graphite: ${name}`)
    }
    for (const [index, value] of theme.previewColors.entries()) {
      expectAchromaticCssColor(value, `graphite preview ${index + 1}`)
    }
    expectReadableThemeTokens('graphite')
  })

  test('snow uses a near-white base with readable cool gray text', () => {
    const theme = SYSTEM_THEMES.find((item) => item.code === 'snow')!

    expect(theme.title).toBe('Снежная')
    expect(theme.dominantColor).toBe('#e4e7ec')
    expect(theme.previewColors).toEqual(['#f8fafc', '#e4e7ec', '#647184'])
    expect(theme.variables['--color-bg']).toBe('#f8fafc')
    expect(theme.variables['--color-text']).toBe('#1f2937')
    expect(theme.variables['--color-muted']).toBe('#5f6977')
    expect(getThemeDominantTextColor(theme.dominantColor)).toBe('#10131f')

    const accentStops = ['#647184', '#515e6f']
    expect(theme.variables['--theme-surface-accent']).toBe(
      `linear-gradient(135deg, ${accentStops.join(', ')})`,
    )
    expect(theme.variables['--theme-surface-accent-strong']).toBe(
      `linear-gradient(180deg, ${accentStops.join(', ')})`,
    )
    for (const accentStop of accentStops) {
      expect(contrastRatio('#ffffff', accentStop)).toBeGreaterThanOrEqual(4.5)
    }
    for (const controlSurface of ['#f8fafc', '#edf0f4', '#dee2e8']) {
      expect(
        contrastRatio(
          theme.variables['--color-sapphire-light'],
          controlSurface,
        ),
      ).toBeGreaterThanOrEqual(4.5)
    }
    expect(theme.variables['--color-success']).toBe('#287a50')
    expectReadableThemeTokens('snow')
  })

  test('theme tiles derive readable text from their own dominant color', () => {
    expect(getThemeDominantTextColor('#f4ead2')).toBe('#10131f')
    expect(getThemeDominantTextColor('#101116')).toBe('#ffffff')
    expect(getThemeDominantTextColor('#7b61ff')).toBe('#ffffff')
  })
})
