using ArcaneLink.DataBase._Data;
using ArcaneLink.DataBase.Constants;
using ArcaneLink.DataBase.DTOs.Servers;
using ArcaneLink.DataBase.Models.ServersModels;
using ArcaneLink.Exceptions;
using ArcaneLink.Exceptions.ServerExceptions;
using ArcaneLink.Services.Realtime;
using ArcaneLink.Services.Realtime.Abstractions;
using ArcaneLink.Services.Servers.Abstractions;
using ArcaneLink.Services.Servers.Authorization;
using ArcaneLink.Services.Spaces.Abstractions;
using Microsoft.EntityFrameworkCore;
using static ArcaneLink.Services.Servers.ServerResponseMapper;

namespace ArcaneLink.Services.Servers
{
    public class ServerCommandService : IServerCommandService
    {
        private readonly AppDbContext _db;
        private readonly IRealtimeNotificationService _realtime;
        private readonly ServerConfigurationValidator _configurationValidator;
        private readonly ISpaceAuthorizationService _spaceAuthorization;
        private readonly ServerVoiceAccessReconciliationService _voiceAccess;
        private readonly IUserPresenceCoordinator _presenceCoordinator;
        private readonly IServerGovernanceAccessService _access;
        private readonly LegacyServerPermissionMaskAdapter _legacyPermissionMaskAdapter;
        private readonly ILogger<ServerCommandService> _logger;

        public ServerCommandService(
            AppDbContext db,
            IRealtimeNotificationService realtime,
            ServerConfigurationValidator configurationValidator,
            ISpaceAuthorizationService spaceAuthorization,
            ServerVoiceAccessReconciliationService voiceAccess,
            IUserPresenceCoordinator presenceCoordinator,
            IServerGovernanceAccessService access,
            LegacyServerPermissionMaskAdapter legacyPermissionMaskAdapter,
            ILogger<ServerCommandService> logger)
        {
            _db = db;
            _realtime = realtime;
            _configurationValidator = configurationValidator;
            _spaceAuthorization = spaceAuthorization;
            _voiceAccess = voiceAccess;
            _presenceCoordinator = presenceCoordinator;
            _access = access;
            _legacyPermissionMaskAdapter = legacyPermissionMaskAdapter;
            _logger = logger;
        }

