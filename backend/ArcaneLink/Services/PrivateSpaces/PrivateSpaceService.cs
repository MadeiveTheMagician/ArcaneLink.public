using ArcaneLink.DataBase._Data;
using ArcaneLink.DataBase.Constants;
using ArcaneLink.DataBase.DTOs.Messages;
using ArcaneLink.DataBase.DTOs.Spaces;
using ArcaneLink.DataBase.Models.MessagesModels;
using ArcaneLink.DataBase.Models.SpacesModels;
using ArcaneLink.Exceptions.UsersExceptions;
using ArcaneLink.Services.Messages;
using ArcaneLink.Services.Notifications.Abstractions;
using ArcaneLink.Services.PrivateSpaces.Abstractions;
using ArcaneLink.Services.Realtime;
using ArcaneLink.Services.Realtime.Abstractions;
using ArcaneLink.Services.Users;
using ArcaneLink.Services.Users.Abstractions;
using Microsoft.EntityFrameworkCore;
using static ArcaneLink.Services.PrivateSpaces.PrivateSpaceResponseMapper;
using static ArcaneLink.Services.PrivateSpaces.PrivateSpaceTextNormalizer;

namespace ArcaneLink.Services.PrivateSpaces;

public class PrivateSpaceService : IPrivateSpaceService
{
    private const int MaxInitialMembers = 20;

    private readonly AppDbContext _db;
    private readonly PrivateSpaceAccessService _access;
    private readonly PrivateSpaceActivityService _activity;
    private readonly PrivateSpacePersonalAvatarService _personalAvatars;
    private readonly PrivateSpaceRealtimeNotifier _notifier;
    private readonly UnreadCountService _unreadCounts;
    private readonly IUserPresencePolicyService _presencePolicy;
    private readonly IUserPresenceCoordinator _presenceCoordinator;
    private readonly IDirectMessagePrivacyService _directMessagePrivacy;
    private readonly IUserNotificationService _notifications;
    private readonly TimeProvider _timeProvider;

    public PrivateSpaceService(
        AppDbContext db,
        PrivateSpaceAccessService access,
        PrivateSpaceActivityService activity,
        PrivateSpacePersonalAvatarService personalAvatars,
        PrivateSpaceRealtimeNotifier notifier,
        UnreadCountService unreadCounts,
        IUserPresencePolicyService presencePolicy,
        IUserPresenceCoordinator presenceCoordinator,
        IDirectMessagePrivacyService directMessagePrivacy,
        IUserNotificationService notifications,
        TimeProvider timeProvider)
    {
        this._db = db;
        this._access = access;
        this._activity = activity;
        this._personalAvatars = personalAvatars;
        this._notifier = notifier;
        this._unreadCounts = unreadCounts;
        this._presencePolicy = presencePolicy;
        this._presenceCoordinator = presenceCoordinator;
        this._directMessagePrivacy = directMessagePrivacy;
        this._notifications = notifications;
        this._timeProvider = timeProvider;
    }

