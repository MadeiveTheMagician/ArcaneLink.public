import { useId, useState } from 'react'
import { hexColorPattern } from './hexColor'
import { SystemCustomColorPalette } from './SystemCustomColorPalette'
import styles from './SystemColorPicker.module.css'

const colorPresets = [
  '#5865f2', '#8f7cff', '#4ca7ff', '#42d4a7', '#63b34a', '#f0c55e',
  '#f49d5f', '#ec626f', '#ff8f9a', '#d08cff', '#8b95a7', '#f5f6fa',
]

type SystemColorPickerProps = {
  label: string
  value: string
  previewColor: string
  onChange: (color: string) => void
}

export function SystemColorPicker({ label, value, previewColor, onChange }: SystemColorPickerProps) {
  const [isPaletteOpen, setIsPaletteOpen] = useState(false)
  const paletteId = useId()

  return (
    <fieldset className={styles.picker}>
      <legend>{label}</legend>
      <div className={styles.controls}>
        <span className={styles.preview} style={{ backgroundColor: previewColor }} aria-hidden="true" />
        <input
          className="ui-field-control"
          type="text"
          aria-label={label}
          value={value}
          pattern={hexColorPattern}
          maxLength={7}
          spellCheck={false}
          autoComplete="off"
          required
          onChange={(event) => onChange(event.currentTarget.value)}
        />
      </div>
      <div className={styles.presets}>
        {colorPresets.map((preset) => (
          <button
            key={preset}
            type="button"
            aria-label={`Выбрать цвет ${preset}`}
            aria-pressed={value.toLowerCase() === preset}
            title={preset}
            style={{ backgroundColor: preset }}
            onClick={() => onChange(preset)}
          />
        ))}
        <button
          type="button"
          className={styles.prism}
          aria-expanded={isPaletteOpen}
          aria-controls={isPaletteOpen ? paletteId : undefined}
          onClick={() => setIsPaletteOpen((open) => !open)}
        >
          <span>Свой цвет</span>
        </button>
      </div>
      {isPaletteOpen && (
        <SystemCustomColorPalette id={paletteId} color={previewColor} value={value} onChange={onChange} />
      )}
    </fieldset>
  )
}
