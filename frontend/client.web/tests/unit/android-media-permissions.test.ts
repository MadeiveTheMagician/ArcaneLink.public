import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { expect, test } from '@playwright/test'

test('Android declares the permissions required by Capacitor WebRTC capture', async () => {
  const manifest = await readFile(
    resolve('../client.mobile/android/app/src/main/AndroidManifest.xml'),
    'utf8',
  )

  expect(manifest).toContain('android.permission.RECORD_AUDIO')
  expect(manifest).toContain('android.permission.MODIFY_AUDIO_SETTINGS')
  expect(manifest).toContain('android.permission.CAMERA')
})
