import { useMemo, useState } from 'react'
import type {
  PermissionResponse,
  ServerRoleDeletionImpactResponse,
} from '../../../../../shared/types'
import {
  SystemButton,
  SystemCheckbox,
  SystemIcon,
  SystemSearchInput,
  SystemTabPanel,
  SystemTabs,
} from '../../../../shared'
import {
  groupServerRolePermissions,
  hasAdministratorPermission,
  isAdministratorPermissionCode,
  isAdministratorServerRole,
  serverPermissionCodesEqual,
  type ServerRoleEditorTab,
} from './serverRoleSettingsModel'
import type { ServerRoleSettingsController } from './useServerRoleSettings'
import styles from './ServerRolesSettings.module.css'

type ServerRoleEditorProps = {
  controller: ServerRoleSettingsController
  permissions: readonly PermissionResponse[]
}

const editorTabs = [
  { value: 'appearance', label: 'Отображение' },
  { value: 'permissions', label: 'Права' },
  { value: 'members', label: 'Участники' },
] as const

const roleColorPresets = [
  '#8f7cff',
  '#4ca7ff',
  '#42d4a7',
  '#f0c55e',
  '#ff8f9a',
  '#d08cff',
] as const

export function ServerRoleEditor({
  controller,
  permissions,
}: ServerRoleEditorProps) {
  const [permissionQuery, setPermissionQuery] = useState('')
  const {
    selectedRole,
    isCreating,
    activeTab,
    draft,
    memberQuery,
    members,
    memberTotalCount,
    effectivePermissions,
    deletionImpact,
    roleConflict,
    management,
    assignmentManagement,
    isDirty,
    canEditSelected,
    availablePermissionCodes,
    isLoadingContext,
    isLoadingMembers,
    isResolvingConflict,
    isMutating,
    error,
    notice,
    setActiveTab,
    setMemberQuery,
    updateDraft,
    loadServerRoleVersion,
    retryRoleConflictReload,
    resetDraft,
    togglePermission,
    saveRole,
    toggleMemberRole,
  } = controller

  const permissionGroups = useMemo(() => {
    const normalizedQuery = permissionQuery.trim().toLocaleLowerCase('ru-RU')
    const visiblePermissions = normalizedQuery
      ? permissions.filter((permission) =>
          [
            permission.title,
            permission.code,
            permission.description ?? '',
          ].some((value) =>
            value.toLocaleLowerCase('ru-RU').includes(normalizedQuery),
          ),
        )
      : permissions

    return groupServerRolePermissions(visiblePermissions)
  }, [permissionQuery, permissions])

  if (!selectedRole && !isCreating) {
    return (
      <section className={styles.roleEditorEmpty}>
        <SystemIcon name="lock" size="large" />
        <h3>Выберите роль</h3>
        <p>Настройки выбранной роли появятся здесь.</p>
      </section>
    )
  }

  const isDefaultRole = selectedRole?.kind === 'everyone'
  const isSystemRole = Boolean(selectedRole?.isSystem && !isDefaultRole)
  const isAdministrator = selectedRole
    ? isAdministratorServerRole(selectedRole)
    : hasAdministratorPermission(draft.permissionCodes)
  const editorTitle = isCreating ? 'Новая роль' : selectedRole?.title ?? 'Роль'
  const tabs = editorTabs.map((tab) => ({
    ...tab,
    disabled:
      (tab.value === 'appearance' && isDefaultRole) ||
      (tab.value === 'members' && (isCreating || isSystemRole || isDefaultRole)),
  }))

  return (
    <section className={styles.roleEditor} aria-labelledby="server-role-editor-title">
      <header className={styles.roleEditorHeader}>
        <div>
          <span className={styles.roleEditorEyebrow}>
            {isCreating
              ? 'Безопасный черновик без прав'
              : isDefaultRole
                ? 'Права по умолчанию для всех участников'
                : isSystemRole
                ? 'Системная роль · только чтение'
                : isAdministrator
                  ? 'Административная роль'
                  : 'Пользовательская роль'}
          </span>
          <h3 id="server-role-editor-title">{editorTitle}</h3>
        </div>
        <div className={styles.roleEditorActions}>
          <SystemButton
            variant="ghost"
            size="small"
            disabled={
              (!isDirty && !isCreating) ||
              isMutating ||
              isResolvingConflict
            }
            onClick={resetDraft}
          >
            Отменить
          </SystemButton>
          <SystemButton
            size="small"
            disabled={
              !canEditSelected ||
              !isDirty ||
              isMutating ||
              isLoadingContext ||
              isResolvingConflict
            }
            aria-busy={isMutating}
            onClick={() => void saveRole()}
          >
            {isMutating ? 'Сохраняем…' : 'Сохранить'}
          </SystemButton>
        </div>
      </header>

      {error ? (
        <div
          className={`${styles.roleStatusError} ${
            roleConflict || isResolvingConflict
              ? styles.roleConflictStatus
              : ''
          }`}
          role="alert"
        >
          <span>{error}</span>
          {roleConflict ? (
            <SystemButton
              size="small"
              variant="ghost"
              onClick={loadServerRoleVersion}
            >
              {roleConflict.kind === 'deleted'
                ? 'Выбрать актуальную роль'
                : 'Загрузить версию сервера'}
            </SystemButton>
          ) : isResolvingConflict ? (
            <SystemButton
              size="small"
              variant="ghost"
              disabled={isMutating}
              onClick={() => void retryRoleConflictReload()}
            >
              Повторить загрузку
            </SystemButton>
          ) : null}
        </div>
      ) : null}
      {notice ? (
        <p className={styles.roleStatusSuccess} role="status">
          {notice}
        </p>
      ) : null}
      {!isCreating && management && !management.allowed ? (
        <p className={styles.roleLockedNotice}>
          <SystemIcon name="lock" size={15} />
          {getManagementReason(management.reason)}
        </p>
      ) : null}
      {deletionImpact ? (
        <RoleDeletionImpact impact={deletionImpact} />
      ) : null}

      <SystemTabs
        className={styles.roleEditorTabs}
        idBase="server-role-editor"
        label="Разделы редактора роли"
        value={activeTab}
        options={tabs}
        onChange={(value) => setActiveTab(value as ServerRoleEditorTab)}
      />

      {activeTab === 'appearance' ? (
        <SystemTabPanel
          className={styles.roleEditorPanel}
          idBase="server-role-editor"
          value="appearance"
        >
          <AppearanceEditor
            title={draft.title}
            description={draft.description}
            color={draft.color}
            mentionable={draft.mentionable}
            disabled={!canEditSelected || isMutating}
            onChange={updateDraft}
          />
        </SystemTabPanel>
      ) : null}

      {activeTab === 'permissions' ? (
        <SystemTabPanel
          className={styles.roleEditorPanel}
          idBase="server-role-editor"
          value="permissions"
        >
          <div className={styles.permissionToolbar}>
            <SystemSearchInput
              aria-label="Поиск прав"
              placeholder="Найти право"
              value={permissionQuery}
              onChange={(event) =>
                setPermissionQuery(event.currentTarget.value)
              }
            />
            <span>{draft.permissionCodes.length} выбрано</span>
          </div>
          {hasAdministratorPermission(draft.permissionCodes) ? (
            <p className={styles.administratorWarning} role="note">
              <SystemIcon name="flag" size={16} />
              ADMINISTRATOR динамически предоставляет все текущие и будущие права.
              Остальные переключатели отключены.
              {selectedRole?.directAssignmentCount
                ? ` Изменение затронет ${selectedRole.directAssignmentCount} участника(ов).`
                : ''}
            </p>
          ) : null}
          <div className={`${styles.permissionGroups} ui-scroll-list`}>
            {permissionGroups.map((group) => (
              <section className={styles.permissionGroup} key={group.id}>
                <h4>{group.title}</h4>
                <div>
                  {group.permissions.map((permission) => {
                    const checked = draft.permissionCodes.some((code) =>
                      serverPermissionCodesEqual(code, permission.code),
                    )
                    const disabled =
                      !canEditSelected ||
                      isMutating ||
                      !availablePermissionCodes.has(permission.code) ||
                      (hasAdministratorPermission(draft.permissionCodes) &&
                        !isAdministratorPermissionCode(permission.code))

                    return (
                      <button
                        className={styles.permissionToggle}
                        key={permission.id}
                        type="button"
                        role="switch"
                        aria-checked={checked}
                        disabled={disabled}
                        onClick={() =>
                          togglePermission(permission.code, !checked)
                        }
                      >
                        <span className={styles.permissionToggleCopy}>
                          <strong>{permission.title}</strong>
                          <small>
                            {permission.description ?? permission.code}
                          </small>
                        </span>
                        <span
                          className={styles.permissionSwitch}
                          aria-hidden="true"
                        >
                          <span className={styles.permissionSwitchThumb} />
                        </span>
                      </button>
                    )
                  })}
                </div>
              </section>
            ))}
            {permissionGroups.length === 0 ? (
              <p className="ui-empty-state">Права по запросу не найдены.</p>
            ) : null}
          </div>
        </SystemTabPanel>
      ) : null}

      {activeTab === 'members' && selectedRole && !isSystemRole ? (
        <SystemTabPanel
          className={styles.roleEditorPanel}
          idBase="server-role-editor"
          value="members"
        >
          <div className={styles.memberToolbar}>
            <SystemSearchInput
              aria-label="Поиск участников для роли"
              placeholder="Найти участника"
              value={memberQuery}
              onChange={(event) => setMemberQuery(event.currentTarget.value)}
            />
            <span>
              {memberQuery.trim()
                ? `${memberTotalCount} найдено`
                : `${selectedRole.directAssignmentCount} назначений`}
            </span>
          </div>
          {isLoadingMembers ? (
            <p className="ui-empty-state">Загружаем участников…</p>
          ) : members.length === 0 ? (
            <p className="ui-empty-state">
              {memberQuery.trim()
                ? 'Участники по запросу не найдены.'
                : 'Роль пока никому не назначена.'}
            </p>
          ) : (
            <div className={`${styles.memberList} ui-scroll-list`}>
              {members.map((member) => {
                const assignment = member.roleAssignments.find(
                  (candidate) =>
                    candidate.roleId === selectedRole.id &&
                    !candidate.revokedAt,
                )

                return (
                  <article className={styles.memberRow} key={member.id}>
                    <span className={styles.memberAvatar} aria-hidden="true">
                      {member.user.avatarAssetId ? (
                        <img
                          src={`/api/assets/${member.user.avatarAssetId}/content`}
                          alt=""
                        />
                      ) : (
                        member.user.displayName.slice(0, 1).toUpperCase()
                      )}
                    </span>
                    <div>
                      <strong>{member.user.displayName}</strong>
                      <small>@{member.user.login}</small>
                    </div>
                    <SystemButton
                      size="small"
                      variant={assignment ? 'ghost' : 'primary'}
                      disabled={
                        !assignmentManagement?.allowed ||
                        isMutating ||
                        member.isOwner ||
                        member.id === effectivePermissions?.memberId
                      }
                      title={
                        member.isOwner
                          ? 'Роль владельца меняется только системными операциями.'
                          : undefined
                      }
                      onClick={() => void toggleMemberRole(member)}
                    >
                      {assignment ? 'Снять' : 'Назначить'}
                    </SystemButton>
                  </article>
                )
              })}
            </div>
          )}
        </SystemTabPanel>
      ) : null}
    </section>
  )
}

