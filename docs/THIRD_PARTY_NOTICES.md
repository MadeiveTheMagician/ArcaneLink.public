# Third-party notices

ArcaneLink depends on third-party software. Those components are not covered by
the ArcaneLink Academic Review License and remain under their own terms.

The primary package manifests and lockfiles include:

- `backend/ArcaneLink/ArcaneLink.csproj`
- `backend/ArcaneLink.Tests/ArcaneLink.Tests.csproj`
- `backend/tools/TestDataSeeder/TestDataSeeder.csproj`
- `frontend/client.web/package-lock.json`
- `frontend/client.desktop/package-lock.json`
- `frontend/client.mobile/package-lock.json`
- `frontend/client.mobile/android/build.gradle`
- `frontend/client.mobile/android/variables.gradle`
- `frontend/client.mobile/android/gradle/wrapper/gradle-wrapper.properties`

Important direct dependencies in `1.0.0-rc.1` include:

| Component | License declared by package |
| --- | --- |
| ASP.NET Core, Entity Framework Core, SignalR and Microsoft OpenAPI libraries | MIT |
| Npgsql Entity Framework Core provider | PostgreSQL License |
| Scalar.AspNetCore | MIT |
| SkiaSharp | MIT |
| Microsoft Visual Studio Container Tools targets | Microsoft package EULA |
| React and React DOM | MIT |
| Vite | MIT |
| TypeScript | Apache-2.0 |
| Playwright | Apache-2.0 |
| dnd-kit | MIT |
| rnnoise-wasm | Apache-2.0 |
| Electron, electron-builder and electron-updater | MIT |
| Capacitor Core, Android and CLI | MIT |
| PostgreSQL container image | PostgreSQL License and image component terms |
| Nginx container image | Nginx and image component terms |
| Coturn | BSD-3-Clause and image component terms |

This summary is provided for review convenience and does not replace the full
license text distributed by each package. Transitive dependencies are also
subject to their own licenses. Before distributing binary releases, generate a
complete dependency inventory or SBOM from the exact .NET, npm and Gradle
inputs and preserve every required notice.

No third-party font binaries with unverified redistribution rights are included
in the sanitized source tree. ArcaneLink project brand and interface media are
reserved assets unless a file says otherwise.
