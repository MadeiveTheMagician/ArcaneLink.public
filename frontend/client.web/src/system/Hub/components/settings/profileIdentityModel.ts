export const profileDisplayNameMaxLength = 128;

export type ProfileDisplayNameValidationError = 'required' | 'too-long' | null;

export function normalizeProfileDisplayName(value: string) {
  return value.trim();
}

export function validateProfileDisplayName(
  value: string
): ProfileDisplayNameValidationError {
  const normalized = normalizeProfileDisplayName(value);

  if (!normalized) return 'required';
  if (normalized.length > profileDisplayNameMaxLength) return 'too-long';
  return null;
}

export function createProfileDisplayNameUpdate(
  draft: string,
  currentDisplayName: string
) {
  const displayName = normalizeProfileDisplayName(draft);
  if (
    validateProfileDisplayName(displayName) !== null ||
    displayName === normalizeProfileDisplayName(currentDisplayName)
  ) {
    return null;
  }

  return { displayName };
}
