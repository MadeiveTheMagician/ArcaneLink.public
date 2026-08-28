import { useEffect, useMemo, useState } from 'react'
import type {
  PermissionResponse,
  ServerMemberDetailsResponse,
  ServerRoleResponse,
  SpacePermissionOverrideResponse,
  SpaceResponse,
  UpsertSpacePermissionOverrideRequest,
} from '../../../../../shared/types'
import { serverCopy } from '../../../../shared/copy'
import buttonStyles from '../../../../shared/styles/Button.module.css'
import { SystemSelect } from '../../../../shared/ui/SystemSelect'
import {
  buildSpacePermissionOverrideRequest,
  type SpacePermissionEffect,
  type SpacePermissionTargetKind,
} from './spacePermissionEditorModel'
import styles from './SpacePermissionEditor.module.css'

type SpacePermissionEditorProps = {
  space: SpaceResponse
  permissions: PermissionResponse[]
  roles: ServerRoleResponse[]
  members: ServerMemberDetailsResponse[]
  isMutating: boolean
  onUpsert: (
    spaceId: string,
    request: UpsertSpacePermissionOverrideRequest,
  ) => Promise<SpacePermissionOverrideResponse | null>
  onDelete: (spaceId: string, overrideId: string) => Promise<boolean>
}

export function SpacePermissionEditor({
  space,
  permissions,
  roles,
  members,
  isMutating,
  onUpsert,
  onDelete,
}: SpacePermissionEditorProps) {
  const administratorRoleIds = useMemo(
    () =>
      new Set(
        roles
          .filter((role) =>
            [...role.permissionCodes, ...role.permissions.map((item) => item.code)]
              .some(isAdministratorPermissionCode),
          )
          .map((role) => role.id),
      ),
    [roles],
  )
  const editableRoles = useMemo(
    () =>
      roles.filter(
        (role) =>
          role.code !== 'owner' &&
          !administratorRoleIds.has(role.id),
      ),
    [administratorRoleIds, roles],
  )
  const editableMembers = useMemo(
    () =>
      members.filter(
        (member) =>
          !member.isOwner &&
          !member.permissionCodes.some(isAdministratorPermissionCode) &&
          !member.roleAssignments.some(
            (assignment) =>
              !assignment.revokedAt &&
              administratorRoleIds.has(assignment.roleId),
          ),
      ),
    [administratorRoleIds, members],
  )
  const [targetKind, setTargetKind] =
    useState<SpacePermissionTargetKind>('role')
  const [targetId, setTargetId] = useState('')
  const [permissionId, setPermissionId] = useState('')
  const [effect, setEffect] = useState<SpacePermissionEffect>('allow')
  const [error, setError] = useState<string | null>(null)

  const availableTargets =
    targetKind === 'role'
      ? editableRoles.map((role) => ({ id: role.id, title: role.title }))
      : editableMembers.map((member) => ({
          id: member.id,
          title: `${member.user.displayName} (@${member.user.login})`,
        }))

  useEffect(() => {
    if (!availableTargets.some((target) => target.id === targetId)) {
      setTargetId(availableTargets[0]?.id ?? '')
    }
  }, [availableTargets, targetId])

  useEffect(() => {
    if (!permissions.some((permission) => permission.id === permissionId)) {
      setPermissionId(permissions[0]?.id ?? '')
    }
  }, [permissionId, permissions])

  const permissionTitleById = useMemo(
    () => new Map(permissions.map((permission) => [permission.id, permission.title])),
    [permissions],
  )
  const roleTitleById = useMemo(
    () => new Map(roles.map((role) => [role.id, role.title])),
    [roles],
  )
  const memberTitleById = useMemo(
    () =>
      new Map(
        members.map((member) => [
          member.id,
          `${member.user.displayName} (@${member.user.login})`,
        ]),
      ),
    [members],
  )
  const sortedOverrides = useMemo(
    () =>
      [...space.permissionOverrides].sort((left, right) =>
        left.permissionCode.localeCompare(right.permissionCode),
      ),
    [space.permissionOverrides],
  )

  async function saveOverride() {
    const request = buildSpacePermissionOverrideRequest(
      targetKind,
      targetId,
      permissionId,
      effect,
    )
    if (!request) {
      return
    }

    setError(null)
    try {
      await onUpsert(space.id, request)
    } catch {
      setError(serverCopy.workspaceDialogs.permissionSaveFailed)
    }
  }

  async function deleteOverride(overrideId: string) {
    setError(null)
    try {
      await onDelete(space.id, overrideId)
    } catch {
      setError(serverCopy.workspaceDialogs.permissionDeleteFailed)
    }
  }

  return (
    <section className={styles.editor} aria-labelledby="space-permissions-title">
      <header className={styles.header}>
        <div>
          <h3 id="space-permissions-title">
            {serverCopy.workspaceDialogs.permissionsTitle}
          </h3>
          <p>{serverCopy.workspaceDialogs.permissionsDescription}</p>
        </div>
      </header>

      <div className={styles.controls}>
        <label>
          <span>{serverCopy.workspaceDialogs.permissionTargetType}</span>
          <SystemSelect
            aria-label={serverCopy.workspaceDialogs.permissionTargetType}
            value={targetKind}
            disabled={isMutating}
            onValueChange={(value) =>
              setTargetKind(value as SpacePermissionTargetKind)
            }
          >
            <option value="role">
              {serverCopy.workspaceDialogs.permissionTargetRole}
            </option>
            <option value="member">
              {serverCopy.workspaceDialogs.permissionTargetMember}
            </option>
          </SystemSelect>
        </label>

        <label>
          <span>{serverCopy.workspaceDialogs.permissionTarget}</span>
          <SystemSelect
            aria-label={serverCopy.workspaceDialogs.permissionTarget}
            value={targetId}
            disabled={isMutating || availableTargets.length === 0}
            onValueChange={setTargetId}
          >
            {availableTargets.length === 0 && (
              <option value="">
                {serverCopy.workspaceDialogs.permissionTargetsEmpty}
              </option>
            )}
            {availableTargets.map((target) => (
              <option key={target.id} value={target.id}>
                {target.title}
              </option>
            ))}
          </SystemSelect>
        </label>

        <label>
          <span>{serverCopy.workspaceDialogs.permission}</span>
          <SystemSelect
            aria-label={serverCopy.workspaceDialogs.permission}
            value={permissionId}
            disabled={isMutating || permissions.length === 0}
            onValueChange={setPermissionId}
          >
            {permissions.map((permission) => (
              <option key={permission.id} value={permission.id}>
                {permission.title}
              </option>
            ))}
          </SystemSelect>
        </label>

        <label>
          <span>{serverCopy.workspaceDialogs.permissionEffect}</span>
          <SystemSelect
            aria-label={serverCopy.workspaceDialogs.permissionEffect}
            value={effect}
            disabled={isMutating}
            onValueChange={(value) =>
              setEffect(value as SpacePermissionEffect)
            }
          >
            <option value="allow">
              {serverCopy.workspaceDialogs.permissionAllow}
            </option>
            <option value="deny">
              {serverCopy.workspaceDialogs.permissionDeny}
            </option>
          </SystemSelect>
        </label>

        <button
          className={`${buttonStyles.button} ${buttonStyles.primary} ${styles.saveButton}`}
          type="button"
          disabled={
            isMutating ||
            !targetId ||
            !permissionId ||
            permissions.length === 0
          }
          onClick={() => void saveOverride()}
        >
          {isMutating
            ? serverCopy.workspaceDialogs.permissionSaving
            : serverCopy.workspaceDialogs.permissionSave}
        </button>
      </div>

      {error && <p className={styles.error}>{error}</p>}

      <div className={styles.overrideList}>
        {sortedOverrides.length === 0 ? (
          <p className={styles.empty}>
            {serverCopy.workspaceDialogs.permissionsEmpty}
          </p>
        ) : (
          sortedOverrides.map((permissionOverride) => {
            const targetTitle = permissionOverride.roleId
              ? roleTitleById.get(permissionOverride.roleId)
              : permissionOverride.memberId
                ? memberTitleById.get(permissionOverride.memberId)
                : null

            return (
              <article className={styles.overrideRow} key={permissionOverride.id}>
                <div>
                  <strong>
                    {permissionTitleById.get(permissionOverride.permissionId) ??
                      permissionOverride.permissionCode}
                  </strong>
                  <span>
                    {targetTitle ??
                      serverCopy.workspaceDialogs.permissionUnknownTarget}
                  </span>
                </div>
                <em
                  className={
                    permissionOverride.deny ? styles.deny : styles.allow
                  }
                >
                  {permissionOverride.deny
                    ? serverCopy.workspaceDialogs.permissionDenied
                    : serverCopy.workspaceDialogs.permissionAllowed}
                </em>
                <button
                  className={`${buttonStyles.button} ${buttonStyles.ghost} ${styles.deleteButton}`}
                  type="button"
                  disabled={isMutating}
                  onClick={() => void deleteOverride(permissionOverride.id)}
                >
                  {serverCopy.workspaceDialogs.permissionDelete}
                </button>
              </article>
            )
          })
        )}
      </div>
    </section>
  )
}

function isAdministratorPermissionCode(code: string) {
  const normalizedCode = code.trim().toUpperCase()
  return (
    normalizedCode === 'ADMINISTRATOR' || normalizedCode === 'MANAGE_SERVER'
  )
}
