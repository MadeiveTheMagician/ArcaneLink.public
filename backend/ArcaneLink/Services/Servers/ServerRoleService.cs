using System.Data;
using System.Text.Json;
using ArcaneLink.DataBase._Data;
using ArcaneLink.DataBase.Constants;
using ArcaneLink.DataBase.DTOs.Servers;
using ArcaneLink.DataBase.Models.ServersModels;
using ArcaneLink.Services.Realtime;
using ArcaneLink.Services.Realtime.Abstractions;
using ArcaneLink.Services.Servers.Abstractions;
using ArcaneLink.Services.Servers.Authorization;
using ArcaneLink.Services.Spaces.Abstractions;
using Microsoft.EntityFrameworkCore;
using Npgsql;

namespace ArcaneLink.Services.Servers
{
    public class ServerRoleService : IServerRoleService
    {
        private readonly AppDbContext _db;
        private readonly IRealtimeNotificationService _realtime;
        private readonly IServerGovernanceAccessService _access;
        private readonly ISpaceAuthorizationService _spaceAuthorization;
        private readonly ServerVoiceAccessReconciliationService _voiceAccess;
        private readonly LegacyServerPermissionMaskAdapter _legacyPermissionAdapter = new();
        private readonly ILogger<ServerRoleService> _logger;

        public ServerRoleService(
            AppDbContext db,
            IRealtimeNotificationService realtime,
            IServerGovernanceAccessService access,
            ISpaceAuthorizationService spaceAuthorization,
            ServerVoiceAccessReconciliationService voiceAccess,
            ILogger<ServerRoleService> logger)
        {
            this._db = db;
            this._realtime = realtime;
            this._access = access;
            this._spaceAuthorization = spaceAuthorization;
            this._voiceAccess = voiceAccess;
            this._logger = logger;
        }

        public async Task<IReadOnlyList<PermissionResponse>> GetPermissionsAsync(
            CancellationToken cancellationToken = default)
        {
            var permissionIds = ServerGovernanceIds.ServerPermissionIds.ToArray();
            return await this._db.PermissionCatalog
                .AsNoTracking()
                .Where(x => permissionIds.Contains(x.Id))
                .OrderBy(x => x.Code)
                .Select(x => new PermissionResponse
                {
                    Id = x.Id,
                    Code = x.Code,
                    Title = x.Title,
                    Description = x.Description
                })
                .ToListAsync(cancellationToken);
        }

        public Task<ServerPermissionCatalogResponse> GetPermissionCatalogV1Async(
            CancellationToken cancellationToken = default)
        {
            cancellationToken.ThrowIfCancellationRequested();

            return Task.FromResult(new ServerPermissionCatalogResponse
            {
                PermissionSchemaVersion = ServerPermissionRegistry.SchemaVersion,
                Permissions = ServerPermissionRegistry.All
                    .OrderBy(permission => permission.Bit)
                    .Select(permission => new ServerPermissionDefinitionResponse
                    {
                        Bit = permission.Bit,
                        Code = permission.Code,
                        Group = permission.Group.ToString().ToLowerInvariant(),
                        Title = HumanizePermissionCode(permission.Code)
                    })
                    .ToList()
            });
        }

        public async Task<IReadOnlyList<PermissionResponse>> GetSpacePermissionsAsync(
            CancellationToken cancellationToken = default)
        {
            var permissionIds = SpacePermissionIds.All.ToArray();
            return await this._db.PermissionCatalog
                .AsNoTracking()
                .Where(x => permissionIds.Contains(x.Id))
                .OrderBy(x => x.Code)
                .Select(x => new PermissionResponse
                {
                    Id = x.Id,
                    Code = x.Code,
                    Title = x.Title,
                    Description = x.Description
                })
                .ToListAsync(cancellationToken);
        }

        public async Task<IReadOnlyList<ServerRoleResponse>?> GetRolesAsync(
            Guid currentUserId,
            Guid serverId,
            ServerRoleQueryRequest query,
            CancellationToken cancellationToken = default)
        {
            if (!await this._access.IsActiveMemberAsync(currentUserId, serverId, cancellationToken))
            {
                return null;
            }

            await this._access.EnsureOwnerRoleAsync(serverId, cancellationToken);
            await this._db.SaveChangesAsync(cancellationToken);

            var normalizedSearch = NormalizeOptional(query.Q)?.ToLowerInvariant();
            var normalizedPermissionCode = NormalizeOptional(query.PermissionCode);
            var roles = await this._db.ServerRoles
                .AsNoTracking()
                .Where(role =>
                    role.ServerId == serverId &&
                    role.DeletedAt == null)
                .Include(role => role.Permissions)
                .ThenInclude(permission => permission.Permission)
                .OrderBy(role => role.Level)
                .ThenBy(role => role.CreatedAt)
                .ThenBy(role => role.Id)
                .ToListAsync(cancellationToken);

            if (normalizedSearch != null)
            {
                var searchMask = PermissionMask256.FromBits(
                    ServerPermissionRegistry.All
                        .Where(permission =>
                            permission.Code.Contains(
                                normalizedSearch,
                                StringComparison.OrdinalIgnoreCase) ||
                            HumanizePermissionCode(permission.Code).Contains(
                                normalizedSearch,
                                StringComparison.OrdinalIgnoreCase))
                        .Select(permission => permission.Bit));
                roles = roles
                    .Where(role =>
                        role.Title.Contains(
                            normalizedSearch,
                            StringComparison.OrdinalIgnoreCase) ||
                        (!searchMask.IsEmpty &&
                         TryGetPersistedRolePermissionMask(
                             role,
                             out var roleMask) &&
                         !(roleMask & searchMask).IsEmpty))
                    .ToList();
            }

            if (normalizedPermissionCode != null)
            {
                var filterMask = await this.ResolveRolePermissionFilterMaskAsync(
                    normalizedPermissionCode,
                    cancellationToken);
                if (!filterMask.HasValue)
                {
                    return [];
                }

                roles = roles
                    .Where(role =>
                        TryGetPersistedRolePermissionMask(
                            role,
                            out var roleMask) &&
                        filterMask.Value.Except(roleMask).IsEmpty)
                    .ToList();
            }
            var roleIds = roles.Select(role => role.Id).ToList();
            var directAssignmentCounts = new Dictionary<Guid, int>();
            if (roleIds.Count > 0)
            {
                directAssignmentCounts = await this._db.ServerMemberRoles
                    .AsNoTracking()
                    .Where(assignment =>
                        roleIds.Contains(assignment.RoleId) &&
                        assignment.ServerId == serverId &&
                        assignment.RevokedAt == null &&
                        assignment.Member.StatusId == ServerMemberStatusIds.Active &&
                        assignment.Member.BannedAt == null &&
                        assignment.Member.User.DeletedAt == null &&
                        assignment.Member.User.StatusId == UserStatusIds.Active)
                    .GroupBy(assignment => assignment.RoleId)
                    .Select(group => new
                    {
                        RoleId = group.Key,
                        Count = group.Count()
                    })
                    .ToDictionaryAsync(item => item.RoleId, item => item.Count, cancellationToken);
            }

            return roles
                .Select(role => ServerGovernanceMapper.ToRoleResponse(
                    role,
                    directAssignmentCounts.GetValueOrDefault(role.Id)))
                .ToList();
        }

        public async Task<CreateServerRoleResult> CreateRoleAsync(
            Guid currentUserId,
            Guid serverId,
            CreateServerRoleRequest request,
            CancellationToken cancellationToken = default)
        {
            if (!TryNormalizeRoleCreate(
                    request,
                    out var title,
                    out var description,
                    out var color,
                    out var permissionSchemaVersion,
                    out var permissionCodes))
            {
                return CreateServerRoleResult.InvalidRequest();
            }

            try
            {
                return await this.CreateRoleTransactionAsync(
                    currentUserId,
                    serverId,
                    request.Level,
                    title,
                    description,
                    color,
                    request.Mentionable,
                    permissionSchemaVersion,
                    permissionCodes,
                    cancellationToken);
            }
            catch (Exception exception) when (IsPostgresSerializationFailure(exception))
            {
                this._db.ChangeTracker.Clear();
                return CreateServerRoleResult.Conflict();
            }
            catch (Exception exception) when (IsServerRoleTitleConflict(exception))
            {
                this._db.ChangeTracker.Clear();
                return CreateServerRoleResult.TitleConflict();
            }
        }

