# API сервера и карта зон ответственности

[English version](API.md)

Документ описывает серверный контракт версии `1.0.1`. Это исходная точка для
изменений API: здесь можно быстро определить HTTP-границу, сервис-владельца
правила, область хранения данных и связанные realtime-события.

## Общие правила контракта

| Элемент | Контракт |
|---|---|
| Публичный HTTP-префикс | `/api` |
| Realtime endpoint | `/hubs/realtime` (SignalR) |
| Аутентификация | JWT bearer token, если строка не помечена как Anonymous |
| Идентификаторы | UUID; шаблоны контроллеров обычно используют ограничение `:guid` |
| Формат | Обычно JSON; загрузки — `multipart/form-data`; содержимое assets — binary |
| Ошибки | Единый формат API формирует глобальный exception middleware |
| Авторизация | Контроллер задаёт границу запроса; правила применяют доменные сервисы и authorization runtime |
| Хранение | EF Core context и миграции в `backend/ArcaneLink/` являются источником истины |
| Realtime | Мутации уведомляют только рассчитанных получателей через `IRealtimeNotificationService` |
| Схема API | OpenAPI/Scalar доступен только в окружениях разработки |

Таблица группирует близкие шаблоны, сохраняя все поддерживаемые операции.
Реализация содержит 193 уникальных REST-маршрута.

## Карта владельцев

| Домен | HTTP-граница | Владелец в сервисном слое | Зона ответственности |
|---|---|---|---|
| Аутентификация и сессии | `AuthController` | `Services/Auth`, `Services/Login`, `Services/Logout`, `Services/JwtService` | Регистрация, вход, ротация токенов, выход и отзыв device-сессий |
| Аккаунт и email | `AuthController` | `AccountLifecycleService`, `Services/Email`, `UserPasswordService` | Подтверждение email, восстановление пароля, смена email/login/password и надёжная доставка |
| Пользователи и профили | `UsersController` | `Services/Users` | Поиск, публичный/собственный профиль, настройки, теги, медиа и DM privacy |
| Друзья | `FriendsController` | `FriendService` | Заявки, принятие, отмена, удаление и уведомления списка друзей |
| Уведомления | `NotificationsController` | `UserNotificationService` | История уведомлений и состояние прочтения |
| Assets | `AssetsController` | `Services/Assets` | Валидация загрузки, метаданные, политика доступа, варианты, storage и retention |
| Серверы сообществ | `ServersController` | `Services/Servers` | Создание, discovery, получение, изменение и удаление сервера |
| Участники и bans | Контроллеры members, bans и join requests | Сервисы server member/join | Членство, заявки, kick, ban и самостоятельный выход |
| Роли и governance | `ServerGovernanceController` | Сервисы governance, roles, ownership и audit | Invites, роли, каталоги прав, иерархия, владелец и аудит |
| Идентичность на сервере | Контроллеры member profile/color/effective permissions | Сервисы profile, color и authorization | Серверный профиль, avatar, цвет и вычисленные права |
| Спейсы | `SpacesController` | `Services/Spaces` | Дерево, типы, порядок, защита и permission overrides |
| Сообщения сервера | `SpaceMessagesController` | `Services/Messages` | Текстовый/voice companion chat, read state, поиск, mentions, attachments, reactions и pins |
| Приватные спейсы | `PrivateSpacesController`, `PrivateSpaceFoldersController` | `Services/PrivateSpaces` | Direct/group чаты, личные настройки, папки, сообщения и корзина |
| Модерация | `ModerationController` | `ModerationService` | Reports, cases, доступ к evidence и статус для автора жалобы |
| Voice и calls | `VoiceController`, `RealtimeHub` | TURN и realtime voice services | Краткосрочная ICE-конфигурация, комнаты, private calls и WebRTC signaling |
| Streaming bootstrap | `StreamingController` | `StreamingOptions` | Публичные для клиента лимиты и настройки streaming-функций |
| Диагностика | `TestController`, mappings в `Program.cs` | Инфраструктура host | Проверка identity, liveness и readiness |

