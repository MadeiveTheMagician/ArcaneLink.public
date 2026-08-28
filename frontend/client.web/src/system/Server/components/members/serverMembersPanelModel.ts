export type ServerMembersPanelDisclosure = {
  ariaHidden: boolean
  inert: boolean
  state: 'collapsed' | 'expanded'
  toggleExpanded: boolean
  toggleLabel: string
}

export function getServerMembersPanelDisclosure(
  isCollapsed: boolean,
): ServerMembersPanelDisclosure {
  return {
    ariaHidden: isCollapsed,
    inert: isCollapsed,
    state: isCollapsed ? 'collapsed' : 'expanded',
    toggleExpanded: !isCollapsed,
    toggleLabel: isCollapsed
      ? 'Показать участников'
      : 'Скрыть участников',
  }
}