    public async Task<IReadOnlyList<PrivateSpaceResponse>> GetMyPrivateSpacesAsync(
        Guid currentUserId,
        CancellationToken cancellationToken = default)
    {
        var isOrderLocked = await this._db.UserProfileSettings
            .AsNoTracking()
            .Where(settings => settings.UserId == currentUserId)
            .Select(settings =>
                (bool?)settings.IsAllPrivateSpaceOrderLocked)
            .SingleOrDefaultAsync(cancellationToken) ?? false;
        var spacesQuery = this.LoadPrivateSpacesQuery()
            .Where(
                x => x.DeletedAt == null &&
                     x.Members.Any(member =>
                         member.UserId == currentUserId &&
                         member.StatusId ==
                         PrivateSpaceIds.MemberStatusActive &&
                         member.HiddenFromListAt == null));
        IOrderedQueryable<PrivateSpace> orderedSpaces = isOrderLocked
            ? spacesQuery
                .OrderByDescending(x => x.Members
                    .Where(member =>
                        member.UserId == currentUserId &&
                        member.StatusId ==
                        PrivateSpaceIds.MemberStatusActive)
                    .Select(member => member.PinnedAt.HasValue)
                    .First())
                .ThenByDescending(x => x.Members
                    .Where(member =>
                        member.UserId == currentUserId &&
                        member.StatusId ==
                        PrivateSpaceIds.MemberStatusActive)
                    .Select(member => member.PinnedAt)
                    .First())
                .ThenBy(x => x.Members
                    .Where(member =>
                        member.UserId == currentUserId &&
                        member.StatusId ==
                        PrivateSpaceIds.MemberStatusActive)
                    .Select(member => member.ListPosition)
                    .First())
            : spacesQuery
                .OrderByDescending(x => x.Members
                    .Where(member =>
                        member.UserId == currentUserId &&
                        member.StatusId ==
                        PrivateSpaceIds.MemberStatusActive)
                    .Select(member => member.PinnedAt.HasValue)
                    .First())
                .ThenByDescending(x => x.Members
                    .Where(member =>
                        member.UserId == currentUserId &&
                        member.StatusId ==
                        PrivateSpaceIds.MemberStatusActive)
                    .Select(member => member.PinnedAt)
                    .First())
                .ThenByDescending(x => x.Members
                    .Where(member =>
                        member.UserId == currentUserId &&
                        member.StatusId ==
                        PrivateSpaceIds.MemberStatusActive)
                    .Select(member => member.ListActivityAt)
                    .First())
                .ThenBy(x => x.Members
                .Where(member =>
                    member.UserId == currentUserId &&
                    member.StatusId == PrivateSpaceIds.MemberStatusActive)
                .Select(member => member.ListPosition)
                .First());
        var spaces = await orderedSpaces
            .ThenByDescending(x => x.UpdatedAt)
            .ThenBy(x => x.SpaceId)
            .ToListAsync(cancellationToken);

        var lastMessages = await this.GetLastMessagesByPrivateSpaceAsync(
            spaces.Select(x => x.SpaceId).ToList(),
            currentUserId,
            cancellationToken);
        var unreadCounts = await this._unreadCounts.GetPrivateSpaceUnreadCountsAsync(
            currentUserId,
            spaces.Select(x => x.SpaceId),
            cancellationToken);
        var presence = await this._presencePolicy.ResolveAsync(
            currentUserId,
            spaces.SelectMany(space => space.Members).Select(member => member.UserId),
            cancellationToken);
        var blockedUserIds = await this.GetBlockedUserIdsAsync(
            currentUserId,
            cancellationToken);

        return spaces
            .Select(space => ToPrivateSpaceResponse(
                space,
                currentUserId,
                presence,
                lastMessages.GetValueOrDefault(space.SpaceId),
                unreadCounts.GetValueOrDefault(space.SpaceId),
                blockedUserIds))
            .ToList();
    }

    public async Task<PrivateSpaceResponse?> GetPrivateSpaceAsync(
        Guid currentUserId,
        Guid spaceId,
        CancellationToken cancellationToken = default)
    {
        if (!await this.IsActiveMemberAsync(currentUserId, spaceId, cancellationToken))
        {
            return null;
        }

        var privateSpace = await this.LoadPrivateSpacesQuery()
            .FirstOrDefaultAsync(
                x => x.SpaceId == spaceId &&
                     x.DeletedAt == null,
                cancellationToken);

        if (privateSpace == null)
        {
            return null;
        }

        var lastMessages = await this.GetLastMessagesByPrivateSpaceAsync(
            [privateSpace.SpaceId],
            currentUserId,
            cancellationToken);
        var unreadCounts = await this._unreadCounts.GetPrivateSpaceUnreadCountsAsync(
            currentUserId,
            [privateSpace.SpaceId],
            cancellationToken);
        var presence = await this._presencePolicy.ResolveAsync(
            currentUserId,
            privateSpace.Members.Select(member => member.UserId),
            cancellationToken);
        var blockedUserIds = await this.GetBlockedUserIdsAsync(
            currentUserId,
            cancellationToken);

        return ToPrivateSpaceResponse(
            privateSpace,
            currentUserId,
            presence,
            lastMessages.GetValueOrDefault(privateSpace.SpaceId),
            unreadCounts.GetValueOrDefault(privateSpace.SpaceId),
            blockedUserIds);
    }

