type DetachedVoiceDropdownOptions = {
  document: Document
  root: HTMLElement
  trigger: HTMLButtonElement
  menu: HTMLElement
}

let detachedVoiceDropdownId = 0

export function bindDetachedVoiceDropdown({
  document,
  root,
  trigger,
  menu,
}: DetachedVoiceDropdownOptions) {
  detachedVoiceDropdownId += 1
  const menuId = `arcane-detached-dropdown-${detachedVoiceDropdownId}`

  menu.id = menuId
  menu.hidden = true
  menu.setAttribute('role', 'menu')
  trigger.setAttribute('aria-controls', menuId)
  trigger.setAttribute('aria-expanded', 'false')
  trigger.setAttribute('aria-haspopup', 'menu')

  const setOpen = (isOpen: boolean) => {
    menu.hidden = !isOpen
    trigger.setAttribute('aria-expanded', isOpen ? 'true' : 'false')
    root.dataset.open = isOpen ? 'true' : 'false'
  }
  const close = () => setOpen(false)
  const toggle = () => setOpen(menu.hasAttribute('hidden'))

  const handleTriggerClick = (event: MouseEvent) => {
    event.stopPropagation()
    toggle()
  }
  const handleDocumentPointerDown = (event: PointerEvent) => {
    const target = event.target
    const ElementConstructor = document.defaultView?.Element
    if (
      !target ||
      !ElementConstructor ||
      !(target instanceof ElementConstructor) ||
      root.contains(target)
    ) {
      return
    }

    close()
  }
  const handleDocumentKeyDown = (event: KeyboardEvent) => {
    if (event.key !== 'Escape' || menu.hidden) {
      return
    }

    event.preventDefault()
    close()
    trigger.focus()
  }

  trigger.addEventListener('click', handleTriggerClick)
  document.addEventListener('pointerdown', handleDocumentPointerDown)
  document.addEventListener('keydown', handleDocumentKeyDown)

  return {
    close,
    cleanup: () => {
      trigger.removeEventListener('click', handleTriggerClick)
      document.removeEventListener('pointerdown', handleDocumentPointerDown)
      document.removeEventListener('keydown', handleDocumentKeyDown)
    },
  }
}
