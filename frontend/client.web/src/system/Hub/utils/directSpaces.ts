import { directSpacesCopy } from './directSpaces.copy'

export type DirectSpace = {
  id: string
  name: string
  preview: string
  time: string
  status?: 'online' | 'idle' | 'offline'
}

export const directSpaces: DirectSpace[] = [
  {
    id: 'nyx',
    name: 'Nyx',
    preview: directSpacesCopy.previews.greeting,
    time: '13:42',
    status: 'online',
  },
  {
    id: 'selene',
    name: 'Selene',
    preview: directSpacesCopy.previews.callLater,
    time: '11:08',
    status: 'idle',
  },
  {
    id: 'ghostcore',
    name: 'GhostCore',
    preview: directSpacesCopy.previews.filesSent,
    time: directSpacesCopy.time.yesterday,
    status: 'offline',
  },
  {
    id: 'echo',
    name: 'Echo',
    preview: directSpacesCopy.previews.thanks,
    time: directSpacesCopy.time.yesterday,
    status: 'online',
  },
  {
    id: 'kairos',
    name: 'Kairos',
    preview: directSpacesCopy.previews.seeYou,
    time: directSpacesCopy.time.daysAgo2,
    status: 'offline',
  },
]

export function getDirectSpaceName(spaceId: string | null) {
  return directSpaces.find((space) => space.id === spaceId)?.name ?? directSpacesCopy.fallbackName
}
