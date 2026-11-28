import '@vitejs/plugin-react/preamble'
import { StrictMode, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import '../../src/styles/global.css'
import '../../src/styles/system-patterns.css'
import type { SpaceMessageResponse } from '../../src/shared/types'
import { ServerMessagePanel } from '../../src/system/Server/components/messages/ServerMessagePanel'
import { SystemTooltipProvider } from '../../src/system/shared/ui/SystemTooltipProvider'

const message: SpaceMessageResponse = {
  id: 'original', serverId: 'server', spaceId: 'one', senderUserId: 'alice', senderDisplayName: 'Alice',
  senderAvatarAssetId: null, senderAvatarCropOffsetX: 0, senderAvatarCropOffsetY: 0, senderAvatarCropZoom: 1,
  messageTypeId: 'text', messageTypeCode: 'text', body: 'Original message', payload: null,
  replyToMessageId: null, createdAt: '2026-11-25T10:00:00Z', updatedAt: '2026-11-25T10:00:00Z',
  editedAt: null, deletedAt: null, assets: [], reactions: [],
}

function Harness() {
  const [feed, setFeed] = useState('one')
  const [user, setUser] = useState('alice')
  const [mode, setMode] = useState('success')
  const pending = useRef<(() => void) | null>(null)
  return <SystemTooltipProvider><main>
    <button onClick={() => setFeed((value) => value === 'one' ? 'two' : 'one')}>Switch chat</button>
    <button onClick={() => setUser((value) => value === 'alice' ? 'bob' : 'alice')}>Switch user</button>
    <button onClick={() => setMode('fail')}>Fail sends</button>
    <button onClick={() => setMode('delay')}>Delay sends</button>
    <button onClick={() => { pending.current?.(); pending.current = null }}>Finish send</button>
    <output data-testid="identity">{user}:{feed}</output>
    <ServerMessagePanel
      key={`${user}:${feed}`} currentUserId={user} feedKey={feed} title={`Chat ${feed}`}
      canManageMessages canSendMessages mentionUsers={[]} mentionRoles={[]}
      messages={[message]} pinnedMessages={[]} isLoading={false} isLoadingPinnedMessages={false}
      isSending={false} error={null}
      onSendMessage={async (body) => {
        if (mode === 'fail') return null
        if (mode === 'delay') await new Promise<void>((resolve) => { pending.current = resolve })
        return { ...message, id: 'sent', body }
      }}
      onUpdateMessage={async (_id, request) => ({ ...message, body: request.body ?? null })}
      onDeleteMessage={async () => true} onPinMessage={async () => message}
      onUnpinMessage={async () => true} onSetMessageReaction={async () => message}
    />
  </main></SystemTooltipProvider>
}

createRoot(document.getElementById('root')!).render(<StrictMode><Harness /></StrictMode>)