        private async Task<CreateServerRoleResult> CreateRoleTransactionAsync(
            Guid currentUserId,
            Guid serverId,
            int? requestedLevel,
            string title,
            string? description,
            string? color,
            bool mentionable,
            int? permissionSchemaVersion,
            IReadOnlyList<string> permissionCodes,
            CancellationToken cancellationToken)
        {
            await using var transaction = await this._db.Database.BeginTransactionAsync(
                IsolationLevel.Serializable,
                cancellationToken);
            var scope = await this.LoadRoleManagementScopeAsync(
                currentUserId,
                serverId,
                cancellationToken);
            if (scope == null ||
                !scope.CanManageRoles)
            {
                return CreateServerRoleResult.NotFound();
            }

            var permissionWriteSet = await this.ResolvePermissionWriteSetAsync(
                permissionSchemaVersion,
                permissionCodes,
                cancellationToken);
            if (permissionWriteSet == null)
            {
                return CreateServerRoleResult.InvalidRequest();
            }

            if (!CanGrantPermissions(scope, permissionWriteSet.Mask))
            {
                return CreateServerRoleResult.NotFound();
            }

            if (!scope.IsUnrestricted &&
                requestedLevel.HasValue &&
                requestedLevel.Value <= scope.HighestRoleLevel)
            {
                return CreateServerRoleResult.NotFound();
            }

            var roleLevel = ResolveNewRoleLevel(scope, requestedLevel);
            if (roleLevel == null)
            {
                return CreateServerRoleResult.InvalidRequest();
            }

            if (await this._db.ServerRoles.AnyAsync(
                    candidate =>
                        candidate.ServerId == serverId &&
                        candidate.Title == title,
                    cancellationToken))
            {
                return CreateServerRoleResult.TitleConflict();
            }

            var now = DateTime.UtcNow;
            var role = new ServerRole
            {
                Id = Guid.NewGuid(),
                ServerId = serverId,
                Code = null,
                Title = title,
                Description = description,
                Color = color,
                Mentionable = mentionable,
                CreatedByUserId = currentUserId,
                Level = roleLevel.Value,
                IsSystem = false,
                PermissionMask = ServerRolePermissionMaskCodec.Encode(
                    permissionWriteSet.Mask),
                PermissionSchemaVersion = ServerPermissionRegistry.SchemaVersion,
                CreatedAt = now,
                UpdatedAt = now
            };

            this._db.ServerRoles.Add(role);
            foreach (var permission in permissionWriteSet.LegacyPermissions)
            {
                role.Permissions.Add(new ServerRolePermission
                {
                    RoleId = role.Id,
                    PermissionId = permission.Id,
                    Permission = permission,
                    CreatedAt = now,
                    IsGranted = true
                });
            }
            this._access.AddAudit(serverId, ServerGovernanceIds.AuditRoleCreated, currentUserId, relatedRoleId: role.Id);
            await this._db.StageServerAclRevisionBumpAsync(serverId, cancellationToken);
            await this._db.SaveChangesAsync(cancellationToken);
            await transaction.CommitAsync(cancellationToken);
            this._spaceAuthorization.InvalidateServer(serverId);

            await this._realtime.NotifyServerBestEffortAsync(
                this._logger,
                serverId,
                RealtimeEventNames.ServerGovernanceChanged,
                new { serverId, roleId = role.Id },
                CancellationToken.None);

            var response = await this.LoadRoleResponseAsync(role.Id, cancellationToken);
            return response == null
                ? CreateServerRoleResult.NotFound()
                : CreateServerRoleResult.Success(response);
        }

        public Task<UpdateServerRoleResult> UpdateRoleAsync(
            Guid currentUserId,
            Guid serverId,
            Guid roleId,
            UpdateServerRoleRequest request,
            CancellationToken cancellationToken = default)
        {
            if (!TryNormalizeRoleUpdate(
                    request,
                    out var title,
                    out var description,
                    out var color,
                    out var permissionSchemaVersion,
                    out var permissionCodes))
            {
                return Task.FromResult(UpdateServerRoleResult.InvalidRequest());
            }

            return this.ExecuteRoleUpdateAsync(
                currentUserId,
                serverId,
                roleId,
                new RoleUpdateCommand(
                    UpdateMetadata: true,
                    Title: title,
                    Description: description,
                    Color: color,
                    Mentionable: request.Mentionable,
                    PermissionSchemaVersion: permissionSchemaVersion,
                    PermissionCodes: permissionCodes,
                    ExpectedVersion: request.ExpectedVersion),
                cancellationToken);
        }

        public Task<UpdateServerRoleResult> UpdateRolePermissionsAsync(
            Guid currentUserId,
            Guid serverId,
            Guid roleId,
            UpdateServerRolePermissionsRequest request,
            CancellationToken cancellationToken = default)
        {
            if ((request.ExpectedVersion.HasValue &&
                 request.ExpectedVersion.Value == Guid.Empty) ||
                !TryNormalizePermissionCodes(
                    request.PermissionCodes,
                    request.PermissionSchemaVersion,
                    out var permissionCodes))
            {
                return Task.FromResult(UpdateServerRoleResult.InvalidRequest());
            }

            return this.ExecuteRoleUpdateAsync(
                currentUserId,
                serverId,
                roleId,
                new RoleUpdateCommand(
                    UpdateMetadata: false,
                    Title: null,
                    Description: null,
                    Color: null,
                    Mentionable: false,
                    PermissionSchemaVersion: request.PermissionSchemaVersion,
                    PermissionCodes: permissionCodes,
                    ExpectedVersion: request.ExpectedVersion),
                cancellationToken);
        }

        private async Task<UpdateServerRoleResult> ExecuteRoleUpdateAsync(
            Guid currentUserId,
            Guid serverId,
            Guid roleId,
            RoleUpdateCommand command,
            CancellationToken cancellationToken)
        {
            try
            {
                return await this.ExecuteRoleUpdateTransactionAsync(
                    currentUserId,
                    serverId,
                    roleId,
                    command,
                    cancellationToken);
            }
            catch (DbUpdateConcurrencyException)
            {
                this._db.ChangeTracker.Clear();
                return UpdateServerRoleResult.Conflict();
            }
            catch (Exception exception) when (IsPostgresSerializationFailure(exception))
            {
                this._db.ChangeTracker.Clear();
                return UpdateServerRoleResult.Conflict();
            }
            catch (Exception exception) when (IsServerRoleTitleConflict(exception))
            {
                this._db.ChangeTracker.Clear();
                return UpdateServerRoleResult.TitleConflict();
            }
        }

