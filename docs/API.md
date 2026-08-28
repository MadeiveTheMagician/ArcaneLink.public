# Server API and responsibility map

[Русская версия](API.ru.md)

This document describes the server contract in release `1.0.1`. It is the
starting point for API changes: use it to locate the HTTP boundary, the domain
service that owns a rule, the persistence area, and the realtime side effects.

## Contract conventions

| Item | Contract |
|---|---|
| Public HTTP prefix | `/api` |
| Realtime endpoint | `/hubs/realtime` (SignalR) |
| Authentication | JWT bearer token unless a row is marked Anonymous |
| Identifiers | UUID values; controller templates normally use `:guid` constraints |
| Payloads | JSON by default; uploads use `multipart/form-data`; asset content is binary |
| Errors | API error responses are produced by the global exception middleware |
| Authorization | Controllers establish the request boundary; domain services and authorization runtimes enforce rules |
| Persistence | EF Core context and migrations under `backend/ArcaneLink/` are authoritative |
| Realtime | Mutations notify affected users/groups through `IRealtimeNotificationService` |
| API schema | OpenAPI/Scalar is available only in development-oriented environments |

The table groups related route templates while retaining every supported
operation. The implementation currently exposes 193 unique REST routes.

## Ownership index

| Domain | HTTP boundary | Service owner | Responsibility |
|---|---|---|---|
| Authentication and sessions | `AuthController` | `Services/Auth`, `Services/Login`, `Services/Logout`, `Services/JwtService` | Registration, login, token rotation, logout and device-session revocation |
| Account lifecycle and email | `AuthController` | `AccountLifecycleService`, `Services/Email`, `UserPasswordService` | Email verification, password recovery, email/login/password changes and durable delivery |
| Users and profiles | `UsersController` | `Services/Users` | Discovery, public/current profile, settings, tags, profile media and DM privacy |
| Friends | `FriendsController` | `FriendService` | Requests, acceptance, cancellation, removal and friend-list notifications |
| Notifications | `NotificationsController` | `UserNotificationService` | Notification history and read state |
| Assets | `AssetsController` | `Services/Assets` | Upload validation, metadata, access policy, optimized variants, storage and retention |
| Community servers | `ServersController` | `Services/Servers` | Server creation, discovery, lookup, update and deletion |
| Membership and bans | `ServerMembersController`, `ServerBansController`, `ServerJoinRequestsController` | Server member/join services | Membership lifecycle, requests, kicks, bans and self-leave |
| Roles and governance | `ServerGovernanceController` | Governance, role, ownership and audit services | Invites, roles, permission catalogs, hierarchy, ownership and audit |
| Server member identity | Member profile/color/effective-permission controllers | Profile, color and authorization services | Per-server profile, avatar, display color and computed permissions |
| Spaces | `SpacesController` | `Services/Spaces` | Space tree, types, ordering, protection and permission overrides |
| Server messages | `SpaceMessagesController` | `Services/Messages` | Text/voice companion chat, reads, search, mentions, attachments, reactions and pins |
| Private spaces | `PrivateSpacesController`, `PrivateSpaceFoldersController` | `Services/PrivateSpaces` | Direct/group conversations, personal settings, folders, messages and trash |
| Moderation | `ModerationController` | `ModerationService` | Reports, cases, evidence access and reporter status |
| Voice and calls | `VoiceController`, `RealtimeHub` | TURN and realtime voice services | Short-lived ICE configuration, room membership, private calls and WebRTC signaling |
| Streaming bootstrap | `StreamingController` | `StreamingOptions` | Anonymous client streaming capability limits/configuration |
| Diagnostics | `TestController`, endpoint mappings in `Program.cs` | Host infrastructure | Identity probe and liveness/readiness checks |

Controller paths are under `backend/ArcaneLink/Controllers`; domain services
are under `backend/ArcaneLink/Services`. Controllers should remain transport
adapters. Business invariants belong to the service owner shown above.

## REST route table

`Bearer` means an authenticated request is required. Additional server, space,
role or ownership permissions are evaluated inside the responsible service.

