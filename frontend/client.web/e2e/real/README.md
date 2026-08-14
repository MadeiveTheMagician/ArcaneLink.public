# Real backend smoke test

This Playwright contour calls the real REST API and SignalR hub through an
already running Vite proxy. It never uses `e2e/fixtures/arcaneLinkApi.ts` and
does not start Vite, the ASP.NET backend, PostgreSQL, or a browser.

Expected services:

- ArcaneLink backend at `http://127.0.0.1:5207`;
- Vite at `http://127.0.0.1:5173`, started with
  `ARCANELINK_API_TARGET=http://127.0.0.1:5207`.

PowerShell opt-in run:

```powershell
$env:ARCANELINK_REAL_E2E = '1'
$env:ARCANELINK_REAL_BASE_URL = 'http://127.0.0.1:5173'
npm.cmd run test:e2e:real
```

`ARCANELINK_REAL_BASE_URL` is optional and defaults to
`http://127.0.0.1:5173`. Without `ARCANELINK_REAL_E2E=1`, the test is skipped.

The test creates unique primary and companion users, a server, text/voice
spaces, server and private messages, one small attachment, and a solo SignalR
voice session. Cleanup deletes the messages, asset, and server, closes both
private-space memberships, stops SignalR, and logs out. User deletion is not
available in the public API, so the two uniquely prefixed `e2e_` accounts
remain in a persistent local database; CI should use an ephemeral database.
