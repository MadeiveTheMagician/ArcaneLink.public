export const invitePageCopy = {
  actions: {
    accept: 'Принять приглашение',
    accepting: 'Подключаем...',
    decline: 'Отклонить',
    returnBack: 'Вернуться'
  },
  errors: {
    acceptFailed: 'Не удалось принять приглашение.',
    expired: 'Срок действия приглашения истёк.',
    invalid: 'К сожалению, ссылка не действительна.',
    maxUsesReached:
      'По этой ссылке уже подключилось максимальное количество участников.',
    revoked: 'Это приглашение было отозвано.'
  },
  labels: {
    invitedToServer: 'Вас пригласили на сервер',
    linkExpiresAt: 'Ссылка действует до',
    members: 'участников',
    online: 'в сети'
  },
  loading: 'Проверяем приглашение...',
  state: {
    unavailable: 'Приглашение недоступно',
    invalidTitle: 'Ссылка не действительна'
  }
} as const;