    public async Task<PrivateSpaceResponse?> UpdatePersonalSettingsAsync(
        Guid currentUserId,
        Guid spaceId,
        UpdatePrivateSpacePersonalSettingsRequest request,
        CancellationToken cancellationToken = default)
    {
        if (!IsWithinMaxLength(
                request.Note,
                UpdatePrivateSpacePersonalSettingsRequest.NoteMaxLength) ||
            !IsWithinMaxLength(
                request.CustomNickname,
                UpdatePrivateSpacePersonalSettingsRequest
                    .CustomNicknameMaxLength) ||
            !IsWithinMaxLength(
                request.MuteMode,
                UpdatePrivateSpacePersonalSettingsRequest.MuteModeMaxLength))
        {
            return null;
        }

        var membership = await this._db.PrivateSpaceMembers
            .Include(member => member.PrivateSpace)
            .FirstOrDefaultAsync(
                member =>
                    member.SpaceId == spaceId &&
                    member.UserId == currentUserId &&
                    member.StatusId == PrivateSpaceIds.MemberStatusActive &&
                    member.PrivateSpace.DeletedAt == null,
                cancellationToken);
        if (membership == null)
        {
            return null;
        }

        var hasDirectOnlyMutation =
            request.Note != null ||
            request.ClearNote ||
            request.CustomNickname != null ||
            request.ClearCustomNickname;
        if (hasDirectOnlyMutation &&
            membership.PrivateSpace.Kind != PrivateSpaceKindCodes.Direct)
        {
            return null;
        }

        var previousCustomAvatarAssetId =
            membership.PeerAvatarAssetId;
        if (request.CustomAvatarAssetId.HasValue &&
            !await this.IsUsableOwnedImageAsync(
                currentUserId,
                request.CustomAvatarAssetId.Value,
                cancellationToken))
        {
            return null;
        }
        if (!TryResolveCrop(
                request.CustomAvatarCropOffsetX,
                request.CustomAvatarCropOffsetY,
                request.CustomAvatarCropZoom,
                membership.PeerAvatarCropOffsetX,
                membership.PeerAvatarCropOffsetY,
                membership.PeerAvatarCropZoom,
                out var crop))
        {
            return null;
        }

        if (request.Note != null || request.ClearNote)
        {
            membership.Note = request.ClearNote
                ? null
                : NormalizeLimited(request.Note, 64);
        }
        if (request.CustomNickname != null || request.ClearCustomNickname)
        {
            membership.PeerNickname = request.ClearCustomNickname
                ? null
                : NormalizeLimited(request.CustomNickname, 64);
        }
        if (request.CustomAvatarAssetId.HasValue ||
            request.ClearCustomAvatar)
        {
            membership.PeerAvatarAssetId = request.ClearCustomAvatar
                ? null
                : request.CustomAvatarAssetId;
        }
        if (request.ClearCustomAvatar)
        {
            membership.PeerAvatarCropOffsetX = 0;
            membership.PeerAvatarCropOffsetY = 0;
            membership.PeerAvatarCropZoom = 1;
        }
        else
        {
            membership.PeerAvatarCropOffsetX = crop.OffsetX;
            membership.PeerAvatarCropOffsetY = crop.OffsetY;
            membership.PeerAvatarCropZoom = crop.Zoom;
        }

        var now = this._timeProvider.GetUtcNow().UtcDateTime;
        if (request.MuteMode != null &&
            !ApplyMuteMode(membership, request.MuteMode, now))
        {
            return null;
        }

        membership.UpdatedAt = now;
        await this._db.SaveChangesAsync(cancellationToken);
        await this._notifier.NotifySpacesChangedForUserAsync(
            currentUserId,
            spaceId,
            CancellationToken.None);
        if (previousCustomAvatarAssetId.HasValue &&
            previousCustomAvatarAssetId !=
            membership.PeerAvatarAssetId)
        {
            await this._personalAvatars
                .DeleteOwnedOptimizedIfOrphanedAsync(
                    currentUserId,
                    previousCustomAvatarAssetId.Value,
                    CancellationToken.None);
        }
        return await this.GetPrivateSpaceAsync(
            currentUserId,
            spaceId,
            cancellationToken);
    }

