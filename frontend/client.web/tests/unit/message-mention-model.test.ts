import { expect, test } from '@playwright/test'
import {
  buildMentionSuggestions,
  discoverDraftMentions,
  findUnresolvedMentionCandidateQueries,
  filterDraftMentionsByOptions,
  findActiveMentionQuery,
  hasPotentialMentionToken,
  insertMentionOption,
  isActiveMentionQueryResolved,
  prepareMessageWithMentions,
  reconcileDraftMentions,
} from '../../src/system/Server/components/messages/mentions'
import type {
  DraftMention,
  MentionOption,
} from '../../src/system/Server/components/messages/mentions'

const bobOption: MentionOption = {
  key: 'user:bob-id',
  kind: 'user',
  targetId: 'bob-id',
  token: '@bob',
  label: 'Bob',
  secondaryLabel: '@bob',
}

const seniorModeratorOption: MentionOption = {
  key: 'role:senior-moderator-id',
  kind: 'role',
  targetId: 'senior-moderator-id',
  token: '@Senior Moderator',
  label: 'Senior Moderator',
}

function mention(
  token: string,
  start: number,
  overrides: Partial<DraftMention> = {},
): DraftMention {
  return {
    kind: 'user',
    targetId: 'bob-id',
    token,
    start,
    length: token.length,
    ...overrides,
  }
}

test.describe('mention autocomplete model', () => {
  test('finds an active query at the caret and supports a role with spaces', () => {
    expect(findActiveMentionQuery('Привет, @Senior Mod', 19)).toEqual({
      start: 8,
      end: 19,
      query: 'Senior Mod',
    })
    expect(findActiveMentionQuery('@', 1)).toEqual({ start: 0, end: 1, query: '' })
  })

  test('does not treat email or a completed phrase as an active mention', () => {
    const email = 'mail@example.com'
    expect(findActiveMentionQuery(email, email.length)).toBeNull()
    expect(findActiveMentionQuery('Привет @bob, дальше', 12)).toBeNull()
    const multiline = '@bob\nдальше'
    expect(findActiveMentionQuery(multiline, multiline.length)).toBeNull()
  })

  test('detects mention boundaries without treating email addresses as mentions', () => {
    expect(hasPotentialMentionToken('mail@example.com')).toBe(false)
    expect(hasPotentialMentionToken('до @bob и после')).toBe(true)
    expect(hasPotentialMentionToken('(@everyone)')).toBe(true)
  })

  test('ranks exact, prefix and contains matches across display name and login', () => {
    const suggestions = buildMentionSuggestions({
      query: 'bob',
      users: [
        { id: 'contains', login: 'a-bob-z', displayName: 'Первый' },
        { id: 'prefix', login: 'bobby', displayName: 'Второй' },
        { id: 'display-exact', login: 'unrelated', displayName: 'BOB' },
        {
          id: 'login-exact',
          login: 'bob',
          displayName: 'Четвёртый',
          avatarAssetId: 'avatar-id',
          avatarCropOffsetX: 0.125,
          avatarCropOffsetY: -0.25,
          avatarCropZoom: 1.4,
        },
        { id: 'display-prefix', login: 'fifth', displayName: 'Bobby' },
        { id: 'sixth', login: 'bob-six', displayName: 'Шестой' },
        { id: 'miss', login: 'alice', displayName: 'Алиса' },
      ],
      roles: [],
    })

    expect(suggestions.users.map((option) => option.targetId)).toEqual([
      'display-exact',
      'login-exact',
      'prefix',
      'display-prefix',
      'sixth',
    ])
    expect(
      suggestions.users.find((option) => option.targetId === 'login-exact'),
    ).toMatchObject({
      avatarAssetId: 'avatar-id',
      avatarCropOffsetX: 0.125,
      avatarCropOffsetY: -0.25,
      avatarCropZoom: 1.4,
    })
  })

  test('normalizes compatibility Unicode and keeps everyone and roles separate', () => {
    const fullWidthBob = 'ＢＯＢ'
    const userSuggestions = buildMentionSuggestions({
      query: 'bob',
      users: [{ id: 'wide', login: fullWidthBob, displayName: 'Боб' }],
      roles: [],
    })
    const roleSuggestions = buildMentionSuggestions({
      query: 'senior mod',
      users: [],
      roles: [
        { id: 'member', title: 'Member' },
        { id: 'senior', title: 'Senior Moderator' },
      ],
    })
    const everyoneSuggestions = buildMentionSuggestions({
      query: 'every',
      users: [],
      roles: [],
    })

    expect(userSuggestions.users[0]?.targetId).toBe('wide')
    expect(roleSuggestions.roles.map((option) => option.token)).toEqual([
      '@Senior Moderator',
    ])
    expect(roleSuggestions.everyone).toBeNull()
    expect(everyoneSuggestions.everyone?.token).toBe('@everyone')
  })

  test('inserts a canonical role token and returns its UTF-16 range', () => {
    const text = '🧙 @sen'
    const query = findActiveMentionQuery(text, text.length)
    expect(query).not.toBeNull()

    const insertion = insertMentionOption(text, query!, seniorModeratorOption)

    expect(insertion).toEqual({
      text: '🧙 @Senior Moderator ',
      caret: 21,
      mention: {
        kind: 'role',
        targetId: 'senior-moderator-id',
        token: '@Senior Moderator',
        start: 3,
        length: 17,
      },
    })
  })

  test('does not add a second separator before existing whitespace', () => {
    const query = findActiveMentionQuery('Ответ @bo дальше', 9)
    const insertion = insertMentionOption('Ответ @bo дальше', query!, bobOption)

    expect(insertion?.text).toBe('Ответ @bob дальше')
    expect(insertion?.caret).toBe(10)
  })
})

