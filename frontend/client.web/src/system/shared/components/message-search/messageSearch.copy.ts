export const messageSearchCopy = {
  aria: {
    clear: 'Очистить поиск',
    results: 'Результаты поиска сообщений'
  },
  attachments: {
    any: 'вложение',
    audio: 'аудио',
    file: 'файл',
    image: 'изображение',
    video: 'видео',
    withoutText: 'Вложение без текста'
  },
  chips: {
    attachment: (label: string) => `имеет: ${label}`,
    sender: (displayName: string) => `от: ${displayName}`,
    space: (title: string) => `в: ${title}`
  },
  filters: {
    attachmentDescription: 'Поиск определённого типа данных',
    attachmentTag: 'имеет: вложение или файл',
    menuTitle: 'Фильтры',
    senderDescription: 'От конкретного пользователя',
    senderTag: 'от: пользователя',
    spaceDescription: 'Поиск в определённом канале',
    spaceTag: 'в: канале'
  },
  menu: {
    attachmentTitle: 'Содержит',
    senderTitle: 'От пользователя',
    spaceTitle: 'В канале'
  },
  placeholder: 'Поиск сообщений',
  prefix: {
    attachment: 'имеет:',
    sender: 'от:',
    space: 'в:'
  },
  results: {
    empty: 'Совпадений нет.',
    emptyForQuery: (query: string) => `Совпадений по "${query}" нет.`,
    found: 'Найдено',
    searching: 'Ищем сообщения...'
  }
} as const;