| Methods and routes | Access | Function and responsibility |
|---|---|---|
| `POST /api/auth/register`; `POST /api/auth/login`; `POST /api/auth/refresh`; `POST /api/auth/logout` | Anonymous | Create an account, authenticate, rotate tokens and terminate the refresh-token session. Registration queues verification email. |
| `POST /api/auth/email/confirm`; `POST /api/auth/email/resend` | Anonymous | Confirm a one-time verification token or request another verification message without disclosing account existence. |
| `POST /api/auth/password/forgot`; `POST /api/auth/password/reset` | Anonymous | Queue a reset message and consume its one-time token; successful reset revokes active sessions. |
| `POST /api/auth/account/email/change`; `PUT /api/auth/account/login`; `POST /api/auth/account/password/change` | Bearer | Change sensitive account identity after credential and lifecycle validation. |
| `GET /api/auth/sessions`; `POST .../{id}/revoke`; `POST .../revoke-all`; `POST .../revoke-others`; `POST /api/auth/logoutAll` | Bearer | Inspect and revoke device sessions. Revocations propagate through realtime events. |
| `GET /api/users/{id}` | Anonymous | Read the allowed public profile projection. |
| `GET /api/users/me`; `GET/PATCH /api/users/me/profile` | Bearer | Read current identity and update the owned profile. |
| `POST /api/users/me/profile/avatar/{assetId}`; `POST .../avatar/upload`; `POST .../banner/{assetId}`; `POST .../banner/upload`; `DELETE .../banner` | Bearer | Attach, upload or clear validated profile media. |
| `GET/PATCH /api/users/me/profile/settings`; `GET/PUT /api/users/me/profile/tags`; `GET /api/users/profile-tags` | Bearer | Manage profile visibility/presentation settings and the controlled tag catalog. |
| `GET /api/users/discover`; `GET /api/users/search` | Bearer | Discover or search users through safe response projections. |
| `GET/PUT/DELETE /api/users/me/direct-message-blocks/{blockedUserId}`; `GET /api/users/me/direct-message-blocks` | Bearer | Inspect and modify direct-message blocks. |
| `GET/POST /api/users/me/voice-layout-presets`; `GET/PUT/DELETE .../{presetId}` | Bearer | Store user-owned voice layout presets. |
| `GET /api/friends`; `GET /api/friends/requests/incoming`; `GET /api/friends/requests/outgoing` | Bearer | Read friendships and pending requests. |
| `POST /api/friends/requests`; `POST .../{requestId}/accept|decline|cancel`; `DELETE /api/friends/{friendUserId}` | Bearer | Manage the friendship state machine and notify both participants. |
| `GET /api/notifications`; `POST .../{notificationId}/read`; `POST .../read-all`; `DELETE .../history` | Bearer | Read, acknowledge or clear owned notifications. |
| `POST /api/assets`; `POST /api/assets/upload`; `DELETE /api/assets/{id}` | Bearer | Create/upload an asset or request deletion after ownership and reference checks. |
| `GET /api/assets/{id}`; `GET /api/assets/{id}/content` | Anonymous | Return access-filtered metadata/content; policy may still reject a private asset. |
| `GET /api/assets/me/avatar|banner|profile-background|server-icon` | Bearer | List current-user assets by supported purpose. |
| `POST /api/servers`; `GET /api/servers/me`; `GET /api/servers/discover`; `GET /api/servers/{id}`; `GET /api/servers/by-slug/{slug}` | Bearer | Create, list, discover and retrieve servers. |
| `PATCH /api/servers/{id}`; `DELETE /api/servers/{id}` | Bearer | Update or delete a server after governance checks. |
| `GET /api/servers/{serverId}/members`; `GET .../members/by-user/{targetUserId}` | Bearer | Read permitted membership projections. |
| `DELETE .../members/{memberId}`; `POST .../members/{memberId}/ban`; `DELETE .../members/me`; `GET .../bans`; `DELETE .../bans/{memberId}` | Bearer | Kick, ban, unban or leave while preserving owner/hierarchy invariants. |
| `POST /api/servers/{serverId}/join`; `GET .../join-requests`; `POST .../{requestId}/approve|decline`; `DELETE .../join-requests/me` | Bearer | Submit, review or cancel server join requests. |
| `GET/POST /api/servers/{serverId}/invites`; `POST .../invites/{inviteId}/revoke` | Bearer | Create, list and revoke governed invitations. |
| `GET /api/server-invites/{code}`; `POST /api/server-invites/accept`; `POST .../{inviteId}/accept|decline`; `GET .../me|target-servers|targets` | Bearer | Preview/respond to invitations and enumerate valid invite targets. |
| `GET /api/permissions/server`; `GET /api/permissions/server/v1`; `GET /api/permissions/space` | Bearer | Return versioned permission catalogs understood by clients. |
| `GET/POST /api/servers/{serverId}/roles`; `PATCH/DELETE .../roles/{roleId}`; `POST .../{roleId}/duplicate`; `PUT .../roles/order` | Bearer | Manage roles and hierarchy ordering. |
| `PATCH .../roles/{roleId}/permissions`; `GET .../{roleId}/deletion-impact`; `POST .../members/{memberId}/roles`; `DELETE .../member-roles/{memberRoleId}` | Bearer | Change permissions and assignments after authority comparison. |
| `POST /api/servers/{serverId}/ownership-transfers`; `GET .../audit-logs` | Bearer | Transfer ownership and read authorized governance audit history. |
| `GET/PATCH /api/servers/{serverId}/member-profiles/me`; `DELETE .../me`; `GET .../{userId}`; `POST .../me/avatar/{assetId}` | Bearer | Manage and read per-server identity projections. |
| `GET/PATCH /api/servers/{serverId}/members/me/display-color`; `GET .../effective-permissions` | Bearer | Manage personal display color and expose the computed authorization snapshot. |
| `GET /api/space-types`; `GET/POST /api/servers/{serverId}/spaces`; `PATCH/DELETE .../spaces/{spaceId}`; `PUT .../spaces/reorder` | Bearer | Read space types and manage the server space tree. |
| `PUT .../spaces/{spaceId}/permission-overrides`; `DELETE .../permission-overrides/{overrideId}` | Bearer | Upsert/remove resource-specific permission overrides. |
| `GET/POST .../spaces/{spaceId}/messages`; `PATCH/DELETE .../messages/{messageId}` | Bearer | Read, create, edit and soft-delete server text messages. |
| `POST .../messages/attachments`; `GET .../mention-candidates`; `GET .../pinned`; `PUT .../read-state`; `GET /api/servers/{serverId}/messages/search` | Bearer | Attach files, resolve mentions, read pins, update reads and search accessible messages. |
| `PUT/DELETE .../messages/{messageId}/reactions`; `POST/DELETE .../{messageId}/pin` | Bearer | Add/remove own reaction and manage pins with space permission checks. |
| Same message operations under `/api/servers/{serverId}/voice-spaces/{spaceId}/chat/messages` | Bearer | Companion text chat for a voice space; same message service and authorization model. |
| `GET/POST /api/private-spaces`; `GET /api/private-spaces/{spaceId}`; `POST /api/private-spaces/direct/{targetUserId}` | Bearer | List/create private groups or get/create a direct conversation. |
| `POST/DELETE .../{spaceId}/members`; `DELETE .../members/me`; `PATCH .../settings`; `PATCH .../settings/me`; `POST .../settings/me/avatar/upload` | Bearer | Manage group membership plus shared and personal private-space settings. |
| `GET/POST .../{spaceId}/messages`; `PATCH/DELETE .../{messageId}`; reactions, pins, attachments, search and read-state routes | Bearer | Full private-message lifecycle with participant-only access. |
| `GET/DELETE .../{spaceId}/messages/trash`; `POST .../{messageId}/restore`; `POST .../history/clear`; `PUT /api/private-spaces/read-state/all` | Bearer | Per-user trash/restore, history visibility and global private read state. |
| CRUD and reorder routes under `/api/private-space-folders` | Bearer | Organize the current user's private conversations into ordered/locked/pinned folders. |
| `POST .../messages/{messageId}/reports`; `GET /api/users/me/moderation-reports` | Bearer | Submit a message report and read the reporter's allowed status projection. |
| `GET /api/servers/{serverId}/moderation/cases`; `GET/PATCH .../cases/{caseId}`; `GET .../evidence-assets/{evidenceAssetId}/content` | Bearer | Review/update governed cases and retrieve authorized immutable evidence. |
| `GET /api/voice/ice-servers` | Bearer | Issue the current client ICE list and short-lived TURN REST credentials; infrastructure secrets never enter client bundles. |
| `GET /api/streaming/config` | Anonymous | Return client-safe streaming limits and feature configuration. |
| `GET /api/test/me` | Bearer | Return the authenticated identity for diagnostic use; not a business endpoint. |

