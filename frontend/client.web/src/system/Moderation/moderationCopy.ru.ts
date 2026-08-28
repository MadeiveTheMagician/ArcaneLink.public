import type {
  ModerationCaseStatus,
  ModerationReasonCode
} from './moderationTypes';

export const moderationCopy = {
  report: {
    action: 'Пожаловаться',
    title: 'Пожаловаться на сообщение',
    description:
      'Жалоба и снимок сообщения будут переданы модераторам этого сервера.',
    messageFrom: (displayName: string) => `Сообщение от ${displayName}`,
    emptyMessage: 'Сообщение без текста',
    reason: 'Причина',
    details: 'Дополнительные сведения',
    detailsHint: 'Опишите проблему без личных или конфиденциальных данных.',
    detailsPlaceholder: 'Что именно нарушает правила сервера?',
    cancel: 'Отмена',
    submit: 'Отправить жалобу',
    submitting: 'Отправляем…',
    successTitle: 'Жалоба отправлена',
    successBody:
      'Модераторы сервера получили жалобу. Её состояние доступно в системных настройках.',
    close: 'Закрыть',
    failed: 'Не удалось отправить жалобу.'
  },
  myReports: {
    tab: 'Мои жалобы',
    title: 'Мои жалобы',
    description:
      'Здесь показано состояние жалоб, которые вы отправили на сообщения серверов.',
    loading: 'Загружаем жалобы…',
    empty: 'Вы ещё не отправляли жалобы.',
    failed: 'Не удалось загрузить жалобы.',
    retry: 'Повторить',
    reportForMessage: (messageId: string) =>
      `Сообщение ${shortIdentifier(messageId)}`,
    submitted: 'Отправлена',
    updated: 'Обновлена'
  },
  cases: {
    tab: 'Модерация',
    title: 'Жалобы на сообщения',
    description:
      'Очередь жалоб доступна только участникам с правом manage_reports.',
    filter: 'Статус жалоб',
    allStatuses: 'Все статусы',
    loading: 'Загружаем очередь…',
    empty: 'В этой очереди жалоб нет.',
    failed: 'Не удалось загрузить очередь жалоб.',
    retry: 'Повторить',
    loadMore: 'Показать ещё',
    submissions: (count: number) => `Жалоб: ${count}`,
    reportedUser: 'Пользователь',
    openCase: 'Открыть материалы жалобы',
    closeCase: 'Закрыть материалы',
    evidence: 'Зафиксированные материалы',
    actions: 'История решений',
    noActions: 'Решений по жалобе пока нет.',
    messageSnapshot: 'Снимок сообщения',
    payloadSnapshot: 'Снимок данных сообщения',
    attachments: 'Вложения',
    integrity: 'SHA-256 снимка',
    updateStatus: 'Изменить статус',
    decisionNote: 'Комментарий к решению',
    decisionNotePlaceholder: 'Необязательный комментарий для истории решений',
    save: 'Сохранить решение',
    saving: 'Сохраняем…',
    updateFailed: 'Не удалось изменить статус жалобы.',
    conflict:
      'Жалобу уже изменил другой модератор. Загружена актуальная версия.',
    detailFailed: 'Не удалось загрузить материалы жалобы.',
    noMessageText: 'Текст сообщения отсутствует.',
    attachment: (fileName: string) => fileName || 'Вложение',
    openAttachment: 'Открыть или скачать',
    loadingAttachment: 'Загружаем вложение…',
    attachmentTransferFailed: 'Не удалось загрузить вложение.',
    invalidAttachmentUrl: 'Адрес вложения не прошёл проверку безопасности.',
    invalidAttachmentResponse:
      'Сервер вернул небезопасный или повреждённый файл.',
    attachmentIntegrityFailed: 'Проверка целостности вложения не пройдена.'
  }
} as const;

export const moderationReasonOptions: ReadonlyArray<{
  code: ModerationReasonCode;
  label: string;
}> = [
  { code: 'spam', label: 'Спам' },
  { code: 'harassment', label: 'Травля или оскорбления' },
  { code: 'hate', label: 'Разжигание ненависти' },
  { code: 'sexual', label: 'Сексуальный контент' },
  { code: 'violence', label: 'Насилие или угрозы' },
  { code: 'scam', label: 'Мошенничество' },
  { code: 'privacy', label: 'Нарушение приватности' },
  { code: 'other', label: 'Другая причина' }
];

export const moderationCaseStatusOptions: ReadonlyArray<{
  code: ModerationCaseStatus;
  label: string;
}> = [
  { code: 'open', label: 'Открыта' },
  { code: 'in_review', label: 'На рассмотрении' },
  { code: 'resolved', label: 'Решена' },
  { code: 'dismissed', label: 'Отклонена' }
];

export function getModerationReasonLabel(code: string) {
  return (
    moderationReasonOptions.find((option) => option.code === code)?.label ??
    'Другая причина'
  );
}

export function getModerationCaseStatusLabel(code: string) {
  return (
    moderationCaseStatusOptions.find((option) => option.code === code)?.label ??
    'Неизвестный статус'
  );
}

export function getUserReportStatusLabel(code: string) {
  if (code === 'open' || code === 'received') {
    return 'Получена';
  }

  if (code === 'in_review' || code === 'under_review') {
    return 'На рассмотрении';
  }

  if (code === 'resolved' || code === 'dismissed' || code === 'closed') {
    return 'Закрыта';
  }

  return 'Статус обновляется';
}

function shortIdentifier(value: string) {
  return value.length > 12 ? `${value.slice(0, 8)}…` : value;
}
