import type * as signalR from '@microsoft/signalr'

export function registerIgnoredRealtimeEvents(connection: signalR.HubConnection) {
  const eventNames = [
    'FriendRequestReceived',
    'FriendRequestUpdated',
    'FriendListChanged',
    'ServerInviteReceived',
    'PrivateSpacesChanged',
    'ServerInviteAccepted',
    'ServerMembersChanged',
    'UserServersChanged',
    'ServerUpdated',
    'ServerDeleted',
    'ServerGovernanceChanged',
    'ServerSpacesChanged',
    'SpaceMessagesChanged',
    'PrivateSpaceMessagesChanged',
    'UserProfileChanged',
    'UserProfileSettingsChanged',
    'UserPresenceChanged',
    'UserAssetsChanged',
    'UserSessionsChanged',
    'CurrentSessionRevoked',
  ]

  for (const eventName of eventNames) {
    connection.on(eventName, () => undefined)
  }
}