        private async Task<UpdateServerRoleResult> ExecuteRoleUpdateTransactionAsync(
            Guid currentUserId,
            Guid serverId,
            Guid roleId,
            RoleUpdateCommand command,
            CancellationToken cancellationToken)
        {
            await using var transaction = await this._db.Database.BeginTransactionAsync(
                IsolationLevel.Serializable,
                cancellationToken);
            var scope = await this.LoadRoleManagementScopeAsync(
                currentUserId,
                serverId,
                cancellationToken);
            if (scope == null ||
                (!scope.CanManageRoles && !scope.CanManageDefaultPermissions))
            {
                return UpdateServerRoleResult.NotFound();
            }

            var role = await this._db.ServerRoles
                .Include(x => x.Permissions)
                    .ThenInclude(x => x.Permission)
                .FirstOrDefaultAsync(
                    x => x.Id == roleId &&
                         x.ServerId == serverId &&
                         x.DeletedAt == null,
                    cancellationToken);

            if (role == null)
            {
                return UpdateServerRoleResult.NotFound();
            }

            var isDefaultRole =
                role.Kind == ServerRoleKindCodes.Everyone;
            if (isDefaultRole)
            {
                if (!scope.CanManageDefaultPermissions ||
                    (command.UpdateMetadata &&
                     (!string.Equals(role.Title, command.Title, StringComparison.Ordinal) ||
                      !string.Equals(role.Description, command.Description, StringComparison.Ordinal) ||
                      !string.Equals(role.Color, command.Color, StringComparison.Ordinal) ||
                      role.Mentionable != command.Mentionable)))
                {
                    return UpdateServerRoleResult.NotFound();
                }
            }
            else if (!scope.CanManageRoles ||
                     role.IsSystem ||
                     !this.CanManageRole(scope, role))
            {
                return UpdateServerRoleResult.NotFound();
            }

            if (command.ExpectedVersion.HasValue &&
                role.Version != command.ExpectedVersion.Value)
            {
                return UpdateServerRoleResult.Conflict();
            }

            var permissionWriteSet = await this.ResolvePermissionWriteSetAsync(
                command.PermissionSchemaVersion,
                command.PermissionCodes,
                cancellationToken);
            if (permissionWriteSet == null ||
                !CanGrantPermissions(scope, permissionWriteSet.Mask) ||
                (isDefaultRole && permissionWriteSet.Mask.Contains(
                    ServerPermissionRegistry.Administrator.Bit)))
            {
                return permissionWriteSet == null
                    ? UpdateServerRoleResult.InvalidRequest()
                    : UpdateServerRoleResult.NotFound();
            }

            if (command.UpdateMetadata &&
                !string.Equals(role.Title, command.Title, StringComparison.Ordinal) &&
                await this._db.ServerRoles.AnyAsync(
                    candidate =>
                        candidate.ServerId == serverId &&
                        candidate.Id != roleId &&
                        candidate.Title == command.Title,
                    cancellationToken))
            {
                return UpdateServerRoleResult.TitleConflict();
            }

            if (!this.TryGetRolePermissionMask(role, out var currentPermissionMask))
            {
                return UpdateServerRoleResult.InvalidRequest();
            }

            var currentPermissionCodes = ServerPermissionRegistry.GetCodes(
                currentPermissionMask);
            var permissionsChanged = currentPermissionMask != permissionWriteSet.Mask;
            var metadataChanged = command.UpdateMetadata &&
                (!string.Equals(role.Title, command.Title, StringComparison.Ordinal) ||
                 !string.Equals(role.Description, command.Description, StringComparison.Ordinal) ||
                 !string.Equals(role.Color, command.Color, StringComparison.Ordinal) ||
                 role.Mentionable != command.Mentionable);

            if (!metadataChanged && !permissionsChanged)
            {
                var unchanged = await this.LoadRoleResponseAsync(role.Id, cancellationToken);
                return unchanged == null
                    ? UpdateServerRoleResult.NotFound()
                    : UpdateServerRoleResult.Success(unchanged);
            }

            var before = CreateRoleAuditState(role, currentPermissionCodes);
            var clearsSelectedDisplayColor =
                metadataChanged &&
                role.Color != null &&
                command.Color == null;
            if (metadataChanged)
            {
                role.Title = command.Title!;
                role.Description = command.Description;
                role.Color = command.Color;
                role.Mentionable = command.Mentionable;
            }

            if (permissionsChanged)
            {
                this.ApplyRolePermissions(
                    role,
                    permissionWriteSet.LegacyPermissions,
                    DateTime.UtcNow);
                role.PermissionMask = ServerRolePermissionMaskCodec.Encode(
                    permissionWriteSet.Mask);
                role.PermissionSchemaVersion = ServerPermissionRegistry.SchemaVersion;
            }

            role.UpdatedAt = DateTime.UtcNow;
            role.Version = Guid.NewGuid();
            var resetDisplayColorCount = 0;
            if (clearsSelectedDisplayColor)
            {
                var nextRolesVersion = Guid.NewGuid();
                resetDisplayColorCount = await this._db.ServerMembers
                    .Where(member =>
                        member.ServerId == serverId &&
                        member.DisplayColorRoleId == role.Id)
                    .ExecuteUpdateAsync(
                        setters => setters
                            .SetProperty(
                                member => member.DisplayColorMode,
                                ServerMemberDisplayColorModeCodes.Auto)
                            .SetProperty(
                                member => member.DisplayColorRoleId,
                                (Guid?)null)
                            .SetProperty(
                                member => member.RolesVersion,
                                nextRolesVersion)
                            .SetProperty(
                                member => member.UpdatedAt,
                                role.UpdatedAt),
                        cancellationToken);
            }
            var after = CreateRoleAuditState(role, permissionWriteSet.Codes);
            this._access.AddAudit(
                serverId,
                ServerGovernanceIds.AuditRoleUpdated,
                currentUserId,
                relatedRoleId: role.Id,
                payload: JsonSerializer.Serialize(new { before, after }));
            if (permissionsChanged)
            {
                await this._db.StageServerAclRevisionBumpAsync(serverId, cancellationToken);
            }

            await this._db.SaveChangesAsync(cancellationToken);
            await transaction.CommitAsync(cancellationToken);
            if (permissionsChanged)
            {
                this._spaceAuthorization.InvalidateServer(serverId);
                await this._voiceAccess.ReconcileServerBestEffortAsync(serverId);
            }

            await this._realtime.NotifyServerBestEffortAsync(
                this._logger,
                serverId,
                RealtimeEventNames.ServerGovernanceChanged,
                new { serverId, roleId = role.Id },
                CancellationToken.None);
            if (resetDisplayColorCount > 0)
            {
                await this._realtime.NotifyServerBestEffortAsync(
                    this._logger,
                    serverId,
                    RealtimeEventNames.ServerMembersChanged,
                    new { serverId, roleId = role.Id, displayColorReset = true },
                    CancellationToken.None);
            }
            if (permissionsChanged)
            {
                await this.NotifyEffectiveSpaceAccessChangedAsync(serverId);
            }

            var response = await this.LoadRoleResponseAsync(role.Id, cancellationToken);
            return response == null
                ? UpdateServerRoleResult.NotFound()
                : UpdateServerRoleResult.Success(response);
        }

        public async Task<DuplicateServerRoleResult> DuplicateRoleAsync(
            Guid currentUserId,
            Guid serverId,
            Guid roleId,
            DuplicateServerRoleRequest request,
            CancellationToken cancellationToken = default)
        {
            if (request.ExpectedVersion == Guid.Empty)
            {
                return DuplicateServerRoleResult.InvalidRequest();
            }

            try
            {
                return await this.DuplicateRoleTransactionAsync(
                    currentUserId,
                    serverId,
                    roleId,
                    request,
                    cancellationToken);
            }
            catch (DbUpdateConcurrencyException)
            {
                this._db.ChangeTracker.Clear();
                return DuplicateServerRoleResult.Conflict();
            }
            catch (Exception exception) when (IsPostgresSerializationFailure(exception))
            {
                this._db.ChangeTracker.Clear();
                return DuplicateServerRoleResult.Conflict();
            }
            catch (Exception exception) when (IsServerRoleTitleConflict(exception))
            {
                this._db.ChangeTracker.Clear();
                return DuplicateServerRoleResult.TitleConflict();
            }
        }

        private async Task<DuplicateServerRoleResult> DuplicateRoleTransactionAsync(
            Guid currentUserId,
            Guid serverId,
            Guid roleId,
            DuplicateServerRoleRequest request,
            CancellationToken cancellationToken)
        {
            await using var transaction = await this._db.Database.BeginTransactionAsync(
                IsolationLevel.Serializable,
                cancellationToken);
            var scope = await this.LoadRoleManagementScopeAsync(
                currentUserId,
                serverId,
                cancellationToken);
            if (scope == null || !scope.CanManageRoles)
            {
                return DuplicateServerRoleResult.NotFound();
            }

            var source = await this._db.ServerRoles
                .AsNoTracking()
                .Include(role => role.Permissions)
                    .ThenInclude(permission => permission.Permission)
                .FirstOrDefaultAsync(
                    role =>
                        role.Id == roleId &&
                        role.ServerId == serverId &&
                        role.DeletedAt == null,
                    cancellationToken);
            if (source == null ||
                source.IsSystem ||
                !this.CanManageRole(scope, source))
            {
                return DuplicateServerRoleResult.NotFound();
            }

            if (source.Version != request.ExpectedVersion)
            {
                return DuplicateServerRoleResult.Conflict();
            }

            var sourceIsAdministrator = this.RoleGrantsManageServer(source);
            if (sourceIsAdministrator && !request.ConfirmAdministrator)
            {
                return DuplicateServerRoleResult.AdministratorConfirmationRequired();
            }

            if (!this.TryGetRolePermissionMask(source, out var sourcePermissionMask) ||
                !CanGrantPermissions(scope, sourcePermissionMask))
            {
                return DuplicateServerRoleResult.NotFound();
            }

            var permissionCodes = ServerPermissionRegistry.GetCodes(
                sourcePermissionMask);
            var legacyPermissions = await this.LoadLegacyPermissionsForMaskAsync(
                sourcePermissionMask,
                cancellationToken);
            if (legacyPermissions == null)
            {
                return DuplicateServerRoleResult.InvalidRequest();
            }

            var title = await this.GenerateDuplicateRoleTitleAsync(
                serverId,
                source.Title,
                cancellationToken);
            var maximumLevel = await this._db.ServerRoles
                .AsNoTracking()
                .Where(role =>
                    role.ServerId == serverId &&
                    role.DeletedAt == null)
                .Select(role => (int?)role.Level)
                .MaxAsync(cancellationToken);
            if (title == null || maximumLevel is null or int.MaxValue)
            {
                return DuplicateServerRoleResult.InvalidRequest();
            }

            var now = DateTime.UtcNow;
            var duplicate = new ServerRole
            {
                Id = Guid.NewGuid(),
                ServerId = serverId,
                Code = null,
                Title = title,
                Description = source.Description,
                Kind = ServerRoleKindCodes.Standard,
                Color = source.Color,
                Mentionable = false,
                CreatedByUserId = currentUserId,
                Level = maximumLevel.Value + 1,
                IsSystem = false,
                PermissionMask = ServerRolePermissionMaskCodec.Encode(
                    sourcePermissionMask),
                PermissionSchemaVersion = ServerPermissionRegistry.SchemaVersion,
                CreatedAt = now,
                UpdatedAt = now
            };

            this._db.ServerRoles.Add(duplicate);
            foreach (var permission in legacyPermissions)
            {
                duplicate.Permissions.Add(new ServerRolePermission
                {
                    RoleId = duplicate.Id,
                    PermissionId = permission.Id,
                    Permission = permission,
                    CreatedAt = now,
                    IsGranted = true
                });
            }
            this._access.AddAudit(
                serverId,
                ServerGovernanceIds.AuditRoleCreated,
                currentUserId,
                relatedRoleId: duplicate.Id,
                payload: JsonSerializer.Serialize(new
                {
                    action = "role_duplicated",
                    sourceRoleId = source.Id,
                    sourceVersion = source.Version,
                    permissionCodes
                }));
            await this._db.StageServerAclRevisionBumpAsync(serverId, cancellationToken);
            await this._db.SaveChangesAsync(cancellationToken);
            await transaction.CommitAsync(cancellationToken);
            this._spaceAuthorization.InvalidateServer(serverId);

            await this._realtime.NotifyServerBestEffortAsync(
                this._logger,
                serverId,
                RealtimeEventNames.ServerGovernanceChanged,
                new
                {
                    serverId,
                    roleId = duplicate.Id,
                    sourceRoleId = source.Id
                },
                CancellationToken.None);

            var response = await this.LoadRoleResponseAsync(
                duplicate.Id,
                cancellationToken);
            return response == null
                ? DuplicateServerRoleResult.NotFound()
                : DuplicateServerRoleResult.Success(response);
        }

