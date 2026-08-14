export const profileCopy = {
  assets: {
    close: 'Закрыть',
    deleteAsset: 'Удалить сохранённый ассет',
    deleteCancel: 'Отменить',
    deleteConfirm: 'Удалить',
    deleteDescription: 'Вы уверены, что хотите удалить аватар? Операция необратима.',
    deleteLoading: 'Удаляем...',
    deleteTitle: 'Удалить аватар?',
    sort: 'Сортировка',
    sortNewest: 'Сначала новые',
    sortOldest: 'Сначала старые',
    avatarCropDescription:
      'Исходный asset останется без изменений. Сохранятся только ссылка на asset и текущие параметры кадрирования.',
    avatarCropTitle: 'Настроить аватар',
    avatarLibraryDescription:
      'Выберите исходный asset, чтобы настроить его кадрирование.',
    avatarLibraryEmpty: 'Пока нет сохранённых аватаров.',
    avatarLibraryLoading: 'Загружаем сохранённые аватары...',
    avatarLibraryTitle: 'Сохранённые аватары',
  },
  labels: {
    about: 'О себе',
    activity: 'Недавняя активность',
    avatarMenu: 'Открыть меню аватара',
    email: 'Email',
    profile: 'Профиль',
    server: 'Сервер',
    site: 'Сайт',
    stampShowcase: 'Витрина печатей',
    subscription: 'Тариф',
  },
  actions: {
    openAvatarOriginal: 'Открыть оригинал',
    openServerSettings: 'Открыть настройки сервера',
    chooseSavedAvatar: 'Выбрать сохранённый',
    logout: 'Выйти',
    serverSettings: 'Настройки сервера',
    servers: 'Серверы',
    settings: 'Настройки',
    uploadAvatar: 'Загрузить аватар',
  },
  bio: {
    default: 'Исследую связи между мирами. Люблю общение, приключения и хорошую музыку.',
  },
  errors: {
    avatarAssetMissing: 'Не удалось подготовить выбранный аватар.',
    avatarSaveFailed: 'Не удалось сохранить аватар.',
    avatarTooLarge: 'Аватар должен быть не больше 10 MB.',
    avatarUnsupportedType: 'Поддерживаются только JPG, PNG, WebP, GIF и BMP изображения.',
  },
  state: {
    activityEmptyDescription:
      'Активность в серверах и личных сообщениях будет отображаться здесь.',
    noActivity: 'Пока нет активности',
    locked: 'Заблокировано',
    siteMissing: 'Не указан',
  },
} as const
