# ArcaneLink Desktop client

This package is the Electron shell for the canonical web client in `../client.web`.
It does not duplicate the React source.

ArcaneLink 1.0 uses a centralized same-origin service contract. A packaged desktop build therefore opens
`https://arcane-link.ru`. In development it opens `http://localhost:5173` by default.

## Development

Install both package trees:

```powershell
cd ..\client.web
npm.cmd ci
cd ..\client.desktop
npm.cmd ci
```

Start Vite in the first terminal:

```powershell
cd frontend\client.web
npm.cmd run dev
```

Start Electron in the second terminal:

```powershell
cd frontend\client.desktop
npm.cmd run dev
```

Override the trusted development origin when Vite uses a different port:

```powershell
$env:ARCANELINK_DESKTOP_DEV_URL = 'http://localhost:5174'
npm.cmd run dev
```

`ARCANELINK_DESKTOP_APP_URL` overrides the packaged application URL for controlled deployment testing.
Only trusted origins receive media, display-capture, and notification permissions.

## Verification and Windows packaging

```powershell
npm.cmd run check
npm.cmd run pack:win
npm.cmd run dist:win
```

`pack:win` creates an unpacked verification build. `dist:win` creates the NSIS installer and update metadata
under `release/`. The directory is generated and must not be committed. Sign public installers before release.
