import type { ServerMemberResponse } from '../../../shared/types';
import type { ContextMenuItem } from '../../shared/components/context-menu/contextMenuTypes';
import { serverCopy } from '../../shared/copy/server.ru';

type BuildServerContextMenuItemsOptions = {
  membership: ServerMemberResponse | null;
  currentUserId: string;
  onOpenServerSettings: (membership: ServerMemberResponse) => void;
  canOpenFullServerSettings?: boolean;
  onLeaveServer: () => Promise<void> | void;
  onCopyServerId?: (serverId: string) => void;
};

export function buildServerContextMenuItems({
  membership,
  currentUserId,
  onOpenServerSettings,
  canOpenFullServerSettings = false,
  onLeaveServer,
  onCopyServerId = (serverId) => {
    void navigator.clipboard?.writeText(serverId);
  }
}: BuildServerContextMenuItemsOptions): ContextMenuItem[] {
  if (!membership) {
    return [];
  }

  const copyServerId = () => onCopyServerId(membership.server.id);
  const isOwner = membership.server.ownerUserId === currentUserId;
  const canOpenServerSettings = isOwner || canOpenFullServerSettings;

  if (!canOpenServerSettings) {
    return [
      {
        type: 'item',
        label: serverCopy.context.copyId,
        icon: 'copy',
        onSelect: copyServerId
      },
      { type: 'separator' },
      {
        type: 'item',
        label: serverCopy.context.leaveServer,
        icon: 'leave',
        danger: true,
        onSelect: () => void onLeaveServer()
      }
    ];
  }

  return [
    {
      type: 'item',
      label: serverCopy.context.serverSettings,
      icon: 'settings',
      onSelect: () => onOpenServerSettings(membership)
    },
    {
      type: 'item',
      label: serverCopy.context.copyId,
      icon: 'copy',
      onSelect: copyServerId
    },
    ...(!isOwner
      ? [
          { type: 'separator' as const },
          {
            type: 'item' as const,
            label: serverCopy.context.leaveServer,
            icon: 'leave' as const,
            danger: true,
            onSelect: () => void onLeaveServer()
          }
        ]
      : [])
  ];
}
