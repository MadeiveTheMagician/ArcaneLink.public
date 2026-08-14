import type {
  SpaceMessageReactionResponse,
  SpaceMessageResponse,
} from '../../../../shared/types'

export type CuratedMessageReaction = {
  emojiCode: string
  label: string
}

export type ReactionPresencePhase = 'present' | 'entering' | 'exiting'

export type ReactionPresenceItem = {
  reaction: SpaceMessageReactionResponse
  phase: ReactionPresencePhase
  token: number
}

export type ReactionPresenceState = {
  messageId: string
  items: ReactionPresenceItem[]
  nextToken: number
}

const curatedReactionEntries = [
  ['👍', 'Нравится'],
  ['❤️', 'Любовь'],
  ['😂', 'Смешно'],
  ['🎉', 'Праздник'],
  ['😮', 'Удивление'],
  ['😢', 'Грусть'],
  ['👎', 'Не нравится'],
  ['🔥', 'Огонь'],
  ['💯', 'Сто баллов'],
  ['👏', 'Аплодисменты'],
  ['🙌', 'Ура'],
  ['🙏', 'Спасибо'],
  ['😀', 'Улыбка'],
  ['😃', 'Радость'],
  ['😄', 'Счастье'],
  ['😁', 'Широкая улыбка'],
  ['😆', 'Хохот'],
  ['😅', 'Нервный смех'],
  ['🤣', 'Очень смешно'],
  ['😊', 'Тёплая улыбка'],
  ['😇', 'Ангел'],
  ['🙂', 'Лёгкая улыбка'],
  ['🙃', 'Перевёрнутая улыбка'],
  ['😉', 'Подмигивание'],
  ['😌', 'Облегчение'],
  ['😍', 'Влюблённость'],
  ['🥰', 'Нежность'],
  ['😘', 'Поцелуй'],
  ['😋', 'Вкусно'],
  ['😛', 'Дразнюсь'],
  ['😜', 'Веселье'],
  ['🤪', 'Безумие'],
  ['🤨', 'Недоверие'],
  ['🧐', 'Изучаю'],
  ['🤓', 'Умник'],
  ['😎', 'Круто'],
  ['🥳', 'Вечеринка'],
  ['🤩', 'Восхищение'],
  ['😏', 'Ухмылка'],
  ['😒', 'Недовольство'],
  ['😞', 'Разочарование'],
  ['😔', 'Задумчивость'],
  ['😟', 'Тревога'],
  ['😕', 'Сомнение'],
  ['🙁', 'Огорчение'],
  ['☹️', 'Печаль'],
  ['😣', 'Терплю'],
  ['😖', 'Мучение'],
  ['😫', 'Усталость'],
  ['😩', 'Изнеможение'],
  ['🥺', 'Просьба'],
  ['😭', 'Плач'],
  ['😤', 'Возмущение'],
  ['😠', 'Злость'],
  ['😡', 'Ярость'],
  ['🤬', 'Ругаюсь'],
  ['🤯', 'Взрыв мозга'],
  ['😳', 'Смущение'],
  ['🥵', 'Жарко'],
  ['🥶', 'Холодно'],
  ['😱', 'Ужас'],
  ['😨', 'Страх'],
  ['😰', 'Волнение'],
  ['😥', 'Грустное облегчение'],
  ['🤗', 'Объятия'],
  ['🤔', 'Думаю'],
  ['🤭', 'Хихикаю'],
  ['🤫', 'Тише'],
  ['🤥', 'Враньё'],
  ['😶', 'Без слов'],
  ['😐', 'Нейтрально'],
  ['😑', 'Без эмоций'],
  ['😬', 'Неловко'],
  ['🙄', 'Закатываю глаза'],
  ['😯', 'Ого'],
  ['😲', 'Потрясение'],
  ['🥱', 'Зеваю'],
  ['😴', 'Сон'],
  ['🤤', 'Слюнки'],
  ['😪', 'Сонливость'],
  ['😵', 'Головокружение'],
  ['🤐', 'Молчу'],
  ['🤢', 'Тошнит'],
  ['🤮', 'Очень плохо'],
  ['🤧', 'Чихаю'],
  ['😷', 'Маска'],
  ['🤒', 'Болезнь'],
  ['🤕', 'Травма'],
  ['🤠', 'Ковбой'],
  ['👻', 'Призрак'],
  ['👌', 'Всё отлично'],
  ['✌️', 'Победа'],
  ['🤞', 'Удача'],
  ['🤟', 'Люблю тебя'],
  ['🤘', 'Рок'],
  ['🤙', 'Позвони'],
  ['👈', 'Влево'],
  ['👉', 'Вправо'],
  ['👆', 'Вверх'],
  ['👇', 'Вниз'],
  ['☝️', 'Внимание'],
  ['✋', 'Стоп'],
  ['👋', 'Привет'],
  ['🤏', 'Немного'],
  ['💪', 'Сила'],
  ['🤝', 'Договорились'],
  ['👀', 'Смотрю'],
  ['🧠', 'Мозг'],
  ['💔', 'Разбитое сердце'],
  ['💕', 'Два сердца'],
  ['💖', 'Сияющее сердце'],
  ['💙', 'Синее сердце'],
  ['💚', 'Зелёное сердце'],
  ['💜', 'Фиолетовое сердце'],
  ['🖤', 'Чёрное сердце'],
  ['🤍', 'Белое сердце'],
  ['✨', 'Блеск'],
  ['⭐', 'Звезда'],
  ['🌟', 'Яркая звезда'],
  ['💥', 'Взрыв'],
  ['🎊', 'Конфетти'],
  ['🏆', 'Кубок'],
  ['🥇', 'Первое место'],
  ['🎯', 'В цель'],
  ['🚀', 'Ракета'],
  ['💡', 'Идея'],
  ['🐶', 'Собака'],
  ['🐱', 'Кошка'],
  ['🐼', 'Панда'],
  ['🦊', 'Лиса'],
  ['🐸', 'Лягушка'],
  ['🙈', 'Не вижу'],
  ['🙉', 'Не слышу'],
  ['🙊', 'Не скажу'],
  ['🍕', 'Пицца'],
  ['🍔', 'Бургер'],
  ['🍿', 'Попкорн'],
  ['🍩', 'Пончик'],
  ['🍰', 'Торт'],
  ['☕', 'Кофе'],
  ['🍻', 'Пиво'],
  ['🌈', 'Радуга'],
  ['☀️', 'Солнце'],
  ['🌙', 'Луна'],
] as const

