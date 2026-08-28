import {
  HttpTransportType,
  type HubConnection,
  HubConnectionBuilder,
  HubConnectionState
} from '@microsoft/signalr';
import {
  type APIRequestContext,
  type APIResponse,
  expect,
  test
} from '@playwright/test';
import { Buffer } from 'node:buffer';
import { randomUUID } from 'node:crypto';
import { env } from 'node:process';

const realSmokeEnabled = env.ARCANELINK_REAL_E2E === '1';
const guidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type UserResponse = {
  id: string;
  login: string;
};

type LoginResponse = UserResponse & {
  accessToken: string;
  refreshToken: string;
};

type ServerResponse = {
  id: string;
  defaultTextSpaceId: string | null;
};

type SpaceResponse = {
  id: string;
  typeCode: 'category' | 'text_room' | 'voice_room';
  title: string;
};

type AssetResponse = {
  id: string;
  originalFileName: string | null;
  mimeType: string;
  sizeBytes: number;
};

type SpaceMessageAssetResponse = {
  assetId: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
};

type SpaceMessageResponse = {
  id: string;
  spaceId: string;
  senderUserId: string;
  body: string | null;
  assets: SpaceMessageAssetResponse[];
};

type PrivateSpaceMemberResponse = {
  id: string;
  userId: string;
  statusCode: string;
};

type PrivateSpaceResponse = {
  spaceId: string;
  members: PrivateSpaceMemberResponse[];
};

type VoiceRoster = {
  serverId: string;
  spaceId: string;
  channelScope: string;
  participants: Array<{
    participantId: string;
    userId: string;
  }>;
};

type CleanupState = {
  accessToken?: string;
  refreshToken?: string;
  serverId?: string;
  textSpaceId?: string;
  serverMessageIds: string[];
  attachmentAssetId?: string;
  privateSpaceId?: string;
  privateMessageId?: string;
  privateCompanionMemberId?: string;
};

test.skip(
  !realSmokeEnabled,
  'Set ARCANELINK_REAL_E2E=1 to run the stateful real-backend smoke test.'
);

