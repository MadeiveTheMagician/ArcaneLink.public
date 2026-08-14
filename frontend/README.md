# ArcaneLink frontend

The frontend is split by platform ownership while keeping one React source tree:

```text
client.web      canonical React/TypeScript application
client.desktop  Electron shell for the official web origin
client.mobile   Capacitor Android shell built from client.web
```

Install dependencies independently with `npm ci` in each package. Build and verify `client.web` before
packaging either wrapper. Desktop and Android production shells use `https://arcane-link.ru` because ArcaneLink
1.0 relies on same-origin API, SignalR, refresh-cookie, and protected-asset semantics.