        public async Task<ServerResponse> CreateServerAsync(
            Guid currentUserId,
            CreateServerRequest request,
            CancellationToken cancellationToken = default)
        {
            var title = NormalizeTitle(request.Title);
            var slug = await GenerateUniqueSlugAsync(
                title,
                cancellationToken);
            var description = NormalizeOptionalText(request.Description);
            var accessMode = _configurationValidator.NormalizeAccessMode(
                request.AccessMode);
            var iconCropOffsetX = request.IconCropOffsetX;
            var iconCropOffsetY = request.IconCropOffsetY;
            var iconCropZoom = request.IconCropZoom;
            _configurationValidator.NormalizeIconCrop(
                ref iconCropOffsetX,
                ref iconCropOffsetY,
                ref iconCropZoom);
            await _configurationValidator.EnsureIconAssetAsync(
                currentUserId,
                request.IconAssetId,
                cancellationToken);

            var now = DateTime.UtcNow;

            await using var transaction = await _db.Database
                .BeginTransactionAsync(cancellationToken);

            var server = new Server
            {
                Id = Guid.NewGuid(),
                CreatedByUserId = currentUserId,
                OwnerUserId = currentUserId,
                Slug = slug,
                Title = title,
                Description = description,
                IconAssetId = request.IconAssetId,
                IconCropOffsetX = request.IconAssetId == null
                    ? 0
                    : iconCropOffsetX,
                IconCropOffsetY = request.IconAssetId == null
                    ? 0
                    : iconCropOffsetY,
                IconCropZoom = request.IconAssetId == null
                    ? 1
                    : iconCropZoom,
                AccessMode = accessMode,
                IsSystem = false,
                CreatedAt = now,
                UpdatedAt = now
            };

            var ownerMember = new ServerMember
            {
                Id = Guid.NewGuid(),
                ServerId = server.Id,
                UserId = currentUserId,
                StatusId = ServerMemberStatusIds.Active,
                JoinedAt = now,
                AddedByUserId = currentUserId,
                CreatedAt = now,
                UpdatedAt = now
            };

            var ownerRole = new ServerRole
            {
                Id = Guid.NewGuid(),
                ServerId = server.Id,
                Code = "owner",
                Title = "Owner",
                Description = "Server owner",
                CreatedByUserId = currentUserId,
                Level = 1,
                IsSystem = true,
                CreatedAt = now,
                UpdatedAt = now
            };

            var everyoneRole = new ServerRole
            {
                Id = Guid.NewGuid(),
                ServerId = server.Id,
                Code = "everyone",
                Title = "@everyone",
                Description = "Default permissions for every active server member",
                Kind = ServerRoleKindCodes.Everyone,
                Level = int.MaxValue,
                IsSystem = true,
                PermissionMask = ServerRolePermissionMaskCodec.Encode(
                    ServerPermissionRegistry.DefaultEveryonePermissionsMask),
                PermissionSchemaVersion = ServerPermissionRegistry.SchemaVersion,
                CreatedAt = now,
                UpdatedAt = now
            };

            var ownerPermissions = new[]
            {
                ServerGovernanceIds.PermissionManageServer,
                ServerGovernanceIds.PermissionManageRoles,
                ServerGovernanceIds.PermissionManageInvites,
                ServerGovernanceIds.PermissionManageMembers,
                ServerGovernanceIds.PermissionViewAuditLog,
                ServerGovernanceIds.PermissionManageReports
            };
            ownerRole.PermissionMask =
                ServerRolePermissionMaskResolver.EncodeLegacyCompatibility(
                    ownerPermissions,
                    _legacyPermissionMaskAdapter);
            ownerRole.PermissionSchemaVersion =
                ServerPermissionRegistry.SchemaVersion;

            foreach (var permissionId in ownerPermissions)
            {
                ownerRole.Permissions.Add(new ServerRolePermission
                {
                    RoleId = ownerRole.Id,
                    PermissionId = permissionId,
                    IsGranted = true,
                    CreatedAt = now
                });
            }

            var ownerRoleAssignment = new ServerMemberRole
            {
                Id = Guid.NewGuid(),
                ServerId = server.Id,
                MemberId = ownerMember.Id,
                RoleId = ownerRole.Id,
                AssignedByUserId = currentUserId,
                AssignedAt = now
            };

            _db.Servers.Add(server);
            _db.ServerMembers.Add(ownerMember);
            _db.ServerRoles.Add(ownerRole);
            _db.ServerRoles.Add(everyoneRole);
            _db.ServerMemberRoles.Add(ownerRoleAssignment);
            _db.ServerAuditLogs.Add(new ServerAuditLog
            {
                Id = Guid.NewGuid(),
                ServerId = server.Id,
                EventTypeId = ServerGovernanceIds.AuditMemberJoined,
                ActorUserId = currentUserId,
                TargetUserId = currentUserId,
                CreatedAt = now
            });

            try
            {
                await _db.SaveChangesAsync(cancellationToken);
                await transaction.CommitAsync(cancellationToken);
                await _realtime.NotifyUserAsync(
                    currentUserId,
                    RealtimeEventNames.ServerMembersChanged,
                    new { serverId = server.Id },
                    cancellationToken);
                await _realtime.NotifyUserAsync(
                    currentUserId,
                    RealtimeEventNames.UserServersChanged,
                    new { serverId = server.Id },
                    cancellationToken);
            }
            catch (DbUpdateException)
            {
                throw new ServerSlugAlreadyExistsException();
            }

            return ToServerResponse(server);
        }

