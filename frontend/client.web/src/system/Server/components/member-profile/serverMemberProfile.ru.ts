export const serverMemberProfileCopy = {
  actions: {
    close: 'Закрыть профиль',
    openFull: 'Просмотреть полный профиль',
    retry: 'Повторить',
  },
  labels: {
    about: 'О себе',
    joined: 'На сервере с',
    login: 'Логин',
    mutualFriends: 'Общие друзья',
    mutualConnections: 'Общие связи',
    mutualServers: 'Общие серверы',
    profile: 'Профиль',
    roles: 'Роли',
  },
  state: {
    loadFailed: 'Не удалось загрузить серверный профиль.',
    loading: 'Загружаем профиль…',
    noAbout: 'Пользователь пока ничего о себе не рассказал.',
    noMutualFriends: 'Общих друзей пока нет.',
    noMutualServers: 'Общих серверов пока нет.',
    noRoles: 'Роли не назначены',
    partialMutualList: (returnedCount: number, totalCount: number) =>
      `Показано ${returnedCount} из ${totalCount}.`,
  },
} as const
