import { useEffect, useLayoutEffect, useRef } from 'react';

import * as signalR from '@microsoft/signalr';

import {
  type ModerationCaseChangedPayload,
  type MyModerationReportsChangedPayload,
  moderationCaseChangedWindowEvent,
  myModerationReportsChangedWindowEvent
} from '../moderation/moderationRealtime';
import {
  acceptUserPresenceChangedPayload,
  beginUserPresenceEventSession,
  clearUserPresenceEventStore
} from '../presence/presenceEventStore';
import type { UserPresenceChangedPayload } from '../presence/presenceModel';
import {
  createRealtimeRefreshCoalescer,
  getSpaceReadStateRefreshTargets
} from './realtimeRefreshCoalescer';
import {
  type ServerJoinRequestChangedPayload,
  serverDirectoryChangedWindowEvent
} from './serverRealtimeEvents';
import { userPresenceChangedWindowEvent } from './useUserPresenceChanged';

type UseRealtimeOptions = {
  accessToken: string;
  currentUserId: string;
  currentDeviceSessionId?: string | null;
  selectedServerId: string | null;
  onFriendsChanged: () => Promise<void> | void;
  onPrivateSpacesChanged: () => Promise<void> | void;
  onDirectServerInvitesChanged: () => Promise<void> | void;
  onServersChanged: () => Promise<void> | void;
  onCurrentServerMembersChanged: () => Promise<void> | void;
  onCurrentServerGovernanceChanged: () => Promise<void> | void;
  onCurrentServerSpacesChanged: () => Promise<void> | void;
  onUserProfileChanged: () => Promise<void> | void;
  onUserProfileSettingsChanged: () => Promise<void> | void;
  onUserAssetsChanged: () => Promise<void> | void;
  onUserSessionsChanged?: () => Promise<void> | void;
  onCurrentSessionRevoked: () => Promise<void> | void;
};

type CurrentSessionRevokedPayload = {
  all?: boolean;
  sessionId?: string | null;
};

type SpaceMessagesChangedPayload = {
  serverId?: string | null;
  spaceId?: string | null;
  messageId?: string | null;
};

type PrivateSpaceMessagesChangedPayload = {
  spaceId?: string | null;
  messageId?: string | null;
};

type PrivateMessageReceivedPayload = PrivateSpaceMessagesChangedPayload & {
  senderUserId?: string | null;
};

type SpaceReadStateChangedPayload = {
  serverId?: string | null;
  spaceId?: string | null;
  lastReadMessageId?: string | null;
  unreadCount?: number;
};

type ServerInviteReceivedPayload = {
  serverId?: string | null;
  inviteId?: string | null;
};

const friendEvents = [
  'FriendRequestReceived',
  'FriendRequestUpdated',
  'FriendListChanged'
];