    public async Task<PrivateSpaceResponse?> UpdateGroupSettingsAsync(
        Guid currentUserId,
        Guid spaceId,
        UpdateGroupPrivateSpaceRequest request,
        CancellationToken cancellationToken = default)
    {
        var privateSpace = await this._db.PrivateSpaces
            .Include(space => space.Space)
            .Include(space => space.Members)
            .FirstOrDefaultAsync(
                space =>
                    space.SpaceId == spaceId &&
                    space.Kind == PrivateSpaceKindCodes.Group &&
                    space.OwnerUserId == currentUserId &&
                    space.DeletedAt == null &&
                    space.Members.Any(member =>
                        member.UserId == currentUserId &&
                        member.StatusId ==
                        PrivateSpaceIds.MemberStatusActive),
                cancellationToken);
        if (privateSpace == null)
        {
            return null;
        }

        if (request.AvatarAssetId.HasValue &&
            !await this.IsUsableOwnedImageAsync(
                currentUserId,
                request.AvatarAssetId.Value,
                cancellationToken))
        {
            return null;
        }
        if (!TryResolveCrop(
                request.AvatarCropOffsetX,
                request.AvatarCropOffsetY,
                request.AvatarCropZoom,
                privateSpace.AvatarCropOffsetX,
                privateSpace.AvatarCropOffsetY,
                privateSpace.AvatarCropZoom,
                out var crop))
        {
            return null;
        }

        if (request.Title != null || request.ClearTitle)
        {
            var title = request.ClearTitle
                ? await this.BuildDefaultGroupTitleAsync(
                    privateSpace.Members
                        .Where(member =>
                            member.StatusId ==
                            PrivateSpaceIds.MemberStatusActive)
                        .Select(member => member.UserId),
                    cancellationToken)
                : NormalizeLimited(request.Title, 128);
            if (title == null)
            {
                return null;
            }

            privateSpace.Title = title;
            privateSpace.Space.Title = title;
        }
        if (request.Description != null || request.ClearDescription)
        {
            privateSpace.Description = request.ClearDescription
                ? null
                : NormalizeLimited(request.Description, 512);
            privateSpace.Space.Description = privateSpace.Description;
        }
        if (request.AvatarAssetId.HasValue || request.ClearAvatar)
        {
            privateSpace.AvatarAssetId = request.ClearAvatar
                ? null
                : request.AvatarAssetId;
        }
        if (request.ClearAvatar)
        {
            privateSpace.AvatarCropOffsetX = 0;
            privateSpace.AvatarCropOffsetY = 0;
            privateSpace.AvatarCropZoom = 1;
        }
        else
        {
            privateSpace.AvatarCropOffsetX = crop.OffsetX;
            privateSpace.AvatarCropOffsetY = crop.OffsetY;
            privateSpace.AvatarCropZoom = crop.Zoom;
        }

        var now = this._timeProvider.GetUtcNow().UtcDateTime;
        privateSpace.UpdatedAt = now;
        privateSpace.Space.UpdatedAt = now;
        await this._db.SaveChangesAsync(cancellationToken);
        await this.NotifyPrivateSpacesChangedAsync(
            spaceId,
            CancellationToken.None);
        return await this.GetPrivateSpaceAsync(
            currentUserId,
            spaceId,
            cancellationToken);
    }

    public async Task<PrivateSpaceResponse?> CreatePrivateSpaceAsync(
        Guid currentUserId,
        CreatePrivateSpaceRequest request,
        CancellationToken cancellationToken = default)
    {
        var invitedUserIds = request.MemberUserIds
            .Where(userId => userId != currentUserId)
            .Distinct()
            .ToList();

        if (invitedUserIds.Count > MaxInitialMembers)
        {
            return null;
        }

        if (invitedUserIds.Count == 1)
        {
            return await this.GetOrCreateDirectSpaceAsync(
                currentUserId,
                invitedUserIds[0],
                cancellationToken);
        }

        var memberUserIds = invitedUserIds
            .Prepend(currentUserId)
            .ToList();
        if (
            !await this.AreActiveUsersAsync(memberUserIds, cancellationToken))
        {
            return null;
        }
        if (!await this._directMessagePrivacy.CanStartConversationsAsync(
                currentUserId,
                memberUserIds,
                cancellationToken))
        {
            throw new DirectMessagePrivacyDeniedException();
        }

        var now = DateTime.UtcNow;
        var listPositions = await PrivateSpaceListOrder.GetNextTopPositionsAsync(
            this._db,
            memberUserIds,
            cancellationToken);
        var title = NormalizeOptional(request.Title) ??
                    await this.BuildDefaultGroupTitleAsync(
                        memberUserIds,
                        cancellationToken);
        var space = new Space
        {
            Id = Guid.NewGuid(),
            ServerId = null,
            TypeId = SpaceIds.TypeTextRoom,
            ParentSpaceId = null,
            CreatedByUserId = currentUserId,
            Title = title,
            Description = NormalizeOptional(request.Description),
            RequiredServerRoleId = null,
            Position = 0,
            IsSystem = false,
            CreatedAt = now,
            UpdatedAt = now
        };
        var privateSpace = new PrivateSpace
        {
            SpaceId = space.Id,
            Space = space,
            CreatedByUserId = currentUserId,
            OwnerUserId = currentUserId,
            Kind = PrivateSpaceKindCodes.Group,
            Title = title,
            Description = NormalizeOptional(request.Description),
            CreatedAt = now,
            UpdatedAt = now
        };

        foreach (var userId in memberUserIds)
        {
            privateSpace.Members.Add(new PrivateSpaceMember
            {
                Id = Guid.NewGuid(),
                SpaceId = space.Id,
                UserId = userId,
                StatusId = PrivateSpaceIds.MemberStatusActive,
                ListPosition = listPositions[userId],
                ListActivityAt = now,
                JoinedAt = now,
                AddedByUserId = userId == currentUserId ? null : currentUserId,
                CreatedAt = now,
                UpdatedAt = now
            });
        }

        this._db.PrivateSpaces.Add(privateSpace);
        var notificationUserIds = memberUserIds
            .Where(userId => userId != currentUserId)
            .ToArray();
        foreach (var invitedUserId in notificationUserIds)
        {
            await this._notifications.StagePrivateSpaceInviteAsync(
                invitedUserId,
                currentUserId,
                space.Id,
                title,
                cancellationToken);
        }
        await this._presenceCoordinator.ExecuteMutationAsync(
            memberUserIds,
            token => this._db.SaveChangesAsync(token),
            cancellationToken);
        await this._presenceCoordinator.AudienceChangedAsync(
            memberUserIds,
            CancellationToken.None);
        await this.NotifyPrivateSpacesChangedAsync(
            space.Id,
            CancellationToken.None);
        await this._notifications.NotifyChangedAsync(
            notificationUserIds,
            CancellationToken.None);

        return await this.GetPrivateSpaceAsync(currentUserId, space.Id, cancellationToken);
    }