        public async Task<ServerRoleDeletionImpactResponse?> GetDeletionImpactAsync(
            Guid currentUserId,
            Guid serverId,
            Guid roleId,
            CancellationToken cancellationToken = default)
        {
            var scope = await this.LoadRoleManagementScopeAsync(
                currentUserId,
                serverId,
                cancellationToken);
            if (scope == null || !scope.CanManageRoles)
            {
                return null;
            }

            var role = await this._db.ServerRoles
                .AsNoTracking()
                .Include(candidate => candidate.Permissions)
                    .ThenInclude(permission => permission.Permission)
                .FirstOrDefaultAsync(
                    candidate =>
                        candidate.Id == roleId &&
                        candidate.ServerId == serverId &&
                        candidate.DeletedAt == null,
                    cancellationToken);
            if (role == null || !this.CanManageRole(scope, role))
            {
                return null;
            }

            return await this.LoadDeletionImpactAsync(role, cancellationToken);
        }

        public async Task<DeleteServerRoleResult> DeleteRoleAsync(
            Guid currentUserId,
            Guid serverId,
            Guid roleId,
            Guid expectedVersion,
            CancellationToken cancellationToken = default)
        {
            if (expectedVersion == Guid.Empty)
            {
                return DeleteServerRoleResult.InvalidRequest();
            }

            try
            {
                return await this.DeleteRoleTransactionAsync(
                    currentUserId,
                    serverId,
                    roleId,
                    expectedVersion,
                    cancellationToken);
            }
            catch (DbUpdateConcurrencyException)
            {
                this._db.ChangeTracker.Clear();
                return DeleteServerRoleResult.Conflict();
            }
            catch (Exception exception) when (IsPostgresSerializationFailure(exception))
            {
                this._db.ChangeTracker.Clear();
                return DeleteServerRoleResult.Conflict();
            }
        }

        private async Task<DeleteServerRoleResult> DeleteRoleTransactionAsync(
            Guid currentUserId,
            Guid serverId,
            Guid roleId,
            Guid expectedVersion,
            CancellationToken cancellationToken)
        {
            await using var transaction = await this._db.Database.BeginTransactionAsync(
                IsolationLevel.Serializable,
                cancellationToken);
            var scope = await this.LoadRoleManagementScopeAsync(
                currentUserId,
                serverId,
                cancellationToken);
            if (scope == null || !scope.CanManageRoles)
            {
                return DeleteServerRoleResult.NotFound();
            }

            var role = await this._db.ServerRoles
                .Include(candidate => candidate.Permissions)
                    .ThenInclude(permission => permission.Permission)
                .FirstOrDefaultAsync(
                    candidate =>
                        candidate.Id == roleId &&
                        candidate.ServerId == serverId &&
                        candidate.DeletedAt == null,
                    cancellationToken);
            if (role == null ||
                role.IsSystem ||
                !this.CanManageRole(scope, role))
            {
                return DeleteServerRoleResult.NotFound();
            }

            if (role.Version != expectedVersion)
            {
                return DeleteServerRoleResult.Conflict();
            }

            var impact = await this.LoadDeletionImpactAsync(role, cancellationToken);
            if (impact.HasBlockingDependencies)
            {
                return DeleteServerRoleResult.HasDependencies(impact);
            }

            var now = DateTime.UtcNow;
            role.DeletedAt = now;
            role.UpdatedAt = now;
            role.Version = Guid.NewGuid();
            this._access.AddAudit(
                serverId,
                ServerGovernanceIds.AuditRoleUpdated,
                currentUserId,
                relatedRoleId: role.Id,
                payload: JsonSerializer.Serialize(new
                {
                    action = "role_deleted",
                    beforeVersion = expectedVersion,
                    impact
                }));
            await this._db.StageServerAclRevisionBumpAsync(serverId, cancellationToken);
            await this._db.SaveChangesAsync(cancellationToken);
            await transaction.CommitAsync(cancellationToken);
            this._spaceAuthorization.InvalidateServer(serverId);

            await this._realtime.NotifyServerBestEffortAsync(
                this._logger,
                serverId,
                RealtimeEventNames.ServerGovernanceChanged,
                new { serverId, roleId = role.Id, deleted = true },
                CancellationToken.None);
            return DeleteServerRoleResult.Success();
        }

        private async Task<ServerRoleDeletionImpactResponse> LoadDeletionImpactAsync(
            ServerRole role,
            CancellationToken cancellationToken)
        {
            var directAssignmentCount = await this._db.ServerMemberRoles
                .AsNoTracking()
                .CountAsync(assignment =>
                    assignment.ServerId == role.ServerId &&
                    assignment.RoleId == role.Id &&
                    assignment.RevokedAt == null,
                    cancellationToken);
            var roleAclCount = await this._db.SpacePermissionOverrides
                .AsNoTracking()
                .CountAsync(permissionOverride =>
                    permissionOverride.ServerId == role.ServerId &&
                    permissionOverride.RoleId == role.Id,
                    cancellationToken);
            var protectedAclCount = await this._db.SpacePermissionOverrides
                .AsNoTracking()
                .CountAsync(permissionOverride =>
                    permissionOverride.ServerId == role.ServerId &&
                    permissionOverride.ProtectionRoleId == role.Id,
                    cancellationToken);
            var requiredSpaceCount = await this._db.Spaces
                .AsNoTracking()
                .CountAsync(space =>
                    space.ServerId == role.ServerId &&
                    space.RequiredServerRoleId == role.Id,
                    cancellationToken);
            var protectedSpaceCount = await this._db.Spaces
                .AsNoTracking()
                .CountAsync(space =>
                    space.ServerId == role.ServerId &&
                    space.ProtectionRoleId == role.Id,
                    cancellationToken);
            var createdWithRoleSpaceCount = await this._db.Spaces
                .AsNoTracking()
                .CountAsync(space =>
                    space.ServerId == role.ServerId &&
                    space.CreatedWithRoleId == role.Id,
                    cancellationToken);
            var displayColorMemberCount = await this._db.ServerMembers
                .AsNoTracking()
                .CountAsync(member =>
                    member.ServerId == role.ServerId &&
                    member.DisplayColorRoleId == role.Id,
                    cancellationToken);
            var hasBlockingDependencies =
                directAssignmentCount > 0 ||
                roleAclCount > 0 ||
                protectedAclCount > 0 ||
                requiredSpaceCount > 0 ||
                protectedSpaceCount > 0 ||
                displayColorMemberCount > 0;

            return new ServerRoleDeletionImpactResponse
            {
                RoleId = role.Id,
                Version = role.Version,
                DirectAssignmentCount = directAssignmentCount,
                RoleAclCount = roleAclCount,
                ProtectedAclCount = protectedAclCount,
                RequiredSpaceCount = requiredSpaceCount,
                ProtectedSpaceCount = protectedSpaceCount,
                CreatedWithRoleSpaceCount = createdWithRoleSpaceCount,
                DisplayColorMemberCount = displayColorMemberCount,
                HasBlockingDependencies = hasBlockingDependencies,
                CanDelete = !role.IsSystem && !hasBlockingDependencies
            };
        }