        public async Task<ServerResponse?> UpdateServerAsync(
            Guid currentUserId,
            Guid serverId,
            UpdateServerRequest request,
            CancellationToken cancellationToken = default)
        {
            var server = await _db.Servers
                .FirstOrDefaultAsync(
                    x => x.Id == serverId &&
                         x.DeletedAt == null,
                    cancellationToken);

            if (server == null)
            {
                return null;
            }

            var updatesProfile = request.Title != null ||
                request.Description != null ||
                request.IconAssetId != null ||
                request.IconCropOffsetX != null ||
                request.IconCropOffsetY != null ||
                request.IconCropZoom != null ||
                request.ClearIconAsset;
            var updatesSettings = request.DefaultTextSpaceId != null ||
                request.ClearDefaultTextSpace ||
                request.AccessMode != null;
            if (server.OwnerUserId != currentUserId &&
                ((!updatesProfile && !updatesSettings) ||
                 (updatesProfile && !await _access.HasGranularPermissionAsync(
                    currentUserId,
                    serverId,
                    "MANAGE_SERVER_PROFILE",
                    cancellationToken)) ||
                 (updatesSettings && !await _access.HasGranularPermissionAsync(
                    currentUserId,
                    serverId,
                    "MANAGE_SERVER_SETTINGS",
                    cancellationToken))))
            {
                return null;
            }

            if (request.Title == null &&
                request.Description == null &&
                request.IconAssetId == null &&
                request.IconCropOffsetX == null &&
                request.IconCropOffsetY == null &&
                request.IconCropZoom == null &&
                !request.ClearIconAsset &&
                request.DefaultTextSpaceId == null &&
                !request.ClearDefaultTextSpace &&
                request.AccessMode == null)
            {
                throw new InvalidServerDataException(
                    ExceptionMessages.ServerUpdateIsEmpty);
            }

            if (request.Title != null)
            {
                server.Title = NormalizeTitle(request.Title);
            }

            if (request.Description != null)
            {
                server.Description = NormalizeOptionalText(request.Description);
            }

            if (request.IconAssetId != null)
            {
                var iconCropOffsetX = request.IconCropOffsetX ?? 0;
                var iconCropOffsetY = request.IconCropOffsetY ?? 0;
                var iconCropZoom = request.IconCropZoom ?? 1;

                _configurationValidator.NormalizeIconCrop(
                    ref iconCropOffsetX,
                    ref iconCropOffsetY,
                    ref iconCropZoom);

                await _configurationValidator.EnsureIconAssetAsync(
                    currentUserId,
                    request.IconAssetId,
                    cancellationToken);

                server.IconAssetId = request.IconAssetId;
                server.IconCropOffsetX = iconCropOffsetX;
                server.IconCropOffsetY = iconCropOffsetY;
                server.IconCropZoom = iconCropZoom;
            }
            else if (request.ClearIconAsset)
            {
                server.IconAssetId = null;
                server.IconCropOffsetX = 0;
                server.IconCropOffsetY = 0;
                server.IconCropZoom = 1;
            }
            else if (request.IconCropOffsetX != null ||
                     request.IconCropOffsetY != null ||
                     request.IconCropZoom != null)
            {
                var iconCropOffsetX = request.IconCropOffsetX
                    ?? server.IconCropOffsetX;
                var iconCropOffsetY = request.IconCropOffsetY
                    ?? server.IconCropOffsetY;
                var iconCropZoom = request.IconCropZoom
                    ?? server.IconCropZoom;

                _configurationValidator.NormalizeIconCrop(
                    ref iconCropOffsetX,
                    ref iconCropOffsetY,
                    ref iconCropZoom);

                server.IconCropOffsetX = iconCropOffsetX;
                server.IconCropOffsetY = iconCropOffsetY;
                server.IconCropZoom = iconCropZoom;
            }

            if (request.DefaultTextSpaceId != null)
            {
                await _configurationValidator.EnsureDefaultTextSpaceAsync(
                    serverId,
                    request.DefaultTextSpaceId.Value,
                    cancellationToken);

                server.DefaultTextSpaceId = request.DefaultTextSpaceId;
            }
            else if (request.ClearDefaultTextSpace)
            {
                server.DefaultTextSpaceId = null;
            }

            var previousAccessMode = server.AccessMode;
            if (request.AccessMode != null)
            {
                server.AccessMode = _configurationValidator.NormalizeAccessMode(
                    request.AccessMode);
            }

            var updatedAt = DateTime.UtcNow;
            server.UpdatedAt = updatedAt;

            IReadOnlyCollection<Guid> cancelledJoinRequestUserIds = [];
            await using var transaction = await _db.Database
                .BeginTransactionAsync(cancellationToken);
            if (previousAccessMode == ServerAccessModeCodes.Restricted &&
                server.AccessMode != ServerAccessModeCodes.Restricted)
            {
                cancelledJoinRequestUserIds = await _db.ServerJoinRequests
                    .AsNoTracking()
                    .Where(joinRequest =>
                        joinRequest.ServerId == serverId &&
                        joinRequest.StatusCode ==
                        ServerJoinRequestStatusCodes.Pending)
                    .Select(joinRequest => joinRequest.UserId)
                    .Distinct()
                    .ToArrayAsync(cancellationToken);
                await _db.ServerJoinRequests
                    .Where(joinRequest =>
                        joinRequest.ServerId == serverId &&
                        joinRequest.StatusCode ==
                        ServerJoinRequestStatusCodes.Pending)
                    .ExecuteUpdateAsync(
                        setters => setters
                            .SetProperty(
                                joinRequest => joinRequest.StatusCode,
                                ServerJoinRequestStatusCodes.Cancelled)
                            .SetProperty(
                                joinRequest => joinRequest.ReviewedAt,
                                updatedAt)
                            .SetProperty(
                                joinRequest => joinRequest.ReviewedByUserId,
                                currentUserId)
                            .SetProperty(
                                joinRequest => joinRequest.UpdatedAt,
                                updatedAt),
                        cancellationToken);
            }

            await _db.SaveChangesAsync(cancellationToken);
            await transaction.CommitAsync(cancellationToken);
            foreach (var userId in cancelledJoinRequestUserIds)
            {
                await _realtime.NotifyUserBestEffortAsync(
                    _logger,
                    userId,
                    RealtimeEventNames.ServerJoinRequestChanged,
                    new { serverId },
                    CancellationToken.None);
            }
            await _realtime.NotifyServerAsync(
                serverId,
                RealtimeEventNames.ServerUpdated,
                new { serverId },
                cancellationToken);
            await _realtime.NotifyServerAsync(
                serverId,
                RealtimeEventNames.ServerGovernanceChanged,
                new { serverId },
                cancellationToken);
            await _realtime.NotifyServerAsync(
                serverId,
                RealtimeEventNames.ServerMembersChanged,
                new { serverId },
                cancellationToken);

            return ToServerResponse(server);
        }