Контроллеры находятся в `backend/ArcaneLink/Controllers`, доменные сервисы — в
`backend/ArcaneLink/Services`. Контроллеры должны оставаться транспортными
адаптерами; бизнес-инварианты принадлежат указанному сервису-владельцу.

## Таблица REST-маршрутов

`Bearer` означает обязательную аутентификацию. Дополнительные права сервера,
спейса, роли или владельца проверяются ответственным сервисом.

| Методы и маршруты | Доступ | Функция и ответственность |
|---|---|---|
| `POST /api/auth/register`; `POST /api/auth/login`; `POST /api/auth/refresh`; `POST /api/auth/logout` | Anonymous | Создание аккаунта, вход, ротация токенов и завершение refresh-сессии. Регистрация ставит письмо подтверждения в очередь. |
| `POST /api/auth/email/confirm`; `POST /api/auth/email/resend` | Anonymous | Применить одноразовый verification token или повторно запросить письмо без раскрытия существования аккаунта. |
| `POST /api/auth/password/forgot`; `POST /api/auth/password/reset` | Anonymous | Поставить reset-письмо в очередь и применить одноразовый token; успешный reset отзывает активные сессии. |
| `POST /api/auth/account/email/change`; `PUT /api/auth/account/login`; `POST /api/auth/account/password/change` | Bearer | Изменение чувствительных данных после проверки credentials и lifecycle-правил. |
| `GET /api/auth/sessions`; `POST .../{id}/revoke`; `POST .../revoke-all`; `POST .../revoke-others`; `POST /api/auth/logoutAll` | Bearer | Просмотр и отзыв device-сессий с realtime-уведомлением. |
| `GET /api/users/{id}` | Anonymous | Разрешённая публичная проекция профиля. |
| `GET /api/users/me`; `GET/PATCH /api/users/me/profile` | Bearer | Текущая identity и изменение собственного профиля. |
| `POST /api/users/me/profile/avatar/{assetId}`; upload-вариант; banner set/upload; `DELETE .../banner` | Bearer | Привязка, загрузка или очистка валидированных медиа профиля. |
| `GET/PATCH /api/users/me/profile/settings`; `GET/PUT .../profile/tags`; `GET /api/users/profile-tags` | Bearer | Настройки видимости/представления и контролируемый каталог тегов. |
| `GET /api/users/discover`; `GET /api/users/search` | Bearer | Discovery и поиск пользователей через безопасные DTO. |
| `GET/PUT/DELETE /api/users/me/direct-message-blocks/{blockedUserId}`; `GET .../direct-message-blocks` | Bearer | Просмотр и изменение блокировок личных сообщений. |
| `GET/POST /api/users/me/voice-layout-presets`; `GET/PUT/DELETE .../{presetId}` | Bearer | Хранение принадлежащих пользователю voice layout presets. |
| `GET /api/friends`; `GET .../requests/incoming`; `GET .../requests/outgoing` | Bearer | Друзья и ожидающие заявки. |
| `POST /api/friends/requests`; `POST .../{requestId}/accept|decline|cancel`; `DELETE /api/friends/{friendUserId}` | Bearer | Изменение state machine дружбы и уведомление обеих сторон. |
| `GET /api/notifications`; `POST .../{notificationId}/read`; `POST .../read-all`; `DELETE .../history` | Bearer | Чтение, подтверждение и очистка собственных уведомлений. |
| `POST /api/assets`; `POST /api/assets/upload`; `DELETE /api/assets/{id}` | Bearer | Создание/загрузка asset или удаление после проверки ownership и ссылок. |
| `GET /api/assets/{id}`; `GET /api/assets/{id}/content` | Anonymous | Метаданные/контент с проверкой access policy; приватный asset может быть отклонён. |
| `GET /api/assets/me/avatar|banner|profile-background|server-icon` | Bearer | Assets текущего пользователя по назначению. |
| `POST /api/servers`; `GET /api/servers/me`; `GET .../discover`; `GET .../{id}`; `GET .../by-slug/{slug}` | Bearer | Создание, списки, discovery и получение серверов. |
| `PATCH /api/servers/{id}`; `DELETE /api/servers/{id}` | Bearer | Изменение или удаление после governance-проверок. |
| `GET /api/servers/{serverId}/members`; `GET .../members/by-user/{targetUserId}` | Bearer | Разрешённые проекции участников. |
| `DELETE .../members/{memberId}`; `POST .../members/{memberId}/ban`; `DELETE .../members/me`; bans list/unban | Bearer | Kick, ban, unban или leave с сохранением owner/hierarchy-инвариантов. |
| `POST /api/servers/{serverId}/join`; join-requests list/approve/decline; `DELETE .../join-requests/me` | Bearer | Создание, рассмотрение и отмена заявок на вступление. |
| `GET/POST /api/servers/{serverId}/invites`; `POST .../{inviteId}/revoke` | Bearer | Создание, список и отзыв приглашений. |
| `GET /api/server-invites/{code}`; accept/decline; `GET .../me|target-servers|targets` | Bearer | Preview/ответ на invite и список допустимых целевых серверов. |
| `GET /api/permissions/server`; `GET /api/permissions/server/v1`; `GET /api/permissions/space` | Bearer | Версионированные каталоги прав для клиентов. |
| Roles list/create/update/delete/duplicate/reorder под `/api/servers/{serverId}/roles` | Bearer | Управление ролями и их иерархией. |
| Permissions, deletion-impact, member-role assign/revoke под тем же сервером | Bearer | Изменение прав и назначений после сравнения уровня authority. |
| `POST /api/servers/{serverId}/ownership-transfers`; `GET .../audit-logs` | Bearer | Передача ownership и разрешённая история governance-аудита. |
| Member profile get/update/reset/avatar под `/api/servers/{serverId}/member-profiles` | Bearer | Персональная идентичность пользователя на конкретном сервере. |
| `GET/PATCH .../members/me/display-color`; `GET .../effective-permissions` | Bearer | Персональный цвет и вычисленный authorization snapshot. |
| `GET /api/space-types`; spaces list/create/update/delete/reorder под `/api/servers/{serverId}/spaces` | Bearer | Типы и управление деревом спейсов. |
| `PUT .../spaces/{spaceId}/permission-overrides`; `DELETE .../{overrideId}` | Bearer | Upsert/remove локальных переопределений прав ресурса. |
| Messages get/create/edit/delete под `/api/servers/{serverId}/spaces/{spaceId}/messages` | Bearer | Полный lifecycle текстовых сообщений сервера. |
| Attachments, mention-candidates, pinned, read-state и server message search | Bearer | Файлы, mentions, pins, прочтение и поиск только в доступных спейсах. |
| Reactions add/remove и message pin/unpin | Bearer | Собственные реакции и pins с проверкой прав спейса. |
| Те же message-операции под `/api/servers/{serverId}/voice-spaces/{spaceId}/chat/messages` | Bearer | Связанный текстовый чат voice-спейса на общей модели сообщений и прав. |
| `GET/POST /api/private-spaces`; `GET .../{spaceId}`; `POST .../direct/{targetUserId}` | Bearer | Список/создание приватных групп или get-or-create direct conversation. |
| Members, shared settings, personal settings и personal avatar под `/api/private-spaces/{spaceId}` | Bearer | Состав группы и общие/личные параметры приватного спейса. |
| Private messages get/create/edit/delete, reactions, pins, attachments, search и read-state | Bearer | Lifecycle приватных сообщений только для участников. |
| Trash get/clear, restore, history clear и `PUT /api/private-spaces/read-state/all` | Bearer | Индивидуальная корзина/restore, видимость истории и общий private read state. |
| CRUD и reorder под `/api/private-space-folders` | Bearer | Организация личных разговоров в ordered/locked/pinned папках. |
| `POST .../messages/{messageId}/reports`; `GET /api/users/me/moderation-reports` | Bearer | Жалоба на сообщение и разрешённая проекция её статуса для автора. |
| Cases get/update и evidence content под `/api/servers/{serverId}/moderation` | Bearer | Работа модераторов с cases и доступ к неизменяемым evidence. |
| `GET /api/voice/ice-servers` | Bearer | Client-safe ICE list и краткосрочные TURN REST credentials; инфраструктурный secret не попадает в client bundle. |
| `GET /api/streaming/config` | Anonymous | Безопасные для клиента streaming limits и feature config. |
| `GET /api/test/me` | Bearer | Диагностическая identity текущего токена; не бизнес-endpoint. |

