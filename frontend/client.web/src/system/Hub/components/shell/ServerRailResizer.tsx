import { useRef, type KeyboardEvent, type PointerEvent } from 'react'
import { settingsCopy } from '../../../shared/copy'
import { maxServerRailColumns } from './useServerRailPreferences'
import styles from './HubPage.module.css'

type ServerRailResizerProps = {
  columnCount: number
  columnWidth: number
  onColumnCountChange: (columns: number) => void
}

export function ServerRailResizer({
  columnCount,
  columnWidth,
  onColumnCountChange,
}: ServerRailResizerProps) {
  const drag = useRef<{ pointerId: number; startX: number; startColumns: number } | null>(
    null,
  )

  function startResize(event: PointerEvent<HTMLDivElement>) {
    if (event.button !== 0 || !event.isPrimary) return

    event.preventDefault()
    event.currentTarget.setPointerCapture(event.pointerId)
    drag.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startColumns: columnCount,
    }
  }

  function resize(event: PointerEvent<HTMLDivElement>) {
    const activeDrag = drag.current
    if (!activeDrag || activeDrag.pointerId !== event.pointerId) return

    const columns = activeDrag.startColumns + (event.clientX - activeDrag.startX) / columnWidth
    onColumnCountChange(columns)
  }

  function finishResize(event: PointerEvent<HTMLDivElement>) {
    resize(event)
    clearDrag(event)
  }

  function clearDrag(event: PointerEvent<HTMLDivElement>) {
    if (drag.current?.pointerId === event.pointerId) drag.current = null
  }

  function resizeWithKeyboard(event: KeyboardEvent<HTMLDivElement>) {
    const columns: Partial<Record<string, number>> = {
      ArrowLeft: columnCount - 1,
      ArrowRight: columnCount + 1,
      Home: 1,
      End: maxServerRailColumns,
    }
    const next = columns[event.key]
    if (typeof next !== 'number') return

    event.preventDefault()
    onColumnCountChange(next)
  }

  return (
    <div
      className={styles.serverRailResizer}
      role="separator"
      tabIndex={0}
      aria-label={settingsCopy.interface.serverRailWidth}
      aria-orientation="vertical"
      aria-controls="server-rail"
      aria-valuemin={1}
      aria-valuemax={maxServerRailColumns}
      aria-valuenow={columnCount}
      onPointerDown={startResize}
      onPointerMove={resize}
      onPointerUp={finishResize}
      onPointerCancel={clearDrag}
      onLostPointerCapture={clearDrag}
      onKeyDown={resizeWithKeyboard}
    />
  )
}