test.describe('draft mention model', () => {
  test('shifts later mention ranges when Unicode text is pasted before them', () => {
    const previousText = 'Hello @bob '
    const nextText = '🧙 Hello @bob '
    const result = reconcileDraftMentions(
      previousText,
      nextText,
      [mention('@bob', 6)],
    )

    expect(result).toEqual([mention('@bob', 9)])
    expect(nextText.slice(result[0]!.start, result[0]!.start + result[0]!.length))
      .toBe('@bob')
  })

  test('removes a mention edited inside its token and preserves unrelated ones', () => {
    expect(
      reconcileDraftMentions('@bob и @alice', '@boXXb и @alice', [
        mention('@bob', 0),
        mention('@alice', 7, { targetId: 'alice-id' }),
      ]),
    ).toEqual([
      mention('@alice', 9, { targetId: 'alice-id' }),
    ])
  })

  test('keeps a mention when editing normal text after its separator', () => {
    expect(
      reconcileDraftMentions('@bob привет', '@bob большой привет', [
        mention('@bob', 0),
      ]),
    ).toEqual([mention('@bob', 0)])
  })

  test('does not reopen autocomplete after a selected mention', () => {
    const text = '@bob ordinary text'
    const query = findActiveMentionQuery(text, text.length)

    expect(query).not.toBeNull()
    expect(
      isActiveMentionQueryResolved(text, query!, [mention('@bob', 0)]),
    ).toBe(true)
  })

  test('finds unresolved user and multi-word role queries before submit', () => {
    expect(
      findUnresolvedMentionCandidateQueries(
        '@bob, @Senior Moderator please',
        [],
      ),
    ).toEqual([
      'bob',
      'Senior Moderator please',
      'Senior Moderator',
      'Senior',
    ])
    expect(
      findUnresolvedMentionCandidateQueries(
        '@bob and @alice',
        [mention('@bob', 0)],
      ),
    ).toEqual(['alice'])
  })

  test('discovers exact pasted tokens, including a role with spaces', () => {
    const text = 'Ping @Senior Moderator и @bob. Не @bobby и не mail@bob.dev'
    const discovered = discoverDraftMentions(
      text,
      [bobOption, seniorModeratorOption],
    )

    expect(discovered).toEqual([
      mention('@Senior Moderator', 5, {
        kind: 'role',
        targetId: 'senior-moderator-id',
      }),
      mention('@bob', 25),
    ])
  })

  test('accepts a sentence dot after a mention but not a dotted login continuation', () => {
    expect(discoverDraftMentions('hello @bob.', [bobOption])).toHaveLength(1)
    expect(discoverDraftMentions('hello @bob.extra', [bobOption])).toHaveLength(0)
  })

  test('trims the body and shifts valid UTF-16 offsets', () => {
    const text = ' \n🧙 @bob  '
    const prepared = prepareMessageWithMentions(text, [mention('@bob', 5)])

    expect(prepared).toEqual({
      body: '🧙 @bob',
      mentions: [{
        kind: 'user',
        targetId: 'bob-id',
        start: 3,
        length: 4,
      }],
    })
  })

  test('filters invalid, overlapping and no-longer-canonical spans', () => {
    const text = '@bob @everyone'
    const prepared = prepareMessageWithMentions(text, [
      mention('@bob', 0),
      mention('@bob', 0),
      mention('@everyone', 5, { kind: 'everyone', targetId: null }),
      mention('@everyone', 5, { kind: 'everyone', targetId: 'unexpected' }),
      mention('@missing', 50),
    ])

    expect(prepared.mentions).toEqual([
      { kind: 'user', targetId: 'bob-id', start: 0, length: 4 },
      { kind: 'everyone', targetId: null, start: 5, length: 9 },
    ])
  })

  test('drops structured mentions that are no longer supported candidates', () => {
    expect(
      filterDraftMentionsByOptions(
        [
          mention('@bob', 0),
          mention('@everyone', 5, { kind: 'everyone', targetId: null }),
          mention('@removed', 15, { targetId: 'removed-id' }),
          mention('@old-bob', 24),
        ],
        [
          bobOption,
          {
            key: 'everyone',
            kind: 'everyone',
            targetId: null,
            token: '@everyone',
            label: 'everyone',
          },
        ],
      ),
    ).toEqual([
      mention('@bob', 0),
      mention('@everyone', 5, { kind: 'everyone', targetId: null }),
    ])
  })
})