export const curatedMessageReactions: readonly CuratedMessageReaction[] =
  curatedReactionEntries.map(([emojiCode, label]) => ({ emojiCode, label }))

const curatedReactionOrder = new Map(
  curatedMessageReactions.map((reaction, index) => [reaction.emojiCode, index]),
)

export function shouldAddMessageReaction(
  reactions: readonly SpaceMessageReactionResponse[],
  emojiCode: string,
) {
  return !reactions.some(
    (reaction) =>
      reaction.emojiCode === emojiCode && reaction.reactedByCurrentUser,
  )
}

export function replaceMessage(
  messages: SpaceMessageResponse[],
  updatedMessage: SpaceMessageResponse,
) {
  if (!messages.some((message) => message.id === updatedMessage.id)) {
    return messages
  }

  return messages.map((message) => {
    if (message.id !== updatedMessage.id) {
      return message
    }

    return updatedMessage
  })
}

export function sortMessageReactions(
  reactions: readonly SpaceMessageReactionResponse[],
) {
  return [...reactions].sort((left, right) => {
    const leftOrder = curatedReactionOrder.get(left.emojiCode)
    const rightOrder = curatedReactionOrder.get(right.emojiCode)

    if (leftOrder != null || rightOrder != null) {
      if (leftOrder == null) return 1
      if (rightOrder == null) return -1
      return leftOrder - rightOrder
    }

    if (left.count !== right.count) {
      return right.count - left.count
    }

    return left.emojiCode.localeCompare(right.emojiCode)
  })
}

function sortReactionPresenceItems(items: ReactionPresenceItem[]) {
  const itemsByEmojiCode = new Map(
    items.map((item) => [item.reaction.emojiCode, item]),
  )

  return sortMessageReactions(items.map((item) => item.reaction))
    .map((reaction) => itemsByEmojiCode.get(reaction.emojiCode))
    .filter((item): item is ReactionPresenceItem => item != null)
}

export function createReactionPresenceState(
  messageId: string,
  reactions: readonly SpaceMessageReactionResponse[],
): ReactionPresenceState {
  return {
    messageId,
    items: sortMessageReactions(reactions).map((reaction) => ({
      reaction,
      phase: 'present',
      token: 0,
    })),
    nextToken: 1,
  }
}

export function reconcileReactionPresence(
  state: ReactionPresenceState,
  messageId: string,
  reactions: readonly SpaceMessageReactionResponse[],
): ReactionPresenceState {
  if (state.messageId !== messageId) {
    const resetState = createReactionPresenceState(messageId, reactions)
    return { ...resetState, nextToken: state.nextToken }
  }

  const incomingReactions = sortMessageReactions(reactions)
  const incomingEmojiCodes = new Set(
    incomingReactions.map((reaction) => reaction.emojiCode),
  )
  const previousItems = new Map(
    state.items.map((item) => [item.reaction.emojiCode, item]),
  )
  let nextToken = state.nextToken

  const items = incomingReactions.map((reaction): ReactionPresenceItem => {
    const previousItem = previousItems.get(reaction.emojiCode)
    if (!previousItem) {
      return {
        reaction,
        phase: 'entering',
        token: nextToken++,
      }
    }

    return {
      reaction,
      phase: previousItem.phase === 'exiting'
        ? 'present'
        : previousItem.phase,
      token: previousItem.token,
    }
  })

  for (const previousItem of state.items) {
    if (incomingEmojiCodes.has(previousItem.reaction.emojiCode)) {
      continue
    }

    items.push(
      previousItem.phase === 'exiting'
        ? previousItem
        : {
            ...previousItem,
            phase: 'exiting',
            token: nextToken++,
          },
    )
  }

  return {
    messageId,
    items: sortReactionPresenceItems(items),
    nextToken,
  }
}

export function completeReactionPresenceAnimation(
  state: ReactionPresenceState,
  messageId: string,
  emojiCode: string,
  token: number,
): ReactionPresenceState {
  if (state.messageId !== messageId) {
    return state
  }

  const item = state.items.find(
    (candidate) =>
      candidate.reaction.emojiCode === emojiCode &&
      candidate.token === token,
  )
  if (!item || item.phase === 'present') {
    return state
  }

  if (item.phase === 'exiting') {
    return {
      ...state,
      items: state.items.filter((candidate) => candidate !== item),
    }
  }

  return {
    ...state,
    items: state.items.map((candidate) =>
      candidate === item
        ? { ...candidate, phase: 'present' }
        : candidate,
    ),
  }
}