function AppearanceEditor({
  title,
  description,
  color,
  mentionable,
  disabled,
  onChange,
}: {
  title: string
  description: string
  color: string
  mentionable: boolean
  disabled: boolean
  onChange: (patch: {
    title?: string
    description?: string
    color?: string
    mentionable?: boolean
  }) => void
}) {
  const previewColor = /^#[0-9a-f]{6}([0-9a-f]{2})?$/i.test(color)
    ? color
    : undefined

  return (
    <div className={styles.appearanceEditor}>
      <label className={styles.field}>
        <span>Название</span>
        <input
          className="ui-field-control"
          value={title}
          maxLength={64}
          disabled={disabled}
          onChange={(event) => onChange({ title: event.currentTarget.value })}
        />
        <small>{title.length}/64</small>
      </label>
      <label className={styles.field}>
        <span>Описание</span>
        <textarea
          className="ui-field-control"
          value={description}
          maxLength={255}
          disabled={disabled}
          onChange={(event) =>
            onChange({ description: event.currentTarget.value })
          }
        />
        <small>{description.length}/255</small>
      </label>
      <fieldset className={styles.colorPicker} disabled={disabled}>
        <legend>Цвет роли</legend>
        <div className={styles.colorControls}>
          <span
            className={styles.colorPreview}
            style={{ backgroundColor: previewColor ?? 'transparent' }}
            data-empty={!previewColor || undefined}
            aria-hidden="true"
          />
          <input
            className="ui-field-control"
            value={color}
            placeholder="#8f7cff или без цвета"
            pattern="^#[0-9a-fA-F]{6}([0-9a-fA-F]{2})?$"
            aria-label="Цвет роли"
            onChange={(event) => onChange({ color: event.currentTarget.value })}
          />
          <SystemButton
            size="small"
            variant="ghost"
            disabled={disabled || !color}
            onClick={() => onChange({ color: '' })}
          >
            Без цвета
          </SystemButton>
        </div>
        <div className={styles.colorPresets}>
          {roleColorPresets.map((preset) => (
            <button
              key={preset}
              type="button"
              aria-label={`Выбрать цвет ${preset}`}
              aria-pressed={color.toLowerCase() === preset}
              style={{ backgroundColor: preset }}
              onClick={() => onChange({ color: preset })}
            />
          ))}
        </div>
      </fieldset>
      <SystemCheckbox
        checked={mentionable}
        disabled={disabled}
        onChange={(event) =>
          onChange({ mentionable: event.currentTarget.checked })
        }
      >
        Разрешить участникам упоминать эту роль
      </SystemCheckbox>
      <section className={styles.rolePreview}>
        <h4>Предпросмотр</h4>
        <div className={styles.rolePreviewCards}>
          <span className={styles.rolePreviewLight}>
            <strong style={{ color: previewColor }}>Arcane User</strong>
            <small>{title || 'Новая роль'} · светлый фон</small>
          </span>
          <span className={styles.rolePreviewDark}>
            <strong style={{ color: previewColor }}>Arcane User</strong>
            <small>{title || 'Новая роль'} · тёмный фон</small>
          </span>
        </div>
      </section>
    </div>
  )
}