    public async Task<PrivateSpaceResponse?> GetOrCreateDirectSpaceAsync(
        Guid currentUserId,
        Guid targetUserId,
        CancellationToken cancellationToken = default)
    {
        if (targetUserId == currentUserId ||
            !await this.IsActiveUserAsync(targetUserId, cancellationToken) ||
            !await this.IsActiveUserAsync(currentUserId, cancellationToken))
        {
            return null;
        }

        var pair = CanonicalizeDirectPair(currentUserId, targetUserId);
        var existingSpace = await this._db.PrivateSpaces
            .AsNoTracking()
            .Include(x => x.Members)
            .Where(
                x => x.DeletedAt == null &&
                     x.Kind == PrivateSpaceKindCodes.Direct &&
                     x.DirectUserLowId == pair.Low &&
                     x.DirectUserHighId == pair.High)
            .FirstOrDefaultAsync(cancellationToken);

        if (existingSpace != null)
        {
            var requiresReactivation = existingSpace.Members.Any(member =>
                member.StatusId != PrivateSpaceIds.MemberStatusActive);
            if (requiresReactivation &&
                !await this._directMessagePrivacy.CanStartConversationAsync(
                    currentUserId,
                    targetUserId,
                    cancellationToken))
            {
                throw new DirectMessagePrivacyDeniedException();
            }

            await this.ReactivateDirectSpaceMembersAsync(
                existingSpace.SpaceId,
                currentUserId,
                [currentUserId, targetUserId],
                cancellationToken);
            await this.RestoreDirectVisibilityAsync(
                existingSpace.SpaceId,
                currentUserId,
                cancellationToken);

            return await this.GetPrivateSpaceAsync(
                currentUserId,
                existingSpace.SpaceId,
                cancellationToken);
        }

        if (!await this._directMessagePrivacy.CanStartConversationAsync(
                currentUserId,
                targetUserId,
                cancellationToken))
        {
            throw new DirectMessagePrivacyDeniedException();
        }

        return await this.CreateDirectSpaceAsync(
            currentUserId,
            targetUserId,
            pair,
            cancellationToken);
    }

