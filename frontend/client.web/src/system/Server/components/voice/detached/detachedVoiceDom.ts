import { clampNumber } from './detachedVoiceLayoutModel'
import {
  getDetachedUtilityIconCss,
  type DetachedUtilityIconName,
} from './detachedVoiceIcons'

export function createDetachedLabeledField(
  document: Document,
  text: string,
  field: HTMLElement,
) {
  const label = document.createElement('label')
  label.className = 'arcane-detached-labeled-field'

  const caption = document.createElement('span')
  caption.className = 'arcane-detached-field-caption'
  caption.textContent = text

  label.append(caption, field)
  return label
}

export function createDetachedFieldGrid(
  document: Document,
  options: {
    columns: number
    maxColumnWidth?: string
  },
) {
  const grid = document.createElement('div')
  grid.className = 'arcane-detached-field-grid'
  grid.style.setProperty('--detached-field-columns', String(options.columns))
  if (options.maxColumnWidth) {
    grid.style.setProperty('--detached-field-max-width', options.maxColumnWidth)
  }
  return grid
}

export function createDetachedCheckboxLabel(
  document: Document,
  text: string,
  options: {
    checked: boolean
    disabled?: boolean
    variant?: 'row' | 'inline'
    title?: string
    onChange: (checked: boolean) => void
  },
) {
  const label = document.createElement('label')
  label.className = 'arcane-detached-checkbox-label'
  label.dataset.variant = options.variant ?? 'row'
  if (options.title) {
    label.title = options.title
  }
  label.append(text)

  const input = document.createElement('input')
  input.type = 'checkbox'
  input.checked = options.checked
  input.disabled = Boolean(options.disabled)
  input.addEventListener('change', () => {
    options.onChange(input.checked)
  })

  label.append(input)
  return label
}

export function createDetachedNumberInput(
  document: Document,
  options: {
    value: number | string
    min?: number | string
    max?: number | string
    step?: number | string
    title?: string
    variant?: 'slot' | 'settings'
  },
) {
  const input = document.createElement('input')
  input.type = 'number'
  if (options.min !== undefined) {
    input.min = String(options.min)
  }
  if (options.max !== undefined) {
    input.max = String(options.max)
  }
  if (options.step !== undefined) {
    input.step = String(options.step)
  }
  if (options.title) {
    input.title = options.title
  }
  input.value = typeof options.value === 'number'
    ? formatDetachedSlotNumber(options.value)
    : options.value
  input.className = 'arcane-detached-field'
  input.dataset.variant = options.variant ?? 'slot'
  attachDetachedWheelNumberInput(input)

  return input
}

export function createDetachedTextInput(
  document: Document,
  options: {
    value: string
    placeholder?: string
    variant?: 'slot' | 'settings'
    onChange: (value: string) => void
  },
) {
  const input = document.createElement('input')
  input.type = 'text'
  input.value = options.value
  if (options.placeholder) {
    input.placeholder = options.placeholder
  }
  input.className = 'arcane-detached-field'
  input.dataset.variant = options.variant ?? 'settings'
  input.addEventListener('change', () => {
    options.onChange(input.value)
  })

  return input
}

export function createDetachedRadioGroup<TValue extends string>(
  document: Document,
  options: {
    legend: string
    name: string
    value: TValue
    items: Array<{ value: TValue; label: string }>
    onChange: (value: TValue) => void
  },
) {
  const group = document.createElement('fieldset')
  group.className = 'arcane-detached-radio-group'

  const legend = document.createElement('legend')
  legend.className = 'arcane-detached-radio-legend'
  legend.textContent = options.legend

  const list = document.createElement('div')
  list.className = 'arcane-detached-radio-list'

  options.items.forEach((item) => {
    const label = document.createElement('label')
    label.className = 'arcane-detached-radio-option'
    label.dataset.active = options.value === item.value ? 'true' : 'false'

    const input = document.createElement('input')
    input.type = 'radio'
    input.name = options.name
    input.value = item.value
    input.checked = options.value === item.value
    input.addEventListener('change', () => {
      options.onChange(item.value)
    })

    const text = document.createElement('span')
    text.className = 'arcane-detached-radio-text'
    text.textContent = item.label

    label.append(input, text)
    list.append(label)
  })

  group.append(legend, list)
  return group
}

