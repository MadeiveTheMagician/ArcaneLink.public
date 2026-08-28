export const privateCallCopy = {
  incomingTitle: 'Входящий звонок',
  directDescription: 'Вам звонят в личной переписке.',
  groupDescription: (title: string) => `Групповой звонок · ${title}`,
  accept: 'Принять',
  decline: 'Отклонить',
  accepting: 'Соединяем…',
  declining: 'Отклоняем…',
  unavailable: 'Не удалось выполнить действие. Попробуйте ещё раз.',
  stackLabel: 'Входящие звонки'
} as const;
