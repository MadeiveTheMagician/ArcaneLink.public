import type {
  ActiveMentionQuery,
  DraftMention,
  MentionOption,
  MessageMentionRequest
} from './messageMentionTypes';

export type PreparedMessageWithMentions = {
  readonly body: string;
  readonly mentions: readonly MessageMentionRequest[];
};

export function reconcileDraftMentions(
  previousText: string,
  nextText: string,
  mentions: readonly DraftMention[]
) {
  const previousMentions = normalizeDraftMentions(previousText, mentions);
  if (previousText === nextText) {
    return previousMentions;
  }

  const edit = findSingleEdit(previousText, nextText);
  const delta = edit.nextEnd - edit.start - (edit.previousEnd - edit.start);
  const isInsertion = edit.start === edit.previousEnd;

  const reconciled = previousMentions.flatMap((mention): DraftMention[] => {
    const mentionEnd = mention.start + mention.length;

    if (isInsertion) {
      if (edit.start <= mention.start) {
        return [{ ...mention, start: mention.start + delta }];
      }
      if (edit.start >= mentionEnd) {
        return [mention];
      }
      return [];
    }

    if (mentionEnd <= edit.start) {
      return [mention];
    }
    if (mention.start >= edit.previousEnd) {
      return [{ ...mention, start: mention.start + delta }];
    }
    return [];
  });

  return normalizeDraftMentions(nextText, reconciled);
}

export function discoverDraftMentions(
  text: string,
  options: readonly MentionOption[],
  existingMentions: readonly DraftMention[] = []
) {
  const mentions = normalizeDraftMentions(text, existingMentions);
  const uniqueOptions = [
    ...new Map(
      options
        .filter(isUsableMentionOption)
        .map((option) => [
          `${option.kind}:${option.targetId ?? ''}:${option.token}`,
          option
        ])
    ).values()
  ].sort((left, right) => right.token.length - left.token.length);

  for (const option of uniqueOptions) {
    let start = text.indexOf(option.token);
    while (start >= 0) {
      const candidate: DraftMention = {
        kind: option.kind,
        targetId: option.targetId,
        token: option.token,
        start,
        length: option.token.length
      };

      if (
        isDraftMentionValid(text, candidate) &&
        !mentions.some((mention) => rangesOverlap(mention, candidate))
      ) {
        mentions.push(candidate);
      }

      start = text.indexOf(option.token, start + option.token.length);
    }
  }

  return mentions.sort(compareMentionRanges);
}

export function filterDraftMentionsByOptions(
  mentions: readonly DraftMention[],
  options: readonly MentionOption[]
) {
  const supported = new Set(
    options
      .filter(isUsableMentionOption)
      .map(
        (option) => `${option.kind}:${option.targetId ?? ''}:${option.token}`
      )
  );

  return mentions.filter((mention) =>
    supported.has(`${mention.kind}:${mention.targetId ?? ''}:${mention.token}`)
  );
}

export function isActiveMentionQueryResolved(
  text: string,
  query: ActiveMentionQuery,
  mentions: readonly DraftMention[]
) {
  return normalizeDraftMentions(text, mentions).some(
    (mention) =>
      mention.start === query.start &&
      query.end >= mention.start + mention.length
  );
}

