export const notificationCopy = {
  locale: 'ru-RU',
  brandFallback: 'ArcaneLink',
  title: 'Уведомления',
  actions: {
    clearHistory: 'Очистить историю уведомлений',
    accept: 'Принять',
    acceptInvitation: 'Принять приглашение',
    closeInvitation: 'Закрыть приглашение',
    closeNotification: 'Закрыть уведомление',
    decline: 'Отклонить',
    later: 'Позже',
    markAllRead: 'Отметить все уведомления прочитанными',
    notNow: 'Не сейчас',
    openPrivateSpace: 'Открыть приватный спейс',
    openMention: 'Перейти к упоминанию',
    openFriendRequests: 'Открыть заявки в друзья',
    enableNotifications: 'Включить уведомления',
    disableNotifications: 'Выключить уведомления',
    retry: 'Повторить',
  },
  center: {
    clearHistoryConfirmation:
      'Удалить все прочитанные уведомления? Непрочитанные уведомления и активные приглашения останутся.',
    clearHistoryError:
      'Не удалось очистить историю уведомлений. Попробуйте ещё раз.',
    searchPlaceholder: 'Поиск уведомлений',
    filtersLabel: 'Фильтры уведомлений',
    notificationsEnabled: 'Уведомления включены',
    notificationsDisabled: 'Уведомления выключены',
    filters: {
      all: 'Все',
      unread: 'Непрочитанные',
      mention: 'Упоминания',
      invite: 'Приглашения',
      system: 'Системные',
    },
    loading: 'Загружаем уведомления…',
    loadError: 'Не удалось загрузить уведомления.',
    updateError:
      'Не удалось сохранить состояние прочтения. Изменения отменены.',
    emptyTitle: 'Здесь пока тихо',
    emptyDescription:
      'Новые упоминания, приглашения и системные события появятся здесь.',
    today: 'Сегодня',
    yesterday: 'Вчера',
    now: 'сейчас',
    minutesAgo: (minutes: number) => `${minutes} мин. назад`,
    hoursAgo: (hours: number) => `${hours} ч. назад`,
  },
  quickSettings: {
    title: 'Быстрые настройки',
    all: 'Все уведомления',
    mentions: 'Упоминания',
    invites: 'Приглашения',
    system: 'Системные',
  },
  invite: {
    title: 'Приглашение на сервер',
    eyebrow: 'Вас пригласили на сервер',
    noDescription: 'Владелец сервера пока не добавил описание.',
    online: 'онлайн',
    members: 'участников',
  },
  popup: {
    notificationsLabel: 'Уведомления',
    privateMessageTitle: 'Новое сообщение',
    attachment: 'Отправлено вложение',
    attachments: (count: number) => `Отправлено вложений: ${count}`,
    privateSpaceFallback: 'Новое сообщение в приватном спейсе',
    now: 'сейчас',
    minutesAgo: (minutes: number) => `${minutes} мин. назад`,
  },
  settings: {
    masterDescription:
      'Главный переключатель всплывающих уведомлений ArcaneLink',
    eventsTitle: 'Всплывающие события',
    eventsDescription:
      'Настройки сохраняются отдельно для вашего аккаунта в этом веб-клиенте.',
    additionalTitle: 'Дополнительно',
    placementLabel: 'Показывать уведомления',
    placementBottomRight: 'В правом нижнем углу',
    placementBottomLeft: 'В левом нижнем углу',
    toggles: {
      privateMessages: {
        label: 'Личные сообщения',
        description: 'Уведомления о новых ЛС',
      },
      mentions: {
        label: 'Упоминания',
        description: 'Сообщения, в которых упомянули вас, вашу роль или всех',
      },
      serverInvites: {
        label: 'Приглашения на серверы',
        description: 'Приглашения от других пользователей',
      },
      privateSpaceInvites: {
        label: 'Приглашения в личные переписки',
        description: 'Уведомления о новых и возобновлённых личных чатах',
      },
      system: {
        label: 'Системные',
        description: 'Обновления, технические работы и др.',
      },
    },
  },
} as const