        public async Task<ReorderServerRolesResult> ReorderRolesAsync(
            Guid currentUserId,
            Guid serverId,
            ReorderServerRolesRequest request,
            CancellationToken cancellationToken = default)
        {
            if (request.ExpectedAuthorizationVersion == Guid.Empty ||
                request.Roles == null ||
                request.Roles.Count > 10_000 ||
                request.Roles.Any(item =>
                    item == null ||
                    item.RoleId == Guid.Empty ||
                    item.ExpectedVersion == Guid.Empty) ||
                request.Roles.Select(item => item.RoleId).Distinct().Count() !=
                request.Roles.Count)
            {
                return ReorderServerRolesResult.InvalidRequest();
            }

            try
            {
                return await this.ReorderRolesTransactionAsync(
                    currentUserId,
                    serverId,
                    request,
                    cancellationToken);
            }
            catch (DbUpdateConcurrencyException)
            {
                this._db.ChangeTracker.Clear();
                return ReorderServerRolesResult.Conflict();
            }
            catch (Exception exception) when (IsPostgresSerializationFailure(exception))
            {
                this._db.ChangeTracker.Clear();
                return ReorderServerRolesResult.Conflict();
            }
        }

        private async Task<ReorderServerRolesResult> ReorderRolesTransactionAsync(
            Guid currentUserId,
            Guid serverId,
            ReorderServerRolesRequest request,
            CancellationToken cancellationToken)
        {
            await using var transaction = await this._db.Database.BeginTransactionAsync(
                IsolationLevel.Serializable,
                cancellationToken);
            var scope = await this.LoadRoleManagementScopeAsync(
                currentUserId,
                serverId,
                cancellationToken);
            if (scope == null || !scope.CanManageRoles)
            {
                return ReorderServerRolesResult.NotFound();
            }

            var server = await this._db.Servers.FirstOrDefaultAsync(
                candidate =>
                    candidate.Id == serverId &&
                    candidate.DeletedAt == null,
                cancellationToken);
            if (server == null)
            {
                return ReorderServerRolesResult.NotFound();
            }

            if (server.AuthorizationVersion != request.ExpectedAuthorizationVersion)
            {
                return ReorderServerRolesResult.Conflict();
            }

            var roles = await this._db.ServerRoles
                .Where(role =>
                    role.ServerId == serverId &&
                    !role.IsSystem &&
                    role.DeletedAt == null)
                .OrderBy(role => role.Level)
                .ThenBy(role => role.CreatedAt)
                .ThenBy(role => role.Id)
                .ToListAsync(cancellationToken);
            var rolesById = roles.ToDictionary(role => role.Id);
            if (roles.Count != request.Roles.Count ||
                request.Roles.Any(item => !rolesById.ContainsKey(item.RoleId)))
            {
                return ReorderServerRolesResult.InvalidRequest();
            }

            if (request.Roles.Any(item =>
                    rolesById[item.RoleId].Version != item.ExpectedVersion))
            {
                return ReorderServerRolesResult.Conflict();
            }

            var currentOrder = roles.Select(role => role.Id).ToList();
            var requestedOrder = request.Roles.Select(item => item.RoleId).ToList();
            if (currentOrder.SequenceEqual(requestedOrder))
            {
                return ReorderServerRolesResult.Success();
            }

            if (!scope.IsOwner)
            {
                var repositionedRoleIds = currentOrder
                    .Select((roleId, index) => new
                    {
                        RoleId = roleId,
                        Index = index
                    })
                    .Where(item => requestedOrder[item.Index] != item.RoleId)
                    .Select(item => item.RoleId)
                    .Concat(requestedOrder
                        .Select((roleId, index) => new
                        {
                            RoleId = roleId,
                            Index = index
                        })
                        .Where(item => currentOrder[item.Index] != item.RoleId)
                        .Select(item => item.RoleId))
                    .Distinct()
                    .ToList();
                if (repositionedRoleIds.Any(roleId =>
                        !this.CanManageRole(scope, rolesById[roleId])))
                {
                    return ReorderServerRolesResult.NotFound();
                }
            }

            var now = DateTime.UtcNow;
            var changedRoleIds = new List<Guid>();
            for (var index = 0; index < requestedOrder.Count; index++)
            {
                var role = rolesById[requestedOrder[index]];
                var level = 100 + index;
                if (role.Level == level)
                {
                    continue;
                }

                role.Level = level;
                role.UpdatedAt = now;
                role.Version = Guid.NewGuid();
                changedRoleIds.Add(role.Id);
            }

            if (changedRoleIds.Count == 0)
            {
                return ReorderServerRolesResult.Success();
            }

            this._access.AddAudit(
                serverId,
                ServerGovernanceIds.AuditRoleUpdated,
                currentUserId,
                payload: JsonSerializer.Serialize(new
                {
                    action = "roles_reordered",
                    beforeRoleIds = currentOrder,
                    afterRoleIds = requestedOrder,
                    changedRoleIds
                }));
            await this._db.StageServerAclRevisionBumpAsync(serverId, cancellationToken);
            await this._db.SaveChangesAsync(cancellationToken);
            await transaction.CommitAsync(cancellationToken);
            this._spaceAuthorization.InvalidateServer(serverId);

            await this._realtime.NotifyServerBestEffortAsync(
                this._logger,
                serverId,
                RealtimeEventNames.ServerGovernanceChanged,
                new { serverId, reordered = true },
                CancellationToken.None);
            return ReorderServerRolesResult.Success();
        }

        public async Task<ServerMemberRoleResponse?> AssignRoleAsync(
            Guid currentUserId,
            Guid serverId,
            Guid memberId,
            AssignServerRoleRequest request,
            CancellationToken cancellationToken = default)
        {
            await using var transaction = await this._db.Database.BeginTransactionAsync(
                IsolationLevel.Serializable,
                cancellationToken);
            var scope = await this.LoadRoleManagementScopeAsync(
                currentUserId,
                serverId,
                cancellationToken);
            if (scope == null || !scope.CanAssignRoles)
            {
                return null;
            }

            var canAffectMember = await this.CanAffectMemberAsync(
                scope,
                currentUserId,
                serverId,
                memberId,
                cancellationToken);
            var role = await this._db.ServerRoles
                .Include(x => x.Permissions)
                    .ThenInclude(x => x.Permission)
                .FirstOrDefaultAsync(
                x => x.Id == request.RoleId &&
                     x.ServerId == serverId &&
                     x.DeletedAt == null,
                cancellationToken);

            if (!canAffectMember ||
                role == null ||
                role.IsSystem ||
                !this.CanManageRole(scope, role))
            {
                return null;
            }

            var existing = await this._db.ServerMemberRoles.FirstOrDefaultAsync(
                x => x.ServerId == serverId &&
                     x.MemberId == memberId &&
                     x.RoleId == request.RoleId,
                cancellationToken);

            if (existing is { RevokedAt: null })
            {
                await transaction.CommitAsync(cancellationToken);
                return ServerGovernanceMapper.ToMemberRoleResponse(existing, role.Title);
            }

            var now = DateTime.UtcNow;
            var assignment = existing ?? new ServerMemberRole
            {
                Id = Guid.NewGuid(),
                ServerId = serverId,
                MemberId = memberId,
                RoleId = request.RoleId,
                AssignedByUserId = currentUserId,
                AssignedAt = now
            };

            if (existing == null)
            {
                this._db.ServerMemberRoles.Add(assignment);
            }
            else
            {
                assignment.AssignedByUserId = currentUserId;
                assignment.AssignedAt = now;
                assignment.RevokedAt = null;
                assignment.RevokedByUserId = null;
            }

            this._access.AddAudit(serverId, ServerGovernanceIds.AuditRoleAssigned, currentUserId, relatedRoleId: role.Id);
            await this._db.StageMemberRolesVersionBumpAsync(
                serverId,
                memberId,
                cancellationToken);
            await this._db.StageServerAclRevisionBumpAsync(serverId, cancellationToken);
            await this._db.SaveChangesAsync(cancellationToken);
            await transaction.CommitAsync(cancellationToken);
            this._spaceAuthorization.InvalidateServer(serverId);
            await this._voiceAccess.ReconcileServerBestEffortAsync(serverId);

            await this._realtime.NotifyServerBestEffortAsync(
                this._logger,
                serverId,
                RealtimeEventNames.ServerMembersChanged,
                new { serverId, memberId },
                CancellationToken.None);
            await this._realtime.NotifyServerBestEffortAsync(
                this._logger,
                serverId,
                RealtimeEventNames.ServerGovernanceChanged,
                new { serverId, roleId = role.Id },
                CancellationToken.None);
            await this.NotifyEffectiveSpaceAccessChangedAsync(serverId);

            return ServerGovernanceMapper.ToMemberRoleResponse(assignment, role.Title);
        }

