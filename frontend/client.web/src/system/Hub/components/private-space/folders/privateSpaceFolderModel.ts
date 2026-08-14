export const privateSpaceFolderNameMaxLength = 12

export function getPrivateSpaceFolderDisplayName(name: string) {
  return name.slice(0, privateSpaceFolderNameMaxLength)
}