test('real REST and SignalR smoke path', async ({ request, baseURL }) => {
  const suffix = randomUUID().replaceAll('-', '').slice(0, 12);
  const primaryCredentials = createCredentials(`e2e_${suffix}`);
  const companionCredentials = createCredentials(`e2ep_${suffix}`);
  const cleanup: CleanupState = { serverMessageIds: [] };
  let voiceConnection: HubConnection | undefined;

  try {
    await expectPingThroughVite(request);

    const primaryUser = await registerUser(request, primaryCredentials);
    const companionUser = await registerUser(request, companionCredentials);
    expect(primaryUser.id).toMatch(guidPattern);
    expect(companionUser.id).toMatch(guidPattern);

    const login = await postJson<LoginResponse>(
      request,
      '/api/auth/login',
      {
        loginOrEmail: primaryCredentials.login,
        password: primaryCredentials.password,
        deviceName: 'Playwright real smoke'
      },
      undefined,
      'login primary user'
    );
    expect(login.id).toBe(primaryUser.id);
    expect(login.accessToken).toBeTruthy();
    expect(login.refreshToken).toBeTruthy();
    cleanup.accessToken = login.accessToken;
    cleanup.refreshToken = login.refreshToken;

    const server = await postJson<ServerResponse>(
      request,
      '/api/servers',
      {
        title: `Real smoke ${suffix}`,
        description: 'Created by the opt-in Playwright real smoke test.',
        isPublic: false
      },
      login.accessToken,
      'create server'
    );
    expect(server.id).toMatch(guidPattern);
    cleanup.serverId = server.id;

    const spaces = await getJson<SpaceResponse[]>(
      request,
      `/api/servers/${server.id}/spaces`,
      login.accessToken,
      'load server spaces'
    );
    const textSpace = await ensureSpace(
      request,
      login.accessToken,
      server.id,
      spaces,
      'text_room',
      `real-text-${suffix}`,
      0
    );
    const voiceSpace = await ensureSpace(
      request,
      login.accessToken,
      server.id,
      spaces,
      'voice_room',
      `real-voice-${suffix}`,
      1
    );
    cleanup.textSpaceId = textSpace.id;

    const configuredServer = await patchJson<ServerResponse>(
      request,
      `/api/servers/${server.id}`,
      { defaultTextSpaceId: textSpace.id },
      login.accessToken,
      'set default text space'
    );
    expect(configuredServer.defaultTextSpaceId).toBe(textSpace.id);

    const plainMessageBody = `Real server message ${suffix}`;
    const plainMessage = await postJson<SpaceMessageResponse>(
      request,
      `/api/servers/${server.id}/spaces/${textSpace.id}/messages`,
      { body: plainMessageBody },
      login.accessToken,
      'send server message'
    );
    expect(plainMessage.body).toBe(plainMessageBody);
    expect(plainMessage.senderUserId).toBe(primaryUser.id);
    cleanup.serverMessageIds.push(plainMessage.id);

    const attachmentContents = Buffer.from(
      `ArcaneLink real smoke ${suffix}\n`,
      'utf8'
    );
    const attachment = await uploadAttachment(
      request,
      `/api/servers/${server.id}/spaces/${textSpace.id}/messages/attachments`,
      login.accessToken,
      `real-smoke-${suffix}.txt`,
      attachmentContents
    );
    expect(attachment.id).toMatch(guidPattern);
    expect(attachment.mimeType).toBe('application/octet-stream');
    expect(attachment.sizeBytes).toBe(attachmentContents.byteLength);
    cleanup.attachmentAssetId = attachment.id;

    const attachmentMessageBody = `Real attachment message ${suffix}`;
    const attachmentMessage = await postJson<SpaceMessageResponse>(
      request,
      `/api/servers/${server.id}/spaces/${textSpace.id}/messages`,
      {
        body: attachmentMessageBody,
        attachments: [
          {
            assetId: attachment.id,
            displayName: `smoke-${suffix}.txt`,
            isSpoiler: false
          }
        ]
      },
      login.accessToken,
      'send attachment message'
    );
    expect(attachmentMessage.assets).toHaveLength(1);
    expect(attachmentMessage.assets[0]?.assetId).toBe(attachment.id);
    cleanup.serverMessageIds.push(attachmentMessage.id);

    const persistedServerMessages = await getJson<SpaceMessageResponse[]>(
      request,
      `/api/servers/${server.id}/spaces/${textSpace.id}/messages?limit=20`,
      login.accessToken,
      'reload server messages'
    );
    expect(persistedServerMessages).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: plainMessage.id,
          body: plainMessageBody
        }),
        expect.objectContaining({
          id: attachmentMessage.id,
          body: attachmentMessageBody,
          assets: expect.arrayContaining([
            expect.objectContaining({ assetId: attachment.id })
          ])
        })
      ])
    );

    const privateSpace = await postJson<PrivateSpaceResponse>(
      request,
      '/api/private-spaces',
      {
        title: `Real private ${suffix}`,
        description: 'Created by the opt-in Playwright real smoke test.',
        memberUserIds: [companionUser.id]
      },
      login.accessToken,
      'create private space'
    );
    expect(privateSpace.spaceId).toMatch(guidPattern);
    expect(privateSpace.members.map((member) => member.userId)).toEqual(
      expect.arrayContaining([primaryUser.id, companionUser.id])
    );
    cleanup.privateSpaceId = privateSpace.spaceId;
    cleanup.privateCompanionMemberId = privateSpace.members.find(
      (member) => member.userId === companionUser.id
    )?.id;

    const privateMessageBody = `Real private message ${suffix}`;
    const privateMessage = await postJson<SpaceMessageResponse>(
      request,
      `/api/private-spaces/${privateSpace.spaceId}/messages`,
      { body: privateMessageBody },
      login.accessToken,
      'send private message'
    );
    expect(privateMessage.body).toBe(privateMessageBody);
    expect(privateMessage.spaceId).toBe(privateSpace.spaceId);
    cleanup.privateMessageId = privateMessage.id;

    const persistedPrivateMessages = await getJson<SpaceMessageResponse[]>(
      request,
      `/api/private-spaces/${privateSpace.spaceId}/messages?limit=20`,
      login.accessToken,
      'reload private messages'
    );
    expect(persistedPrivateMessages).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: privateMessage.id,
          body: privateMessageBody
        })
      ])
    );

    voiceConnection = new HubConnectionBuilder()
      .withUrl(new URL('/hubs/realtime', requireBaseURL(baseURL)).toString(), {
        accessTokenFactory: () => login.accessToken,
        transport: HttpTransportType.WebSockets,
        skipNegotiation: true
      })
      .build();

    await voiceConnection.start();
    expect(voiceConnection.state).toBe(HubConnectionState.Connected);

    const participantId = await voiceConnection.invoke<string | null>(
      'JoinVoiceChannel',
      server.id,
      voiceSpace.id,
      false,
      false,
      false,
      false
    );
    expect(participantId).not.toBeNull();
    expect(participantId).toMatch(guidPattern);

    const roster = await voiceConnection.invoke<VoiceRoster | null>(
      'RenewVoiceChannelAccessLease',
      server.id,
      voiceSpace.id
    );
    expect(roster).toMatchObject({
      serverId: server.id,
      spaceId: voiceSpace.id,
      channelScope: 'server'
    });
    expect(roster?.participants).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          participantId,
          userId: primaryUser.id
        })
      ])
    );

    await voiceConnection.invoke('LeaveVoiceChannel', voiceSpace.id);
    const rosterAfterLeave = await voiceConnection.invoke<VoiceRoster | null>(
      'RenewVoiceChannelAccessLease',
      server.id,
      voiceSpace.id
    );
    expect(rosterAfterLeave).toBeNull();
  } finally {
    await stopVoiceConnectionBestEffort(voiceConnection);
    await cleanupCreatedState(request, cleanup);
  }
});