    private async Task<PrivateSpaceResponse?> CreateDirectSpaceAsync(
        Guid currentUserId,
        Guid targetUserId,
        DirectPair pair,
        CancellationToken cancellationToken)
    {
        var memberUserIds = new[] { currentUserId, targetUserId };
        var now = DateTime.UtcNow;
        var listPositions = await PrivateSpaceListOrder.GetNextTopPositionsAsync(
            this._db,
            memberUserIds,
            cancellationToken);
        var internalTitle = await this.BuildDirectInternalTitleAsync(
            targetUserId,
            cancellationToken);
        var space = new Space
        {
            Id = Guid.NewGuid(),
            ServerId = null,
            TypeId = SpaceIds.TypeTextRoom,
            ParentSpaceId = null,
            CreatedByUserId = currentUserId,
            Title = internalTitle,
            Description = null,
            RequiredServerRoleId = null,
            Position = 0,
            IsSystem = false,
            CreatedAt = now,
            UpdatedAt = now
        };
        var privateSpace = new PrivateSpace
        {
            SpaceId = space.Id,
            Space = space,
            CreatedByUserId = currentUserId,
            OwnerUserId = currentUserId,
            Kind = PrivateSpaceKindCodes.Direct,
            DirectUserLowId = pair.Low,
            DirectUserHighId = pair.High,
            Title = null,
            Description = null,
            CreatedAt = now,
            UpdatedAt = now
        };
        foreach (var userId in memberUserIds)
        {
            privateSpace.Members.Add(new PrivateSpaceMember
            {
                Id = Guid.NewGuid(),
                SpaceId = space.Id,
                UserId = userId,
                StatusId = PrivateSpaceIds.MemberStatusActive,
                ListPosition = listPositions[userId],
                ListActivityAt = now,
                JoinedAt = now,
                AddedByUserId = userId == currentUserId
                    ? null
                    : currentUserId,
                CreatedAt = now,
                UpdatedAt = now
            });
        }

        this._db.PrivateSpaces.Add(privateSpace);
        await this._notifications.StagePrivateSpaceInviteAsync(
            targetUserId,
            currentUserId,
            space.Id,
            internalTitle,
            cancellationToken);
        try
        {
            await this._presenceCoordinator.ExecuteMutationAsync(
                memberUserIds,
                token => this._db.SaveChangesAsync(token),
                cancellationToken);
        }
        catch (DbUpdateException)
        {
            this._db.ChangeTracker.Clear();
            var winnerSpaceId = await this._db.PrivateSpaces
                .AsNoTracking()
                .Where(candidate =>
                    candidate.Kind == PrivateSpaceKindCodes.Direct &&
                    candidate.DirectUserLowId == pair.Low &&
                    candidate.DirectUserHighId == pair.High &&
                    candidate.DeletedAt == null)
                .Select(candidate => (Guid?)candidate.SpaceId)
                .SingleOrDefaultAsync(cancellationToken);
            if (!winnerSpaceId.HasValue)
            {
                throw;
            }

            return await this.GetPrivateSpaceAsync(
                currentUserId,
                winnerSpaceId.Value,
                cancellationToken);
        }

        await this._presenceCoordinator.AudienceChangedAsync(
            memberUserIds,
            CancellationToken.None);
        await this.NotifyPrivateSpacesChangedAsync(
            space.Id,
            CancellationToken.None);
        await this._notifications.NotifyChangedAsync(
            [targetUserId],
            CancellationToken.None);

        return await this.GetPrivateSpaceAsync(
            currentUserId,
            space.Id,
            cancellationToken);
    }

    private async Task ReactivateDirectSpaceMembersAsync(
        Guid spaceId,
        Guid actorUserId,
        IReadOnlyCollection<Guid> userIds,
        CancellationToken cancellationToken)
    {
        var wasChanged = false;
        var invitedUserIds = new HashSet<Guid>();
        var presenceSubjects = await this._presenceCoordinator.ExecuteTopologyMutationAsync(
            UserPresenceTopologyKey.PrivateSpace(spaceId),
            userIds,
            token => this.ResolveActivePrivateSpaceUserIdsAsync(spaceId, token),
            async token =>
            {
                var privateSpace = await this._db.PrivateSpaces
                    .Include(x => x.Members)
                    .Include(x => x.Space)
                    .FirstOrDefaultAsync(
                        x => x.SpaceId == spaceId &&
                             x.DeletedAt == null &&
                             x.Space.DeletedAt == null,
                        token);
                if (privateSpace == null ||
                    privateSpace.Members.Count != userIds.Count ||
                    userIds.Any(userId =>
                        privateSpace.Members.All(member => member.UserId != userId)))
                {
                    return;
                }

                var now = DateTime.UtcNow;
                var membersToReactivate = privateSpace.Members
                    .Where(member =>
                        userIds.Contains(member.UserId) &&
                        member.StatusId != PrivateSpaceIds.MemberStatusActive)
                    .ToList();
                var listPositions = await PrivateSpaceListOrder.GetNextTopPositionsAsync(
                    this._db,
                    membersToReactivate.Select(member => member.UserId),
                    token);
                foreach (var member in membersToReactivate)
                {
                    member.StatusId = PrivateSpaceIds.MemberStatusActive;
                    member.ListPosition = listPositions[member.UserId];
                    member.ListActivityAt = now;
                    member.LeftAt = null;
                    member.JoinedAt = now;
                    member.UpdatedAt = now;
                    wasChanged = true;
                    if (member.UserId != actorUserId)
                    {
                        invitedUserIds.Add(member.UserId);
                    }
                }

                if (!wasChanged)
                {
                    return;
                }

                await this.TouchPrivateSpaceAsync(spaceId, now, token);
                foreach (var invitedUserId in invitedUserIds)
                {
                    await this._notifications.StagePrivateSpaceInviteAsync(
                        invitedUserId,
                        actorUserId,
                        spaceId,
                        privateSpace.Space.Title,
                        token);
                }
                await this._db.SaveChangesAsync(token);
            },
            cancellationToken);

        if (!wasChanged)
        {
            return;
        }

        await this._presenceCoordinator.AudienceChangedAsync(
            presenceSubjects,
            CancellationToken.None);
        await this.NotifyPrivateSpacesChangedAsync(
            spaceId,
            CancellationToken.None);
        await this._notifications.NotifyChangedAsync(
            invitedUserIds,
            CancellationToken.None);
    }

