import { useState, type KeyboardEvent, type PointerEvent } from 'react'
import { hexToHsv, hsvToHex, type HsvColor } from './hsvColor'
import styles from './SystemColorPicker.module.css'

type PaletteProps = {
  id: string
  color: string
  value: string
  onChange: (color: string) => void
}

function clampUnit(value: number) {
  return Math.min(1, Math.max(0, value))
}

export function SystemCustomColorPalette({ id, color, value, onChange }: PaletteProps) {
  const [selection, setSelection] = useState<{ hex: string; hsv: HsvColor } | null>(null)
  const hsv = selection?.hex === value ? selection.hsv : hexToHsv(color)

  function select(next: HsvColor) {
    const hex = hsvToHex(next)
    setSelection({ hex, hsv: next })
    onChange(hex)
  }

  function selectPoint(event: PointerEvent<HTMLDivElement>) {
    const bounds = event.currentTarget.getBoundingClientRect()
    select({
      hue: hsv.hue,
      saturation: clampUnit((event.clientX - bounds.left) / bounds.width),
      brightness: clampUnit(1 - (event.clientY - bounds.top) / bounds.height),
    })
  }

  function startSelection(event: PointerEvent<HTMLDivElement>) {
    if (event.button !== 0 || !event.isPrimary) return
    event.currentTarget.focus({ preventScroll: true })
    event.currentTarget.setPointerCapture(event.pointerId)
    selectPoint(event)
  }

  function changeWithKeyboard(event: KeyboardEvent<HTMLDivElement>) {
    const step = event.shiftKey ? 0.1 : 0.01
    const directions: Partial<Record<string, [number, number]>> = {
      ArrowLeft: [-step, 0],
      ArrowRight: [step, 0],
      ArrowDown: [0, -step],
      ArrowUp: [0, step],
    }
    const direction = directions[event.key]
    if (!Array.isArray(direction)) return
    event.preventDefault()
    select({
      hue: hsv.hue,
      saturation: clampUnit(hsv.saturation + direction[0]),
      brightness: clampUnit(hsv.brightness + direction[1]),
    })
  }

  const saturation = Math.round(hsv.saturation * 100)
  const brightness = Math.round(hsv.brightness * 100)
  return (
    <div id={id} className={styles.customPalette}>
      <div
        className={styles.colorPlane}
        role="slider"
        tabIndex={0}
        aria-label="Насыщенность и яркость"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={saturation}
        aria-valuetext={`Насыщенность ${saturation}%, яркость ${brightness}%`}
        aria-describedby={`${id}-instructions`}
        style={{ backgroundColor: `hsl(${hsv.hue} 100% 50%)` }}
        onPointerDown={startSelection}
        onPointerMove={(event) => {
          if (event.currentTarget.hasPointerCapture(event.pointerId)) selectPoint(event)
        }}
        onKeyDown={changeWithKeyboard}
      >
        <span
          className={styles.colorMarker}
          style={{
            left: `${hsv.saturation * 100}%`,
            top: `${(1 - hsv.brightness) * 100}%`,
            backgroundColor: color,
          }}
          aria-hidden="true"
        />
      </div>
      <span id={`${id}-instructions`} className={styles.instructions}>
        Стрелки влево и вправо меняют насыщенность, вверх и вниз — яркость.
      </span>
      <label className={styles.hueControl}>
        Оттенок
        <input
          className={styles.hue}
          type="range"
          min={0}
          max={360}
          value={Math.round(hsv.hue)}
          onChange={(event) => select({ ...hsv, hue: event.currentTarget.valueAsNumber })}
        />
      </label>
    </div>
  )
}
