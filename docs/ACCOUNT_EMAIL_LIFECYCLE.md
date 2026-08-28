# Account email lifecycle

[Русская версия](ACCOUNT_EMAIL_LIFECYCLE.ru.md)

This reference defines the ownership, data flow and operating contract for
email verification, password recovery and account-email changes in `1.0.1`.

## Responsibility map

| Component | Responsibility |
|---|---|
| `AuthController` | Validates HTTP DTO shape, resolves the current identity and maps lifecycle results to responses/cookies. |
| `AccountLifecycleService` | Owns account state transitions, password checks, token issuance/consumption and session revocation. |
| `EmailOutboxQueue` | Persists a protected delivery or deferred-lookup payload in the same database unit of work. |
| `EmailOutboxProcessor` | Claims messages with a lease, prepares deferred messages, delivers them and schedules retry/dead-letter state. |
| `EmailOutboxHostedService` | Runs the processor only when email delivery is enabled. |
| `FileEmailTemplateRenderer` | Loads and validates the fixed template/variable contract. |
| `MailKitEmailSender` | Establishes the configured SMTP connection and sends the rendered message. |
| `ProductionConfigurationValidator` | Refuses production startup without enabled, valid SMTP and HTTPS public-origin settings. |

## User flows

| Flow | Endpoint sequence | State and security behavior |
|---|---|---|
| Registration verification | `POST /api/auth/register` → message link → `POST /api/auth/email/confirm` | New user starts in `PendingEmailVerification`. Confirmation consumes the token, records confirmation time and activates the account. Login is rejected until confirmation. |
| Verification resend | `POST /api/auth/email/resend` | Always accepts the request shape. Eligibility lookup is deferred to the worker so existing and non-existing accounts follow the same public request path. |
| Forgotten password | `POST /api/auth/password/forgot` → message link → `POST /api/auth/password/reset` | Lookup is deferred to reduce account enumeration. A valid token and valid new password are required; successful reset consumes the token and revokes sessions. |
| Authenticated password change | `POST /api/auth/account/password/change` | Requires bearer identity, current password and a policy-compliant new password. Active sessions and authentication cookies are revoked/cleared. |
| Login change | `PUT /api/auth/account/login` | Requires bearer identity and current password; uniqueness and validation are service-owned. |
| Email change | `POST /api/auth/account/email/change` → message at new address → `POST /api/auth/email/confirm` | Requires bearer identity and current password. The account email changes only after the new-address token is confirmed. Existing sessions are revoked and reauthentication is required. A security notice is queued for the old address. |

## Token and persistence contract

- Action tokens contain 48 random bytes and only their hash is stored.
- Purpose, pending value, creation, expiration and consumption timestamps are
  stored in `UserAccountActionTokens`.
- Only one active token per user and purpose is retained by the database
  constraints and service invalidation flow.
- Default lifetimes are 24 hours for registration verification, 2 hours for an
  email change, and 30 minutes for a password reset.
- A token is single-use. Expired, consumed, purpose-mismatched or state-mismatched
  tokens fail without changing the account.
- Outbox payloads are protected with ASP.NET Core Data Protection before they
  enter `EmailOutboxMessages`. Keep the data-protection key volume stable across
  restarts, or pending messages cannot be unprotected.
- Outbox rows record availability, attempt count, lease, completion,
  dead-letter time and the last error. Default dispatch settings are a 5-second
  poll, 120-second lease, 8 attempts and a maximum 60-minute backoff.

## Configuration

Docker Compose maps these `.env` variables to `EmailDelivery`:

| Variable | Required in production | Meaning |
|---|---|---|
| `EMAIL_ENABLED` | Yes, `true` | Starts the outbox delivery worker. |
| `EMAIL_SMTP_HOST` | Yes | SMTP relay hostname. |
| `EMAIL_SMTP_PORT` | Yes | SMTP port, normally `587` for STARTTLS or a provider-specific TLS port. |
| `EMAIL_SMTP_SSL_ON_CONNECT` | Yes | Whether TLS is established immediately on connect. |
| `EMAIL_SMTP_USERNAME` | Yes | SMTP credential name. |
| `EMAIL_SMTP_PASSWORD` | Yes | SMTP secret; keep only in the ignored `.env`. |
| `EMAIL_FROM_ADDRESS` | Yes | Valid sender address authorized by the relay. |
| `EMAIL_PUBLIC_ORIGIN` | Yes | HTTPS site origin used to build action links; no path, query or credentials. |

Local `.env` may use `EMAIL_ENABLED=false`; requests are persisted but not
delivered until valid SMTP settings are enabled. Production intentionally
fails configuration validation when delivery is disabled or incomplete.

## Templates and operations

The fixed template set is email verification, password reset, email change and
old-address security notice. Templates live with backend resources and define
both text and HTML bodies. Adding a template requires updating the template
name/variable contract and tests.

Operational checks:

1. Apply the migration that creates action-token/outbox storage.
2. Persist and back up the Data Protection key volume.
3. Confirm the relay accepts the configured sender and TLS mode.
4. Exercise every link against the configured public HTTPS origin.
5. Monitor retry and dead-letter logs by outbox message identifier; logs must
   not include raw tokens, passwords or protected payloads.
6. Treat repeated dead letters as delivery failure, not as successful account
   communication.
