import { expect, test } from '@playwright/test';

import {
  isExpectedModerationEvidenceResponseUrl,
  isMatchingModerationEvidenceSha256,
  resolveModerationEvidenceContentUrl,
  sanitizeModerationEvidenceFileName,
  validateModerationEvidenceResponse
} from '../../src/system/Moderation/models/moderationEvidenceAssetModel';

const route = {
  origin: 'https://arcanelink.test',
  serverId: 'aaaaaaaa-0000-0000-0000-000000000001',
  caseId: 'bbbbbbbb-0000-0000-0000-000000000002',
  evidenceAssetId: 'cccccccc-0000-0000-0000-000000000003'
};
const contentUrl =
  '/api/servers/aaaaaaaa-0000-0000-0000-000000000001/moderation/cases/bbbbbbbb-0000-0000-0000-000000000002/evidence-assets/cccccccc-0000-0000-0000-000000000003/content';

test.describe('moderation evidence asset model', () => {
  test('accepts only the exact same-origin evidence endpoint', () => {
    expect(resolveModerationEvidenceContentUrl({ ...route, contentUrl })).toBe(
      contentUrl
    );
    expect(
      resolveModerationEvidenceContentUrl({
        ...route,
        contentUrl: `https://evil.example${contentUrl}`
      })
    ).toBeNull();
    expect(
      resolveModerationEvidenceContentUrl({
        ...route,
        contentUrl: `${contentUrl}?access_token=leak`
      })
    ).toBeNull();
    expect(
      resolveModerationEvidenceContentUrl({
        ...route,
        evidenceAssetId: 'dddddddd-0000-0000-0000-000000000004',
        contentUrl
      })
    ).toBeNull();
  });

  test('accepts only the final response URL that was requested', () => {
    expect(
      isExpectedModerationEvidenceResponseUrl({
        origin: route.origin,
        requestPath: contentUrl,
        responseUrl: `${route.origin}${contentUrl}`
      })
    ).toBe(true);
    expect(
      isExpectedModerationEvidenceResponseUrl({
        origin: route.origin,
        requestPath: contentUrl,
        responseUrl: `https://cdn.example${contentUrl}`
      })
    ).toBe(false);
    expect(
      isExpectedModerationEvidenceResponseUrl({
        origin: route.origin,
        requestPath: contentUrl,
        responseUrl: `${route.origin}${contentUrl}?token=leak`
      })
    ).toBe(false);
  });

  test('opens only verified inline media and downloads forced attachments', () => {
    expect(
      validateModerationEvidenceResponse({
        recordedMimeType: 'image/png',
        recordedSizeBytes: 128,
        responseContentType: 'image/png',
        responseContentDisposition: 'inline; filename="evidence.png"',
        responseSizeBytes: 128
      })
    ).toEqual({ ok: true, mode: 'open' });
    expect(
      validateModerationEvidenceResponse({
        recordedMimeType: 'application/zip',
        recordedSizeBytes: 256,
        responseContentType: 'application/octet-stream',
        responseContentDisposition: 'attachment; filename="evidence.zip"',
        responseSizeBytes: 256
      })
    ).toEqual({ ok: true, mode: 'download' });
  });

  test('rejects mismatched size, executable inline content and missing disposition', () => {
    expect(
      validateModerationEvidenceResponse({
        recordedMimeType: 'image/png',
        recordedSizeBytes: 128,
        responseContentType: 'image/png',
        responseContentDisposition: 'inline',
        responseSizeBytes: 127
      }).ok
    ).toBe(false);
    expect(
      validateModerationEvidenceResponse({
        recordedMimeType: 'text/html',
        recordedSizeBytes: 128,
        responseContentType: 'text/html',
        responseContentDisposition: 'inline',
        responseSizeBytes: 128
      }).ok
    ).toBe(false);
    expect(
      validateModerationEvidenceResponse({
        recordedMimeType: 'image/png',
        recordedSizeBytes: 128,
        responseContentType: 'image/png',
        responseContentDisposition: null,
        responseSizeBytes: 128
      }).ok
    ).toBe(false);
    expect(
      validateModerationEvidenceResponse({
        recordedMimeType: 'image/svg+xml',
        recordedSizeBytes: 128,
        responseContentType: 'image/svg+xml',
        responseContentDisposition: 'inline',
        responseSizeBytes: 128
      }).ok
    ).toBe(false);
  });

  test('matches only a valid recorded SHA-256 digest', () => {
    const digest = 'a'.repeat(64);

    expect(
      isMatchingModerationEvidenceSha256(digest.toUpperCase(), digest)
    ).toBe(true);
    expect(isMatchingModerationEvidenceSha256('not-a-digest', digest)).toBe(
      false
    );
    expect(
      isMatchingModerationEvidenceSha256(digest, `${'a'.repeat(63)}b`)
    ).toBe(false);
  });

  test('sanitizes server-provided filenames before download', () => {
    expect(sanitizeModerationEvidenceFileName('../unsafe\\name?.zip')).toBe(
      '.._unsafe_name_.zip'
    );
    expect(sanitizeModerationEvidenceFileName('...')).toBe(
      'moderation-evidence'
    );
  });
});
