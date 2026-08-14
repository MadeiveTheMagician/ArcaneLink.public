import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  useDraggable,
  useDroppable,
  type DragEndEvent,
} from '@dnd-kit/core'
import { useCallback, useState, type CSSProperties } from 'react'
import type {
  ServerEffectivePermissionsResponse,
  ServerRoleResponse,
} from '../../../../../shared/types'
import {
  ContextMenu,
  SystemButton,
  SystemIcon,
  SystemSearchInput,
} from '../../../../shared'
import type { ContextMenuItem } from '../../../../shared/components/context-menu/ContextMenu'
import {
  filterServerRoles,
  partitionServerRoles,
  reorderServerRolesWithinTier,
  resolveServerRoleManagement,
} from './serverRoleSettingsModel'
import styles from './ServerRolesSettings.module.css'

type ServerRoleListProps = {
  roles: readonly ServerRoleResponse[]
  selectedRoleId: string | null
  query: string
  actorLegacyPermissionCodes: readonly string[]
  effectivePermissions: ServerEffectivePermissionsResponse | null
  canManageRoles: boolean
  canCreate: boolean
  canReorder: boolean
  isMutating: boolean
  onQueryChange: (value: string) => void
  onCreate: () => void
  onSelect: (roleId: string) => void
  onDuplicate: (role: ServerRoleResponse) => void
  onDelete: (role: ServerRoleResponse) => void
  onReorder: (roles: readonly ServerRoleResponse[]) => void
}

type RoleMenuState = {
  role: ServerRoleResponse
  x: number
  y: number
}

const roleDndAccessibility = {
  screenReaderInstructions: {
    draggable:
      'Используйте стрелки вверх и вниз на кнопке перемещения. Указатель можно использовать для перетаскивания роли.',
  },
}

