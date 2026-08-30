export type AccountCredentialEditor = 'login' | 'email' | 'password';

export function isValidLoginChange(newLogin: string, currentPassword: string) {
  const normalizedLogin = newLogin.trim();
  return (
    normalizedLogin.length >= 3 &&
    normalizedLogin.length <= 50 &&
    currentPassword.length > 0
  );
}

export function isValidEmailChange(newEmail: string, currentPassword: string) {
  const normalizedEmail = newEmail.trim();
  return (
    currentPassword.length > 0 &&
    normalizedEmail.length <= 254 &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)
  );
}

export function isValidPasswordChange(
  currentPassword: string,
  newPassword: string,
  confirmedPassword: string
) {
  return (
    currentPassword.length > 0 &&
    newPassword === confirmedPassword &&
    newPassword.length >= 8 &&
    newPassword.length <= 128 &&
    !/\s/.test(newPassword) &&
    /[a-z]/.test(newPassword) &&
    /[A-Z]/.test(newPassword) &&
    /\d/.test(newPassword) &&
    /[^a-zA-Z0-9\s]/.test(newPassword)
  );
}