## Realtime-контракт

SignalR hub реализован в `backend/ArcaneLink/Hubs/RealtimeHub.cs` и требует
JWT. Группы соединений и аудитории рассчитывает сервер: клиент не может выбрать
произвольных получателей событий.

| Методы hub, вызываемые клиентом | Ответственность |
|---|---|
| `JoinServer`, `LeaveServer` | Подписка/отписка соединения от разрешённой аудитории сервера. |
| `JoinVoiceChannel`, `LeaveVoiceChannel`, `GetVoiceChannelState` | Вход, выход и чтение server voice room после авторизации спейса. |
| `UpdateVoiceState`, `MoveVoiceParticipant`, `UpdateVoiceParticipantModeration`, `DisconnectVoiceParticipant` | Собственное media state и управляемая модерация voice-участников. |
| `JoinPrivateVoiceChannel`, `GetPrivateVoiceChannelState` | Вход/чтение private voice room после проверки membership. |
| `StartPrivateCall`, `AcceptPrivateCall`, `DeclinePrivateCall`, `CancelPrivateCall`, `GetPrivateCallState`, `GetIncomingPrivateCalls` | State machine приватного звонка. |
| `SendVoiceSignal` | Передача WebRTC offer/answer/ICE только между авторизованными текущими участниками. |
| `RenewVoiceChannelAccessLease`, `RenewPrivateVoiceChannelAccessLease` | Повторная проверка доступа долгого media-сеанса и fail-closed при изменении прав. |
| `RefreshCurrentVoiceIdentity` | Обновление проекции участника после изменения профиля. |

