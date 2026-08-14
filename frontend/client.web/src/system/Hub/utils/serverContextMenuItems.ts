import type { ServerMemberResponse } from '../../../shared/types'
import type {
  ServerSettingsAccess,
  ServerSettingsSection,
} from '../../Server/components/dialogs/ServerDialog'
import type { ContextMenuItem } from '../../shared/components/context-menu/contextMenuTypes'
import { serverCopy } from '../../shared/copy/server.ru'

type BuildServerContextMenuItemsOptions = {
  membership: ServerMemberResponse | null
  currentUserId: string
  onOpenServerSettings: (
    membership: ServerMemberResponse,
    section: ServerSettingsSection,
    access: ServerSettingsAccess,
  ) => void
  canManageServerProfile?: boolean
  canManageServerSettings?: boolean
  onLeaveServer: () => Promise<void> | void
  onCopyServerId?: (serverId: string) => void
}

export function buildServerContextMenuItems({
  membership,
  currentUserId,
  onOpenServerSettings,
  canManageServerProfile = false,
  canManageServerSettings = false,
  onLeaveServer,
  onCopyServerId = (serverId) => {
    void navigator.clipboard?.writeText(serverId)
  },
}: BuildServerContextMenuItemsOptions): ContextMenuItem[] {
  if (!membership) {
    return []
  }

  const copyServerId = () => onCopyServerId(membership.server.id)
  const isOwner = membership.server.ownerUserId === currentUserId
  const settingsAccess: ServerSettingsAccess = {
    canManageProfile: isOwner || canManageServerProfile,
    canManageSettings: isOwner || canManageServerSettings,
    canDelete: isOwner,
  }
  const canOpenServerSettings =
    settingsAccess.canManageProfile || settingsAccess.canManageSettings

  if (!canOpenServerSettings) {
    return [
      {
        type: 'item',
        label: serverCopy.context.copyId,
        icon: 'copy',
        onSelect: copyServerId,
      },
      { type: 'separator' },
      {
        type: 'item',
        label: serverCopy.context.leaveServer,
        icon: 'leave',
        danger: true,
        onSelect: () => void onLeaveServer(),
      },
    ]
  }

  return [
    {
      type: 'item',
      label: serverCopy.context.serverSettings,
      icon: 'settings',
      onSelect: () => onOpenServerSettings(membership, 'all', settingsAccess),
      submenu: [
        {
          type: 'item',
          label: serverCopy.context.editServer,
          icon: 'edit',
          onSelect: () =>
            onOpenServerSettings(membership, 'edit', settingsAccess),
        },
        ...(isOwner ? [{
          type: 'item' as const,
          label: serverCopy.context.deleteServer,
          icon: 'trash' as const,
          danger: true,
          onSelect: () =>
            onOpenServerSettings(membership, 'delete', settingsAccess),
        }] : []),
      ],
    },
    {
      type: 'item',
      label: serverCopy.context.copyId,
      icon: 'copy',
      onSelect: copyServerId,
    },
    ...(isOwner
      ? ([
          { type: 'separator' },
          {
            type: 'item',
            label: serverCopy.context.deleteServer,
            icon: 'trash',
            danger: true,
            onSelect: () =>
              onOpenServerSettings(membership, 'delete', settingsAccess),
          },
        ] satisfies ContextMenuItem[])
      : [
          { type: 'separator' as const },
          {
            type: 'item' as const,
            label: serverCopy.context.leaveServer,
            icon: 'leave' as const,
            danger: true,
            onSelect: () => void onLeaveServer(),
          },
        ]),
  ]
}
