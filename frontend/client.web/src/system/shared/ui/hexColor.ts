export const hexColorPattern = '#[0-9a-fA-F]{6}'

const hexColorExpression = new RegExp(`^${hexColorPattern}$`)

export function normalizeHexColor(value: unknown) {
  return typeof value === 'string' && hexColorExpression.test(value)
    ? value.toLowerCase()
    : null
}
