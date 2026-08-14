import { expect, test } from '@playwright/test'
import {
  findServerInviteMessageLinks,
  SERVER_INVITE_MESSAGE_CARD_LIMIT,
} from '../../src/system/Server/components/messages/serverInviteLinkModel'

const origin = 'https://chat.arcanelink.test'

test.describe('server invite links in messages', () => {
  test('extracts only exact invite routes from the current origin', () => {
    const links = findServerInviteMessageLinks(
      [
        'Подключайся: https://chat.arcanelink.test/invite/A1b2-C3_d.',
        'Не приглашение: https://chat.arcanelink.test/invites/other',
        'Чужой сервер: https://arcanelink.test.evil.example/invite/stolen',
        'Другой origin: https://www.arcanelink.test/invite/another',
      ].join(' '),
      origin,
    )

    expect(links).toEqual([
      {
        code: 'a1b2-c3_d',
        sourceUrl: 'https://chat.arcanelink.test/invite/a1b2-c3_d',
      },
    ])
  })

  test('deduplicates case-insensitive invite codes and strips query data', () => {
    const links = findServerInviteMessageLinks(
      [
        'https://chat.arcanelink.test/invite/ABC123?from=message',
        'https://chat.arcanelink.test/invite/abc123#details',
      ].join(' '),
      origin,
    )

    expect(links).toEqual([
      {
        code: 'abc123',
        sourceUrl: 'https://chat.arcanelink.test/invite/abc123',
      },
    ])
  })

  test('rejects credentials, encoded path separators and extra segments', () => {
    const links = findServerInviteMessageLinks(
      [
        'https://user@chat.arcanelink.test/invite/code',
        'https://chat.arcanelink.test/invite/code%2Fredirect',
        'https://chat.arcanelink.test/invite/code/extra',
      ].join(' '),
      origin,
    )

    expect(links).toEqual([])
  })

  test('caps the number of cards even when a larger limit is requested', () => {
    const body = Array.from(
      { length: SERVER_INVITE_MESSAGE_CARD_LIMIT + 2 },
      (_, index) =>
        `https://chat.arcanelink.test/invite/code-${index + 1}`,
    ).join(' ')

    const links = findServerInviteMessageLinks(body, origin, 100)

    expect(links).toHaveLength(SERVER_INVITE_MESSAGE_CARD_LIMIT)
    expect(links.map((link) => link.code)).toEqual([
      'code-1',
      'code-2',
      'code-3',
    ])
  })

  test('returns no links for invalid origin input or a disabled limit', () => {
    expect(
      findServerInviteMessageLinks(
        'https://chat.arcanelink.test/invite/code',
        'not-an-origin',
      ),
    ).toEqual([])
    expect(
      findServerInviteMessageLinks(
        'https://chat.arcanelink.test/invite/code',
        origin,
        0,
      ),
    ).toEqual([])
  })
})
