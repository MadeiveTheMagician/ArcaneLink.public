export type ContextMenuIcon =
  | 'audio'
  | 'block'
  | 'call'
  | 'copy'
  | 'edit'
  | 'friend'
  | 'report'
  | 'invite'
  | 'leave'
  | 'message'
  | 'profile'
  | 'role'
  | 'settings'
  | 'space'
  | 'trash'
  | 'video'

export type ContextMenuItem =
  | {
      id?: string
      type: 'item'
      label: string
      hint?: string
      icon?: ContextMenuIcon
      danger?: boolean
      disabled?: boolean
      selected?: boolean
      visualLabel?: string
      compact?: boolean
      onSelect?: () => void
      submenu?: ContextMenuItem[]
      submenuLayout?: 'list' | 'grid'
    }
  | {
      id?: string
      type: 'separator'
    }
  | {
      id?: string
      type: 'range'
      label: string
      icon?: ContextMenuIcon
      value: number
      valueLabel?: string
      min: number
      max: number
      step: number
      disabled?: boolean
      onChange: (value: number) => void
    }

export function getContextMenuItemKey(
  item: ContextMenuItem,
  index: number,
) {
  return (
    item.id ??
    (item.type === 'separator'
      ? `separator:${index}`
      : `${item.type}:${item.label}:${index}`)
  )
}
