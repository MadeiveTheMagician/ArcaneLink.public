import { readFile, mkdir } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from '@playwright/test'

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url))
const mobileDirectory = path.resolve(scriptDirectory, '..')
const webDirectory = path.resolve(mobileDirectory, '..', 'client.web')
const resourcesDirectory = path.join(mobileDirectory, 'android', 'app', 'src', 'main', 'res')
const logoPath = path.join(webDirectory, 'public', 'brand', 'logo-mark.svg')

const splashTargets = [
  ['drawable/splash.png', 480, 320],
  ['drawable-land-mdpi/splash.png', 480, 320],
  ['drawable-land-hdpi/splash.png', 800, 480],
  ['drawable-land-xhdpi/splash.png', 1280, 720],
  ['drawable-land-xxhdpi/splash.png', 1600, 960],
  ['drawable-land-xxxhdpi/splash.png', 1920, 1280],
  ['drawable-port-mdpi/splash.png', 320, 480],
  ['drawable-port-hdpi/splash.png', 480, 800],
  ['drawable-port-xhdpi/splash.png', 720, 1280],
  ['drawable-port-xxhdpi/splash.png', 960, 1600],
  ['drawable-port-xxxhdpi/splash.png', 1280, 1920],
]

const logoSvg = await readFile(logoPath, 'utf8')
const logoDataUrl = `data:image/svg+xml;base64,${Buffer.from(logoSvg).toString('base64')}`

function createSplashMarkup(width, height) {
  const logoSize = Math.round(Math.min(width, height) * 0.24)
  const logoX = Math.round((width - logoSize) / 2)
  const logoY = Math.round((height - logoSize) / 2)

  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <style>
      html, body { width: 100%; height: 100%; margin: 0; overflow: hidden; background: #030815; }
      svg { display: block; width: 100%; height: 100%; }
    </style>
  </head>
  <body>
    <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
      <defs>
        <linearGradient id="systemBackground" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#030815" />
          <stop offset="48%" stop-color="#071126" />
          <stop offset="100%" stop-color="#171247" />
        </linearGradient>
        <radialGradient id="systemGlow" cx="50%" cy="50%" r="48%">
          <stop offset="0%" stop-color="#6740ed" stop-opacity="0.32" />
          <stop offset="42%" stop-color="#6740ed" stop-opacity="0.13" />
          <stop offset="100%" stop-color="#6740ed" stop-opacity="0" />
        </radialGradient>
        <radialGradient id="cornerGlow" cx="80%" cy="12%" r="64%">
          <stop offset="0%" stop-color="#3f7cff" stop-opacity="0.15" />
          <stop offset="100%" stop-color="#3f7cff" stop-opacity="0" />
        </radialGradient>
        <filter id="logoGlow" x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur in="SourceAlpha" stdDeviation="${Math.max(4, Math.round(logoSize * 0.055))}" result="blur" />
          <feFlood flood-color="#845cff" flood-opacity="0.48" result="color" />
          <feComposite in="color" in2="blur" operator="in" result="shadow" />
          <feMerge>
            <feMergeNode in="shadow" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      <rect width="${width}" height="${height}" fill="url(#systemBackground)" />
      <rect width="${width}" height="${height}" fill="url(#cornerGlow)" />
      <rect width="${width}" height="${height}" fill="url(#systemGlow)" />
      <image href="${logoDataUrl}" x="${logoX}" y="${logoY}" width="${logoSize}" height="${logoSize}" filter="url(#logoGlow)" />
    </svg>
  </body>
</html>`
}

const browser = await chromium.launch({ headless: true })

try {
  for (const [relativePath, width, height] of splashTargets) {
    const outputPath = path.join(resourcesDirectory, relativePath)
    await mkdir(path.dirname(outputPath), { recursive: true })

    const page = await browser.newPage({
      viewport: { width, height },
      deviceScaleFactor: 1,
    })

    await page.setContent(createSplashMarkup(width, height), { waitUntil: 'load' })
    await page.locator('image').evaluate((image) => image.decode())
    await page.screenshot({ path: outputPath, type: 'png' })
    await page.close()

    console.log(`Generated ${relativePath} (${width}x${height})`)
  }
} finally {
  await browser.close()
}