export function findUnresolvedMentionCandidateQueries(
  text: string,
  mentions: readonly DraftMention[],
  maximumQueries = 25
) {
  const safeMaximumQueries = Math.max(0, Math.floor(maximumQueries));
  if (safeMaximumQueries === 0) {
    return [];
  }

  const resolvedMentions = normalizeDraftMentions(text, mentions);
  const queries = new Set<string>();
  let start = text.indexOf('@');

  while (start >= 0 && queries.size < safeMaximumQueries) {
    const previousCharacter = start > 0 ? text[start - 1] : undefined;
    const resolvedMention = resolvedMentions.find(
      (mention) =>
        mention.start <= start && start < mention.start + mention.length
    );
    if (resolvedMention) {
      start = text.indexOf('@', resolvedMention.start + resolvedMention.length);
      continue;
    }
    if (isMentionPrefixContinuation(previousCharacter)) {
      start = text.indexOf('@', start + 1);
      continue;
    }

    let end = start + 1;
    while (
      end < text.length &&
      !/[\r\n\t,;:!?()[\]{}<>/\\"“”«»]/u.test(text[end]!)
    ) {
      end += 1;
    }

    const rawQuery = text
      .slice(start + 1, end)
      .trim()
      .replace(/\.+$/u, '');
    const words = rawQuery.split(/\s+/u).filter(Boolean).slice(0, 8);
    for (
      let wordCount = words.length;
      wordCount > 0 && queries.size < safeMaximumQueries;
      wordCount -= 1
    ) {
      const query = words.slice(0, wordCount).join(' ');
      if (query.toLocaleLowerCase() !== 'everyone') {
        queries.add(query);
      }
    }

    start = text.indexOf('@', Math.max(end, start + 1));
  }

  return [...queries];
}

export function prepareMessageWithMentions(
  text: string,
  mentions: readonly DraftMention[]
): PreparedMessageWithMentions {
  const body = text.trim();
  if (body.length === 0) {
    return { body, mentions: [] };
  }

  const leadingWhitespaceLength = text.length - text.trimStart().length;
  const adjustedMentions = normalizeDraftMentions(text, mentions).map(
    (mention): DraftMention => ({
      ...mention,
      start: mention.start - leadingWhitespaceLength
    })
  );

  return {
    body,
    mentions: normalizeDraftMentions(body, adjustedMentions).map(
      ({ kind, targetId, start, length }) => ({
        kind,
        targetId,
        start,
        length
      })
    )
  };
}

export function isDraftMentionValid(text: string, mention: DraftMention) {
  if (
    !Number.isInteger(mention.start) ||
    !Number.isInteger(mention.length) ||
    mention.start < 0 ||
    mention.length <= 1 ||
    mention.start + mention.length > text.length ||
    mention.token.length !== mention.length ||
    text.slice(mention.start, mention.start + mention.length) !==
      mention.token ||
    !mention.token.startsWith('@')
  ) {
    return false;
  }

  if (mention.kind === 'everyone') {
    if (mention.targetId != null || mention.token !== '@everyone') {
      return false;
    }
  } else if (
    typeof mention.targetId !== 'string' ||
    mention.targetId.length === 0
  ) {
    return false;
  }

  const previousCharacter =
    mention.start > 0 ? text[mention.start - 1] : undefined;
  const nextIndex = mention.start + mention.length;
  return (
    !isMentionPrefixContinuation(previousCharacter) &&
    !isMentionSuffixContinuation(text, nextIndex)
  );
}

function normalizeDraftMentions(
  text: string,
  mentions: readonly DraftMention[]
) {
  const normalized: DraftMention[] = [];

  for (const mention of [...mentions].sort(compareMentionRanges)) {
    if (
      !isDraftMentionValid(text, mention) ||
      normalized.some((candidate) => rangesOverlap(candidate, mention))
    ) {
      continue;
    }

    normalized.push(mention);
  }

  return normalized;
}

function findSingleEdit(previousText: string, nextText: string) {
  let start = 0;
  const sharedPrefixLimit = Math.min(previousText.length, nextText.length);
  while (start < sharedPrefixLimit && previousText[start] === nextText[start]) {
    start += 1;
  }

  let sharedSuffixLength = 0;
  const sharedSuffixLimit = Math.min(
    previousText.length - start,
    nextText.length - start
  );
  while (
    sharedSuffixLength < sharedSuffixLimit &&
    previousText[previousText.length - 1 - sharedSuffixLength] ===
      nextText[nextText.length - 1 - sharedSuffixLength]
  ) {
    sharedSuffixLength += 1;
  }

  return {
    start,
    previousEnd: previousText.length - sharedSuffixLength,
    nextEnd: nextText.length - sharedSuffixLength
  };
}

function compareMentionRanges(left: DraftMention, right: DraftMention) {
  return left.start - right.start || right.length - left.length;
}

function rangesOverlap(left: DraftMention, right: DraftMention) {
  return (
    left.start < right.start + right.length &&
    right.start < left.start + left.length
  );
}

function isMentionWordCharacter(value: string | undefined) {
  return value != null && /[\p{L}\p{N}\p{M}_@-]/u.test(value);
}

function isMentionPrefixContinuation(value: string | undefined) {
  return value === '.' || isMentionWordCharacter(value);
}

function isMentionSuffixContinuation(text: string, index: number) {
  const value = text[index];
  if (isMentionWordCharacter(value)) return true;

  return value === '.' && isMentionWordCharacter(text[index + 1]);
}

function isUsableMentionOption(option: MentionOption) {
  if (!option.token.startsWith('@') || option.token.length <= 1) {
    return false;
  }
  if (option.kind === 'everyone') {
    return option.targetId == null && option.token === '@everyone';
  }
  return typeof option.targetId === 'string' && option.targetId.length > 0;
}
