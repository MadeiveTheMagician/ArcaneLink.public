# Жизненный цикл email аккаунта

[English version](ACCOUNT_EMAIL_LIFECYCLE.md)

Справочник фиксирует владельцев, поток данных и эксплуатационный контракт для
подтверждения email, восстановления пароля и смены адреса в версии `1.0.1`.

## Карта ответственности

| Компонент | Ответственность |
|---|---|
| `AuthController` | Проверяет форму HTTP DTO, получает текущую identity и преобразует результат lifecycle в response/cookies. |
| `AccountLifecycleService` | Владеет переходами состояния аккаунта, password checks, выпуском/применением tokens и отзывом сессий. |
| `EmailOutboxQueue` | Сохраняет защищённый payload доставки или отложенного lookup в той же database unit of work. |
| `EmailOutboxProcessor` | Захватывает строки с lease, готовит deferred-письма, доставляет и назначает retry/dead-letter. |
| `EmailOutboxHostedService` | Запускает processor только при включённой email delivery. |
| `FileEmailTemplateRenderer` | Загружает и строго проверяет фиксированный контракт templates/variables. |
| `MailKitEmailSender` | Устанавливает настроенное SMTP-соединение и отправляет готовое письмо. |
| `ProductionConfigurationValidator` | Запрещает production startup без включённого валидного SMTP и HTTPS public origin. |

## Пользовательские потоки

| Поток | Последовательность endpoints | Состояние и безопасность |
|---|---|---|
| Подтверждение регистрации | `POST /api/auth/register` → ссылка из письма → `POST /api/auth/email/confirm` | Новый пользователь получает статус `PendingEmailVerification`. Confirm применяет token, фиксирует время и активирует аккаунт. До этого login отклоняется. |
| Повторное письмо | `POST /api/auth/email/resend` | Endpoint одинаково принимает корректный запрос. Проверка существования аккаунта отложена в worker, чтобы публичный путь не раскрывал наличие email. |
| Забытый пароль | `POST /api/auth/password/forgot` → ссылка → `POST /api/auth/password/reset` | Lookup отложен для защиты от enumeration. Нужны валидный token и новый пароль; reset применяет token и отзывает сессии. |
| Смена пароля из аккаунта | `POST /api/auth/account/password/change` | Bearer identity, текущий пароль и соответствующий политике новый пароль обязательны. Сессии отзываются, auth cookies очищаются. |
| Смена login | `PUT /api/auth/account/login` | Требует bearer identity и текущий пароль; uniqueness и validation принадлежат сервисному слою. |
| Смена email | `POST /api/auth/account/email/change` → письмо на новый адрес → `POST /api/auth/email/confirm` | Требует bearer identity и текущий пароль. Адрес меняется только после подтверждения нового. Сессии отзываются, нужна повторная аутентификация; на старый адрес ставится security notice. |

## Контракт tokens и хранения

- Action token содержит 48 случайных байт; в БД сохраняется только hash.
- Purpose, pending value, время создания, истечения и применения находятся в
  `UserAccountActionTokens`.
- Ограничения БД и инвалидирование сервисом оставляют один активный token на
  пользователя и purpose.
- Сроки по умолчанию: 24 часа для регистрации, 2 часа для смены email и 30
  минут для password reset.
- Token одноразовый. Истёкший, применённый, с неверным purpose или состоянием
  не изменяет аккаунт.
- Outbox payload защищается ASP.NET Core Data Protection до записи в
  `EmailOutboxMessages`. Volume ключей должен сохраняться между перезапусками,
  иначе ожидающие письма невозможно расшифровать.
- Outbox хранит availability, attempts, lease, completion, dead-letter и
  последнюю ошибку. Значения по умолчанию: poll 5 секунд, lease 120 секунд,
  8 попыток и backoff не более 60 минут.

## Конфигурация

Docker Compose преобразует следующие `.env` variables в `EmailDelivery`:

| Variable | Обязательна в production | Значение |
|---|---|---|
| `EMAIL_ENABLED` | Да, `true` | Запуск delivery worker. |
| `EMAIL_SMTP_HOST` | Да | Hostname SMTP relay. |
| `EMAIL_SMTP_PORT` | Да | SMTP port, обычно `587` для STARTTLS или TLS-port провайдера. |
| `EMAIL_SMTP_SSL_ON_CONNECT` | Да | Устанавливать ли TLS сразу при connect. |
| `EMAIL_SMTP_USERNAME` | Да | Имя SMTP credential. |
| `EMAIL_SMTP_PASSWORD` | Да | SMTP secret; хранится только в исключённом `.env`. |
| `EMAIL_FROM_ADDRESS` | Да | Валидный sender, разрешённый relay. |
| `EMAIL_PUBLIC_ORIGIN` | Да | HTTPS origin сайта для action links, без path/query/credentials. |

В локальном `.env` допустимо `EMAIL_ENABLED=false`: запросы сохраняются, но не
доставляются до включения валидного SMTP. В production неполная или выключенная
доставка намеренно не проходит configuration validation.

## Templates и эксплуатация

Фиксированный набор templates: подтверждение email, password reset, смена email
и security notice на старый адрес. Backend-ресурс содержит text и HTML. Новый
template требует изменения контракта names/variables и тестов.

Проверки эксплуатации:

1. Применить миграцию хранилища action tokens и outbox.
2. Сохранять и резервировать volume Data Protection keys.
3. Проверить, что relay принимает sender и выбранный TLS mode.
4. Пройти все ссылки через настроенный публичный HTTPS origin.
5. Следить за retry/dead-letter по идентификатору outbox message; в логах не
   должны появляться raw tokens, passwords или protected payloads.
6. Повторяющиеся dead letters считать ошибкой доставки, а не успешной связью с
   пользователем.
