export const blockingModalSelector =
  '[aria-modal="true"]:not([aria-hidden="true"]):not([hidden])'

export type BlockingModalQueryRoot = {
  querySelector: (selector: string) => unknown
}

export function hasOpenBlockingModal(
  root: BlockingModalQueryRoot | null | undefined,
) {
  return Boolean(root?.querySelector(blockingModalSelector))
}

export type MessageAssetDropDisposition = 'accept' | 'ignore' | 'reject'

export function resolveMessageAssetDropDisposition({
  canAccept,
  hasFiles,
  isBlockingModalOpen,
}: {
  canAccept: boolean
  hasFiles: boolean
  isBlockingModalOpen: boolean
}): MessageAssetDropDisposition {
  if (!hasFiles) return 'ignore'
  if (!canAccept || isBlockingModalOpen) return 'reject'
  return 'accept'
}