События server-to-client объявлены в
`backend/ArcaneLink/Services/Realtime/RealtimeEventNames.cs`:

| Семейство | События |
|---|---|
| Друзья | `FriendRequestReceived`, `FriendRequestUpdated`, `FriendListChanged` |
| Invites и membership | `ServerInviteReceived`, `ServerInviteAccepted`, `ServerJoinRequestChanged`, `ServerJoinRequestsChanged`, `ServerMembersChanged` |
| Структура сервера | `ServerGovernanceChanged`, `ServerSpacesChanged`, `ServerUpdated`, `ServerDeleted`, `UserServersChanged` |
| Приватные сообщения | `PrivateSpacesChanged`, `PrivateSpaceMessagesChanged`, `PrivateMessageReceived` |
| Сообщения сервера | `SpaceMessagesChanged`, `SpaceReadStateChanged` |
| Пользователь | `UserProfileChanged`, `UserProfileSettingsChanged`, `UserPresenceChanged`, `UserAssetsChanged`, `UserSessionsChanged`, `UserNotificationsChanged`, `CurrentSessionRevoked` |
| Voice и calls | `VoiceAccessRevoked`, `VoiceConnectionReplaced`, `IncomingPrivateCall`, `PrivateCallStateChanged` |
| Модерация | `ModerationCaseChanged`, `MyModerationReportsChanged` |

## Эксплуатационные endpoints

| Маршрут | Доступ | Ответственность |
|---|---|---|
| `GET /` | Anonymous | Минимальная идентификация сервиса. |
| `GET /ping` | Anonymous | Лёгкая проверка ответа процесса. |
| `GET /health/live` | Anonymous | Liveness процесса без гарантии готовности БД. |
| `GET /health/ready` | Anonymous | Readiness с обязательными зависимостями. |
| `/scalar` и OpenAPI routes | Ограничено окружением | Интерактивная схема вне production. |

## Правило сопровождения

При добавлении, удалении или переименовании controller route, hub method или
realtime event одновременно обновляйте `API.md` и `API.ru.md`. Если меняется
бизнес-правило, обновляется строка сервиса-владельца: правило не должно
переезжать в контроллер.
