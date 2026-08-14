import { useMemo, useState } from 'react'
import type { CSSProperties } from 'react'
import {
  DEFAULT_SYSTEM_THEME_CODE,
  getSystemTheme,
  SYSTEM_THEMES,
} from '../../../styles/systemThemes'
import { buildSystemThemeVariables } from '../../../styles/systemThemeTokens'
import { authCopy } from '../../../system/shared/index'
import styles from './AuthThemeTestCard.module.css'

const sampleTokens = [
  [authCopy.themeTest.surface, '--color-bg'],
  [authCopy.themeTest.panel, '--color-surface'],
  [authCopy.themeTest.denseSurface, '--color-surface-strong'],
  [authCopy.themeTest.border, '--color-border'],
  [authCopy.themeTest.text, '--color-text'],
  [authCopy.themeTest.mutedText, '--color-muted'],
  [authCopy.themeTest.accent, '--color-sapphire'],
  [authCopy.themeTest.lightAccent, '--color-sapphire-light'],
  [authCopy.themeTest.success, '--color-success'],
  [authCopy.themeTest.danger, '--color-danger'],
] as const

export function AuthThemeTestCard() {
  const [selectedThemeCode, setSelectedThemeCode] = useState(
    DEFAULT_SYSTEM_THEME_CODE,
  )
  const selectedTheme = getSystemTheme(selectedThemeCode)
  const previewStyle = useMemo(
    () =>
      buildSystemThemeVariables(
        selectedTheme.variables,
      ) as CSSProperties & Record<string, string>,
    [selectedTheme],
  )

  return (
    <details className={styles.themeTester}>
      <summary>
        <span>Theme test lab</span>
        <strong>{selectedTheme.title}</strong>
      </summary>

      <section className={styles.themeTesterBody} style={previewStyle}>
        <div className={styles.themePicker} aria-label={authCopy.themeTest.themePicker}>
          {SYSTEM_THEMES.map((theme) => (
            <button
              key={theme.code}
              className={
                theme.code === selectedTheme.code ? styles.themeOptionActive : ''
              }
              type="button"
              onClick={() => setSelectedThemeCode(theme.code)}
            >
              <span
                aria-hidden="true"
                style={{ background: theme.dominantColor }}
              />
              {theme.title}
            </button>
          ))}
        </div>

        <div className={styles.colorGrid}>
          {sampleTokens.map(([label, token]) => (
            <div key={token} className={styles.colorToken}>
              <span style={{ background: `var(${token})` }} />
              <strong>{label}</strong>
              <small>{token}</small>
            </div>
          ))}
        </div>

        <div className={styles.demoGrid}>
          <article className={styles.demoPanel}>
            <header>
              <span>{authCopy.themeTest.panel}</span>
              <strong>{authCopy.themeTest.activeFrame}</strong>
            </header>
            <p>{authCopy.themeTest.description}</p>
            <div className={styles.demoRow}>
              <button className={styles.primaryButton} type="button">
                Primary
              </button>
              <button className={styles.secondaryButton} type="button">
                Secondary
              </button>
            </div>
          </article>

          <article className={styles.demoPanel}>
            <header>
              <span>{authCopy.themeTest.forms}</span>
              <strong>{authCopy.themeTest.fieldsAndToggles}</strong>
            </header>
            <label className={styles.demoInput}>
              <span>{authCopy.themeTest.name}</span>
              <input value="Arcane Link" readOnly />
            </label>
            <label className={styles.demoToggle}>
              <input type="checkbox" checked readOnly />
              <span />
              {authCopy.themeTest.applyTheme}
            </label>
          </article>

          <article className={styles.demoPanel}>
            <header>
              <span>{authCopy.themeTest.lists}</span>
              <strong>{authCopy.themeTest.selectedStates}</strong>
            </header>
            <div className={styles.listItem}>{authCopy.themeTest.normalItem}</div>
            <div className={`${styles.listItem} ${styles.listItemActive}`}>
              {authCopy.themeTest.activeItem}
            </div>
            <div className={styles.chipRow}>
              <span className={styles.chip}>Badge</span>
              <span className={styles.chipSuccess}>Online</span>
              <span className={styles.chipDanger}>Danger</span>
            </div>
          </article>

          <article className={styles.demoPanel}>
            <header>
              <span>{authCopy.themeTest.gradients}</span>
              <strong>{authCopy.themeTest.accentLayers}</strong>
            </header>
            <div className={styles.gradientPreview} />
            <div className={styles.glowPreview}>Glow</div>
          </article>
        </div>
      </section>
    </details>
  )
}