export function createDetachedDropdownButton(
  document: Document,
  options: {
    text: string
    variant?: 'slot' | 'settings'
  },
) {
  const button = document.createElement('button')
  button.type = 'button'
  button.className = 'arcane-detached-field arcane-detached-dropdown-button'
  button.dataset.variant = options.variant ?? 'settings'

  const label = document.createElement('span')
  label.className = 'arcane-detached-dropdown-label'
  label.textContent = options.text

  button.append(label, createDetachedDropdownArrow(document))
  return button
}

export function createDetachedDropdownMenu(
  document: Document,
  options: {
    variant?: 'anchored' | 'side'
  } = {},
) {
  const menu = document.createElement('div')
  menu.className = 'arcane-detached-dropdown-menu'
  menu.dataset.variant = options.variant ?? 'anchored'
  return menu
}

export function createDetachedMenuOption(
  document: Document,
  options: {
    text: string
    active?: boolean
    padding?: string
    onSelect: () => void
  },
) {
  const optionButton = document.createElement('button')
  optionButton.type = 'button'
  optionButton.className = 'arcane-detached-menu-option'
  optionButton.dataset.active = options.active ? 'true' : 'false'
  optionButton.setAttribute('role', 'menuitem')
  optionButton.textContent = options.text
  if (options.padding) {
    optionButton.style.setProperty('--detached-option-padding', options.padding)
  }
  optionButton.addEventListener('click', options.onSelect)

  return optionButton
}

export function createDetachedIconButton(
  document: Document,
  options: {
    label: string
    icon: DetachedUtilityIconName
    onClick: () => void
  },
) {
  const button = document.createElement('button')
  button.type = 'button'
  button.className = 'arcane-icon-button'
  button.setAttribute('aria-label', options.label)

  const icon = document.createElement('span')
  icon.setAttribute('aria-hidden', 'true')
  icon.style.background = getDetachedUtilityIconCss(options.icon)

  button.append(icon)
  button.addEventListener('click', options.onClick)
  return button
}

export function createDetachedCompactButton(
  document: Document,
  options: {
    text: string
    danger?: boolean
    onClick: () => void
  },
) {
  const button = document.createElement('button')
  button.type = 'button'
  button.className = 'arcane-detached-compact-button'
  button.dataset.danger = options.danger ? 'true' : 'false'
  button.textContent = options.text
  button.addEventListener('click', options.onClick)
  return button
}

export function createDetachedDropdownArrow(document: Document) {
  const arrow = document.createElement('span')
  arrow.className = 'arcane-detached-dropdown-arrow'
  arrow.setAttribute('aria-hidden', 'true')

  return arrow
}

export function formatDetachedSlotNumber(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(2)
}

export function attachDetachedWheelNumberInput(input: HTMLInputElement) {
  input.addEventListener(
    'wheel',
    (event) => {
      event.preventDefault()
      const step = Number(input.step) || 1
      const currentValue = Number(input.value) || 0
      const direction = event.deltaY < 0 ? 1 : -1
      const min = input.min === ''
        ? Number.NEGATIVE_INFINITY
        : Number(input.min)
      const max = input.max === ''
        ? Number.POSITIVE_INFINITY
        : Number(input.max)
      const nextValue = clampNumber(
        currentValue + step * direction,
        Number.isFinite(min) ? min : Number.NEGATIVE_INFINITY,
        Number.isFinite(max) ? max : Number.POSITIVE_INFINITY,
      )

      input.value = formatDetachedSlotNumber(nextValue)
      const EventConstructor = input.ownerDocument.defaultView?.Event ?? Event
      input.dispatchEvent(new EventConstructor('change', { bubbles: true }))
    },
    { passive: false },
  )
}