export function ServerRoleList({
  roles,
  selectedRoleId,
  query,
  actorLegacyPermissionCodes,
  effectivePermissions,
  canManageRoles,
  canCreate,
  canReorder,
  isMutating,
  onQueryChange,
  onCreate,
  onSelect,
  onDuplicate,
  onDelete,
  onReorder,
}: ServerRoleListProps) {
  const [menu, setMenu] = useState<RoleMenuState | null>(null)
  const [reorderAnnouncement, setReorderAnnouncement] = useState('')
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 6 },
    }),
  )
  const visibleRoles = filterServerRoles(roles, query)
  const partition = partitionServerRoles(visibleRoles)
  const fullPartition = partitionServerRoles(roles)
  const hasSearch = Boolean(query.trim())

  function handleDragEnd(event: DragEndEvent) {
    if (!canReorder || !event.over || event.active.id === event.over.id) {
      return
    }

    const activeId = String(event.active.id)
    const overId = String(event.over.id)
    const activeIsAdministrator = fullPartition.administratorRoles.some(
      (role) => role.id === activeId,
    )
    const overIsAdministrator = fullPartition.administratorRoles.some(
      (role) => role.id === overId,
    )
    if (activeIsAdministrator !== overIsAdministrator) {
      return
    }

    const administratorRoles = activeIsAdministrator
      ? reorderServerRolesWithinTier(
          fullPartition.administratorRoles,
          activeId,
          overId,
        )
      : fullPartition.administratorRoles
    const standardRoles = activeIsAdministrator
      ? fullPartition.standardRoles
      : reorderServerRolesWithinTier(
          fullPartition.standardRoles,
          activeId,
          overId,
        )

    onReorder([...administratorRoles, ...standardRoles])
  }

  function moveRoleByKeyboard(
    roleId: string,
    direction: -1 | 1,
  ) {
    if (!canReorder) {
      return
    }

    const isAdministrator = fullPartition.administratorRoles.some(
      (role) => role.id === roleId,
    )
    const tier = isAdministrator
      ? fullPartition.administratorRoles
      : fullPartition.standardRoles
    const currentIndex = tier.findIndex((role) => role.id === roleId)
    const targetRole = tier[currentIndex + direction]
    const currentRole = tier[currentIndex]
    if (currentIndex < 0 || !currentRole || !targetRole) {
      return
    }

    const nextTier = reorderServerRolesWithinTier(
      tier,
      roleId,
      targetRole.id,
    )
    onReorder(
      isAdministrator
        ? [...nextTier, ...fullPartition.standardRoles]
        : [...fullPartition.administratorRoles, ...nextTier],
    )
    setReorderAnnouncement(
      `Роль ${currentRole.title} перемещена на позицию ${currentIndex + direction + 1} из ${tier.length}.`,
    )
  }

  function openRoleMenu(
    role: ServerRoleResponse,
    trigger: HTMLButtonElement,
  ) {
    const bounds = trigger.getBoundingClientRect()
    setMenu({
      role,
      x: Math.min(bounds.right, window.innerWidth - 12),
      y: Math.min(bounds.bottom + 4, window.innerHeight - 12),
    })
  }

  function getRoleMenuItems(role: ServerRoleResponse): ContextMenuItem[] {
    const decision = resolveServerRoleManagement(
      role,
      effectivePermissions,
      actorLegacyPermissionCodes,
      canManageRoles,
    )
    const lockedHint = getRoleManagementReason(decision.reason)

    return [
      {
        type: 'item',
        icon: 'edit',
        label: 'Открыть редактор',
        onSelect: () => onSelect(role.id),
      },
      {
        type: 'item',
        icon: 'copy',
        label: 'Дублировать',
        disabled: !decision.allowed || isMutating,
        hint: decision.allowed ? undefined : lockedHint,
        onSelect: () => onDuplicate(role),
      },
      {
        type: 'item',
        icon: 'copy',
        label: 'Копировать ID роли',
        onSelect: () => void navigator.clipboard.writeText(role.id),
      },
      { type: 'separator' },
      {
        type: 'item',
        icon: 'trash',
        label: 'Удалить роль',
        danger: true,
        disabled: !decision.allowed || isMutating,
        hint: decision.allowed ? undefined : lockedHint,
        onSelect: () => onDelete(role),
      },
    ]
  }

  return (
    <aside className={styles.roleListPane} aria-label="Роли сервера">
      <div className={styles.roleListToolbar}>
        <SystemSearchInput
          aria-label="Поиск ролей"
          placeholder="Найти роль или право"
          value={query}
          onChange={(event) => onQueryChange(event.currentTarget.value)}
        />
        <SystemButton
          size="small"
          disabled={!canCreate || isMutating}
          onClick={onCreate}
        >
          <SystemIcon name="plus" size={15} />
          Создать
        </SystemButton>
      </div>

      {hasSearch ? (
        <p className={styles.reorderNotice}>
          Сортировка отключена во время поиска.
        </p>
      ) : null}

      <div className={`${styles.roleListScroll} ui-scroll-list`}>
        <section className={styles.defaultRoleSection}>
          <h3>Права по умолчанию</h3>
          {partition.defaultRole ? (
            <StaticRoleRow
              role={partition.defaultRole}
              isSelected={selectedRoleId === partition.defaultRole.id}
              onSelect={onSelect}
              onOpenMenu={openRoleMenu}
            />
          ) : (
            <div className={styles.defaultRolePlaceholder} aria-disabled="true">
              <SystemIcon name="lock" size={17} />
              <div>
                <strong>Все участники</strong>
                <small>Будет доступно после включения v1 permission storage</small>
              </div>
            </div>
          )}
        </section>

        {visibleRoles.length === 0 ? (
          <p className="ui-empty-state">Роли по запросу не найдены.</p>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            accessibility={roleDndAccessibility}
            onDragEnd={handleDragEnd}
          >
            <RoleTierSection
              title="Административные роли"
              roles={partition.administratorRoles}
              selectedRoleId={selectedRoleId}
              canReorder={canReorder}
              isMutating={isMutating}
              onSelect={onSelect}
              onOpenMenu={openRoleMenu}
              onMove={moveRoleByKeyboard}
            />
            <RoleTierSection
              title="Обычные роли"
              roles={partition.standardRoles}
              selectedRoleId={selectedRoleId}
              canReorder={canReorder}
              isMutating={isMutating}
              onSelect={onSelect}
              onOpenMenu={openRoleMenu}
              onMove={moveRoleByKeyboard}
            />
          </DndContext>
        )}

        {partition.systemRoles.length > 0 ? (
          <section className={styles.roleTier}>
            <h3>Системные роли</h3>
            <div className={styles.roleTierList}>
              {partition.systemRoles.map((role) => (
                <StaticRoleRow
                  key={role.id}
                  role={role}
                  isSelected={selectedRoleId === role.id}
                  onSelect={onSelect}
                  onOpenMenu={openRoleMenu}
                />
              ))}
            </div>
          </section>
        ) : null}
      </div>

      <span
        className={styles.visuallyHidden}
        role="status"
        aria-live="polite"
        aria-atomic="true"
      >
        {reorderAnnouncement}
      </span>

      {menu ? (
        <ContextMenu
          x={menu.x}
          y={menu.y}
          items={getRoleMenuItems(menu.role)}
          autoFocus
          onClose={() => setMenu(null)}
        />
      ) : null}
    </aside>
  )
}