function createCredentials(login: string) {
  return {
    login,
    displayName: `Real smoke ${login}`,
    email: `${login}@e2e.arcanelink.test`,
    password: `RealSmoke!${login}Aa1`
  };
}

async function expectPingThroughVite(request: APIRequestContext) {
  const response = await request.get('/ping');
  const body = await response.text();
  expect(response.status(), `Vite/backend ping failed: ${body}`).toBe(200);
  expect(body).toBe('pong');
  await response.dispose();
}

async function registerUser(
  request: APIRequestContext,
  credentials: ReturnType<typeof createCredentials>
) {
  return await postJson<UserResponse>(
    request,
    '/api/auth/register',
    credentials,
    undefined,
    `register ${credentials.login}`
  );
}

async function ensureSpace(
  request: APIRequestContext,
  accessToken: string,
  serverId: string,
  spaces: SpaceResponse[],
  typeCode: SpaceResponse['typeCode'],
  title: string,
  position: number
) {
  const existing = spaces.find((space) => space.typeCode === typeCode);
  if (existing) {
    return existing;
  }

  const created = await postJson<SpaceResponse>(
    request,
    `/api/servers/${serverId}/spaces`,
    {
      typeCode,
      parentSpaceId: null,
      title,
      position
    },
    accessToken,
    `create ${typeCode} space`
  );
  spaces.push(created);
  return created;
}

async function uploadAttachment(
  request: APIRequestContext,
  url: string,
  accessToken: string,
  fileName: string,
  contents: Buffer
) {
  const response = await request.post(url, {
    headers: authorizationHeaders(accessToken),
    multipart: {
      file: {
        name: fileName,
        mimeType: 'text/plain',
        buffer: contents
      }
    }
  });
  return await readJsonResponse<AssetResponse>(response, 'upload attachment');
}

async function getJson<T>(
  request: APIRequestContext,
  url: string,
  accessToken: string,
  operation: string
) {
  return await readJsonResponse<T>(
    await request.get(url, { headers: authorizationHeaders(accessToken) }),
    operation
  );
}

