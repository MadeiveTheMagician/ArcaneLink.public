import {
  buildSystemThemeVariables,
  SYSTEM_THEME_VARIABLE_NAMES,
  SYSTEM_THEME_STORAGE_KEY,
} from './systemThemeTokens'
import { blackTheme } from './themes/black'
import { grayTheme } from './themes/gray'
import { greenAppleTheme } from './themes/greenApple'
import { ivoryTheme } from './themes/ivory'
import { pinkTheme } from './themes/pink'
import { sapphireTheme } from './themes/sapphire'
import { skyTheme } from './themes/sky'

export const DEFAULT_SYSTEM_THEME_CODE = 'sapphire'

export type SystemThemeCode =
  | 'sapphire'
  | 'ivory'
  | 'gray'
  | 'sky'
  | 'black'
  | 'pink'
  | 'green-apple'

export type SystemTheme = {
  code: SystemThemeCode
  title: string
  dominantColor: string
  previewColors: string[]
  assetSet: 'sapphire' | 'none'
  variables: Record<string, string>
}

export const SYSTEM_THEMES: SystemTheme[] = [
  sapphireTheme,
  ivoryTheme,
  grayTheme,
  skyTheme,
  blackTheme,
  pinkTheme,
  greenAppleTheme,
]

export function getSystemTheme(code: string | null | undefined) {
  return (
    SYSTEM_THEMES.find((theme) => theme.code === code) ??
    SYSTEM_THEMES.find((theme) => theme.code === DEFAULT_SYSTEM_THEME_CODE)!
  )
}

export function getProfileColor(themeCode: string, profileColor?: string | null) {
  return profileColor ?? getSystemTheme(themeCode).dominantColor
}

export function applySystemThemeToDocument(themeCode: string) {
  const theme = getSystemTheme(themeCode)
  const root = document.documentElement

  SYSTEM_THEME_VARIABLE_NAMES.forEach((name) => {
    root.style.removeProperty(name)
  })

  Object.entries(buildSystemThemeVariables(theme.variables)).forEach(([name, value]) => {
    root.style.setProperty(name, value)
  })

  root.dataset.systemTheme = theme.code
  root.dataset.systemThemeAssets = theme.assetSet
  localStorage.setItem(SYSTEM_THEME_STORAGE_KEY, theme.code)
}

export function applyLastSystemThemeFromStorage() {
  applySystemThemeToDocument(
    localStorage.getItem(SYSTEM_THEME_STORAGE_KEY) ?? DEFAULT_SYSTEM_THEME_CODE,
  )
}