        public async Task<bool> RevokeMemberRoleAsync(
            Guid currentUserId,
            Guid serverId,
            Guid memberRoleId,
            CancellationToken cancellationToken = default)
        {
            await using var transaction = await this._db.Database.BeginTransactionAsync(
                IsolationLevel.Serializable,
                cancellationToken);
            var scope = await this.LoadRoleManagementScopeAsync(
                currentUserId,
                serverId,
                cancellationToken);
            if (scope == null || !scope.CanAssignRoles)
            {
                return false;
            }

            var assignment = await this._db.ServerMemberRoles
                .Include(x => x.Role)
                    .ThenInclude(x => x.Permissions)
                        .ThenInclude(x => x.Permission)
                .FirstOrDefaultAsync(
                    x => x.Id == memberRoleId &&
                         x.ServerId == serverId &&
                         x.RevokedAt == null,
                    cancellationToken);

            if (assignment == null ||
                assignment.Role.IsSystem ||
                !this.CanManageRole(scope, assignment.Role) ||
                !await this.CanAffectMemberAsync(
                    scope,
                    currentUserId,
                    serverId,
                    assignment.MemberId,
                    cancellationToken))
            {
                return false;
            }

            var revokedAt = DateTime.UtcNow;
            assignment.RevokedAt = revokedAt;
            assignment.RevokedByUserId = currentUserId;
            this._access.AddAudit(serverId, ServerGovernanceIds.AuditRoleRevoked, currentUserId, relatedRoleId: assignment.RoleId);
            await this._db.StageMemberRolesVersionBumpAsync(
                serverId,
                assignment.MemberId,
                cancellationToken);
            var targetMember = this._db.ServerMembers.Local.Single(member =>
                member.Id == assignment.MemberId &&
                member.ServerId == serverId);
            if (targetMember.DisplayColorRoleId == assignment.RoleId)
            {
                targetMember.DisplayColorMode = ServerMemberDisplayColorModeCodes.Auto;
                targetMember.DisplayColorRoleId = null;
                targetMember.UpdatedAt = revokedAt;
            }
            await this._db.StageServerAclRevisionBumpAsync(serverId, cancellationToken);
            await this._db.SaveChangesAsync(cancellationToken);
            await transaction.CommitAsync(cancellationToken);
            this._spaceAuthorization.InvalidateServer(serverId);
            await this._voiceAccess.ReconcileServerBestEffortAsync(serverId);

            await this._realtime.NotifyServerBestEffortAsync(
                this._logger,
                serverId,
                RealtimeEventNames.ServerMembersChanged,
                new { serverId, assignment.MemberId },
                CancellationToken.None);
            await this._realtime.NotifyServerBestEffortAsync(
                this._logger,
                serverId,
                RealtimeEventNames.ServerGovernanceChanged,
                new { serverId, roleId = assignment.RoleId },
                CancellationToken.None);
            await this.NotifyEffectiveSpaceAccessChangedAsync(serverId);

            return true;
        }

        private async Task SetRolePermissionsAsync(
            ServerRole role,
            IReadOnlyList<string> permissionCodes,
            DateTime now,
            CancellationToken cancellationToken)
        {
            var codes = permissionCodes.Select(NormalizeCode).Distinct().ToList();
            var serverPermissionIds = ServerGovernanceIds.ServerPermissionIds.ToArray();
            var permissions = await this._db.PermissionCatalog
                .Where(x =>
                    serverPermissionIds.Contains(x.Id) &&
                    codes.Contains(x.Code))
                .ToListAsync(cancellationToken);

            foreach (var permission in permissions)
            {
                role.Permissions.Add(new ServerRolePermission
                {
                    RoleId = role.Id,
                    PermissionId = permission.Id,
                    CreatedAt = now,
                    IsGranted = true
                });
            }
        }

        private async Task<IReadOnlyList<PermissionCatalog>> LoadServerPermissionsAsync(
            IReadOnlyList<string> permissionCodes,
            CancellationToken cancellationToken)
        {
            if (permissionCodes.Count == 0)
            {
                return [];
            }

            var serverPermissionIds = ServerGovernanceIds.ServerPermissionIds.ToArray();
            return await this._db.PermissionCatalog
                .Where(permission =>
                    serverPermissionIds.Contains(permission.Id) &&
                    permissionCodes.Contains(permission.Code))
                .ToListAsync(cancellationToken);
        }

        private async Task<PermissionWriteSet?> ResolvePermissionWriteSetAsync(
            int? permissionSchemaVersion,
            IReadOnlyList<string> permissionCodes,
            CancellationToken cancellationToken)
        {
            if (permissionSchemaVersion == ServerPermissionRegistry.SchemaVersion)
            {
                PermissionMask256 mask;
                try
                {
                    mask = ServerPermissionRegistry.CreateMask(permissionCodes);
                }
                catch (KeyNotFoundException)
                {
                    return null;
                }

                var legacyPermissions = await this.LoadLegacyPermissionsForMaskAsync(
                    mask,
                    cancellationToken);
                return legacyPermissions == null
                    ? null
                    : new PermissionWriteSet(
                        mask,
                        ServerPermissionRegistry.GetCodes(mask),
                        legacyPermissions);
            }

            if (permissionSchemaVersion != null)
            {
                return null;
            }

            var knownLegacyRequestPermissions = await this.LoadKnownPermissionsAsync(
                permissionCodes,
                cancellationToken);
            if (knownLegacyRequestPermissions.Count != permissionCodes.Count)
            {
                return null;
            }

            var serverPermissionIds = ServerGovernanceIds.ServerPermissionIds
                .ToHashSet();
            var legacyPermissionsForWrite = knownLegacyRequestPermissions
                .Where(permission => serverPermissionIds.Contains(permission.Id))
                .ToList();
            if (!this._legacyPermissionAdapter.TryCreateMask(
                    legacyPermissionsForWrite.Select(permission => permission.Id),
                    out var legacyMask))
            {
                return null;
            }

            return new PermissionWriteSet(
                legacyMask,
                ServerPermissionRegistry.GetCodes(legacyMask),
                legacyPermissionsForWrite);
        }

        private async Task<IReadOnlyList<PermissionCatalog>?> LoadLegacyPermissionsForMaskAsync(
            PermissionMask256 mask,
            CancellationToken cancellationToken)
        {
            var permissionIds = this._legacyPermissionAdapter
                .GetFullyRepresentedLegacyPermissionIds(mask);
            if (permissionIds.Count == 0)
            {
                return [];
            }

            var permissions = await this._db.PermissionCatalog
                .Where(permission => permissionIds.Contains(permission.Id))
                .ToListAsync(cancellationToken);
            return permissions.Count == permissionIds.Count
                ? permissions
                : null;
        }

        private bool TryGetRolePermissionMask(
            ServerRole role,
            out PermissionMask256 mask)
        {
            return ServerRolePermissionMaskResolver.TryResolve(
                role,
                this._legacyPermissionAdapter,
                out mask,
                out _);
        }

        private static bool TryGetPersistedRolePermissionMask(
            ServerRole role,
            out PermissionMask256 mask)
        {
            return ServerRolePermissionMaskCodec.TryDecode(
                role.PermissionMask,
                role.PermissionSchemaVersion,
                out mask);
        }

        private async Task<PermissionMask256?> ResolveRolePermissionFilterMaskAsync(
            string permissionCode,
            CancellationToken cancellationToken)
        {
            var granularCode = permissionCode.Trim().ToUpperInvariant();
            if (ServerPermissionRegistry.TryGet(
                    granularCode,
                    out var granularPermission))
            {
                return PermissionMask256.Empty.With(granularPermission.Bit);
            }

            // Retain the old query spelling as a compatibility alias, but
            // always evaluate the result against the role's persisted v1 mask.
            var legacyCode = NormalizeCode(permissionCode);
            var legacyPermissionId = await this._db.PermissionCatalog
                .AsNoTracking()
                .Where(permission =>
                    ServerGovernanceIds.ServerPermissionIds.Contains(permission.Id) &&
                    permission.Code == legacyCode)
                .Select(permission => (Guid?)permission.Id)
                .SingleOrDefaultAsync(cancellationToken);
            if (!legacyPermissionId.HasValue ||
                !this._legacyPermissionAdapter.TryCreateMask(
                    [legacyPermissionId.Value],
                    out var compatibilityMask))
            {
                return null;
            }

            return compatibilityMask;
        }