        public async Task<bool> DeleteServerAsync(
            Guid currentUserId,
            Guid serverId,
            CancellationToken cancellationToken = default)
        {
            var server = await _db.Servers
                .FirstOrDefaultAsync(
                    x => x.Id == serverId &&
                         x.DeletedAt == null,
                    cancellationToken);

            if (server == null || server.OwnerUserId != currentUserId)
            {
                return false;
            }

            var mutationSucceeded = false;
            var presenceSubjects = await _presenceCoordinator
                .ExecuteTopologyMutationAsync(
                    UserPresenceTopologyKey.Server(serverId),
                    [currentUserId],
                    token => ResolveActiveServerUserIdsAsync(serverId, token),
                    async token =>
                    {
                        await _db.Entry(server).ReloadAsync(token);
                        if (server.DeletedAt != null ||
                            server.OwnerUserId != currentUserId)
                        {
                            return;
                        }

                        server.DeletedAt = DateTime.UtcNow;
                        server.UpdatedAt = server.DeletedAt.Value;
                        await _db.SaveChangesAsync(token);
                        mutationSucceeded = true;
                    },
                    cancellationToken);
            if (!mutationSucceeded)
            {
                return false;
            }

            await _presenceCoordinator.AudienceChangedAsync(
                presenceSubjects,
                CancellationToken.None);
            _spaceAuthorization.InvalidateServer(serverId);
            await _voiceAccess.ReconcileServerBestEffortAsync(serverId);
            await _realtime.NotifyServerBestEffortAsync(
                _logger,
                serverId,
                RealtimeEventNames.ServerMembersChanged,
                new { serverId },
                CancellationToken.None);

            return true;
        }

        private async Task<IReadOnlyCollection<Guid>> ResolveActiveServerUserIdsAsync(
            Guid serverId,
            CancellationToken cancellationToken)
        {
            return await _db.ServerMembers
                .AsNoTracking()
                .Where(member =>
                    member.ServerId == serverId &&
                    member.StatusId == ServerMemberStatusIds.Active &&
                    member.BannedAt == null &&
                    member.Server.DeletedAt == null)
                .Select(member => member.UserId)
                .Distinct()
                .ToArrayAsync(cancellationToken);
        }

        private async Task<string> GenerateUniqueSlugAsync(
            string title,
            CancellationToken cancellationToken)
        {
            var baseSlug = CreateSlugBase(title);

            for (var attempt = 0; attempt < 100; attempt++)
            {
                var slug = attempt == 0
                    ? baseSlug
                    : $"{baseSlug}-{attempt + 1}";

                var exists = await _db.Servers
                    .AnyAsync(
                        x => x.Slug == slug,
                        cancellationToken);

                if (!exists)
                {
                    return slug;
                }
            }

            return $"{baseSlug}-{Guid.NewGuid():N}"[..64];
        }

        private static string CreateSlugBase(string title)
        {
            var characters = new List<char>(title.Length);
            var previousWasSeparator = false;

            foreach (var character in title.Trim().ToLowerInvariant())
            {
                if (char.IsAsciiLetterOrDigit(character))
                {
                    characters.Add(character);
                    previousWasSeparator = false;
                    continue;
                }

                if ((char.IsWhiteSpace(character) ||
                     character == '-' ||
                     character == '_') &&
                    !previousWasSeparator &&
                    characters.Count > 0)
                {
                    characters.Add('-');
                    previousWasSeparator = true;
                }
            }

            var slug = new string(characters.ToArray()).Trim('-');

            if (slug.Length == 0)
            {
                slug = "server";
            }

            return slug.Length <= 48
                ? slug
                : slug[..48].Trim('-');
        }

        private static string NormalizeTitle(string title)
        {
            var normalizedTitle = title.Trim();

            if (string.IsNullOrWhiteSpace(normalizedTitle))
            {
                throw new InvalidServerDataException(
                    ExceptionMessages.ServerTitleIsRequired);
            }

            return normalizedTitle;
        }

        private static string? NormalizeOptionalText(string? value)
        {
            return string.IsNullOrWhiteSpace(value)
                ? null
                : value.Trim();
        }

    }
}
