import { readJsonResponse } from '../api/api';
import type { AuthTokenPair } from '../types';

const accessTokenStorageKey = 'arcanelink.accessToken';
const refreshTokenStorageKey = 'arcanelink.refreshToken';
const deviceSessionStorageKey = 'arcanelink.deviceSessionId';
const refreshLeewayMs = 60_000;

let accessToken: string | null = null;
let deviceSessionId: string | null = null;
let refreshPromise: Promise<AuthTokenPair> | null = null;
const tokenListeners = new Set<(accessToken: string | null) => void>();

export function persistAuthSession(
  tokenPair: Pick<
    AuthTokenPair,
    'accessToken' | 'refreshToken' | 'deviceSessionId'
  >
) {
  accessToken = tokenPair.accessToken;
  deviceSessionId =
    tokenPair.deviceSessionId ?? tryReadDeviceSessionId(tokenPair.accessToken);

  localStorage.removeItem(accessTokenStorageKey);
  localStorage.removeItem(refreshTokenStorageKey);

  if (deviceSessionId) {
    localStorage.setItem(deviceSessionStorageKey, deviceSessionId);
  }

  notifyTokenChanged();
}

export async function restoreAuthSession() {
  const tokenPair = await refreshAuthSession();
  persistAuthSession(tokenPair);

  return tokenPair;
}

export function clearAuthSession() {
  accessToken = null;
  deviceSessionId = null;
  refreshPromise = null;
  localStorage.removeItem(accessTokenStorageKey);
  localStorage.removeItem(refreshTokenStorageKey);
  localStorage.removeItem(deviceSessionStorageKey);
  notifyTokenChanged();
}

export async function getManagedAccessToken() {
  if (!accessToken) {
    return null;
  }

  return shouldRefreshAccessToken(accessToken)
    ? await refreshManagedAccessToken()
    : accessToken;
}

export async function refreshManagedAccessToken() {
  try {
    const tokenPair = await refreshAuthSession();
    persistAuthSession(tokenPair);

    return tokenPair.accessToken;
  } catch (error) {
    clearAuthSession();
    throw error;
  }
}

export function getCurrentAccessToken() {
  return accessToken;
}

export function getCurrentDeviceSessionId() {
  return deviceSessionId ?? localStorage.getItem(deviceSessionStorageKey);
}

export function subscribeAuthSession(
  listener: (accessToken: string | null) => void
) {
  tokenListeners.add(listener);

  return () => {
    tokenListeners.delete(listener);
  };
}

async function refreshAuthSession() {
  if (!refreshPromise) {
    refreshPromise = requestRefreshToken().finally(() => {
      refreshPromise = null;
    });
  }

  return await refreshPromise;
}

async function requestRefreshToken() {
  const legacyRefreshToken = localStorage.getItem(refreshTokenStorageKey);
  const response = await fetch('/api/auth/refresh', {
    method: 'POST',
    credentials: 'same-origin',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(
      legacyRefreshToken ? { refreshToken: legacyRefreshToken } : {}
    )
  });

  return await readJsonResponse<AuthTokenPair>(response);
}

function notifyTokenChanged() {
  for (const listener of tokenListeners) {
    listener(accessToken);
  }
}

function shouldRefreshAccessToken(token: string) {
  const expiresAt = tryReadAccessTokenExpiration(token);

  return (
    expiresAt != null && expiresAt.getTime() <= Date.now() + refreshLeewayMs
  );
}

function tryReadAccessTokenExpiration(token: string) {
  const expiresAtSeconds = tryReadAccessTokenClaims(token)?.exp;

  return typeof expiresAtSeconds === 'number'
    ? new Date(expiresAtSeconds * 1000)
    : null;
}

function tryReadDeviceSessionId(token: string) {
  return tryReadAccessTokenClaims(token)?.deviceSessionId ?? null;
}

function tryReadAccessTokenClaims(token: string) {
  const payload = token.split('.')[1];

  if (!payload) {
    return null;
  }

  try {
    const normalizedPayload = payload
      .replace(/-/g, '+')
      .replace(/_/g, '/')
      .padEnd(Math.ceil(payload.length / 4) * 4, '=');
    return JSON.parse(atob(normalizedPayload)) as {
      deviceSessionId?: string;
      exp?: number;
    };
  } catch {
    return null;
  }
}
