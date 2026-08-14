import type { SpaceMessageAssetResponse } from '../../../../shared/types'

import { serverCopy } from '../../../shared'

export type DownloadWarningState = {
  asset: SpaceMessageAssetResponse
  url: string
  title: string
  body: string
  openedAtMs: number
}

const dangerousAttachmentExtensions = new Set([
  '.exe',
  '.com',
  '.scr',
  '.pif',
  '.bat',
  '.cmd',
  '.ps1',
  '.vbs',
  '.js',
  '.jse',
  '.wsf',
  '.wsh',
  '.msi',
  '.msp',
  '.appx',
  '.msix',
])
const archiveAttachmentExtensions = new Set([
  '.zip',
  '.rar',
  '.7z',
  '.tar',
  '.gz',
])
const registryAttachmentExtensions = new Set(['.reg'])
export function isImageAsset(asset: SpaceMessageAssetResponse) {
  return asset.mimeType.toLowerCase().startsWith('image/')
}

export function isVideoAsset(asset: SpaceMessageAssetResponse) {
  return asset.mimeType.toLowerCase().startsWith('video/')
}

export function isArchiveAsset(asset: SpaceMessageAssetResponse) {
  return /\.(zip|rar|7z|tar|gz|bz2)$/i.test(asset.fileName)
}

export function getAttachmentDownloadWarning(asset: SpaceMessageAssetResponse) {
  const extension = getFileExtension(asset.fileName)

  if (dangerousAttachmentExtensions.has(extension)) {
    return {
      title: serverCopy.messages.downloadWarningDangerousTitle,
      body: serverCopy.messages.downloadWarningDangerousBody,
    }
  }

  if (archiveAttachmentExtensions.has(extension)) {
    return {
      title: serverCopy.messages.downloadWarningArchiveTitle,
      body: serverCopy.messages.downloadWarningArchiveBody,
    }
  }

  if (registryAttachmentExtensions.has(extension)) {
    return {
      title: serverCopy.messages.downloadWarningRegistryTitle,
      body: serverCopy.messages.downloadWarningRegistryBody,
    }
  }

  return null
}

function getFileExtension(fileName: string) {
  const normalized = fileName.trim().toLowerCase()
  const lastDotIndex = normalized.lastIndexOf('.')

  return lastDotIndex >= 0 ? normalized.slice(lastDotIndex) : ''
}

export function triggerAssetDownload(url: string, fileName: string) {
  const link = document.createElement('a')
  link.href = url
  link.download = fileName || 'attachment'
  link.rel = 'noopener noreferrer'
  document.body.append(link)
  link.click()
  link.remove()
}

export function formatMessageDay(value: string) {
  return new Intl.DateTimeFormat('ru-RU', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  }).format(new Date(value))
}

export function formatMessageTime(value: string) {
  return new Intl.DateTimeFormat('ru-RU', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
}

export function formatPinnedMessageDateTime(value: string) {
  return new Intl.DateTimeFormat('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
}

export function formatFileSize(sizeBytes: number) {
  if (sizeBytes < 1024) {
    return `${sizeBytes} B`
  }

  const units = ['KB', 'MB', 'GB', 'TB']
  let size = sizeBytes / 1024
  let unitIndex = 0

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024
    unitIndex += 1
  }

  return `${size >= 10 ? size.toFixed(0) : size.toFixed(1)} ${units[unitIndex]}`
}

export function getMessageDayKey(value: string) {
  return new Date(value).toISOString().slice(0, 10)
}
