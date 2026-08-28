import { useCallback, useEffect, useMemo, useState } from 'react';

import { ApiError } from '../../../../../shared/api/api';
import type {
  PermissionResponse,
  ServerEffectivePermissionsResponse,
  ServerMemberDetailsResponse,
  ServerRoleDeletionImpactResponse,
  ServerRoleResponse
} from '../../../../../shared/types';
import {
  assignServerRoleToMember,
  createServerRole,
  deleteServerRole,
  duplicateServerRole,
  loadServerEffectivePermissions,
  loadServerRoleDeletionImpact,
  loadServerRoleMembers,
  reorderServerRoles,
  revokeServerMemberRole,
  updateServerRole
} from './serverRoleSettingsApi';
import {
  type ServerRoleDraft,
  type ServerRoleEditorTab,
  type ServerRoleVersionConflictResolution,
  createServerRoleDraft,
  isAdministratorServerRole,
  isServerRoleDraftDirty,
  normalizeServerPermissionCode,
  normalizeServerRoleDraft,
  resolveAvailableServerRolePermissionCodes,
  resolveServerRoleManagement,
  resolveServerRoleVersionConflict,
  toggleServerRolePermission
} from './serverRoleSettingsModel';

type UseServerRoleSettingsOptions = {
  accessToken: string;
  serverId: string;
  roles: readonly ServerRoleResponse[];
  permissions: readonly PermissionResponse[];
  actorLegacyPermissionCodes: readonly string[];
  onReloadRoles: () => Promise<readonly ServerRoleResponse[]>;
  onReloadMembers: () => Promise<void>;
};

const defaultDraft = createServerRoleDraft();

type PendingRoleConflict = {
  roleId: string;
};

type RoleConflict = Exclude<
  ServerRoleVersionConflictResolution,
  { kind: 'version-only' }
> & {
  roleId: string;
};