        private async Task<IReadOnlyList<PermissionCatalog>> LoadKnownPermissionsAsync(
            IReadOnlyList<string> permissionCodes,
            CancellationToken cancellationToken)
        {
            if (permissionCodes.Count == 0)
            {
                return [];
            }

            return await this._db.PermissionCatalog
                .Where(permission => permissionCodes.Contains(permission.Code))
                .ToListAsync(cancellationToken);
        }

        private async Task<string?> GenerateDuplicateRoleTitleAsync(
            Guid serverId,
            string sourceTitle,
            CancellationToken cancellationToken)
        {
            var occupiedTitles = (await this._db.ServerRoles
                    .AsNoTracking()
                    .Where(role => role.ServerId == serverId)
                    .Select(role => role.Title)
                    .ToListAsync(cancellationToken))
                .ToHashSet(StringComparer.Ordinal);

            for (var copyNumber = 1; copyNumber <= 10_000; copyNumber++)
            {
                var suffix = copyNumber == 1
                    ? " (copy)"
                    : $" (copy {copyNumber})";
                var prefixLength = 64 - suffix.Length;
                if (prefixLength < 1)
                {
                    return null;
                }

                var prefix = sourceTitle.Length <= prefixLength
                    ? sourceTitle
                    : sourceTitle[..prefixLength].TrimEnd();
                var candidate = prefix + suffix;
                if (!occupiedTitles.Contains(candidate))
                {
                    return candidate;
                }
            }

            return null;
        }

        private void ApplyRolePermissions(
            ServerRole role,
            IReadOnlyList<PermissionCatalog> desiredPermissions,
            DateTime now)
        {
            var serverPermissionIds = ServerGovernanceIds.ServerPermissionIds.ToHashSet();
            var desiredById = desiredPermissions.ToDictionary(permission => permission.Id);
            var existingById = role.Permissions
                .Where(permission => serverPermissionIds.Contains(permission.PermissionId))
                .ToDictionary(permission => permission.PermissionId);

            foreach (var existing in existingById.Values)
            {
                if (desiredById.ContainsKey(existing.PermissionId))
                {
                    existing.IsGranted = true;
                }
                else if (existing.IsGranted)
                {
                    this._db.ServerRolePermissions.Remove(existing);
                }
            }

            foreach (var desired in desiredPermissions)
            {
                if (existingById.ContainsKey(desired.Id))
                {
                    continue;
                }

                role.Permissions.Add(new ServerRolePermission
                {
                    RoleId = role.Id,
                    PermissionId = desired.Id,
                    Permission = desired,
                    CreatedAt = now,
                    IsGranted = true
                });
            }
        }

        private static IReadOnlyList<string> GetGrantedServerPermissionCodes(
            ServerRole role)
        {
            var serverPermissionIds = ServerGovernanceIds.ServerPermissionIds.ToHashSet();
            return role.Permissions
                .Where(permission =>
                    permission.IsGranted &&
                    serverPermissionIds.Contains(permission.PermissionId))
                .Select(permission => NormalizeCode(permission.Permission.Code))
                .Distinct(StringComparer.Ordinal)
                .OrderBy(code => code, StringComparer.Ordinal)
                .ToList();
        }

        private static object CreateRoleAuditState(
            ServerRole role,
            IReadOnlyList<string> permissionCodes)
        {
            return new
            {
                title = role.Title,
                description = role.Description,
                color = role.Color,
                mentionable = role.Mentionable,
                permissionCodes
            };
        }

        private async Task<ServerRoleResponse?> LoadRoleResponseAsync(
            Guid roleId,
            CancellationToken cancellationToken)
        {
            var role = await this._db.ServerRoles
                .AsNoTracking()
                .Include(x => x.Permissions)
                .ThenInclude(x => x.Permission)
                .FirstOrDefaultAsync(x => x.Id == roleId, cancellationToken);

            if (role == null)
            {
                return null;
            }

            var directAssignmentCount = await this._db.ServerMemberRoles
                .AsNoTracking()
                .CountAsync(assignment =>
                    assignment.RoleId == roleId &&
                    assignment.ServerId == role.ServerId &&
                    assignment.RevokedAt == null &&
                    assignment.Member.StatusId == ServerMemberStatusIds.Active &&
                    assignment.Member.BannedAt == null &&
                    assignment.Member.User.DeletedAt == null &&
                    assignment.Member.User.StatusId == UserStatusIds.Active,
                    cancellationToken);

            return ServerGovernanceMapper.ToRoleResponse(
                role,
                directAssignmentCount);
        }

        private Task NotifyEffectiveSpaceAccessChangedAsync(Guid serverId)
        {
            return this._realtime.NotifyServerBestEffortAsync(
                this._logger,
                serverId,
                RealtimeEventNames.ServerSpacesChanged,
                new { serverId },
                CancellationToken.None);
        }

        private async Task<RoleManagementScope?> LoadRoleManagementScopeAsync(
            Guid userId,
            Guid serverId,
            CancellationToken cancellationToken)
        {
            var member = await this._db.ServerMembers
                .AsNoTracking()
                .Include(x => x.Server)
                .Include(x => x.User)
                .Include(x => x.Roles.Where(assignment =>
                    assignment.RevokedAt == null &&
                    assignment.Role.DeletedAt == null))
                    .ThenInclude(x => x.Role)
                        .ThenInclude(x => x.Permissions.Where(permission =>
                            permission.IsGranted))
                            .ThenInclude(x => x.Permission)
                .FirstOrDefaultAsync(
                    x => x.ServerId == serverId &&
                         x.UserId == userId &&
                         x.StatusId == ServerMemberStatusIds.Active &&
                         x.Server.DeletedAt == null &&
                         x.User.DeletedAt == null &&
                         x.User.StatusId == UserStatusIds.Active,
                    cancellationToken);

            if (member == null)
            {
                return null;
            }

            var activeRoles = member.Roles
                .Where(assignment =>
                    assignment.RevokedAt == null &&
                    assignment.Role.DeletedAt == null &&
                    assignment.Role.Kind != ServerRoleKindCodes.Everyone)
                .Select(assignment => assignment.Role)
                .ToList();
            var isOwner = member.Server.OwnerUserId == userId;
            var permissionMask = isOwner
                ? ServerPermissionRegistry.KnownPermissionsMask
                : await this.LoadDefaultRolePermissionMaskAsync(
                    serverId,
                    cancellationToken);
            if (!permissionMask.HasValue)
            {
                return null;
            }

            var effectivePermissionMask = permissionMask.Value;
            if (!isOwner)
            {
                foreach (var role in activeRoles)
                {
                    if (!this.TryGetRolePermissionMask(role, out var roleMask))
                    {
                        return null;
                    }

                    effectivePermissionMask |= roleMask;
                }
            }

            var hasAdministrator = effectivePermissionMask.Contains(
                ServerPermissionRegistry.Administrator.Bit);
            var canManageRoles = effectivePermissionMask.Contains(
                ServerPermissionRegistry.GetRequired("MANAGE_ROLES").Bit);
            var canAssignRoles = effectivePermissionMask.Contains(
                ServerPermissionRegistry.GetRequired("ASSIGN_ROLES").Bit);
            var canManageDefaultPermissions = effectivePermissionMask.Contains(
                ServerPermissionRegistry.GetRequired(
                    "MANAGE_DEFAULT_PERMISSIONS").Bit);

            return new RoleManagementScope(
                CanManageRoles:
                    isOwner ||
                    hasAdministrator ||
                    canManageRoles,
                CanAssignRoles:
                    isOwner ||
                    hasAdministrator ||
                    canAssignRoles,
                CanManageDefaultPermissions:
                    isOwner ||
                    hasAdministrator ||
                    canManageDefaultPermissions,
                IsOwner: isOwner,
                IsUnrestricted: isOwner || hasAdministrator,
                HighestRoleLevel: activeRoles.Count == 0
                    ? int.MaxValue
                    : activeRoles.Min(role => role.Level),
                PermissionMask: effectivePermissionMask);
        }

        private async Task<PermissionMask256?> LoadDefaultRolePermissionMaskAsync(
            Guid serverId,
            CancellationToken cancellationToken)
        {
            var defaultRoles = await this._db.ServerRoles
                .AsNoTracking()
                .Include(role => role.Permissions)
                .Where(role =>
                    role.ServerId == serverId &&
                    role.Kind == ServerRoleKindCodes.Everyone &&
                    role.DeletedAt == null)
                .Take(2)
                .ToListAsync(cancellationToken);
            if (defaultRoles.Count > 1)
            {
                return null;
            }

            if (defaultRoles.Count == 0)
            {
                return ServerPermissionRegistry.DefaultEveryonePermissionsMask;
            }

            return this.TryGetRolePermissionMask(defaultRoles[0], out var permissionMask)
                ? permissionMask.Without(
                    ServerPermissionRegistry.Administrator.Bit)
                : null;
        }

