export const authCopy = {
  actions: {
    back: 'Назад',
    create: 'Создать',
    createAccount: 'Создать аккаунт',
    creating: 'Создаем...',
    creatingSeal: 'Создаем печать...',
    login: 'Войти',
    loginLoading: 'Сверяем печать...',
    next: 'Далее',
    register: 'Регистрация',
    backToLogin: 'Вернуться ко входу',
    sendRecoveryLink: 'Отправить ссылку',
    resetPassword: 'Сменить пароль',
    resendVerification: 'Отправить письмо ещё раз',
    saving: 'Сохраняем...',
    sending: 'Отправляем...',
  },
  aria: {
    changeForm: 'Смена формы',
    hidePassword: 'Скрыть пароль',
    registerSteps: 'Этапы регистрации',
    showPassword: 'Показать пароль',
    step: (index: number, label: string) => `Шаг ${index}: ${label}`,
  },
  fields: {
    displayName: 'Профиль',
    displayNamePlaceholder: 'Имя профиля',
    displayNameRegisterPlaceholder: 'Отображаемое имя',
    emailComplete: 'Email заполнен',
    emailOrLogin: 'Email или логин',
    login: 'Логин',
    loginOrEmail: 'Логин или email',
    loginPlaceholder: 'Логин',
    loginRegisterPlaceholder: 'Введите логин',
    password: 'Пароль',
    newPassword: 'Новый пароль',
    confirmPassword: 'Повторите новый пароль',
    rememberMe: 'Запомнить меня',
  },
  hints: {
    deviceReady: 'Печать устройства готова. Введите учётные данные для входа.',
    forgotPassword: 'Забыли пароль?',
    loginCopy: 'Войдите в свой контур и продолжите работу с серверами, друзьями и личными сообщениями.',
    registerCopy: 'Заполните четыре печати регистрации. После создания аккаунта портал вернет вас ко входу.',
    registerReady: 'Заполните свиток регистрации. После создания аккаунта портал вернет вас ко входу.',
    registrationEmailVerification:
      'После регистрации мы отправим на email ссылку. Войти можно только после подтверждения адреса.',
    forgotPasswordCopy:
      'Укажите email или логин. Если аккаунт активен, мы отправим безопасную ссылку.',
    resetPasswordCopy:
      'Задайте новый пароль. После смены все активные сеансы будут завершены.',
    confirmEmailCopy:
      'Проверяем одноразовую ссылку и активируем email.',
  },
  labels: {
    device: 'Устройство',
    requirements: 'Требования',
    stepOf: (current: number, total: number) => `Шаг ${current} из ${total}`,
  },
  requirements: {
    displayName: 'Требования к профилю',
    displayNameMaxLength: 'Не больше 128 символов',
    displayNameMinLength: 'Минимум 3 символа',
    displayNameRequired: 'Имя профиля заполнено',
    email: 'Требования к email',
    login: 'Требования к логину',
    loginMaxLength: 'Не больше 50 символов',
    loginMinLength: 'Минимум 3 символа',
    loginRequired: 'Логин заполнен',
    password: 'Требования к паролю',
    passwordDigit: 'Есть цифра',
    passwordLowercase: 'Есть строчная буква',
    passwordMaxLength: 'Не больше 128 символов',
    passwordMinLength: 'Минимум 8 символов',
    passwordNoWhitespace: 'Нет пробелов',
    passwordSpecial: 'Есть спецсимвол',
    passwordUppercase: 'Есть заглавная буква',
  },
  messages: {
    loginFailed: 'Вход не выполнен.',
    loginSuccess: (displayName: string) =>
      `Портал открыт. Добро пожаловать, ${displayName}.`,
    registerFailed: 'Регистрация не выполнена.',
    registerSuccess: (login: string) =>
      `Аккаунт ${login} создан. Проверьте почту и подтвердите email перед входом.`,
    verifyingAccessSeal: 'Сверяем печать доступа...',
    emailNotConfirmed:
      'Адрес email ещё не подтверждён. Откройте ссылку из письма, затем войдите.',
    verificationSent:
      'Если аккаунт ожидает подтверждения, новое письмо будет отправлено.',
    recoverySent:
      'Если аккаунт найден, ссылка для смены пароля отправлена.',
    passwordResetSuccess:
      'Пароль изменён. Теперь войдите с новым паролем.',
    emailConfirmed:
      'Адрес email подтверждён. Аккаунт активирован, можно войти.',
    confirmingEmail: 'Проверяем ссылку подтверждения...',
    checkVerificationInbox:
      'Аккаунт пока не активирован. Проверьте входящие и откройте ссылку из письма. При необходимости письмо можно отправить повторно.',
    emailChangeConfirmed:
      'Новый адрес email подтверждён. Для безопасности войдите в аккаунт заново.',
    emailConfirmationFailed:
      'Ссылка подтверждения недействительна или срок её действия истёк.',
    passwordRequirementsNotMet:
      'Новый пароль пока не соответствует требованиям безопасности.',
    passwordResetFailed:
      'Не удалось изменить пароль. Ссылка могла устареть или уже использоваться.',
    recoverySendFailed:
      'Не удалось отправить письмо для восстановления. Повторите попытку позже.',
    resettingPassword: 'Сохраняем новый пароль...',
    sendingRecovery: 'Готовим письмо для восстановления...',
    sendingVerification: 'Отправляем письмо подтверждения...',
    verificationSendFailed:
      'Не удалось отправить письмо подтверждения. Повторите попытку позже.',
    passwordsDoNotMatch: 'Пароли не совпадают.',
  },
  steps: {
    displayName: 'Профиль',
    email: 'Email',
    login: 'Логин',
    password: 'Пароль',
  },
  tabs: {
    login: 'Вход',
    register: 'Регистрация',
  },
  titles: {
    confirmEmail: 'Подтверждение email',
    forgotPassword: 'Восстановление пароля',
    resetPassword: 'Новый пароль',
    verifyEmail: 'Проверьте почту',
  },
  themeTest: {
    activeFrame: 'Активный фрейм',
    activeItem: 'Активный элемент',
    accent: 'Акцент',
    accentLayers: 'Акцентные слои',
    border: 'Граница',
    denseSurface: 'Плотная панель',
    description:
      'Проверка поверхности, границы, обычного текста и вторичного описания.',
    forms: 'Формы',
    gradients: 'Градиенты',
    lightAccent: 'Светлый акцент',
    lists: 'Списки',
    name: 'Название',
    normalItem: 'Обычный элемент',
    panel: 'Панель',
    fieldsAndToggles: 'Поля и тоглы',
    applyTheme: 'Применить тему',
    selectedStates: 'Выбранные состояния',
    success: 'Успех',
    surface: 'Фон',
    text: 'Текст',
    themePicker: 'Темы для проверки',
    danger: 'Опасность',
    mutedText: 'Вторичный текст',
  },
} as const
