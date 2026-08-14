# ArcaneLink Android client

This package owns the Capacitor Android wrapper. The React application remains in `../client.web`; running
`npm run android:sync` builds that package and copies its generated `dist/` into the native project.

ArcaneLink 1.0 deliberately uses a centralized same-origin authentication and asset contract. Production
Android builds therefore load the official HTTPS origin `https://arcane-link.ru`. The synchronized web bundle
is retained as generated fallback material, but is not presented as a standalone offline client. A truly local
runtime would require a separate native authentication and API transport design.

## Requirements

- Node.js 24 or newer and npm 11 or newer;
- JDK 21;
- Android SDK 36 and the platform tools required by Gradle.

## Install and synchronize

```powershell
cd frontend\client.web
npm.cmd ci
cd ..\client.mobile
npm.cmd ci
npm.cmd run android:sync
```

Use a local Vite server for emulator development by setting an explicit URL before synchronization:

```powershell
$env:CAPACITOR_SERVER_URL = 'http://10.0.2.2:5174'
npm.cmd run android:sync
```

The production default remains `https://arcane-link.ru` when `CAPACITOR_SERVER_URL` is absent.

Camera and microphone access uses the standard Capacitor WebView permission flow: Android requests the
corresponding runtime permission when the web client first opens an audio or video capture device. Camera
and microphone hardware are declared optional so voice-only and camera-less devices remain installable.

## Release-candidate limitation

Android screen sharing is not part of the `1.0.0-rc.1` support contract. It requires a separately tested
MediaProjection integration; the wrapper currently guarantees camera and microphone capture only.

## Build and open

```powershell
npm.cmd run android:open
.\android\gradlew.bat -p android :app:assembleDebug
```

Generated web assets, Gradle state, APK/AAB files, signing keys, and local Android SDK paths are ignored.
