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

ArcaneLink `1.0.0-rc.1` uses the operating-system font stack; no custom font
binaries are required to build the clients.