    private async Task<IReadOnlyCollection<Guid>> ResolveActivePrivateSpaceUserIdsAsync(
        Guid spaceId,
        CancellationToken cancellationToken)
    {
        return await this._db.PrivateSpaceMembers
            .AsNoTracking()
            .Where(member =>
                member.SpaceId == spaceId &&
                member.StatusId == PrivateSpaceIds.MemberStatusActive &&
                member.PrivateSpace.DeletedAt == null &&
                member.PrivateSpace.Space.DeletedAt == null)
            .Select(member => member.UserId)
            .Distinct()
            .ToArrayAsync(cancellationToken);
    }

    private async Task<IReadOnlySet<Guid>> GetBlockedUserIdsAsync(
        Guid currentUserId,
        CancellationToken cancellationToken)
    {
        return (await this._db.UserDirectMessageBlocks
                .AsNoTracking()
                .Where(block => block.UserId == currentUserId)
                .Select(block => block.BlockedUserId)
                .ToArrayAsync(cancellationToken))
            .ToHashSet();
    }

    private async Task RestoreDirectVisibilityAsync(
        Guid spaceId,
        Guid userId,
        CancellationToken cancellationToken)
    {
        var membership = await this._db.PrivateSpaceMembers
            .FirstOrDefaultAsync(
                member =>
                    member.SpaceId == spaceId &&
                    member.UserId == userId &&
                    member.StatusId ==
                    PrivateSpaceIds.MemberStatusActive &&
                    member.HiddenFromListAt != null,
                cancellationToken);
        if (membership == null)
        {
            return;
        }

        var now = this._timeProvider.GetUtcNow().UtcDateTime;
        membership.HiddenFromListAt = null;
        membership.ListActivityAt = now;
        membership.UpdatedAt = now;
        await this._db.SaveChangesAsync(cancellationToken);
        await this._notifier.NotifySpacesChangedForUserAsync(
            userId,
            spaceId,
            CancellationToken.None);
    }

    private IQueryable<PrivateSpace> LoadPrivateSpacesQuery()
    {
        return PrivateSpaceQueries.LoadSpaces(this._db);
    }

    private IQueryable<SpaceMessage> LoadMessagesQuery()
    {
        return PrivateSpaceQueries.LoadMessages(this._db);
    }

    private async Task<bool> IsActiveMemberAsync(
        Guid userId,
        Guid spaceId,
        CancellationToken cancellationToken)
    {
        return await this._access.IsActiveMemberAsync(userId, spaceId, cancellationToken);
    }

    private async Task<bool> AreActiveUsersAsync(
        IReadOnlyCollection<Guid> userIds,
        CancellationToken cancellationToken)
    {
        return await this._access.AreActiveUsersAsync(userIds, cancellationToken);
    }

    private async Task<bool> IsActiveUserAsync(
        Guid userId,
        CancellationToken cancellationToken)
    {
        return await this._access.IsActiveUserAsync(userId, cancellationToken);
    }

    private async Task<string> BuildDefaultGroupTitleAsync(
        IEnumerable<Guid> memberUserIds,
        CancellationToken cancellationToken)
    {
        var names = await this._db.UserProfiles
            .AsNoTracking()
            .Where(x => memberUserIds.Contains(x.UserId))
            .OrderBy(x => x.DisplayNameNorm)
            .Select(x => x.DisplayName)
            .Take(4)
            .ToListAsync(cancellationToken);

        return PrivateSpaceTitleMapper.BuildDefaultGroupTitle(names);
    }

    private async Task<string> BuildDirectInternalTitleAsync(
        Guid targetUserId,
        CancellationToken cancellationToken)
    {
        return await this._db.UserProfiles
            .AsNoTracking()
            .Where(profile => profile.UserId == targetUserId)
            .Select(profile => profile.DisplayName)
            .SingleOrDefaultAsync(cancellationToken)
            ?? "Личная переписка";
    }

    private static DirectPair CanonicalizeDirectPair(
        Guid firstUserId,
        Guid secondUserId)
    {
        return string.CompareOrdinal(
                firstUserId.ToString("N"),
                secondUserId.ToString("N")) < 0
            ? new DirectPair(firstUserId, secondUserId)
            : new DirectPair(secondUserId, firstUserId);
    }