export function useRealtime({
  accessToken,
  currentUserId,
  currentDeviceSessionId,
  selectedServerId,
  onFriendsChanged,
  onPrivateSpacesChanged,
  onDirectServerInvitesChanged,
  onServersChanged,
  onCurrentServerMembersChanged,
  onCurrentServerGovernanceChanged,
  onCurrentServerSpacesChanged,
  onUserProfileChanged,
  onUserProfileSettingsChanged,
  onUserAssetsChanged,
  onUserSessionsChanged,
  onCurrentSessionRevoked
}: UseRealtimeOptions) {
  const connectionRef = useRef<signalR.HubConnection | null>(null);
  const selectedServerIdRef = useRef(selectedServerId);
  const callbacksRef = useRef({
    onFriendsChanged,
    onPrivateSpacesChanged,
    onDirectServerInvitesChanged,
    onServersChanged,
    onCurrentServerMembersChanged,
    onCurrentServerGovernanceChanged,
    onCurrentServerSpacesChanged,
    onUserProfileChanged,
    onUserProfileSettingsChanged,
    onUserAssetsChanged,
    onUserSessionsChanged,
    onCurrentSessionRevoked
  });

  useEffect(() => {
    callbacksRef.current = {
      onFriendsChanged,
      onPrivateSpacesChanged,
      onDirectServerInvitesChanged,
      onServersChanged,
      onCurrentServerMembersChanged,
      onCurrentServerGovernanceChanged,
      onCurrentServerSpacesChanged,
      onUserProfileChanged,
      onUserProfileSettingsChanged,
      onUserAssetsChanged,
      onUserSessionsChanged,
      onCurrentSessionRevoked
    };
  }, [
    onCurrentServerGovernanceChanged,
    onCurrentServerMembersChanged,
    onCurrentServerSpacesChanged,
    onDirectServerInvitesChanged,
    onPrivateSpacesChanged,
    onFriendsChanged,
    onServersChanged,
    onUserAssetsChanged,
    onUserProfileChanged,
    onUserProfileSettingsChanged,
    onUserSessionsChanged,
    onCurrentSessionRevoked
  ]);

  useEffect(() => {
    selectedServerIdRef.current = selectedServerId;
  }, [selectedServerId]);

  useLayoutEffect(() => {
    beginUserPresenceEventSession(currentUserId);

    return () => clearUserPresenceEventStore(currentUserId);
  }, [currentUserId]);

  useEffect(() => {
    let isDisposed = false;
    const connection = new signalR.HubConnectionBuilder()
      .withUrl('/hubs/realtime', {
        accessTokenFactory: () => accessToken
      })
      .withAutomaticReconnect()
      .configureLogging(signalR.LogLevel.None)
      .build();

    connectionRef.current = connection;
    const refreshServerList = createRealtimeRefreshCoalescer(() =>
      callbacksRef.current.onServersChanged()
    );
    const refreshCurrentServerSpaces = createRealtimeRefreshCoalescer(() =>
      callbacksRef.current.onCurrentServerSpacesChanged()
    );
    const refreshPrivateSpaces = createRealtimeRefreshCoalescer(() =>
      callbacksRef.current.onPrivateSpacesChanged()
    );

    function scheduleSpaceReadStateRefresh(
      payload?: SpaceReadStateChangedPayload
    ) {
      const targets = getSpaceReadStateRefreshTargets(
        payload?.serverId,
        selectedServerIdRef.current
      );

      if (targets.serverList) {
        refreshServerList.request();
      }
      if (targets.currentServerSpaces) {
        refreshCurrentServerSpaces.request();
      }
      if (targets.privateSpaces) {
        refreshPrivateSpaces.request();
      }
    }

    function handleLocalSpaceReadState(event: Event) {
      scheduleSpaceReadStateRefresh(
        (event as CustomEvent<SpaceReadStateChangedPayload>).detail
      );
    }

    window.addEventListener(
      'arcanelink:space-read-state-committed',
      handleLocalSpaceReadState
    );

    for (const eventName of friendEvents) {
      connection.on(eventName, () => {
        runSilently(callbacksRef.current.onFriendsChanged);
      });
    }

    connection.on(
      'ServerInviteReceived',
      (payload?: ServerInviteReceivedPayload) => {
        runSilently(callbacksRef.current.onDirectServerInvitesChanged);
        window.dispatchEvent(
          new CustomEvent<ServerInviteReceivedPayload>(
            'arcanelink:server-invite-received',
            { detail: payload }
          )
        );
      }
    );

    connection.on('PrivateSpacesChanged', () => {
      refreshPrivateSpaces.request();
    });

    connection.on(
      'ServerInviteAccepted',
      (payload?: ServerInviteReceivedPayload) => {
        runSilently(callbacksRef.current.onServersChanged);
        runSilently(callbacksRef.current.onDirectServerInvitesChanged);
        window.dispatchEvent(
          new CustomEvent<ServerInviteReceivedPayload>(
            'arcanelink:server-invite-received',
            { detail: payload }
          )
        );
      }
    );

    connection.on('ServerMembersChanged', () => {
      runSilently(callbacksRef.current.onServersChanged);
      runSilently(callbacksRef.current.onCurrentServerMembersChanged);
    });

    connection.on('UserServersChanged', () => {
      runSilently(callbacksRef.current.onServersChanged);
      dispatchServerDirectoryChanged();
    });

    connection.on('ServerUpdated', () => {
      runSilently(callbacksRef.current.onServersChanged);
      runSilently(callbacksRef.current.onCurrentServerMembersChanged);
    });

    connection.on('ServerDeleted', () => {
      runSilently(callbacksRef.current.onServersChanged);
      runSilently(callbacksRef.current.onCurrentServerMembersChanged);
    });

    connection.on('ServerGovernanceChanged', () => {
      runSilently(callbacksRef.current.onCurrentServerGovernanceChanged);
    });

    connection.on(
      'ServerJoinRequestChanged',
      (payload?: ServerJoinRequestChangedPayload) => {
        dispatchServerDirectoryChanged(payload);
      }
    );

    connection.on('ServerSpacesChanged', () => {
      runSilently(callbacksRef.current.onCurrentServerSpacesChanged);
    });

    connection.on('VoiceChannelStateChanged', () => undefined);
    connection.on('VoiceSignal', () => undefined);

    connection.on(
      'SpaceMessagesChanged',
      (payload?: SpaceMessagesChangedPayload) => {
        refreshServerList.request();

        if (
          payload?.serverId &&
          payload.serverId.toLowerCase() ===
            selectedServerIdRef.current?.toLowerCase()
        ) {
          refreshCurrentServerSpaces.request();
        }

        window.dispatchEvent(
          new CustomEvent<SpaceMessagesChangedPayload>(
            'arcanelink:space-messages-changed',
            { detail: payload }
          )
        );
      }
    );

    connection.on(
      'PrivateSpaceMessagesChanged',
      (payload?: PrivateSpaceMessagesChangedPayload) => {
        refreshPrivateSpaces.request();
        window.dispatchEvent(
          new CustomEvent<PrivateSpaceMessagesChangedPayload>(
            'arcanelink:private-space-messages-changed',
            { detail: payload }
          )
        );
      }
    );

    connection.on(
      'PrivateMessageReceived',
      (payload?: PrivateMessageReceivedPayload) => {
        window.dispatchEvent(
          new CustomEvent<PrivateMessageReceivedPayload>(
            'arcanelink:private-message-received',
            { detail: payload }
          )
        );
      }
    );

    connection.on(
      'SpaceReadStateChanged',
      (payload?: SpaceReadStateChangedPayload) => {
        scheduleSpaceReadStateRefresh(payload);

        window.dispatchEvent(
          new CustomEvent<SpaceReadStateChangedPayload>(
            'arcanelink:space-read-state-changed',
            { detail: payload }
          )
        );
      }
    );

    connection.on('UserProfileChanged', () => {
      runSilently(callbacksRef.current.onUserProfileChanged);
      runSilently(callbacksRef.current.onFriendsChanged);
      runSilently(callbacksRef.current.onCurrentServerMembersChanged);
    });

    connection.on('UserProfileSettingsChanged', () => {
      runSilently(callbacksRef.current.onUserProfileSettingsChanged);
    });

    connection.on('UserPresenceChanged', (payload?: unknown) => {
      if (!acceptUserPresenceChangedPayload(payload)) {
        return;
      }

      window.dispatchEvent(
        new CustomEvent<UserPresenceChangedPayload>(
          userPresenceChangedWindowEvent,
          { detail: payload }
        )
      );
    });

    connection.on(
      'ModerationCaseChanged',
      (payload?: ModerationCaseChangedPayload) => {
        window.dispatchEvent(
          new CustomEvent<ModerationCaseChangedPayload>(
            moderationCaseChangedWindowEvent,
            { detail: payload }
          )
        );
      }
    );

    connection.on(
      'MyModerationReportsChanged',
      (payload?: MyModerationReportsChangedPayload) => {
        window.dispatchEvent(
          new CustomEvent<MyModerationReportsChangedPayload>(
            myModerationReportsChangedWindowEvent,
            { detail: payload }
          )
        );
      }
    );

    connection.on('UserAssetsChanged', () => {
      runSilently(callbacksRef.current.onUserAssetsChanged);
    });

    connection.on('UserSessionsChanged', () => {
      runSilently(callbacksRef.current.onUserSessionsChanged);
    });

    connection.on('UserNotificationsChanged', (payload?: unknown) => {
      window.dispatchEvent(
        new CustomEvent('arcanelink:user-notifications-changed', {
          detail: payload
        })
      );
    });

    connection.on(
      'CurrentSessionRevoked',
      (payload?: CurrentSessionRevokedPayload) => {
        if (
          payload?.all ||
          !payload?.sessionId ||
          !currentDeviceSessionId ||
          payload.sessionId.toLowerCase() ===
            currentDeviceSessionId.toLowerCase()
        ) {
          runSilently(callbacksRef.current.onCurrentSessionRevoked);
        } else {
          runSilently(callbacksRef.current.onUserSessionsChanged);
        }
      }
    );

    connection.onreconnecting(() => {
      dispatchSystemNotification(
        `realtime-reconnecting:${Date.now()}`,
        'Соединение прервано',
        'ArcaneLink пытается восстановить подключение.'
      );
    });

    connection.onreconnected(() => {
      dispatchSystemNotification(
        `realtime-restored:${Date.now()}`,
        'Соединение восстановлено',
        'События и сообщения снова синхронизируются.'
      );
      runSilently(callbacksRef.current.onFriendsChanged);
      runSilently(callbacksRef.current.onDirectServerInvitesChanged);
      runSilently(callbacksRef.current.onServersChanged);
      runSilently(callbacksRef.current.onUserProfileChanged);
      runSilently(callbacksRef.current.onUserProfileSettingsChanged);
      runSilently(callbacksRef.current.onUserAssetsChanged);

      const serverId = selectedServerIdRef.current;
      if (serverId) {
        void connection.invoke('JoinServer', serverId).catch(() => undefined);
        runSilently(callbacksRef.current.onCurrentServerMembersChanged);
        runSilently(callbacksRef.current.onCurrentServerGovernanceChanged);
        runSilently(callbacksRef.current.onCurrentServerSpacesChanged);
        window.dispatchEvent(
          new CustomEvent<ModerationCaseChangedPayload>(
            moderationCaseChangedWindowEvent,
            { detail: { serverId } }
          )
        );
      }

      window.dispatchEvent(
        new CustomEvent(myModerationReportsChangedWindowEvent)
      );
    });

    const startConnection = connection
      .start()
      .then(() => {
        if (isDisposed) {
          void connection.stop();
          return;
        }

        const serverId = selectedServerIdRef.current;
        if (serverId) {
          void connection.invoke('JoinServer', serverId).catch(() => undefined);
        }
      })
      .catch(() => undefined);

    return () => {
      isDisposed = true;
      refreshServerList.dispose();
      refreshCurrentServerSpaces.dispose();
      refreshPrivateSpaces.dispose();
      window.removeEventListener(
        'arcanelink:space-read-state-committed',
        handleLocalSpaceReadState
      );
      connectionRef.current = null;
      void startConnection.finally(() => {
        if (connection.state !== signalR.HubConnectionState.Disconnected) {
          void connection.stop();
        }
      });
    };
  }, [accessToken, currentDeviceSessionId]);

  useEffect(() => {
    const connection = connectionRef.current;
    if (
      !connection ||
      connection.state !== signalR.HubConnectionState.Connected
    ) {
      return;
    }

    if (selectedServerId) {
      void connection
        .invoke('JoinServer', selectedServerId)
        .catch(() => undefined);
    }
  }, [selectedServerId]);
}

function runSilently(callback?: () => Promise<void> | void) {
  void Promise.resolve(callback?.()).catch(() => undefined);
}

function dispatchSystemNotification(id: string, title: string, body: string) {
  window.dispatchEvent(
    new CustomEvent('arcanelink:system-notification', {
      detail: { id, title, body }
    })
  );
}

function dispatchServerDirectoryChanged(
  payload?: ServerJoinRequestChangedPayload
) {
  window.dispatchEvent(
    new CustomEvent<ServerJoinRequestChangedPayload>(
      serverDirectoryChangedWindowEvent,
      { detail: payload }
    )
  );
}
