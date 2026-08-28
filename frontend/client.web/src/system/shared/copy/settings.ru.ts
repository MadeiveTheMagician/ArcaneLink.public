export const settingsCopy = {
  account: {
    accountInfoDescription:
      'Логин и электронная почта, используемые для входа и восстановления доступа.',
    accountInfoTitle: 'Данные для входа',
    activeSessions: 'Активные сеансы устройств',
    currentSession: 'Текущий',
    currentSessionProtected: 'Текущий сеанс останется активным',
    otherSessionsCount: (count: number) => {
      const remainder100 = count % 100
      const remainder10 = count % 10
      const suffix =
        remainder100 >= 11 && remainder100 <= 14
          ? 'других устройств'
          : remainder10 === 1
            ? 'другое устройство'
            : remainder10 >= 2 && remainder10 <= 4
              ? 'других устройства'
              : 'других устройств'

      return `${count} ${suffix}`
    },
    revokeSession: 'Прервать сеанс',
    revokingSession: 'Прерываем...',
    revokeSessionQuestion: 'Прервать этот сеанс?',
    revokeSessionWarning:
      'Устройство потеряет возможность обновить токен и будет отключено от ArcaneLink.',
    revokeOtherSessions: 'Прервать все остальные сеансы',
    revokingOtherSessions: 'Прерываем сеансы...',
    revokeOtherSessionsQuestion: 'Прервать все остальные сеансы?',
    revokeOtherSessionsWarning:
      'Текущий сеанс останется активным. Остальные устройства будут отключены от ArcaneLink.',
    deleteAccount: 'Удалить учётную запись',
    deleteAccountDescription:
      'Этот пункт вынесен отдельно, чтобы его нельзя было нажать случайно.',
    deleteAccountQuestion: 'Удалить учётную запись?',
    deleteAccountWarning:
      'Это действие потребует отдельного подтверждения и будет необратимым после подключения серверной операции.',
    email: 'Электронная почта',
    ipUnknown: 'IP не определён',
    lastActivity: 'Последняя активность',
    loadingSessions: 'Загружаем сеансы...',
    logout: 'Выйти из учётной записи',
    noSessions: 'Активные сеансы не найдены.',
    password: 'Пароль',
    passwordSecurityDescription:
      'Пароль, подтверждение входа и устройства с активными сеансами.',
    passwordSecurityTitle: 'Пароль и безопасность',
    username: 'Логин',
    unknownDevice: 'Неизвестное устройство',
    cancelChange: 'Отменить',
    change: 'Изменить',
    confirmNewPassword: 'Повторите новый пароль',
    currentPassword: 'Текущий пароль',
    emailChangeFailed:
      'Не удалось запросить смену email. Проверьте пароль и доступность адреса.',
    emailChangeRequested:
      'Письмо отправлено на новый адрес. Текущий email изменится только после подтверждения ссылки.',
    loginChangeFailed:
      'Не удалось изменить логин. Проверьте текущий пароль и доступность логина.',
    loginChangedReauthentication:
      'Логин изменён. Все сеансы завершены — войдите в ArcaneLink заново.',
    newEmail: 'Новый email',
    newLogin: 'Новый логин',
    newPassword: 'Новый пароль',
    passwordChangeFailed:
      'Не удалось изменить пароль. Проверьте текущий пароль и требования безопасности.',
    passwordChangedReauthentication:
      'Пароль изменён. Все сеансы завершены — войдите в ArcaneLink заново.',
    passwordRequirements:
      'От 8 до 128 символов: строчная и заглавная буквы, цифра, спецсимвол, без пробелов.',
    saveChange: 'Сохранить',
    savingChange: 'Сохраняем...',
    revokeAllSessions: 'Прервать все сеансы',
    revokingAllSessions: 'Прерываем все сеансы...',
    revokeAllSessionsWarning:
      'Прервать все активные сеансы, включая текущий? После этого потребуется войти заново.',
    yesDelete: 'Да, удалить',
  },
  actions: {
    resetInterface: 'Сбросить настройки интерфейса',
    resetScale: 'Сбросить масштаб',
    resetStreaming: 'Сбросить настройки стриминга',
    resetVoice: 'Сбросить настройки голоса и видео',
  },
  errors: {
    bannerLimit: 'Доступно не больше 10 сохранённых баннеров профиля.',
    bannerMustBeImage: 'Баннер профиля должен быть изображением.',
    bannerTooLarge: 'Файл баннера не должен превышать 10 МБ.',
    backgroundLimit:
      'Доступно до 10 фонов. Plus расширит лимит до 30, Prime — до 50.',
    backgroundMustBeImage: 'Фон профиля должен быть изображением.',
    backgroundTooLarge: 'Файл фона не должен превышать 10 МБ.',
    deleteBackground: 'Не удалось удалить фон профиля.',
    deleteBanner: 'Не удалось удалить баннер профиля.',
    loadBackgrounds: 'Не удалось загрузить фоны профиля.',
    loadBanners: 'Не удалось загрузить баннеры профиля.',
    loadProfileTags: 'Не удалось загрузить теги.',
    loadServerProfile: 'Не удалось загрузить профиль для выбранного сервера.',
    loadSessions: 'Не удалось загрузить активные сеансы.',
    revokeSession: 'Не удалось прервать выбранный сеанс.',
    revokeOtherSessions: 'Не удалось прервать остальные сеансы.',
    revokeAllSessions: 'Не удалось прервать все сеансы.',
    saveDisplayName: 'Не удалось сохранить отображаемое имя.',
    saveBanner: 'Не удалось применить баннер профиля.',
    saveServerProfile: 'Не удалось сохранить серверный профиль.',
    saveProfileTags: 'Не удалось сохранить теги.',
    serverProfileAssetMustBeImage:
      'Поддерживаются изображения JPEG, PNG, WebP, GIF и BMP.',
    serverProfileAssetTooLarge: 'Изображение не должно превышать 10 МБ.',
    uploadBackground: 'Не удалось загрузить фон профиля.',
    uploadBanner: 'Не удалось загрузить баннер профиля.',
  },
  interface: {
    advancedFeatures: 'Дополнительные функции',
    expandMessageAttachmentsByDefault:
      'Показывать вложения сообщений в полном размере',
    expandMessageAttachmentsByDefaultDescription:
      'По умолчанию разворачивать все вложения сообщения крупными плитками.',
    loadExternalMediaPreviews: 'Загружать превью внешних видео',
    loadExternalMediaPreviewsDescription:
      'Показывать встроенные видео из разрешённых источников YouTube и Twitch. YouTube Shorts отображаются в вертикальном формате.',
    messagesTitle: 'Сообщения',
    messagesDescription:
      'Отображение вложений и внешних видео непосредственно в переписке.',
    messageDisplayFormatTitle: 'Формат отображения сообщений',
    messageDisplayFormatDescription:
      'Настройте оформление сообщений отдельно для серверов и личных переписок.',
    messageDisplayFormatServers: 'Серверы',
    messageDisplayFormatServersDescription:
      'Формат сообщений в текстовых спейсах серверов.',
    messageDisplayFormatPrivate: 'Переписки',
    messageDisplayFormatPrivateDescription:
      'Формат сообщений в Direct- и Group-переписках.',
    messageDisplayFormatWallScroll: 'WallScroll',
    messageDisplayFormatBubble: 'Bubble · облачка',
    messageDisplayFormatMode: 'Режим',
    messageBubbleAlignment: 'Расположение облачков',
    messageBubbleOneSideLeft: 'Все сообщения слева',
    messageBubbleOneSideRight: 'Все сообщения справа',
    messageBubbleOwnLeft: 'Мои слева, остальные справа',
    messageBubbleOwnRight: 'Мои справа, остальные слева',
    messageBubbleWidth: 'Ширина облачка',
    messageBubbleWidthStandard: 'Стандартная · по содержимому',
    messageBubbleWidthFull: 'На всю доступную ширину',
    videoCardSizeTitle: 'Размер карточек видео',
    horizontalVideoCards: 'Горизонтальные',
    verticalVideoCards: 'Вертикальные',
    applyThemeToOtherProfiles:
      'Применить тему системы к профилям других пользователей',
    applyThemeToOtherProfilesDescription:
      'Когда включено, чужие профили в интерфейсе подсвечиваются выбранной системной темой.',
    fontScale: 'Размер шрифта',
    interfaceScaleDescription:
      'Размеры основных областей, серверного интерфейса и текста.',
    interfaceScaleTitle: 'Масштабирование интерфейса',
    profileColor: 'Цвет профиля',
    profileInterface: 'Интерфейс профиля',
    profileInheritsTheme: 'Сейчас профиль наследует',
    scalePreview: 'Предпросмотр масштаба интерфейса и текста.',
    serverInterface: 'Интерфейс сервера',
    themeDescription: 'Плашка переключает цветовую гамму сразу после выбора.',
    themeTitle: 'Тема',
    toggleServerRailPinned: 'Закрепить закладку серверов открытой',
    toggleServerRailPinnedDescription:
      'Когда включено, закладка открыта постоянно, а внешний переключатель скрыт.',
    showPrivateReadAllButton: 'Отображать кнопку «Прочитать всё»',
    showPrivateReadAllButtonDescription:
      'Показывать кнопку над списком переписок, когда есть непрочитанные сообщения.',
  },
  profile: {
    addBanner: 'Добавить баннер',
    addBackground: 'Добавить фон',
    backgroundDefault: 'По умолчанию',
    backgroundDescription:
      'Фон профиля может наследовать текущую тему или использовать ваше изображение.',
    backgroundFileFallback: 'Фон профиля',
    backgroundLimitStatus:
      'Сейчас доступно {count}/10 фонов. Plus: 30, Prime: 50.',
    backgroundTitle: 'Изменить фон профиля',
    bannerDescription:
      'Баннер отображается отдельной полосой под основной информацией профиля. Можно сохранить до 10 вариантов.',
    bannerFileFallback: 'Баннер профиля',
    bannerLimitStatus: (count: number) => `${count} из 10 баннеров`,
    bannerNone: 'Без баннера',
    bannerTitle: 'Баннер профиля',
    deleteBackground: 'Удалить фон',
    deleteBanner: 'Удалить баннер',
    displayName: 'Отображаемое имя',
    displayNameDescription:
      'Используется в профиле, переписках и списках участников.',
    displayNameLength: (current: number, max: number) =>
      `${current} из ${max} символов`,
    displayNameRequired: 'Введите отображаемое имя.',
    displayNameSaved: 'Отображаемое имя сохранено.',
    displayNameTooLong:
      'Отображаемое имя не может быть длиннее 128 символов.',
    identityDescription:
      'Публичные данные, которые видят другие пользователи ArcaneLink.',
    identityTitle: 'Основной профиль',
    loadingBackgrounds: 'Загружаем фоны профиля...',
    loadingBanners: 'Загружаем баннеры профиля...',
    loadingProfileTags: 'Теги загружаются...',
    profileTagsDescription:
      'Теги помогают находить людей с похожими интересами и улучшают рекомендации.',
    profileTagsTitle: 'Теги профиля',
    saveDisplayName: 'Сохранить имя',
    savingDisplayName: 'Сохраняем…',
    scopeGlobal: 'Основной профиль',
    scopeServers: 'Серверные профили',
    scopeTabsLabel: 'Тип профиля',
    serverProfileAbout: 'О себе',
    serverProfileAboutDescription:
      'Описание, которое увидят только участники выбранного сервера.',
    serverProfileAboutRequired:
      'Введите описание или верните поле к основному профилю.',
    serverProfileAboutTooLong: 'Описание не может быть длиннее 512 символов.',
    serverProfileAvatar: 'Аватар',
    serverProfileAvatarCropDescription:
      'Настройте положение и масштаб аватара для выбранного сервера.',
    serverProfileAvatarCropTitle: 'Настроить серверный аватар',
    serverProfileAvatarLibraryDescription:
      'Выберите одно из ранее загруженных изображений и настройте кадрирование.',
    serverProfileAvatarLibraryEmpty: 'В библиотеке пока нет аватаров.',
    serverProfileAvatarLibraryLoading: 'Загружаем библиотеку аватаров…',
    serverProfileAvatarLibraryTitle: 'Библиотека аватаров',
    serverProfileAvatarSaved: 'Серверный аватар сохранён.',
    serverProfileBanner: 'Баннер',
    serverProfileBannerSaved: 'Серверный баннер сохранён.',
    serverProfileCustom: 'Отдельное значение для сервера',
    serverProfileClearStatus: 'Очистить',
    serverProfileCustomize: 'Настроить для сервера',
    serverProfileDisplayNameDescription:
      'Имя, которое увидят участники только этого сервера.',
    serverProfileDisplayNameRequired:
      'Введите отображаемое имя или верните поле к основному профилю.',
    serverProfileDisplayNameTooLong:
      'Отображаемое имя не может быть длиннее 128 символов.',
    serverProfileFieldReset: 'Поле снова наследуется из основного профиля.',
    serverProfileFullyInherited:
      'Все данные динамически наследуются из основного профиля.',
    serverProfileHasOverrides:
      'В этом профиле есть отдельные настройки для сервера.',
    serverProfileInherited: 'Наследуется из основного профиля',
    serverProfileLibrary: 'Из библиотеки',
    serverProfileLoading: 'Загружаем серверный профиль…',
    serverProfileMediaDescription:
      'Изображения используются только на выбранном сервере. Их всегда можно вернуть к основным.',
    serverProfileMediaTitle: 'Аватар и баннер',
    serverProfileNoServers:
      'Серверные профили станут доступны после вступления хотя бы на один сервер.',
    serverProfilePreviewDescription:
      'Так профиль выглядит для участников выбранного сервера.',
    serverProfileResetAll: 'Вернуть весь профиль к основному',
    serverProfileResetDone: 'Серверный профиль полностью сброшен.',
    serverProfileSave: 'Сохранить профиль',
    serverProfileSaved: 'Серверный профиль сохранён.',
    serverProfileSaving: 'Сохраняем…',
    serverProfileSelect: 'Выберите сервер',
    serverProfileStatus: 'Статус на сервере',
    serverProfileStatusDescription:
      'Короткий статус относится только к выбранному серверу.',
    serverProfileStatusPlaceholder: 'Например, готов к голосовому чату',
    serverProfileStatusTooLong: 'Статус не может быть длиннее 128 символов.',
    serverProfilesDescription:
      'Создавайте отдельное имя, описание, статус и оформление для каждого сервера.',
    serverProfilesTitle: 'Личные профили серверов',
    serverProfileTextDescription:
      'Поля с наследованием автоматически обновляются при изменении основного профиля.',
    serverProfileTextTitle: 'Данные профиля',
    serverProfileUnsavedHint:
      'Изменения применятся только к выбранному серверу.',
    serverProfileUpload: 'Загрузить',
    serverProfileUseGlobal: 'Вернуть к основному',
    uploadLimit: 'До 10 МБ',
    uploadingBackground: 'Загружаем...',
    uploadingBanner: 'Загружаем баннер...',
  },
  privacy: {
    directMessagesTitle: 'Личные сообщения',
    directMessagesDescription:
      'Разрешите личные сообщения всем, никому или отдельным категориям пользователей.',
    directMessagesLabel: 'Кто может писать мне',
    directMessagesHint:
      'Чёрный список имеет приоритет над этим разрешением.',
    directMessagesEveryone: 'Все пользователи',
    directMessagesEveryoneDescription:
      'Любой пользователь сможет начать с вами личную переписку.',
    directMessagesCustomSeparator: 'Или выберите категории',
    directMessagesFriends: 'Друзья',
    directMessagesFriendsDescription:
      'Пользователи из вашего списка друзей.',
    directMessagesFriendsOfFriends: 'Друзья друзей',
    directMessagesFriendsOfFriendsDescription:
      'Пользователи, с которыми у вас есть хотя бы один общий друг.',
    directMessagesSharedServers: 'Участники общих серверов',
    directMessagesSharedServersDescription:
      'Пользователи, состоящие хотя бы на одном общем с вами сервере.',
    directMessagesNobody: 'Никто',
    directMessagesNobodyDescription:
      'Новые личные переписки и сообщения будут запрещены для всех.',
    blocklistTitle: 'Чёрный список',
    blocklistDescription:
      'Заблокированные пользователи не смогут писать вам и приглашать в личные переписки.',
    blocklistSearchLabel: 'Добавить пользователя',
    blocklistSearchPlaceholder: 'Отображаемое имя или логин',
    blocklistSearchHint: 'Введите хотя бы два символа.',
    blocklistSearching: 'Ищем пользователей...',
    blocklistSearchResults: 'Результаты поиска пользователей',
    blocklistSearchEmpty: 'Подходящие пользователи не найдены.',
    blocklistSearchError: 'Не удалось выполнить поиск пользователей.',
    blocklistUsers: 'Заблокированные пользователи',
    blocklistCommentsDescription:
      'Комментарии видны только вам и помогают помнить причину блокировки.',
    blocklistLoading: 'Загружаем чёрный список...',
    blocklistLoadingMore: 'Загружаем следующую страницу…',
    blocklistEmpty: 'Чёрный список пока пуст.',
    blocklistFilteredEmpty: 'В чёрном списке нет совпадений.',
    blocklistLoadError: 'Не удалось загрузить чёрный список.',
    blocklistMutationError: 'Не удалось изменить чёрный список.',
    blocklistRetry: 'Повторить',
    blockUser: 'Заблокировать',
    unblockUser: 'Разблокировать',
    modeAutomatic: 'Автоматически',
    modeDescription:
      'Управляйте тем, будет ли ArcaneLink показывать ваше фактическое присутствие.',
    modeHint:
      'Невидимый режим скрывает онлайн-статус, пока вы продолжаете пользоваться приложением.',
    modeInvisible: 'Невидимый режим',
    modeLabel: 'Режим присутствия',
    modeTitle: 'Онлайн-статус',
    saveError: 'Не удалось сохранить настройки приватности.',
    showLastSeen: 'Показывать время последней активности',
    showLastSeenDescription:
      'Если выключить этот параметр, другим пользователям будет доступен только разрешённый статус присутствия.',
    visibilityDescription:
      'Выберите, кто может видеть ваш онлайн-статус и разрешённое время последней активности.',
    visibilityEveryone: 'Все пользователи',
    visibilityEveryoneDescription:
      'Любой пользователь сможет видеть разрешённые данные о вашей активности.',
    visibilityCustomSeparator: 'Или выберите категории',
    visibilityFriends: 'Друзья',
    visibilityFriendsDescription:
      'Пользователи из вашего списка друзей.',
    visibilityFriendsOfFriends: 'Друзья друзей',
    visibilityFriendsOfFriendsDescription:
      'Пользователи, с которыми у вас есть хотя бы один общий друг.',
    visibilitySharedServers: 'Участники общих серверов',
    visibilitySharedServersDescription:
      'Пользователи, состоящие хотя бы на одном общем с вами сервере.',
    visibilityHint:
      'Настройка применяется одинаково в личных сообщениях, списках друзей и на серверах.',
    visibilityLabel: 'Кто видит моё присутствие',
    visibilityNobody: 'Никто',
    visibilityNobodyDescription:
      'Данные о присутствии будут скрыты от всех, кроме вас.',
    visibilityTitle: 'Приватность присутствия',
  },
  root: {
    close: 'Закрыть настройки',
    description:
      'Учётная запись, профиль, интерфейс и параметры связи в одном месте.',
    eyebrow: 'Системные настройки',
    saving: 'Сохраняем...',
    tabs: 'Разделы настроек',
    title: 'Настройки системы',
  },
  security: {
    systemWarningsTitle: 'Системные предупреждения',
    systemWarningsDescription: 'Управление защитными сообщениями при работе с файлами.',
    dangerousFilesWarning: 'Предупреждать о потенциально опасных файлах',
    dangerousFilesWarningDescription:
      'Показывать подтверждение перед скачиванием архивов, исполняемых файлов и системных сценариев.',
  },
  streaming: {
    frameRate: 'Кадров в секунду',
    qualityDescription:
      'Эти параметры применяются к камере и демонстрации экрана перед отправкой потока.',
    qualityNotice:
      '480p и 720p доступны всем. 1080p и 1440p зарезервированы для Plus, 4K и исходное качество — для Prime.',
    qualityTitle: 'Качество трансляции',
    resolution: 'Разрешение',
  },
  tabs: {
    account: 'Учётная запись',
    profile: 'Профиль',
    interface: 'Интерфейс',
    privacy: 'Приватность',
    security: 'Безопасность',
    streaming: 'Стриминг',
    voice: 'Звук и шумоподавление',
  },
  units: {
    megabytes: 'МБ',
  },
  voice: {
    activeProfile: 'Активный профиль',
    adaptiveQuality: 'Адаптивное качество',
    adaptiveQualityDescription:
      'В автоматическом профиле ArcaneLink снижает битрейт при нестабильной связи и восстанавливает его после улучшения соединения.',
    automaticThreshold: 'Автоматически',
    automaticThresholdDescription:
      'ArcaneLink подстраивает порог под фоновый шум и громкость речи.',
    autoGainControl: 'Автоматическое выравнивание громкости',
    autoGainControlDescription:
      'Браузер автоматически усиливает тихую речь и ослабляет слишком громкий сигнал.',
    createProfile: 'Создать профиль',
    deleteProfile: 'Удалить',
    deleteProfileConfirmation:
      'Удалить выбранный профиль? Активным станет основной профиль.',
    duplicateProfile: 'Дублировать',
    chooseOutputDevice: 'Разрешить выбор динамиков',
    choosePushToTalkKey: 'Назначить клавишу',
    clearPushToTalkKey: 'Сбросить клавишу',
    connectionDiagnosticsDescription:
      'Текущие WebRTC-показатели обновляются во время голосового соединения. IP-адреса и порты не отображаются и не копируются.',
    connectionDiagnosticsTitle: 'Диагностика соединения',
    diagnosticsCodec: 'Кодек',
    diagnosticsConnectedPeers: 'Подключения с участниками',
    diagnosticsConnectedPeersValue: (connected: number, total: number) =>
      `${connected} из ${total}`,
    diagnosticsCopyError: 'Не удалось скопировать отчёт.',
    diagnosticsCopyReport: 'Скопировать диагностический отчёт',
    diagnosticsCopySuccess: 'Диагностический отчёт скопирован.',
    diagnosticsInboundBitrate: 'Входящий поток',
    diagnosticsJitter: 'Джиттер',
    diagnosticsKilobitsPerSecond: (value: string) => `${value} Кбит/с`,
    diagnosticsLastSample: 'Последнее измерение',
    diagnosticsMetricUnavailable: 'Недоступно',
    diagnosticsMilliseconds: (value: string) => `${value} мс`,
    diagnosticsOutboundBitrate: 'Исходящий поток',
    diagnosticsPacketLoss: 'Потери пакетов',
    diagnosticsQualityConnecting: 'Подключение',
    diagnosticsQualityDegraded: 'Нестабильное соединение',
    diagnosticsQualityDegradedDescription:
      'Обнаружена повышенная задержка, джиттер или потеря пакетов. Адаптивный профиль может снизить битрейт.',
    diagnosticsQualityDisconnected: 'Нет активного соединения',
    diagnosticsQualityDisconnectedDescription:
      'Подключитесь к голосовому спейсу, чтобы увидеть показатели WebRTC в реальном времени.',
    diagnosticsQualityGood: 'Хорошее соединение',
    diagnosticsQualityGoodDescription:
      'Задержка, джиттер и потери пакетов находятся в нормальном диапазоне.',
    diagnosticsQualityMeasuring: 'Измеряем качество',
    diagnosticsQualityMeasuringDescription:
      'Соединение устанавливается или ArcaneLink собирает первые WebRTC-показатели.',
    diagnosticsQualityPoor: 'Плохое соединение',
    diagnosticsQualityPoorDescription:
      'Качество разговора может заметно снижаться из-за задержки или потери пакетов.',
    diagnosticsQualityReconnecting: 'Восстанавливаем соединение',
    diagnosticsQualityReconnectingDescription:
      'WebRTC-соединение временно прервано. ArcaneLink пытается восстановить голосовую связь.',
    diagnosticsReportPrivacyNote:
      'IP-адреса, порты и идентификаторы сетевых кандидатов исключены из отчёта.',
    diagnosticsReportQuality: 'Состояние',
    diagnosticsReportTitle: 'ArcaneLink — диагностика голосовой связи',
    diagnosticsRoundTripTime: 'Задержка',
    diagnosticsRoute: 'Маршрут',
    diagnosticsRouteDirect: 'Прямое соединение',
    diagnosticsRouteRelay: 'Через ретранслятор',
    diagnosticsTransmissionAdaptive: 'Адаптивный',
    diagnosticsTransmissionFixed: 'Фиксированный',
    diagnosticsTransmissionIndividual: 'Индивидуально',
    diagnosticsTransmissionMode: 'Режим ограничения',
    diagnosticsTransmissionTarget: 'Целевой предел передачи',
    connectionBehaviorDescription:
      'Выберите способ, которым голос будет передаваться в голосовой спейс.',
    connectionBehaviorTitle: 'Режим передачи',
    dbFsUnit: 'dBFS',
    deviceDescription:
      'Выберите локальные устройства и проверьте звук перед подключением.',
    deviceLoadError:
      'Не удалось получить список устройств. Проверьте разрешения браузера.',
    deviceUnavailable: 'Недоступное устройство из голосового профиля',
    deviceTitle: 'Ввод и вывод звука',
    echoCancellation: 'Эхоподавление',
    echoCancellationDescription:
      'Уменьшает эхо динамиков, которое возвращается в микрофон.',
    inputDevice: 'Микрофон',
    inputDeviceFallback: 'Микрофон',
    inputDeviceMissing: 'Микрофоны не найдены',
    inputLevel: 'Уровень микрофона',
    inputLevelIdle: 'Запустите проверку, чтобы увидеть уровень сигнала.',
    inputLevelLive: 'Микрофон улавливает сигнал.',
    inputModePushToTalk: 'Рация',
    inputModePushToTalkDescription:
      'Звук передаётся, пока назначенная клавиша удерживается.',
    inputModeVoiceActivity: 'Активация голосом',
    inputModeVoiceActivityDescription:
      'Передача начинается автоматически, когда громкость превышает порог.',
    inputProcessingDescription:
      'Эти параметры применяются к микрофону и влияют на качество передаваемого голоса.',
    inputProcessingTitle: 'Параметры ввода звука',
    inputUnavailableNotification:
      'ArcaneLink не получает сигнал с выбранного микрофона.',
    keyCaptureCancelled: 'Назначение клавиши отменено.',
    keyCaptureHint: 'Нажмите клавишу. Escape отменяет назначение.',
    keyCaptureInvalid:
      'Эту клавишу нельзя использовать. Выберите обычную клавишу клавиатуры.',
    manualThreshold: 'Вручную',
    manualThresholdDescription:
      'Укажите минимальную громкость, при которой начинается передача.',
    manualThresholdLabel: 'Порог чувствительности',
    microphoneGain: 'Усиление микрофона',
    microphoneGainDescription:
      '100% сохраняет исходный уровень, значения выше программно усиливают сигнал.',
    microphoneTestError:
      'Не удалось запустить проверку микрофона. Проверьте устройство и разрешения браузера.',
    mlNoiseSuppression: 'ML-шумоподавление RNNoise',
    mlNoiseSuppressionDescription:
      'Обрабатывает голос локально нейросетевой моделью WebAssembly. Если AudioWorklet или модель недоступны, ArcaneLink безопасно вернётся к встроенному шумоподавлению.',
    mlNoiseRuntimeTitle: 'Состояние RNNoise',
    mlNoiseRuntimeIdle:
      'Подключитесь к голосовому спейсу, чтобы увидеть фактическую нагрузку и задержку обработки.',
    mlNoiseRuntimeInitializing: 'Модель RNNoise загружается и готовит аудиотракт.',
    mlNoiseRuntimeActive: 'RNNoise обрабатывает микрофон локально на этом устройстве.',
    mlNoiseRuntimeFallback:
      'RNNoise недоступен. Используется встроенное шумоподавление браузера.',
    mlNoiseRuntimeFailed:
      'RNNoise недоступен, а встроенное шумоподавление не было активировано.',
    mlNoiseRuntimeProvider: 'Модуль',
    mlNoiseRuntimeLatency: 'Задержка обработки',
    mlNoiseRuntimeProcessing: 'Обработка кадра',
    mlNoiseRuntimeCpu: 'Нагрузка кадра',
    mlNoiseRuntimeDrops: 'Пропуски / underrun',
    noiseSuppression: 'Шумоподавление',
    noiseSuppressionDescription:
      'Снижает постоянный фоновый шум клавиатуры, вентилятора и помещения.',
    qualityAutomatic: 'Автоматически',
    qualityAutomaticDescription:
      'Подстраивает передачу голоса под текущее качество соединения, до 64 кбит/с.',
    qualityBalanced: 'Сбалансированный',
    qualityBalancedDescription:
      'Стабильный профиль 48 кбит/с для большинства разговоров.',
    qualityDataSaver: 'Экономия трафика',
    qualityDataSaverDescription:
      'Ограничивает голосовой поток до 24 кбит/с.',
    qualityDescription:
      'Выберите верхний предел битрейта голоса. Изменение применяется к активному соединению без переподключения.',
    qualityHigh: 'Высокое качество',
    qualityHighDescription:
      'До 96 кбит/с для стабильного соединения с достаточной пропускной способностью.',
    qualityTitle: 'Качество передачи голоса',
    notificationTitle: 'Звук и микрофон',
    outputDevice: 'Динамики',
    outputDeviceFallback: 'Устройство вывода',
    outputDeviceMissing: 'Устройства вывода не найдены',
    outputSelectionDescription:
      'Выбор динамиков недоступен в этом браузере. Используется системное устройство.',
    outputSelectionError:
      'Не удалось выбрать устройство вывода. Проверьте разрешения браузера.',
    outputVolume: 'Громкость ArcaneLink',
    outputVolumeDescription:
      'Регулирует звук звонков внутри ArcaneLink и не меняет громкость системы.',
    profileBuiltIn: 'Основной профиль защищён от удаления и переименования.',
    profileCreateHint: 'Название нового профиля',
    profileDescription:
      'Профиль сохраняет устройства, обработку микрофона, режим передачи, предупреждения, качество и пространственный звук.',
    profileDefaultName: 'Основной',
    profileCopySuffix: ' — копия',
    profileLimit: (current: number, limit: number) =>
      `${current} из ${limit} профилей`,
    profileNameEmpty: 'Введите название профиля.',
    profileSave: 'Сохранить',
    profileTitle: 'Голосовые профили',
    renameProfile: 'Переименовать',
    processingUnavailable:
      'Этот параметр не поддерживается текущим браузером или устройством.',
    pushToTalkKey: 'Клавиша рации',
    pushToTalkKeyMissing: 'Не назначена',
    pushToTalkMobileUnavailable:
      'Клавиатурная рация недоступна на этом устройстве. Используйте активацию голосом.',
    pushToTalkNotHeldNotification:
      'ArcaneLink слышит речь. Удерживайте {key}, чтобы вас услышали.',
    refreshDevices: 'Обновить устройства',
    speakerTestError:
      'Не удалось воспроизвести тестовый сигнал через выбранное устройство.',
    speakerTestFallback:
      'Выбранное устройство недоступно. Тест воспроизведён через системные динамики.',
    spatialAudioBalanced: 'Стереопанорама',
    spatialAudioBalancedDescription:
      'Мягко распределяет участников по левому и правому каналам.',
    spatialAudioDescription:
      'Выберите способ пространственного размещения голосов. Настройка применяется локально и не влияет на других участников.',
    spatialAudioImmersive: 'Объёмный HRTF',
    spatialAudioImmersiveDescription:
      'Использует модель положения головы для более выраженного направления голоса.',
    spatialAudioOff: 'Выключено',
    spatialAudioOffDescription:
      'Все голоса воспроизводятся по центру без пространственной обработки.',
    spatialAudioTitle: 'Пространственный звук',
    speakingWhileMutedNotification:
      'ArcaneLink слышит речь, но ваш микрофон сейчас выключен.',
    startMicrophoneTest: 'Проверить микрофон',
    startSpeakerTest: 'Проверить динамики',
    stopMicrophoneTest: 'Остановить проверку',
    systemDefaultDevice: 'Системное устройство',
    cancel: 'Отмена',
    testingSpeaker: 'Воспроизводим тестовый сигнал…',
    thresholdMode: 'Настройка порога',
    warningDescription:
      'ArcaneLink может предупредить о потере микрофона или речи при закрытой передаче.',
    warningLocalAnalysis:
      'Определение речи выполняется локально. Звук не сохраняется и не отправляется.',
    warningTitle: 'Предупреждения об отсутствии звука',
    warnInputUnavailable: 'Микрофон недоступен',
    warnInputUnavailableDescription:
      'Показывать уведомление, если устройство отключено, занято или не передаёт сигнал.',
    warnSpeakingWhileMuted: 'Я говорю с выключенным микрофоном',
    warnSpeakingWhileMutedDescription:
      'Предупреждать, когда речь обнаружена, но звук не передаётся из-за mute или режима рации. При включённой опции микрофон продолжает локальный анализ во время mute; звук не передаётся.',
  },
} as const
