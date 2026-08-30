import { apiJson, apiNoContent } from './api';

export type AcceptedAccountActionResponse = {
  message: string;
};

export type ConfirmEmailResponse = {
  emailConfirmed: boolean;
  emailChanged: boolean;
  requiresReauthentication: boolean;
};

export type AccountChangeResponse = {
  login: string;
  email: string;
  requiresReauthentication: boolean;
};

export function resendVerificationEmail(email: string) {
  return apiJson<AcceptedAccountActionResponse>('/api/auth/email/resend', {
    method: 'POST',
    body: { email }
  });
}

export function confirmAccountEmail(token: string) {
  return apiJson<ConfirmEmailResponse>('/api/auth/email/confirm', {
    method: 'POST',
    body: { token }
  });
}

export function requestPasswordReset(loginOrEmail: string) {
  return apiJson<AcceptedAccountActionResponse>('/api/auth/password/forgot', {
    method: 'POST',
    body: { loginOrEmail }
  });
}

export function resetAccountPassword(token: string, newPassword: string) {
  return apiNoContent('/api/auth/password/reset', {
    method: 'POST',
    body: { token, newPassword }
  });
}

export function changeAccountLogin(
  accessToken: string,
  newLogin: string,
  currentPassword: string
) {
  return apiJson<AccountChangeResponse>('/api/auth/account/login', {
    accessToken,
    method: 'PUT',
    body: { newLogin, currentPassword }
  });
}

export function requestAccountEmailChange(
  accessToken: string,
  newEmail: string,
  currentPassword: string
) {
  return apiJson<AcceptedAccountActionResponse>(
    '/api/auth/account/email/change',
    {
      accessToken,
      method: 'POST',
      body: { newEmail, currentPassword }
    }
  );
}

export function changeAccountPassword(
  accessToken: string,
  currentPassword: string,
  newPassword: string
) {
  return apiNoContent('/api/auth/account/password/change', {
    accessToken,
    method: 'POST',
    body: { currentPassword, newPassword }
  });
}