## Realtime contract

The SignalR hub is `backend/ArcaneLink/Hubs/RealtimeHub.cs`. JWT
authentication is required. Connection groups and audience selection are
server-owned; clients must never choose arbitrary notification audiences.

| Hub methods called by clients | Responsibility |
|---|---|
| `JoinServer`, `LeaveServer` | Subscribe/unsubscribe the authenticated connection to an authorized server audience. |
| `JoinVoiceChannel`, `LeaveVoiceChannel`, `GetVoiceChannelState` | Enter/leave/read a server voice room after space authorization. |
| `UpdateVoiceState`, `MoveVoiceParticipant`, `UpdateVoiceParticipantModeration`, `DisconnectVoiceParticipant` | Publish self media state or perform governed voice moderation. |
| `JoinPrivateVoiceChannel`, `GetPrivateVoiceChannelState` | Enter/read a private-space voice room after membership checks. |
| `StartPrivateCall`, `AcceptPrivateCall`, `DeclinePrivateCall`, `CancelPrivateCall`, `GetPrivateCallState`, `GetIncomingPrivateCalls` | Implement the private-call state machine. |
| `SendVoiceSignal` | Relay WebRTC offer/answer/ICE payloads only between authorized current participants. |
| `RenewVoiceChannelAccessLease`, `RenewPrivateVoiceChannelAccessLease` | Revalidate long-lived media access and fail closed when authorization changed. |
| `RefreshCurrentVoiceIdentity` | Refresh the current participant projection after profile changes. |