    private async Task<bool> IsUsableOwnedImageAsync(
        Guid ownerUserId,
        Guid assetId,
        CancellationToken cancellationToken)
    {
        return await this._db.Assets
            .AsNoTracking()
            .AnyAsync(
                asset =>
                    asset.Id == assetId &&
                    asset.OwnerUserId == ownerUserId &&
                    asset.DeletedAt == null &&
                    asset.PhysicalDeletedAt == null &&
                    asset.MimeType.StartsWith("image/"),
                cancellationToken);
    }

    private static bool TryResolveCrop(
        double? requestedOffsetX,
        double? requestedOffsetY,
        double? requestedZoom,
        double currentOffsetX,
        double currentOffsetY,
        double currentZoom,
        out ImageCrop crop)
    {
        var offsetX = requestedOffsetX ?? currentOffsetX;
        var offsetY = requestedOffsetY ?? currentOffsetY;
        var zoom = requestedZoom ?? currentZoom;
        if (!double.IsFinite(offsetX) ||
            !double.IsFinite(offsetY) ||
            !double.IsFinite(zoom))
        {
            crop = default;
            return false;
        }

        crop = new ImageCrop(
            Math.Clamp(offsetX, -1, 1),
            Math.Clamp(offsetY, -1, 1),
            Math.Clamp(zoom, 0.5, 3));
        return true;
    }

    private static bool ApplyMuteMode(
        PrivateSpaceMember membership,
        string muteMode,
        DateTime now)
    {
        membership.IsMutedIndefinitely = false;
        membership.MutedUntil = muteMode.Trim().ToLowerInvariant() switch
        {
            "off" => null,
            "1h" or "one_hour" => now.AddHours(1),
            "4h" or "four_hours" => now.AddHours(4),
            "8h" or "eight_hours" => now.AddHours(8),
            "indefinite" => null,
            _ => DateTime.MinValue
        };
        if (membership.MutedUntil == DateTime.MinValue)
        {
            return false;
        }

        membership.IsMutedIndefinitely =
            muteMode.Trim().Equals(
                "indefinite",
                StringComparison.OrdinalIgnoreCase);
        return true;
    }

    private static string? NormalizeLimited(string? value, int maxLength)
    {
        var normalized = NormalizeOptional(value);
        return normalized == null || normalized.Length <= maxLength
            ? normalized
            : null;
    }

    private static bool IsWithinMaxLength(string? value, int maxLength)
    {
        return value == null || value.Length <= maxLength;
    }

    private async Task TouchPrivateSpaceAsync(
        Guid spaceId,
        DateTime updatedAt,
        CancellationToken cancellationToken)
    {
        await this._activity.TouchAsync(spaceId, updatedAt, cancellationToken);
    }

    private async Task NotifyPrivateSpacesChangedAsync(
        Guid spaceId,
        CancellationToken cancellationToken)
    {
        await this._notifier.NotifySpacesChangedAsync(spaceId, cancellationToken);
    }

    private async Task<Dictionary<Guid, SpaceMessageResponse>> GetLastMessagesByPrivateSpaceAsync(
        IReadOnlyCollection<Guid> spaceIds,
        Guid currentUserId,
        CancellationToken cancellationToken)
    {
        try
        {
            if (spaceIds.Count == 0)
            {
                return [];
            }

            var lastMessageIds = await this._db.SpaceMessages
                .AsNoTracking()
                .Where(x =>
                    spaceIds.Contains(x.SpaceId) &&
                    x.DeletedAt == null &&
                    !x.UserDeletions.Any(deletion => deletion.UserId == currentUserId))
                .ApplyHistoryCutoff(this._db, currentUserId)
                .GroupBy(x => x.SpaceId)
                .Select(group => group
                    .OrderByDescending(x => x.CreatedAt)
                    .ThenByDescending(x => x.Id)
                    .Select(x => x.Id)
                    .First())
                .ToListAsync(cancellationToken);

            if (lastMessageIds.Count == 0)
            {
                return [];
            }

            var messages = await this.LoadMessagesQuery()
                .Where(x => lastMessageIds.Contains(x.Id))
                .ToListAsync(cancellationToken);

            return messages.ToDictionary(
                message => message.SpaceId,
                message => SpaceMessageMapper.ToResponse(message, currentUserId));
        }
        catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
        {
            return [];
        }
    }

    private sealed record DirectPair(Guid Low, Guid High);
    private readonly record struct ImageCrop(
        double OffsetX,
        double OffsetY,
        double Zoom);

}
