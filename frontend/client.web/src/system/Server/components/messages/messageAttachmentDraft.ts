export type MessageAttachmentDraft = {
  id: string
  file: File
  displayName: string
  isSpoiler: boolean
}

export function createMessageAttachmentDraft(file: File): MessageAttachmentDraft {
  return {
    id: crypto.randomUUID(),
    file,
    displayName: file.name,
    isSpoiler: false,
  }
}
