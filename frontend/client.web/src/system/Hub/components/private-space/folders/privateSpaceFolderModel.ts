import type { PrivateSpaceFolderResponse } from '../../../../../shared/types'

export const privateSpaceFolderNameMaxLength = 12

export function getPrivateSpaceFolderDisplayName(name: string) {
  return name.slice(0, privateSpaceFolderNameMaxLength)
}

export function getPrivateSpaceFolderContext(
  folders: readonly PrivateSpaceFolderResponse[],
  activeFolderId: string,
  spaceId: string,
) {
  const activeFolder =
    folders.find((folder) => folder.id === activeFolderId) ?? null

  return {
    activeFolder,
    addTargets: activeFolder?.isSystem
      ? folders.filter(
          (folder) =>
            !folder.isSystem && !folder.spaceIds.includes(spaceId),
        )
      : [],
  }
}