Server-to-client events are defined in
`backend/ArcaneLink/Services/Realtime/RealtimeEventNames.cs`:

| Event family | Events |
|---|---|
| Friends | `FriendRequestReceived`, `FriendRequestUpdated`, `FriendListChanged` |
| Invitations and membership | `ServerInviteReceived`, `ServerInviteAccepted`, `ServerJoinRequestChanged`, `ServerJoinRequestsChanged`, `ServerMembersChanged` |
| Server structure | `ServerGovernanceChanged`, `ServerSpacesChanged`, `ServerUpdated`, `ServerDeleted`, `UserServersChanged` |
| Private messaging | `PrivateSpacesChanged`, `PrivateSpaceMessagesChanged`, `PrivateMessageReceived` |
| Server messaging | `SpaceMessagesChanged`, `SpaceReadStateChanged` |
| User state | `UserProfileChanged`, `UserProfileSettingsChanged`, `UserPresenceChanged`, `UserAssetsChanged`, `UserSessionsChanged`, `UserNotificationsChanged`, `CurrentSessionRevoked` |
| Voice and calls | `VoiceAccessRevoked`, `VoiceConnectionReplaced`, `IncomingPrivateCall`, `PrivateCallStateChanged` |
| Moderation | `ModerationCaseChanged`, `MyModerationReportsChanged` |

## Operational endpoints

| Route | Access | Responsibility |
|---|---|---|
| `GET /` | Anonymous | Minimal service identity response. |
| `GET /ping` | Anonymous | Lightweight process response. |
| `GET /health/live` | Anonymous | Process liveness; does not prove database readiness. |
| `GET /health/ready` | Anonymous | Readiness including required dependencies. |
| `/scalar` and OpenAPI document routes | Environment-limited | Interactive schema inspection outside production. |

## Change rule

When adding, removing or renaming a controller route, hub method or realtime
event, update both `API.md` and `API.ru.md` in the same change. If a business
rule changes, update the service-owner row rather than assigning that rule to a
controller.
