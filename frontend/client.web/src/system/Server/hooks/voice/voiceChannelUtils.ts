export function shouldCreateOffer(currentUserId: string, remoteUserId: string) {
  return currentUserId.localeCompare(remoteUserId) < 0;
}

export function normalizeUserId(userId: string) {
  return userId.trim().toLowerCase();
}
