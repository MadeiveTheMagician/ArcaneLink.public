import { useLayoutEffect } from 'react'
import type {
  PermissionResponse,
  ServerRoleResponse,
} from '../../../../../shared/types'
import { ServerMemberDisplayColorSettings } from './ServerMemberDisplayColorSettings'
import { ServerRoleEditorDialog } from './ServerRoleEditorDialog'
import { ServerRoleList } from './ServerRoleList'
import { useServerRoleSettings } from './useServerRoleSettings'
import styles from './ServerRolesSettings.module.css'

type ServerRolesSettingsProps = {
  accessToken: string
  serverId: string
  roles: readonly ServerRoleResponse[]
  permissions: readonly PermissionResponse[]
  actorLegacyPermissionCodes: readonly string[]
  isLoading: boolean
  onReloadRoles: () => Promise<readonly ServerRoleResponse[]>
  onReloadMembers: () => Promise<void>
  onDirtyChange: (isDirty: boolean) => void
  onEditorOpenChange: (isOpen: boolean) => void
}

export function ServerRolesSettings({
  accessToken,
  serverId,
  roles,
  permissions,
  actorLegacyPermissionCodes,
  isLoading,
  onReloadRoles,
  onReloadMembers,
  onDirtyChange,
  onEditorOpenChange,
}: ServerRolesSettingsProps) {
  const controller = useServerRoleSettings({
    accessToken,
    serverId,
    roles,
    permissions,
    actorLegacyPermissionCodes,
    onReloadRoles,
    onReloadMembers,
  })

  useLayoutEffect(() => {
    onDirtyChange(controller.isEditorOpen && controller.isDirty)

    return () => onDirtyChange(false)
  }, [controller.isDirty, controller.isEditorOpen, onDirtyChange])

  useLayoutEffect(() => {
    onEditorOpenChange(controller.isEditorOpen)

    return () => onEditorOpenChange(false)
  }, [controller.isEditorOpen, onEditorOpenChange])

  return (
    <section
      className={styles.rolesSettings}
      aria-labelledby="server-roles-title"
      data-server-roles-settings=""
    >
      <header className={styles.rolesHeader}>
        <div>
          <h2 id="server-roles-title">Роли и права</h2>
          <p>
            Управляйте иерархией, внешним видом, правами и прямыми назначениями.
          </p>
        </div>
        <span aria-live="polite">
          {isLoading ? 'Обновляем…' : `${roles.length} ролей`}
        </span>
      </header>

      <ServerMemberDisplayColorSettings
        accessToken={accessToken}
        serverId={serverId}
      />

      <div className={styles.rolesOverview}>
        {!controller.isEditorOpen && controller.error ? (
          <p className={styles.roleStatusError} role="alert">
            {controller.error}
          </p>
        ) : null}
        {!controller.isEditorOpen && controller.notice ? (
          <p className={styles.roleStatusSuccess} role="status">
            {controller.notice}
          </p>
        ) : null}
        <div className={styles.rolesWorkspace} aria-busy={isLoading}>
          <ServerRoleList
            roles={roles}
            selectedRoleId={controller.selectedRoleId}
            query={controller.roleQuery}
            actorLegacyPermissionCodes={actorLegacyPermissionCodes}
            effectivePermissions={controller.effectivePermissions}
            canManageRoles={controller.canManageRolesAccess}
            canCreate={controller.canCreate}
            canReorder={controller.canReorder}
            isMutating={controller.isMutating}
            onQueryChange={controller.setRoleQuery}
            onCreate={controller.startCreating}
            onSelect={controller.selectRole}
            onDuplicate={(role) => void controller.duplicateRole(role)}
            onDelete={(role) => void controller.removeRole(role)}
            onReorder={(nextRoles) => void controller.reorderRoles(nextRoles)}
          />
        </div>
      </div>

      {controller.isEditorOpen ? (
        <ServerRoleEditorDialog
          controller={controller}
          permissions={permissions}
        />
      ) : null}
    </section>
  )
}