async function postJson<T>(
  request: APIRequestContext,
  url: string,
  data: unknown,
  accessToken: string | undefined,
  operation: string
) {
  return await readJsonResponse<T>(
    await request.post(url, {
      data,
      headers: accessToken ? authorizationHeaders(accessToken) : undefined
    }),
    operation
  );
}

async function patchJson<T>(
  request: APIRequestContext,
  url: string,
  data: unknown,
  accessToken: string,
  operation: string
) {
  return await readJsonResponse<T>(
    await request.patch(url, {
      data,
      headers: authorizationHeaders(accessToken)
    }),
    operation
  );
}

async function readJsonResponse<T>(response: APIResponse, operation: string) {
  const body = await response.text();
  expect(
    response.ok(),
    `${operation} failed with HTTP ${response.status()}: ${body}`
  ).toBeTruthy();
  expect(body, `${operation} returned an empty response`).not.toBe('');

  let parsed: unknown;
  try {
    parsed = JSON.parse(body);
  } catch {
    throw new Error(`${operation} returned invalid JSON: ${body}`);
  } finally {
    await response.dispose();
  }

  return parsed as T;
}

function authorizationHeaders(accessToken: string) {
  return { Authorization: `Bearer ${accessToken}` };
}

function requireBaseURL(baseURL: string | undefined) {
  if (!baseURL) {
    throw new Error('ARCANELINK_REAL_BASE_URL is not configured.');
  }

  return baseURL;
}

async function stopVoiceConnectionBestEffort(
  connection: HubConnection | undefined
) {
  if (!connection || connection.state === HubConnectionState.Disconnected) {
    return;
  }

  try {
    await connection.stop();
  } catch {
    // The backend may already have closed the connection after a failed test.
  }
}

async function cleanupCreatedState(
  request: APIRequestContext,
  state: CleanupState
) {
  if (!state.accessToken) {
    return;
  }

  const headers = authorizationHeaders(state.accessToken);
  const cleanupRequests: Array<() => Promise<APIResponse>> = [];

  if (state.serverId && state.textSpaceId) {
    for (const messageId of state.serverMessageIds) {
      cleanupRequests.push(() =>
        request.delete(
          `/api/servers/${state.serverId}/spaces/${state.textSpaceId}/messages/${messageId}`,
          { headers }
        )
      );
    }
  }

  if (state.privateSpaceId && state.privateMessageId) {
    cleanupRequests.push(() =>
      request.delete(
        `/api/private-spaces/${state.privateSpaceId}/messages/${state.privateMessageId}`,
        { headers }
      )
    );
  }

  if (state.privateSpaceId && state.privateCompanionMemberId) {
    cleanupRequests.push(() =>
      request.delete(
        `/api/private-spaces/${state.privateSpaceId}/members/${state.privateCompanionMemberId}`,
        { headers }
      )
    );
  }

  if (state.privateSpaceId) {
    cleanupRequests.push(() =>
      request.delete(`/api/private-spaces/${state.privateSpaceId}/members/me`, {
        headers
      })
    );
  }

  if (state.attachmentAssetId) {
    cleanupRequests.push(() =>
      request.delete(`/api/assets/${state.attachmentAssetId}`, { headers })
    );
  }

  if (state.serverId) {
    cleanupRequests.push(() =>
      request.delete(`/api/servers/${state.serverId}`, { headers })
    );
  }

  for (const cleanupRequest of cleanupRequests) {
    await runCleanupRequest(cleanupRequest);
  }

  await runCleanupRequest(() =>
    request.post('/api/auth/logout', {
      data: state.refreshToken ? { refreshToken: state.refreshToken } : {},
      headers
    })
  );
}

async function runCleanupRequest(requestFactory: () => Promise<APIResponse>) {
  try {
    const response = await requestFactory();
    await response.dispose();
  } catch {
    // Cleanup is best-effort so that it cannot hide the original smoke failure.
  }
}
