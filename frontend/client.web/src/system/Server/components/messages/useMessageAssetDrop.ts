import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type DragEvent,
  type RefObject,
  type SetStateAction,
} from 'react'
import {
  createMessageAttachmentDraft,
  type MessageAttachmentDraft,
} from './messageAttachmentDraft'
import {
  hasOpenBlockingModal,
  resolveMessageAssetDropDisposition,
} from '../../../shared/messages/messageAssetDropModel'

type PendingDroppedFiles = {
  id: string
  files: File[]
}

function hasDraggedFiles(event: DragEvent<HTMLElement>) {
  return Array.from(event.dataTransfer.types).includes('Files')
}

function hasBlockingModal() {
  return (
    typeof document !== 'undefined' && hasOpenBlockingModal(document)
  )
}

export function useMessageAssetDrop({
  isSending,
  isEditing,
  isDisabled,
  pendingDroppedFiles,
  fileInputRef,
  setSelectedAttachments,
  onPendingDroppedFilesConsumed,
}: {
  isSending: boolean
  isEditing: boolean
  isDisabled: boolean
  pendingDroppedFiles?: PendingDroppedFiles | null
  fileInputRef: RefObject<HTMLInputElement | null>
  setSelectedAttachments: Dispatch<SetStateAction<MessageAttachmentDraft[]>>
  onPendingDroppedFilesConsumed?: (id: string) => void
}) {
  const assetDropDepthRef = useRef(0)
  const consumedPendingDropIdRef = useRef<string | null>(null)
  const [isAssetDropActive, setIsAssetDropActive] = useState(false)
  const canAcceptDroppedAssets = !isSending && !isEditing && !isDisabled

  const resetAssetDrop = useCallback(() => {
    assetDropDepthRef.current = 0
    setIsAssetDropActive(false)
  }, [])

  const addSelectedFiles = useCallback(
    (files: FileList | File[] | null) => {
      const disposition = resolveMessageAssetDropDisposition({
        canAccept: canAcceptDroppedAssets,
        hasFiles: Boolean(files?.length),
        isBlockingModalOpen: hasBlockingModal(),
      })
      if (disposition !== 'accept' || !files) return

      setSelectedAttachments((current) => [
        ...current,
        ...Array.from(files, createMessageAttachmentDraft),
      ])
      if (fileInputRef.current) fileInputRef.current.value = ''
    },
    [canAcceptDroppedAssets, fileInputRef, setSelectedAttachments],
  )

  useEffect(() => resetAssetDrop, [resetAssetDrop])

  useEffect(() => {
    function resetGlobalAssetDrop(event: globalThis.DragEvent) {
      if (!Array.from(event.dataTransfer?.types ?? []).includes('Files')) return
      resetAssetDrop()
    }

    function resetGlobalAssetDropByKey(event: KeyboardEvent) {
      if (event.key === 'Escape') resetAssetDrop()
    }

    window.addEventListener('drop', resetGlobalAssetDrop, true)
    window.addEventListener('dragend', resetGlobalAssetDrop, true)
    window.addEventListener('keydown', resetGlobalAssetDropByKey)

    return () => {
      window.removeEventListener('drop', resetGlobalAssetDrop, true)
      window.removeEventListener('dragend', resetGlobalAssetDrop, true)
      window.removeEventListener('keydown', resetGlobalAssetDropByKey)
    }
  }, [resetAssetDrop])

  useEffect(() => {
    if (
      !pendingDroppedFiles ||
      pendingDroppedFiles.files.length === 0 ||
      consumedPendingDropIdRef.current === pendingDroppedFiles.id
    ) {
      return
    }

    consumedPendingDropIdRef.current = pendingDroppedFiles.id
    if (canAcceptDroppedAssets) addSelectedFiles(pendingDroppedFiles.files)
    onPendingDroppedFilesConsumed?.(pendingDroppedFiles.id)
  }, [
    addSelectedFiles,
    canAcceptDroppedAssets,
    onPendingDroppedFilesConsumed,
    pendingDroppedFiles,
  ])

  function activateAssetDrop(event: DragEvent<HTMLElement>) {
    const disposition = resolveMessageAssetDropDisposition({
      canAccept: canAcceptDroppedAssets,
      hasFiles: hasDraggedFiles(event),
      isBlockingModalOpen: hasBlockingModal(),
    })
    if (disposition === 'ignore') return

    event.preventDefault()
    if (disposition === 'reject') {
      resetAssetDrop()
      return
    }

    assetDropDepthRef.current += 1
    setIsAssetDropActive(true)
  }

  function keepAssetDropActive(event: DragEvent<HTMLElement>) {
    const disposition = resolveMessageAssetDropDisposition({
      canAccept: canAcceptDroppedAssets,
      hasFiles: hasDraggedFiles(event),
      isBlockingModalOpen: hasBlockingModal(),
    })
    if (disposition === 'ignore') return

    event.preventDefault()
    if (disposition === 'reject') {
      event.dataTransfer.dropEffect = 'none'
      resetAssetDrop()
      return
    }

    event.dataTransfer.dropEffect = 'copy'
    setIsAssetDropActive(true)
  }

  function deactivateAssetDrop(event: DragEvent<HTMLElement>) {
    if (!hasDraggedFiles(event)) return

    assetDropDepthRef.current = Math.max(0, assetDropDepthRef.current - 1)
    if (assetDropDepthRef.current === 0) setIsAssetDropActive(false)
  }

  function dropAssets(event: DragEvent<HTMLElement>) {
    const disposition = resolveMessageAssetDropDisposition({
      canAccept: canAcceptDroppedAssets,
      hasFiles: hasDraggedFiles(event),
      isBlockingModalOpen: hasBlockingModal(),
    })
    if (disposition === 'ignore') return

    event.preventDefault()
    resetAssetDrop()
    if (disposition === 'accept') addSelectedFiles(event.dataTransfer.files)
  }

  return {
    isAssetDropActive,
    addSelectedFiles,
    activateAssetDrop,
    deactivateAssetDrop,
    dropAssets,
    keepAssetDropActive,
  }
}