        private static bool CanGrantPermissions(
            RoleManagementScope scope,
            PermissionMask256 permissionMask)
        {
            if (!scope.IsOwner && permissionMask.Contains(
                    ServerPermissionRegistry.Administrator.Bit))
            {
                return false;
            }

            return scope.IsUnrestricted ||
                   permissionMask.Except(scope.PermissionMask).IsEmpty;
        }

        private bool CanManageRole(
            RoleManagementScope scope,
            ServerRole role)
        {
            if (!scope.IsOwner && this.RoleGrantsManageServer(role))
            {
                return false;
            }

            if (!this.TryGetRolePermissionMask(role, out var rolePermissionMask))
            {
                return false;
            }

            return scope.IsUnrestricted ||
                   (role.Level > scope.HighestRoleLevel &&
                    rolePermissionMask.Except(scope.PermissionMask).IsEmpty);
        }

        private async Task<bool> CanAffectMemberAsync(
            RoleManagementScope scope,
            Guid actorUserId,
            Guid serverId,
            Guid targetMemberId,
            CancellationToken cancellationToken)
        {
            var target = await this._db.ServerMembers
                .AsNoTracking()
                .Where(member =>
                    member.Id == targetMemberId &&
                    member.ServerId == serverId &&
                    member.StatusId == ServerMemberStatusIds.Active &&
                    member.BannedAt == null &&
                    member.Server.DeletedAt == null &&
                    member.User.DeletedAt == null &&
                    member.User.StatusId == UserStatusIds.Active)
                .Select(member => new
                {
                    member.UserId,
                    member.Server.OwnerUserId,
                    CanManageServer = member.Roles.Any(assignment =>
                        assignment.RevokedAt == null &&
                        assignment.Role.DeletedAt == null &&
                        assignment.Role.Permissions.Any(permission =>
                            permission.IsGranted &&
                            permission.PermissionId == ServerGovernanceIds.PermissionManageServer)),
                    HighestRoleLevel = member.Roles
                        .Where(assignment =>
                            assignment.RevokedAt == null &&
                            assignment.Role.DeletedAt == null)
                        .Select(assignment => (int?)assignment.Role.Level)
                        .Min()
                })
                .FirstOrDefaultAsync(cancellationToken);

            if (target == null)
            {
                return false;
            }

            if (scope.IsOwner)
            {
                return true;
            }

            if (target.UserId == actorUserId ||
                target.UserId == target.OwnerUserId ||
                target.CanManageServer)
            {
                return false;
            }

            return scope.IsUnrestricted ||
                   scope.HighestRoleLevel < (target.HighestRoleLevel ?? int.MaxValue);
        }

        private bool RoleGrantsManageServer(ServerRole role)
        {
            return this.TryGetRolePermissionMask(role, out var permissionMask) &&
                   permissionMask.Contains(ServerPermissionRegistry.Administrator.Bit);
        }

        private static int? ResolveNewRoleLevel(
            RoleManagementScope scope,
            int? requestedLevel)
        {
            if (scope.IsUnrestricted)
            {
                return requestedLevel is > 1
                    ? requestedLevel.Value
                    : 100;
            }

            if (scope.HighestRoleLevel == int.MaxValue)
            {
                return null;
            }

            if (requestedLevel is > 1)
            {
                return requestedLevel.Value > scope.HighestRoleLevel
                    ? requestedLevel.Value
                    : null;
            }

            var nextLevel = (long)scope.HighestRoleLevel + 1;
            return nextLevel <= int.MaxValue
                ? Math.Max(100, (int)nextLevel)
                : null;
        }

        private static string NormalizeCode(string value) => value.Trim().ToLowerInvariant();

        private static bool TryNormalizeRoleUpdate(
            UpdateServerRoleRequest request,
            out string title,
            out string? description,
            out string? color,
            out int? permissionSchemaVersion,
            out IReadOnlyList<string> permissionCodes)
        {
            title = request.Title?.Trim() ?? string.Empty;
            description = NormalizeOptional(request.Description);
            color = NormalizeOptional(request.Color)?.ToLowerInvariant();
            permissionSchemaVersion = request.PermissionSchemaVersion;
            permissionCodes = [];

            if (request.ExpectedVersion == Guid.Empty ||
                title.Length is < 1 or > 64 ||
                description?.Length > 255 ||
                (color != null && !IsValidRoleColor(color)))
            {
                return false;
            }

            return TryNormalizePermissionCodes(
                request.PermissionCodes,
                permissionSchemaVersion,
                out permissionCodes);
        }

        private static bool TryNormalizeRoleCreate(
            CreateServerRoleRequest request,
            out string title,
            out string? description,
            out string? color,
            out int? permissionSchemaVersion,
            out IReadOnlyList<string> permissionCodes)
        {
            title = request.Title?.Trim() ?? string.Empty;
            description = NormalizeOptional(request.Description);
            color = NormalizeOptional(request.Color)?.ToLowerInvariant();
            permissionSchemaVersion = request.PermissionSchemaVersion;
            permissionCodes = [];

            if (title.Length is < 1 or > 64 ||
                description?.Length > 255 ||
                (color != null && !IsValidRoleColor(color)))
            {
                return false;
            }

            return TryNormalizePermissionCodes(
                request.PermissionCodes,
                permissionSchemaVersion,
                out permissionCodes);
        }

        private static bool TryNormalizePermissionCodes(
            IReadOnlyList<string>? permissionCodes,
            int? permissionSchemaVersion,
            out IReadOnlyList<string> normalizedCodes)
        {
            normalizedCodes = [];
            if (permissionCodes == null ||
                permissionCodes.Any(string.IsNullOrWhiteSpace))
            {
                return false;
            }

            if (permissionSchemaVersion is not null and
                not ServerPermissionRegistry.SchemaVersion)
            {
                return false;
            }

            normalizedCodes = permissionCodes
                .Select(code => permissionSchemaVersion == ServerPermissionRegistry.SchemaVersion
                    ? code.Trim().ToUpperInvariant()
                    : NormalizeCode(code))
                .Distinct(StringComparer.Ordinal)
                .OrderBy(code => code, StringComparer.Ordinal)
                .ToList();

            return permissionSchemaVersion != ServerPermissionRegistry.SchemaVersion ||
                   normalizedCodes.All(code =>
                       ServerPermissionRegistry.TryGet(code, out _));
        }

        private static bool IsValidRoleColor(string color)
        {
            return color.Length is 7 or 9 &&
                   color[0] == '#' &&
                   color.AsSpan(1).ToArray().All(Uri.IsHexDigit);
        }

        private static bool IsPostgresSerializationFailure(Exception exception)
        {
            return FindPostgresException(exception)?.SqlState ==
                   PostgresErrorCodes.SerializationFailure;
        }

        private static bool IsServerRoleTitleConflict(Exception exception)
        {
            var postgresException = FindPostgresException(exception);
            return postgresException?.SqlState == PostgresErrorCodes.UniqueViolation &&
                   string.Equals(
                       postgresException.ConstraintName,
                       "UX_ServerRoles_Server_Title",
                       StringComparison.Ordinal);
        }

        private static PostgresException? FindPostgresException(Exception exception)
        {
            for (Exception? current = exception; current != null; current = current.InnerException)
            {
                if (current is PostgresException postgresException)
                {
                    return postgresException;
                }
            }

            return null;
        }

        private sealed record RoleManagementScope(
            bool CanManageRoles,
            bool CanAssignRoles,
            bool CanManageDefaultPermissions,
            bool IsOwner,
            bool IsUnrestricted,
            int HighestRoleLevel,
            PermissionMask256 PermissionMask);

        private sealed record RoleUpdateCommand(
            bool UpdateMetadata,
            string? Title,
            string? Description,
            string? Color,
            bool Mentionable,
            int? PermissionSchemaVersion,
            IReadOnlyList<string> PermissionCodes,
            Guid? ExpectedVersion);

        private sealed record PermissionWriteSet(
            PermissionMask256 Mask,
            IReadOnlyList<string> Codes,
            IReadOnlyList<PermissionCatalog> LegacyPermissions);

        private static string HumanizePermissionCode(string code)
        {
            return string.Join(
                ' ',
                code.Split('_', StringSplitOptions.RemoveEmptyEntries)
                    .Select((part, index) => index == 0
                        ? char.ToUpperInvariant(part[0]) + part[1..].ToLowerInvariant()
                        : part.ToLowerInvariant()));
        }

        private static string NormalizeTitle(string value)
        {
            return string.IsNullOrWhiteSpace(value)
                ? throw new ArgumentException("Title is required.")
                : value.Trim();
        }

        private static string? NormalizeOptional(string? value)
        {
            return string.IsNullOrWhiteSpace(value)
                ? null
                : value.Trim();
        }
    }
}
