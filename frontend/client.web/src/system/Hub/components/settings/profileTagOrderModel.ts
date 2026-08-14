import type { ProfileTagResponse } from '../../../../shared/types'

export function orderProfileTagsBySelection(
  tags: ProfileTagResponse[],
  selectedTagIds: string[],
) {
  const selected = new Set(selectedTagIds)
  return [
    ...tags.filter((tag) => selected.has(tag.id)),
    ...tags.filter((tag) => !selected.has(tag.id)),
  ]
}
