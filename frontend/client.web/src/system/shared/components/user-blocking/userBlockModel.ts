export const userBlockCommentMaxLength = 128;

export function normalizeUserBlockComment(value: string) {
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

export function getUserBlockedNotice(
  displayName: string,
  comment: string | null
) {
  const subject = displayName.trim() || 'Пользователь';

  return comment
    ? `${subject} добавлен в чёрный список. Причина: ${comment}`
    : `${subject} добавлен в чёрный список. Личные сообщения и приглашения от этого пользователя заблокированы.`;
}
