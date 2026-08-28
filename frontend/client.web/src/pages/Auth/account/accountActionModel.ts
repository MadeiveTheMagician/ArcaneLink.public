import { ApiError } from '../../../shared/api/api'

export type AuthAccountAction = {
  kind: 'confirm-email' | 'reset-password'
  token: string
}

export function resolveAuthAccountAction(
  search: string,
  hash = '',
): AuthAccountAction | null {
  const hashParameters = new URLSearchParams(hash.replace(/^#/, ''))
  const searchParameters = new URLSearchParams(search)
  const parameters = hashParameters.has('action')
    ? hashParameters
    : searchParameters
  const action = parameters.get('action')
  const token = parameters.get('token')?.trim()

  if (
    !token ||
    (action !== 'confirm-email' && action !== 'reset-password')
  ) {
    return null
  }

  return { kind: action, token }
}

export function hasApiErrorCode(error: unknown, code: string) {
  if (!(error instanceof ApiError) || !error.data || typeof error.data !== 'object') {
    return false
  }

  const errors = 'errors' in error.data ? error.data.errors : null

  return (
    Array.isArray(errors) &&
    errors.some(
      (item) =>
        Boolean(item) &&
        typeof item === 'object' &&
        'code' in item &&
        item.code === code,
    )
  )
}

export function clearAccountActionFromLocation(location: Location) {
  const url = new URL(location.href)
  url.searchParams.delete('action')
  url.searchParams.delete('token')

  const hashParameters = new URLSearchParams(url.hash.replace(/^#/, ''))
  if (hashParameters.has('action') || hashParameters.has('token')) {
    hashParameters.delete('action')
    hashParameters.delete('token')
    url.hash = hashParameters.size > 0 ? hashParameters.toString() : ''
  }

  return `${url.pathname}${url.search}${url.hash}`
}
