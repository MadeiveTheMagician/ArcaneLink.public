import { apiCopy } from './api.copy.ts'

export class ApiError extends Error {
  status: number
  data: unknown
  responseText: string

  constructor(
    message: string,
    status: number,
    data: unknown,
    responseText: string,
  ) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.data = data
    this.responseText = responseText
  }
}

export async function readJsonResponse<T>(response: Response): Promise<T> {
  const text = await response.text()
  const data = parseResponseJson(text)

  if (!response.ok) {
    throw new ApiError(
      getErrorMessage(response, data, text),
      response.status,
      data,
      text,
    )
  }

  return data as T
}

function parseResponseJson(text: string) {
  if (!text) {
    return null
  }

  try {
    return JSON.parse(text)
  } catch {
    return null
  }
}

function getErrorMessage(
  response: Response,
  data: unknown,
  text: string,
) {
  if (isErrorObject(data)) {
    const errorsMessage = getErrorDetailsMessage(data)

    if (errorsMessage) {
      return errorsMessage
    }

    return data.message ?? data.title ?? response.statusText
  }

  if (response.status === 413) {
    return apiCopy.errors.payloadTooLarge
  }

  if (text && !text.trimStart().startsWith('<')) {
    return text
  }

  return response.statusText || `Request failed with status ${response.status}`
}

function isErrorObject(data: unknown): data is {
  message?: string
  title?: string
  errors?: unknown
} {
  return Boolean(data) && typeof data === 'object'
}

function getErrorDetailsMessage(data: {
  errors?: unknown
}) {
  if (!Array.isArray(data.errors)) {
    return null
  }

  const messages = data.errors
    .map((error) => {
      if (!error || typeof error !== 'object' || !('message' in error)) {
        return null
      }

      const message = error.message
      return typeof message === 'string' && message.trim() ? message : null
    })
    .filter((message): message is string => Boolean(message))

  return messages.length > 0 ? messages.join('\n') : null
}

type ApiRequestOptions = Omit<RequestInit, 'body' | 'headers'> & {
  accessToken?: string
  body?: BodyInit | object | null
  headers?: HeadersInit
}

type AuthSessionController = {
  getAccessToken: () => Promise<string | null>
  refreshAccessToken: () => Promise<string | null>
  onUnauthorized: () => void
}

let authSessionController: AuthSessionController | null = null

export function configureApiAuthSession(controller: AuthSessionController) {
  authSessionController = controller
}

function createHeaders(options: ApiRequestOptions, accessToken?: string | null) {
  const headers = new Headers(options.headers)

  if (accessToken) {
    headers.set('Authorization', `Bearer ${accessToken}`)
  }

  if (
    options.body &&
    !isNativeRequestBody(options.body) &&
    !headers.has('Content-Type')
  ) {
    headers.set('Content-Type', 'application/json')
  }

  return headers
}

function isNativeRequestBody(body: ApiRequestOptions['body']) {
  return (
    body instanceof FormData ||
    body instanceof URLSearchParams ||
    body instanceof Blob ||
    body instanceof ArrayBuffer ||
    typeof body === 'string'
  )
}

function createBody(body: ApiRequestOptions['body']) {
  if (!body || isNativeRequestBody(body)) {
    return body
  }

  return JSON.stringify(body)
}

export async function apiRequest(
  url: string,
  options: ApiRequestOptions = {},
) {
  return await sendApiRequest(url, options, false)
}

export async function apiJson<T>(
  url: string,
  options: ApiRequestOptions = {},
) {
  return await readJsonResponse<T>(await apiRequest(url, options))
}

export async function apiNoContent(
  url: string,
  options: ApiRequestOptions = {},
) {
  const response = await apiRequest(url, options)

  if (!response.ok) {
    await readJsonResponse<unknown>(response)
  }
}

async function sendApiRequest(
  url: string,
  options: ApiRequestOptions,
  hasRetriedAfterUnauthorized: boolean,
): Promise<Response> {
  const managedAuth = Boolean(options.accessToken && authSessionController)
  const accessToken = managedAuth
    ? await authSessionController?.getAccessToken()
    : options.accessToken

  const response = await fetch(url, {
    ...options,
    credentials: options.credentials ?? 'same-origin',
    headers: createHeaders(options, accessToken),
    body: createBody(options.body),
  })

  if (
    response.status !== 401 ||
    !managedAuth ||
    hasRetriedAfterUnauthorized
  ) {
    return response
  }

  try {
    const refreshedAccessToken =
      await authSessionController?.refreshAccessToken()

    if (!refreshedAccessToken) {
      authSessionController?.onUnauthorized()

      return response
    }

    return await sendApiRequest(url, options, true)
  } catch {
    authSessionController?.onUnauthorized()

    return response
  }
}