function RoleDeletionImpact({
  impact,
}: {
  impact: ServerRoleDeletionImpactResponse
}) {
  const dependencies = [
    ['Назначения', impact.directAssignmentCount],
    ['ACL роли', impact.roleAclCount],
    ['Защищённые ACL', impact.protectedAclCount],
    ['Обязательные спейсы', impact.requiredSpaceCount],
    ['Защищённые спейсы', impact.protectedSpaceCount],
    ['Настройки цвета', impact.displayColorMemberCount],
  ] as const

  return (
    <aside className={styles.deletionImpact} role="status">
      <strong>
        {impact.canDelete
          ? 'Роль можно удалить'
          : 'Удаление заблокировано зависимостями'}
      </strong>
      <span>
        {dependencies
          .filter(([, count]) => count > 0)
          .map(([label, count]) => `${label}: ${count}`)
          .join(' · ') || 'Блокирующих зависимостей нет.'}
      </span>
    </aside>
  )
}

function getManagementReason(
  reason: NonNullable<ServerRoleSettingsController['management']>['reason'],
) {
  switch (reason) {
    case 'system':
      return 'Системная роль доступна только для просмотра.'
    case 'administrator':
      return 'Административную роль может изменять только владелец сервера.'
    case 'hierarchy':
      return 'Эта роль находится на вашем уровне или выше.'
    case 'permission-subset':
      return 'Роль содержит права, которых нет у вас.'
    case 'missing-permission':
      return 'У вас нет права управлять ролями.'
    default:
      return 'Роль доступна для изменения.'
  }
}
