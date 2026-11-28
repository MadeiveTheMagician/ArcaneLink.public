import type { SpaceMessageAssetResponse } from '../../../../shared/types'
import type { ContextMenuItem } from '../../../shared/components/context-menu/ContextMenu'
import { arcaneDesktop } from '../../../shared/services/arcaneDesktop'
import { serverCopy } from '../../../shared/copy/server.ru'
import { isImageAsset } from './messageUtils'

export type AttachmentTransfer = (asset: SpaceMessageAssetResponse, action?: () => void) => void

const webFileFormat = 'web application/octet-stream'

async function fetchAttachment(url: string) {
  const response = await fetch(url)
  if (!response.ok) throw new Error('Attachment is unavailable')
  return response.blob()
}

async function readImageAsPng(url: string) {
  const blob = await fetchAttachment(url)
  if (blob.type === 'image/png') return blob
  const image = await createImageBitmap(blob)
  try {
    const canvas = document.createElement('canvas')
    canvas.width = image.width
    canvas.height = image.height
    const context = canvas.getContext('2d')
    if (!context) throw new Error('Could not decode attachment')
    context.drawImage(image, 0, 0)
    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((png) => png ? resolve(png) : reject(new Error('Could not encode image')), 'image/png')
    })
  } finally {
    image.close()
  }
}

export function getAttachmentContextItems(
  asset: SpaceMessageAssetResponse,
  onTransfer: AttachmentTransfer,
  onFailure: () => void,
): ContextMenuItem[] {
  function reportFailure(promise: Promise<unknown>) {
    void promise.catch(onFailure)
  }

  const isImage = isImageAsset(asset)
  const url = new URL(`/api/assets/${asset.assetId}/content`, window.location.origin).href
  const labels = isImage ? serverCopy.messages.imageContext : serverCopy.messages.fileContext
  const desktop = arcaneDesktop()
  const canWrite = typeof ClipboardItem !== 'undefined' && Boolean(navigator.clipboard?.write)

  return [
    {
      type: 'item',
      label: labels.open,
      onSelect: () => {
        const openOriginal = () => {
          if (desktop) reportFailure(desktop.openAttachment(url))
          else window.open(url, '_blank', 'noopener,noreferrer')
        }
        if (isImage) openOriginal()
        else onTransfer(asset, openOriginal)
      },
    },
    {
      type: 'item',
      label: labels.copyLink,
      icon: 'copy',
      disabled: !navigator.clipboard?.writeText,
      onSelect: () => reportFailure(navigator.clipboard.writeText(url)),
    },
    {
      type: 'item',
      label: labels.copy,
      icon: 'copy',
      disabled: isImage ? !canWrite : !desktop?.copyFile && !(canWrite && ClipboardItem.supports?.(webFileFormat)),
      onSelect: () => {
        if (isImage) {
          reportFailure(navigator.clipboard.write([
            new ClipboardItem({ 'image/png': readImageAsPng(url) }),
          ]))
          return
        }
        onTransfer(asset, () => {
          if (desktop?.copyFile) {
            reportFailure(desktop.copyFile(url, asset.fileName))
            return
          }
          reportFailure(navigator.clipboard.write([
            new ClipboardItem({
              [webFileFormat]: fetchAttachment(url),
              'text/plain': new Blob([url], { type: 'text/plain' }),
            }),
          ]))
        })
      },
    },
    {
      type: 'item',
      label: labels.save,
      onSelect: () => onTransfer(asset),
    },
  ]
}

export function findMessageAttachment(assets: SpaceMessageAssetResponse[], target: EventTarget) {
  const id = target instanceof Element
    ? target.closest<HTMLElement>('[data-attachment-id]')?.dataset.attachmentId
    : undefined
  return id ? assets.find((asset) => asset.assetId === id) : undefined
}
