# Source asset policy

Only assets required to build and present ArcaneLink belong in the source
repository.

## Allowed

- original ArcaneLink brand and interface media with confirmed rights;
- code-native SVG and CSS visuals;
- third-party media with a redistribution license recorded in
  [Third-party notices](THIRD_PARTY_NOTICES.md);
- synthetic test fixtures that contain no personal data.

## Not allowed

- user uploads, avatars, message attachments or production screenshots;
- assets copied from an unknown source;
- trial or commercial fonts without explicit redistribution rights;
- generated build copies of web assets;
- files carrying credentials, workstation paths or undisclosed provenance
  metadata.

## Adding an asset

Record its source, author or generator, license, intended use and whether
modification or redistribution is allowed. Inspect metadata before committing.
For raster files, keep the smallest required source and regenerate platform
variants during the build where practical.

ArcaneLink `1.0.1` uses the operating-system font stack; no custom font
binaries are required to build the clients.

## First-party asset register

### Voice connection cues

- Files: `frontend/client.web/src/system/shared/voice/samples/voice-connected.wav`
  and `voice-disconnected.wav` in the same directory.
- Source and rights holder: supplied and confirmed by the ArcaneLink project
  owner as original first-party ArcaneLink audio.
- Intended use: audible confirmation when a voice connection is established or
  disconnected.
- License: covered by the repository-root ArcaneLink Academic Review License.
- Modification and redistribution: allowed only to the extent expressly
  permitted by that license or by separate written authorization from the
  rights holder.
- Integrity hashes:
  - `voice-connected.wav`: `EC86974ED884E486DDA33C87CA5E6204BC426C52A6784862459A91A49E8B9D63`
  - `voice-disconnected.wav`: `EB66EE6746E938CD56009291D90581EECEB7C15EE533FCDA73D32D0435BA8ED3`
