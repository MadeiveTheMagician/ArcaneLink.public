export function formatUnreadCount(count: number) {
  const normalizedCount = normalizeUnreadCount(count)
  return normalizedCount > 99 ? '99+' : String(normalizedCount)
}

export function normalizeUnreadCount(count: number) {
  return Number.isFinite(count) ? Math.max(0, Math.floor(count)) : 0
}

export function getUnreadMessageLabel(count: number) {
  const normalizedCount = normalizeUnreadCount(count)
  return normalizedCount > 0
    ? `Непрочитанных сообщений: ${normalizedCount}`
    : null
}
