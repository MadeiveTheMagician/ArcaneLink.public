import '@vitejs/plugin-react/preamble'
import { useState, type CSSProperties } from 'react'
import { createRoot } from 'react-dom/client'
import { applySystemThemeToDocument } from '../../src/styles/systemThemes'
import '../../src/styles/global.css'
import '../../src/styles/system-patterns.css'
import type { ServerMemberResponse } from '../../src/shared/types'
import { ServerRail } from '../../src/system/Server/components/navigation/ServerRail'
import type { ServerRailLayout } from '../../src/system/Server/components/navigation/serverRailFolders'
import { ContextMenu, type ContextMenuItem } from '../../src/system/shared/components/context-menu/ContextMenu'

const members = ['Alpha', 'Beta', 'Gamma', 'Delta'].map((title, index) => ({
  server: { title, id: String(index) },
  serverId: String(index),
  id: 'membership-' + index,
  unreadCount: 0,
} as ServerMemberResponse))

function ServerRailHarness() {
  const [columns, setColumns] = useState(2)
  const [layout, setLayout] = useState<ServerRailLayout>(
    members.map(({ serverId }) => ({ kind: 'server', id: serverId })),
  )
  const [menu, setMenu] = useState<{ x: number; y: number; items: ContextMenuItem[] } | null>(null)
  return (
    <main style={{
      '--profile-rail-width': (74.5 + (columns - 1) * 61) + 'px',
      '--profile-rail-server': '43.5px',
      '--profile-rail-button': '48px',
      '--profile-interface-scale': '1',
      '--profile-font-scale': '1',
      paddingLeft: 160,
    } as CSSProperties}>
      <button onClick={() => setColumns(1)}>One column</button>
      <button onClick={() => applySystemThemeToDocument("ivory")}>Light theme</button>
      <output data-testid="layout">{JSON.stringify(layout)}</output>
      <ServerRail
        avatarSrc="/brand/logo-mark.svg"
        isOpen
        isLoadingServers={false}
        memberships={members}
        serverLayout={layout}
        columnCount={columns}
        selectedServerMembers={[]}
        selectedServerVoiceParticipants={[]}
        onOpenProfile={() => undefined}
        onOpenServer={() => undefined}
        onOpenContextMenu={(event, _membership, items = []) => {
          event.preventDefault()
          setMenu({ x: event.clientX, y: event.clientY, items })
        }}
        onServerLayoutChange={setLayout}
        onCreateServer={() => undefined}
        onShowAllServers={() => undefined}
        onShowFriends={() => undefined}
        onShowInvites={() => undefined}
      />
      {menu ? <ContextMenu {...menu} autoFocus onClose={() => setMenu(null)} /> : null}
    </main>
  )
}

applySystemThemeToDocument('sapphire')
createRoot(document.getElementById('root')!).render(<ServerRailHarness />)