export function useServerRoleSettings({
  accessToken,
  serverId,
  roles,
  permissions,
  actorLegacyPermissionCodes,
  onReloadRoles,
  onReloadMembers
}: UseServerRoleSettingsOptions) {
  const [selectedRoleId, setSelectedRoleId] = useState<string | null>(null);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [activeTab, setActiveTab] = useState<ServerRoleEditorTab>('appearance');
  const [draft, setDraft] = useState<ServerRoleDraft>(defaultDraft);
  const [draftBaselineRole, setDraftBaselineRole] =
    useState<ServerRoleResponse | null>(null);
  const [roleQuery, setRoleQuery] = useState('');
  const [memberQuery, setMemberQuery] = useState('');
  const [members, setMembers] = useState<ServerMemberDetailsResponse[]>([]);
  const [memberTotalCount, setMemberTotalCount] = useState(0);
  const [effectivePermissions, setEffectivePermissions] =
    useState<ServerEffectivePermissionsResponse | null>(null);
  const [deletionImpact, setDeletionImpact] =
    useState<ServerRoleDeletionImpactResponse | null>(null);
  const [isLoadingContext, setIsLoadingContext] = useState(true);
  const [isLoadingMembers, setIsLoadingMembers] = useState(false);
  const [isMutating, setIsMutating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pendingConflict, setPendingConflict] =
    useState<PendingRoleConflict | null>(null);
  const [roleConflict, setRoleConflict] = useState<RoleConflict | null>(null);

  const apiContext = useMemo(
    () => ({ accessToken, serverId }),
    [accessToken, serverId]
  );
  const selectedServerRole = useMemo(
    () => roles.find((role) => role.id === selectedRoleId) ?? null,
    [roles, selectedRoleId]
  );
  const selectedRole = useMemo(() => {
    if (
      (pendingConflict?.roleId === selectedRoleId ||
        roleConflict?.roleId === selectedRoleId) &&
      draftBaselineRole?.id === selectedRoleId
    ) {
      return draftBaselineRole;
    }

    return selectedServerRole;
  }, [
    draftBaselineRole,
    pendingConflict?.roleId,
    roleConflict?.roleId,
    selectedRoleId,
    selectedServerRole
  ]);
  const actorPermissionCodes = useMemo(
    () =>
      (effectivePermissions?.permissionCodes ?? actorLegacyPermissionCodes).map(
        normalizeServerPermissionCode
      ),
    [actorLegacyPermissionCodes, effectivePermissions?.permissionCodes]
  );
  const isAuthorizationUnrestricted = Boolean(
    effectivePermissions?.isOwner || effectivePermissions?.isAdministrator
  );
  const canManageRolesAccess =
    isAuthorizationUnrestricted ||
    actorPermissionCodes.includes('MANAGE_ROLES');
  const canAssignRolesAccess =
    isAuthorizationUnrestricted ||
    actorPermissionCodes.includes('ASSIGN_ROLES');
  const management = useMemo(
    () =>
      selectedRole
        ? resolveServerRoleManagement(
            selectedRole,
            effectivePermissions,
            actorPermissionCodes,
            canManageRolesAccess
          )
        : null,
    [
      actorPermissionCodes,
      canManageRolesAccess,
      effectivePermissions,
      selectedRole
    ]
  );
  const assignmentManagement = useMemo(
    () =>
      selectedRole && selectedRole.kind === 'standard'
        ? resolveServerRoleManagement(
            selectedRole,
            effectivePermissions,
            actorPermissionCodes,
            canAssignRolesAccess
          )
        : null,
    [
      actorPermissionCodes,
      canAssignRolesAccess,
      effectivePermissions,
      selectedRole
    ]
  );
  const isDirty = isServerRoleDraftDirty(
    draft,
    isCreating ? null : draftBaselineRole
  );
  const canCreate = canManageRolesAccess && effectivePermissions !== null;
  const canEditSelected = Boolean(
    !pendingConflict &&
    !roleConflict &&
    (isCreating ? canCreate : management?.allowed)
  );
  const canReorder = Boolean(
    effectivePermissions?.isOwner &&
    !roleQuery.trim() &&
    !isDirty &&
    !isMutating
  );
  const availablePermissionCodes = useMemo(() => {
    return resolveAvailableServerRolePermissionCodes(
      permissions,
      effectivePermissions
    );
  }, [effectivePermissions, permissions]);

  const refreshEffectivePermissions = useCallback(async () => {
    setIsLoadingContext(true);

    try {
      setEffectivePermissions(await loadServerEffectivePermissions(apiContext));
    } catch {
      setEffectivePermissions(null);
      setError('Не удалось загрузить эффективные права для управления ролями.');
    } finally {
      setIsLoadingContext(false);
    }
  }, [apiContext]);

  useEffect(() => {
    setSelectedRoleId(null);
    setIsEditorOpen(false);
    setIsCreating(false);
    setDraft(defaultDraft);
    setDraftBaselineRole(null);
    setRoleQuery('');
    setMemberQuery('');
    setMembers([]);
    setDeletionImpact(null);
    setError(null);
    setNotice(null);
    setPendingConflict(null);
    setRoleConflict(null);
    void refreshEffectivePermissions();
  }, [refreshEffectivePermissions, serverId]);

  useEffect(() => {
    if (isCreating) {
      return;
    }

    if (pendingConflict) {
      return;
    }

    if (roleConflict) {
      return;
    }

    if (selectedServerRole) {
      const hasSameBaseline = draftBaselineRole?.id === selectedServerRole.id;
      if (!hasSameBaseline) {
        setDraft(createServerRoleDraft(selectedServerRole));
        setDraftBaselineRole(selectedServerRole);
        return;
      }

      if (
        draftBaselineRole.version !== selectedServerRole.version &&
        !isServerRoleDraftDirty(draft, draftBaselineRole)
      ) {
        setDraft(createServerRoleDraft(selectedServerRole));
        setDraftBaselineRole(selectedServerRole);
      }
      return;
    }

    if (selectedRoleId && draftBaselineRole?.id === selectedRoleId && isDirty) {
      setRoleConflict({
        kind: 'deleted',
        freshRole: null,
        roleId: selectedRoleId
      });
      setError('Роль удалена в другой сессии. Локальный черновик сохранён.');
      return;
    }

    const nextRole =
      roles.find((role) => role.kind === 'everyone') ??
      roles.find((role) => !role.isSystem) ??
      roles[0];
    if (nextRole) {
      setSelectedRoleId(nextRole.id);
      setDraft(createServerRoleDraft(nextRole));
      setDraftBaselineRole(nextRole);
    }
  }, [
    draft,
    draftBaselineRole,
    isDirty,
    isCreating,
    pendingConflict,
    roleConflict,
    roles,
    selectedRoleId,
    selectedServerRole
  ]);

  useEffect(() => {
    if (
      activeTab !== 'members' ||
      isCreating ||
      pendingConflict ||
      roleConflict ||
      !selectedRole ||
      selectedRole.isSystem
    ) {
      setMembers([]);
      setMemberTotalCount(0);
      return undefined;
    }

    let isCancelled = false;
    const timeoutId = window.setTimeout(
      async () => {
        setIsLoadingMembers(true);
        setError(null);

        try {
          const response = await loadServerRoleMembers(
            apiContext,
            selectedRole.id,
            memberQuery
          );
          if (!isCancelled) {
            setMembers(response.items);
            setMemberTotalCount(response.totalCount);
          }
        } catch (caughtError) {
          if (!isCancelled) {
            setError(resolveRoleSettingsError(caughtError));
            setMembers([]);
            setMemberTotalCount(0);
          }
        } finally {
          if (!isCancelled) {
            setIsLoadingMembers(false);
          }
        }
      },
      memberQuery.trim() ? 250 : 0
    );

    return () => {
      isCancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, [
    activeTab,
    apiContext,
    isCreating,
    memberQuery,
    pendingConflict,
    roleConflict,
    selectedRole
  ]);

  function confirmDiscard() {
    return (
      !isDirty ||
      window.confirm(
        'Есть несохранённые изменения роли. Отменить их и продолжить?'
      )
    );
  }

  function selectRole(roleId: string) {
    if (roleId === selectedRoleId && !isCreating) {
      setIsEditorOpen(true);
      return;
    }

    if (!confirmDiscard()) {
      return;
    }

    const role = roles.find((candidate) => candidate.id === roleId);
    if (!role) {
      return;
    }

    setIsCreating(false);
    setIsEditorOpen(true);
    setSelectedRoleId(role.id);
    setDraft(createServerRoleDraft(role));
    setDraftBaselineRole(role);
    setActiveTab(role.kind === 'everyone' ? 'permissions' : 'appearance');
    setMemberQuery('');
    setDeletionImpact(null);
    setError(null);
    setNotice(null);
    setPendingConflict(null);
    setRoleConflict(null);
  }

  function startCreating() {
    if (!canCreate || !confirmDiscard()) {
      return;
    }

    setIsCreating(true);
    setIsEditorOpen(true);
    setSelectedRoleId(null);
    setDraft(createServerRoleDraft());
    setDraftBaselineRole(null);
    setActiveTab('appearance');
    setMemberQuery('');
    setDeletionImpact(null);
    setError(null);
    setNotice(null);
    setPendingConflict(null);
    setRoleConflict(null);
  }

  function updateDraft(patch: Partial<ServerRoleDraft>) {
    setDraft((current) => ({ ...current, ...patch }));
    setNotice(null);
  }

  function canCloseEditor() {
    if (isMutating) {
      return false;
    }

    return (
      !isDirty ||
      window.confirm(
        'Есть несохранённые изменения роли. Отменить их и закрыть редактор?'
      )
    );
  }

  function closeEditor() {
    const nextRole =
      selectedServerRole ??
      roles.find((role) => role.kind === 'everyone') ??
      roles.find((role) => !role.isSystem) ??
      roles[0] ??
      null;

    setIsEditorOpen(false);
    setIsCreating(false);
    setSelectedRoleId(nextRole?.id ?? null);
    setDraft(createServerRoleDraft(nextRole));
    setDraftBaselineRole(nextRole);
    setActiveTab('appearance');
    setMemberQuery('');
    setMembers([]);
    setMemberTotalCount(0);
    setDeletionImpact(null);
    setError(null);
    setNotice(null);
    setPendingConflict(null);
    setRoleConflict(null);
  }

  function loadServerRoleVersion() {
    if (!roleConflict) {
      return;
    }

    const nextRole =
      roleConflict.freshRole ??
      roles.find((role) => role.kind === 'everyone') ??
      roles.find((role) => !role.isSystem) ??
      roles[0] ??
      null;

    setIsCreating(false);
    setSelectedRoleId(nextRole?.id ?? null);
    setDraft(createServerRoleDraft(nextRole));
    setDraftBaselineRole(nextRole);
    setActiveTab('appearance');
    setMemberQuery('');
    setMembers([]);
    setMemberTotalCount(0);
    setRoleConflict(null);
    setPendingConflict(null);
    setDeletionImpact(null);
    setError(null);
    setNotice(
      roleConflict.kind === 'deleted'
        ? 'Выбрана актуальная роль.'
        : 'Загружена версия роли с сервера.'
    );
  }

  async function retryRoleConflictReload() {
    if (
      !pendingConflict ||
      !draftBaselineRole ||
      draftBaselineRole.id !== pendingConflict.roleId ||
      isMutating
    ) {
      return;
    }

    setIsMutating(true);
    setError('Загружаем актуальную версию роли…');
    try {
      const freshRoles = await onReloadRoles();
      applyRoleConflictRefresh(
        draftBaselineRole,
        pendingConflict.roleId,
        freshRoles
      );
    } catch {
      setError(
        'Не удалось загрузить актуальную версию роли. Локальный черновик сохранён.'
      );
    } finally {
      setIsMutating(false);
    }
  }

  function resetDraft() {
    if (pendingConflict) {
      return;
    }

    if (roleConflict) {
      loadServerRoleVersion();
      return;
    }

    if (isCreating) {
      const nextRole =
        roles.find((role) => role.kind === 'everyone') ??
        roles.find((role) => !role.isSystem) ??
        roles[0] ??
        null;
      setIsCreating(false);
      setSelectedRoleId(nextRole?.id ?? null);
      setDraft(createServerRoleDraft(nextRole));
      setDraftBaselineRole(nextRole);
    } else {
      setDraft(createServerRoleDraft(selectedRole));
      setDraftBaselineRole(selectedRole);
    }

    setDeletionImpact(null);
    setError(null);
    setNotice(null);
  }

  function togglePermission(permissionCode: string, enabled: boolean) {
    if (!availablePermissionCodes.has(permissionCode)) {
      return;
    }

    setDraft((current) => ({
      ...current,
      permissionCodes: toggleServerRolePermission(
        current.permissionCodes,
        permissionCode,
        enabled
      )
    }));
    setNotice(null);
  }

  async function saveRole() {
    if (!canEditSelected || isMutating) {
      return;
    }

    const normalized = normalizeServerRoleDraft(draft);
    if (!normalized.title || normalized.title.length > 64) {
      setError('Название роли должно содержать от 1 до 64 символов.');
      return;
    }

    setIsMutating(true);
    setError(null);
    setNotice(null);

    try {
      const savedRole = isCreating
        ? await createServerRole(apiContext, draft)
        : selectedRole && draftBaselineRole
          ? await updateServerRole(
              apiContext,
              selectedRole.id,
              draftBaselineRole.version,
              draft
            )
          : null;
      if (!savedRole) {
        return;
      }

      await Promise.all([onReloadRoles(), refreshEffectivePermissions()]);
      setIsCreating(false);
      setSelectedRoleId(savedRole.id);
      setDraft(createServerRoleDraft(savedRole));
      setDraftBaselineRole(savedRole);
      setPendingConflict(null);
      setRoleConflict(null);
      setNotice('Роль сохранена.');
    } catch (caughtError) {
      if (isStaleRoleUpdate(caughtError) && selectedRole && draftBaselineRole) {
        setPendingConflict({
          roleId: selectedRole.id
        });
        setError('Роль изменена в другой сессии. Загружаем актуальную версию…');
        try {
          const [freshRoles] = await Promise.all([
            onReloadRoles(),
            refreshEffectivePermissions()
          ]);
          applyRoleConflictRefresh(
            draftBaselineRole,
            selectedRole.id,
            freshRoles
          );
        } catch {
          setError(
            'Не удалось загрузить актуальную версию роли. Локальный черновик сохранён.'
          );
        }
      } else {
        setError(resolveRoleSettingsError(caughtError));
      }
    } finally {
      setIsMutating(false);
    }
  }

  function applyRoleConflictRefresh(
    baselineRole: ServerRoleResponse,
    roleId: string,
    freshRoles: readonly ServerRoleResponse[]
  ) {
    const freshRole = freshRoles.find((role) => role.id === roleId) ?? null;
    const resolution = resolveServerRoleVersionConflict(
      baselineRole,
      freshRole
    );
    setPendingConflict(null);

    if (resolution.kind === 'version-only') {
      setDraftBaselineRole(resolution.freshRole);
      setRoleConflict(null);
      setError(
        'Версия роли обновлена. Локальный черновик сохранён — повторите сохранение.'
      );
      return;
    }

    setRoleConflict({ ...resolution, roleId });
    setError(
      resolution.kind === 'deleted'
        ? 'Роль удалена в другой сессии. Локальный черновик сохранён.'
        : 'Роль изменена в другой сессии. Локальный черновик сохранён; перед продолжением выберите версию.'
    );
  }

  async function duplicateRole(role: ServerRoleResponse) {
    const decision = resolveServerRoleManagement(
      role,
      effectivePermissions,
      actorPermissionCodes,
      canManageRolesAccess
    );
    if (!decision.allowed || isMutating || !confirmDiscard()) {
      return;
    }

    const isAdministrator = isAdministratorServerRole(role);
    if (
      isAdministrator &&
      !window.confirm(
        'Дублирование административной роли создаст ещё одну роль с полным доступом. Продолжить?'
      )
    ) {
      return;
    }

    setIsMutating(true);
    setError(null);
    setNotice(null);

    try {
      const duplicate = await duplicateServerRole(
        apiContext,
        role,
        isAdministrator
      );
      await Promise.all([onReloadRoles(), refreshEffectivePermissions()]);
      setIsCreating(false);
      setIsEditorOpen(true);
      setSelectedRoleId(duplicate.id);
      setDraft(createServerRoleDraft(duplicate));
      setDraftBaselineRole(duplicate);
      setPendingConflict(null);
      setRoleConflict(null);
      setActiveTab('appearance');
      setNotice('Копия роли создана.');
    } catch (caughtError) {
      setError(resolveRoleSettingsError(caughtError));
    } finally {
      setIsMutating(false);
    }
  }

  async function removeRole(role: ServerRoleResponse) {
    const decision = resolveServerRoleManagement(
      role,
      effectivePermissions,
      actorPermissionCodes,
      canManageRolesAccess
    );
    const isDeletingSelectedRole =
      isEditorOpen && !isCreating && role.id === selectedRoleId;
    if (
      !decision.allowed ||
      isMutating ||
      (isDeletingSelectedRole && !confirmDiscard())
    ) {
      return;
    }

    setIsMutating(true);
    setError(null);
    setNotice(null);

    try {
      const impact = await loadServerRoleDeletionImpact(apiContext, role.id);
      if (isDeletingSelectedRole) {
        setDeletionImpact(impact);
      }
      if (!impact.canDelete || impact.hasBlockingDependencies) {
        setError(
          'Роль нельзя удалить, пока от неё зависят участники, ACL или защищённые ресурсы.'
        );
        return;
      }

      const attributionNotice =
        impact.createdWithRoleSpaceCount > 0
          ? ` Ссылку на роль как создавшую спейс сохранят ${impact.createdWithRoleSpaceCount} ресурс(а).`
          : '';
      if (
        !window.confirm(`Удалить роль «${role.title}»?${attributionNotice}`)
      ) {
        if (isDeletingSelectedRole) {
          setDeletionImpact(null);
        }
        return;
      }

      await deleteServerRole(apiContext, role);
      if (isDeletingSelectedRole) {
        setSelectedRoleId(null);
        setDraft(createServerRoleDraft());
        setDraftBaselineRole(null);
        setPendingConflict(null);
        setRoleConflict(null);
      }
      setDeletionImpact(null);
      await Promise.all([onReloadRoles(), refreshEffectivePermissions()]);
      setNotice('Роль удалена.');
    } catch (caughtError) {
      setError(resolveRoleSettingsError(caughtError));
      if (isRoleConflict(caughtError)) {
        try {
          await onReloadRoles();
        } catch {
          setError(
            'Роль изменилась в другой сессии, но актуальный список загрузить не удалось.'
          );
        }
      }
    } finally {
      setIsMutating(false);
    }
  }

  async function reorderRoles(nextRoles: readonly ServerRoleResponse[]) {
    if (
      !canReorder ||
      !effectivePermissions?.authorizationVersion ||
      isMutating
    ) {
      return;
    }

    setIsMutating(true);
    setError(null);
    setNotice(null);

    try {
      await reorderServerRoles(
        apiContext,
        effectivePermissions.authorizationVersion,
        nextRoles
      );
      await Promise.all([onReloadRoles(), refreshEffectivePermissions()]);
      setNotice('Порядок ролей сохранён.');
    } catch (caughtError) {
      setError(resolveRoleSettingsError(caughtError));
      await onReloadRoles();
      await refreshEffectivePermissions();
    } finally {
      setIsMutating(false);
    }
  }

  async function toggleMemberRole(member: ServerMemberDetailsResponse) {
    if (
      !selectedRole ||
      !assignmentManagement?.allowed ||
      pendingConflict ||
      roleConflict ||
      isMutating
    ) {
      return;
    }

    const activeAssignment = member.roleAssignments.find(
      (assignment) =>
        assignment.roleId === selectedRole.id && !assignment.revokedAt
    );
    setIsMutating(true);
    setError(null);
    setNotice(null);

    try {
      if (activeAssignment) {
        await revokeServerMemberRole(apiContext, activeAssignment.id);
      } else {
        await assignServerRoleToMember(apiContext, member.id, selectedRole.id);
      }

      const [response] = await Promise.all([
        loadServerRoleMembers(apiContext, selectedRole.id, memberQuery),
        onReloadRoles(),
        onReloadMembers(),
        refreshEffectivePermissions()
      ]);
      setMembers(response.items);
      setMemberTotalCount(response.totalCount);
      setNotice(
        activeAssignment
          ? 'Роль снята с участника.'
          : 'Роль назначена участнику.'
      );
    } catch (caughtError) {
      setError(resolveRoleSettingsError(caughtError));
    } finally {
      setIsMutating(false);
    }
  }

  return {
    selectedRole,
    selectedRoleId,
    isEditorOpen,
    isCreating,
    activeTab,
    draft,
    roleQuery,
    memberQuery,
    members,
    memberTotalCount,
    effectivePermissions,
    deletionImpact,
    roleConflict,
    management,
    assignmentManagement,
    isDirty,
    canCreate,
    canManageRolesAccess,
    canEditSelected,
    canReorder,
    availablePermissionCodes,
    isLoadingContext,
    isLoadingMembers,
    isResolvingConflict: pendingConflict !== null,
    isMutating,
    error,
    notice,
    setActiveTab,
    setRoleQuery,
    setMemberQuery,
    selectRole,
    startCreating,
    canCloseEditor,
    closeEditor,
    updateDraft,
    loadServerRoleVersion,
    retryRoleConflictReload,
    resetDraft,
    togglePermission,
    saveRole,
    duplicateRole,
    removeRole,
    reorderRoles,
    toggleMemberRole
  };
}

export type ServerRoleSettingsController = ReturnType<
  typeof useServerRoleSettings
>;

function isRoleConflict(error: unknown) {
  return getApiErrorCode(error) === 'server_role_conflict';
}

function isStaleRoleUpdate(error: unknown) {
  return (
    isRoleConflict(error) || (error instanceof ApiError && error.status === 404)
  );
}

function resolveRoleSettingsError(error: unknown) {
  const code = getApiErrorCode(error);

  switch (code) {
    case 'server_role_conflict':
      return 'Роль уже изменена в другой сессии. Данные обновлены — повторите действие.';
    case 'server_role_title_conflict':
      return 'Роль с таким названием уже существует.';
    case 'server_role_has_dependencies':
      return 'Роль нельзя удалить, пока от неё зависят участники, ACL или защищённые ресурсы.';
    case 'server_role_administrator_confirmation_required':
      return 'Для административной роли требуется отдельное подтверждение.';
    case 'invalid_role_create':
    case 'invalid_role_update':
    case 'invalid_role_duplicate':
    case 'invalid_role_delete':
    case 'invalid_role_order':
      return 'Проверьте заполнение роли и повторите действие.';
    default:
      return error instanceof Error && error.message
        ? error.message
        : 'Не удалось выполнить действие с ролью.';
  }
}

function getApiErrorCode(error: unknown) {
  if (
    !(error instanceof ApiError) ||
    !error.data ||
    typeof error.data !== 'object'
  ) {
    return null;
  }

  return 'code' in error.data && typeof error.data.code === 'string'
    ? error.data.code
    : null;
}