function RoleTierSection({
  title,
  roles,
  selectedRoleId,
  canReorder,
  isMutating,
  onSelect,
  onOpenMenu,
  onMove,
}: {
  title: string
  roles: readonly ServerRoleResponse[]
  selectedRoleId: string | null
  canReorder: boolean
  isMutating: boolean
  onSelect: (roleId: string) => void
  onOpenMenu: (role: ServerRoleResponse, trigger: HTMLButtonElement) => void
  onMove: (roleId: string, direction: -1 | 1) => void
}) {
  if (roles.length === 0) {
    return null
  }

  return (
    <section className={styles.roleTier}>
      <h3>{title}</h3>
      <div className={styles.roleTierList}>
        {roles.map((role) => (
          <DraggableRoleRow
            key={role.id}
            role={role}
            isSelected={selectedRoleId === role.id}
            canReorder={canReorder && !isMutating}
            onSelect={onSelect}
            onOpenMenu={onOpenMenu}
            onMove={onMove}
          />
        ))}
      </div>
    </section>
  )
}

function DraggableRoleRow({
  role,
  isSelected,
  canReorder,
  onSelect,
  onOpenMenu,
  onMove,
}: {
  role: ServerRoleResponse
  isSelected: boolean
  canReorder: boolean
  onSelect: (roleId: string) => void
  onOpenMenu: (role: ServerRoleResponse, trigger: HTMLButtonElement) => void
  onMove: (roleId: string, direction: -1 | 1) => void
}) {
  const {
    attributes,
    listeners,
    setNodeRef: setDraggableNodeRef,
    transform,
    isDragging,
  } = useDraggable({ id: role.id, disabled: !canReorder })
  const {
    isOver,
    setNodeRef: setDroppableNodeRef,
  } = useDroppable({ id: role.id, disabled: !canReorder })
  const style: CSSProperties | undefined = transform
    ? {
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0) scaleX(${transform.scaleX}) scaleY(${transform.scaleY})`,
      }
    : undefined

  const setNodeRef = useCallback(
    (node: HTMLElement | null) => {
      setDraggableNodeRef(node)
      setDroppableNodeRef(node)
    },
    [setDraggableNodeRef, setDroppableNodeRef],
  )

  return (
    <article
      ref={setNodeRef}
      className={`${styles.roleRow} ${isSelected ? styles.roleRowSelected : ''} ${
        isDragging ? styles.roleRowDragging : ''
      } ${isOver && !isDragging ? styles.roleRowDropTarget : ''}`}
      style={style}
    >
      <button
        className={styles.roleDragHandle}
        type="button"
        disabled={!canReorder}
        aria-label={`Переместить роль ${role.title}`}
        title={canReorder ? 'Перетащить роль' : 'Сортировка доступна владельцу без активного поиска'}
        onKeyDown={(event) => {
          if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') {
            return
          }

          event.preventDefault()
          onMove(role.id, event.key === 'ArrowUp' ? -1 : 1)
        }}
        {...attributes}
        {...listeners}
      >
        <SystemIcon name="more-vertical" size={16} />
      </button>
      <RoleIdentityButton role={role} onSelect={onSelect} />
      <button
        className={styles.roleEditButton}
        type="button"
        aria-label={`Редактировать роль ${role.title}`}
        title="Открыть редактор роли"
        onClick={() => onSelect(role.id)}
      >
        <SystemIcon name="edit" size={16} />
      </button>
      <button
        className={styles.roleMenuButton}
        type="button"
        aria-label={`Действия с ролью ${role.title}`}
        onClick={(event) => onOpenMenu(role, event.currentTarget)}
      >
        <SystemIcon name="more" size={17} />
      </button>
    </article>
  )
}

function StaticRoleRow({
  role,
  isSelected,
  onSelect,
  onOpenMenu,
}: {
  role: ServerRoleResponse
  isSelected: boolean
  onSelect: (roleId: string) => void
  onOpenMenu: (role: ServerRoleResponse, trigger: HTMLButtonElement) => void
}) {
  return (
    <article
      className={`${styles.roleRow} ${styles.roleRowStatic} ${
        isSelected ? styles.roleRowSelected : ''
      }`}
    >
      <span className={styles.roleLock} aria-hidden="true">
        <SystemIcon name="lock" size={15} />
      </span>
      <RoleIdentityButton role={role} onSelect={onSelect} />
      <button
        className={styles.roleEditButton}
        type="button"
        aria-label={`Открыть роль ${role.title}`}
        title="Открыть роль"
        onClick={() => onSelect(role.id)}
      >
        <SystemIcon name="edit" size={16} />
      </button>
      <button
        className={styles.roleMenuButton}
        type="button"
        aria-label={`Действия с ролью ${role.title}`}
        onClick={(event) => onOpenMenu(role, event.currentTarget)}
      >
        <SystemIcon name="more" size={17} />
      </button>
    </article>
  )
}

function RoleIdentityButton({
  role,
  onSelect,
}: {
  role: ServerRoleResponse
  onSelect: (roleId: string) => void
}) {
  return (
    <button
      className={styles.roleIdentity}
      type="button"
      aria-label={`Открыть настройки роли ${role.title}`}
      onClick={() => onSelect(role.id)}
    >
      <span
        className={styles.roleColor}
        style={{ backgroundColor: role.color ?? 'transparent' }}
        data-empty={!role.color || undefined}
        aria-hidden="true"
      />
      <span className={styles.roleText}>
        <strong>{role.title}</strong>
        <small>
          {role.directAssignmentCount} назначений · {role.permissions.length} прав
        </small>
      </span>
      <span className={styles.roleBadges} aria-hidden="true">
        {role.isSystem ? <em>system</em> : null}
        {role.mentionable ? <em>@</em> : null}
      </span>
    </button>
  )
}

function getRoleManagementReason(
  reason: ReturnType<typeof resolveServerRoleManagement>['reason'],
) {
  switch (reason) {
    case 'system':
      return 'Системная роль недоступна для изменения.'
    case 'administrator':
      return 'Административными ролями распоряжается только владелец.'
    case 'hierarchy':
      return 'Эта роль находится не ниже вашей роли.'
    case 'permission-subset':
      return 'Роль содержит права, которых нет у вас.'
    case 'missing-permission':
      return 'Нет права управлять ролями.'
    default:
      return undefined
  }
}
