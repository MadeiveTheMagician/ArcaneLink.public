using ArcaneLink.DataBase._Data;
using ArcaneLink.DataBase.Constants;
using ArcaneLink.DataBase.DTOs.Spaces;
using ArcaneLink.DataBase.Models.SpacesModels;
using ArcaneLink.Services.PrivateSpaces.Abstractions;
using ArcaneLink.Services.Notifications.Abstractions;
using ArcaneLink.Services.Realtime;
using ArcaneLink.Services.Realtime.Abstractions;
using ArcaneLink.Services.Users;
using ArcaneLink.Services.Users.Abstractions;
using ArcaneLink.Exceptions.UsersExceptions;
using Microsoft.EntityFrameworkCore;
using static ArcaneLink.Services.PrivateSpaces.PrivateSpaceResponseMapper;

namespace ArcaneLink.Services.PrivateSpaces
{
    public class PrivateSpaceMembershipService : IPrivateSpaceMembershipService
    {
        private readonly AppDbContext _db;
        private readonly PrivateSpaceAccessService _access;
        private readonly PrivateSpaceActivityService _activity;
        private readonly PrivateSpaceHistoryService _history;
        private readonly PrivateSpaceRealtimeNotifier _notifier;
        private readonly PrivateVoiceAccessReconciliationService _voiceAccess;
        private readonly IUserPresencePolicyService _presencePolicy;
        private readonly IUserPresenceCoordinator _presenceCoordinator;
        private readonly IDirectMessagePrivacyService _directMessagePrivacy;
        private readonly IUserNotificationService _notifications;

        public PrivateSpaceMembershipService(
            AppDbContext db,
            PrivateSpaceAccessService access,
            PrivateSpaceActivityService activity,
            PrivateSpaceHistoryService history,
            PrivateSpaceRealtimeNotifier notifier,
            PrivateVoiceAccessReconciliationService voiceAccess,
            IUserPresencePolicyService presencePolicy,
            IUserPresenceCoordinator presenceCoordinator,
            IDirectMessagePrivacyService directMessagePrivacy,
            IUserNotificationService notifications)
        {
            _db = db;
            _access = access;
            _activity = activity;
            _history = history;
            _notifier = notifier;
            _voiceAccess = voiceAccess;
            _presencePolicy = presencePolicy;
            _presenceCoordinator = presenceCoordinator;
            _directMessagePrivacy = directMessagePrivacy;
            _notifications = notifications;
        }

        public async Task<PrivateSpaceMembershipMutationResponse?> AddMemberAsync(
            Guid currentUserId,
            Guid spaceId,
            AddPrivateSpaceMemberRequest request,
            CancellationToken cancellationToken = default)
        {
            var privateSpace = await _db.PrivateSpaces
                .Include(x => x.Members)
                .Include(x => x.Space)
                .FirstOrDefaultAsync(
                    x => x.SpaceId == spaceId &&
                         x.DeletedAt == null,
                    cancellationToken);

            var currentMembership = privateSpace?.Members.FirstOrDefault(member =>
                member.UserId == currentUserId &&
                member.StatusId == PrivateSpaceIds.MemberStatusActive);
            if (privateSpace == null ||
                currentMembership == null ||
                (privateSpace.Kind == PrivateSpaceKindCodes.Group &&
                 privateSpace.OwnerUserId != currentUserId) ||
                request.UserId == currentUserId ||
                !await _access.IsActiveUserAsync(request.UserId, cancellationToken))
            {
                return null;
            }
            if (privateSpace.Members.Count(member =>
                    member.StatusId == PrivateSpaceIds.MemberStatusActive) >= 21)
            {
                return null;
            }
            var existingMember = privateSpace.Members.FirstOrDefault(member =>
                member.UserId == request.UserId);
            if (existingMember?.StatusId == PrivateSpaceIds.MemberStatusActive)
            {
                return null;
            }
            if ((existingMember == null ||
                 existingMember.StatusId != PrivateSpaceIds.MemberStatusActive) &&
                !await _directMessagePrivacy.CanAddParticipantAsync(
                    currentUserId,
                    request.UserId,
                    privateSpace.Members
                        .Where(member =>
                            member.StatusId == PrivateSpaceIds.MemberStatusActive)
                        .Select(member => member.UserId)
                        .ToArray(),
                    cancellationToken))
            {
                throw new DirectMessagePrivacyDeniedException();
            }

            if (privateSpace.Kind == PrivateSpaceKindCodes.Direct)
            {
                return await CreateGroupFromDirectAsync(
                    currentUserId,
                    privateSpace,
                    request.UserId,
                    cancellationToken);
            }

            PrivateSpaceMember? member = null;
            var membershipChanged = false;
            var mutationSucceeded = false;
            var presenceSubjects = await _presenceCoordinator
                .ExecuteTopologyMutationAsync(
                    UserPresenceTopologyKey.PrivateSpace(spaceId),
                    [currentUserId, request.UserId],
                    token => ResolveActivePrivateSpaceUserIdsAsync(spaceId, token),
                    async token =>
                    {
                        await _db.Entry(privateSpace).ReloadAsync(token);
                        if (privateSpace.DeletedAt != null ||
                            privateSpace.Kind != PrivateSpaceKindCodes.Group ||
                            privateSpace.OwnerUserId != currentUserId ||
                            request.UserId == currentUserId ||
                            !await _access.IsActiveUserAsync(request.UserId, token))
                        {
                            return;
                        }

                        var now = DateTime.UtcNow;
                        member = await _db.PrivateSpaceMembers.FirstOrDefaultAsync(
                            existingMember =>
                                existingMember.SpaceId == spaceId &&
                                existingMember.UserId == request.UserId,
                            token);
                        if ((member == null ||
                             member.StatusId != PrivateSpaceIds.MemberStatusActive) &&
                            !await _directMessagePrivacy.CanAddParticipantAsync(
                                currentUserId,
                                request.UserId,
                                (await ResolveActivePrivateSpaceUserIdsAsync(
                                        spaceId,
                                        token))
                                    .ToArray(),
                                token))
                        {
                            throw new DirectMessagePrivacyDeniedException();
                        }
                        var listPosition = member?.ListPosition ?? 0;
                        if (member == null ||
                            member.StatusId != PrivateSpaceIds.MemberStatusActive)
                        {
                            var listPositions = await PrivateSpaceListOrder
                                .GetNextTopPositionsAsync(
                                    _db,
                                    [request.UserId],
                                    token);
                            listPosition = listPositions[request.UserId];
                        }
                        if (member == null)
                        {
                            member = new PrivateSpaceMember
                            {
                                Id = Guid.NewGuid(),
                                SpaceId = spaceId,
                                UserId = request.UserId,
                                StatusId = PrivateSpaceIds.MemberStatusActive,
                                ListPosition = listPosition,
                                ListActivityAt = now,
                                JoinedAt = now,
                                AddedByUserId = currentUserId,
                                CreatedAt = now,
                                UpdatedAt = now
                            };
                            _db.PrivateSpaceMembers.Add(member);
                            membershipChanged = true;
                        }
                        else if (member.StatusId !=
                                 PrivateSpaceIds.MemberStatusActive)
                        {
                            member.StatusId = PrivateSpaceIds.MemberStatusActive;
                            member.ListPosition = listPosition;
                            member.ListActivityAt = now;
                            member.HiddenFromListAt = null;
                            member.JoinedAt = now;
                            member.LeftAt = null;
                            member.AddedByUserId = currentUserId;
                            member.UpdatedAt = now;
                            membershipChanged = true;
                        }

                        privateSpace.UpdatedAt = now;
                        if (membershipChanged)
                        {
                            await _notifications.StagePrivateSpaceInviteAsync(
                                request.UserId,
                                currentUserId,
                                spaceId,
                                privateSpace.Space.Title,
                                token);
                        }
                        await _db.SaveChangesAsync(token);
                        mutationSucceeded = true;
                    },
                    cancellationToken);
            if (!mutationSucceeded || member == null)
            {
                return null;
            }

            if (membershipChanged)
            {
                await _presenceCoordinator.AudienceChangedAsync(
                    presenceSubjects,
                    CancellationToken.None);
            }
            await _notifier.NotifySpacesChangedAsync(
                spaceId,
                CancellationToken.None);
            if (membershipChanged)
            {
                await _notifications.NotifyChangedAsync(
                    [request.UserId],
                    CancellationToken.None);
            }

            var memberResponse = await LoadMemberResponseAsync(
                currentUserId,
                member.Id,
                cancellationToken);
            return memberResponse == null
                ? null
                : new PrivateSpaceMembershipMutationResponse
                {
                    SpaceId = spaceId,
                    CreatedGroup = false,
                    Member = memberResponse
                };
        }

        private async Task<PrivateSpaceMembershipMutationResponse?>
            CreateGroupFromDirectAsync(
                Guid currentUserId,
                PrivateSpace directSpace,
                Guid newUserId,
                CancellationToken cancellationToken)
        {
            var memberUserIds = directSpace.Members
                .Where(member =>
                    member.StatusId == PrivateSpaceIds.MemberStatusActive)
                .Select(member => member.UserId)
                .Append(newUserId)
                .Distinct()
                .ToArray();
            if (memberUserIds.Length < 2 ||
                !await _directMessagePrivacy.CanStartConversationsAsync(
                    currentUserId,
                    memberUserIds,
                    cancellationToken))
            {
                throw new DirectMessagePrivacyDeniedException();
            }

            var names = await _db.UserProfiles
                .AsNoTracking()
                .Where(profile => memberUserIds.Contains(profile.UserId))
                .OrderBy(profile => profile.DisplayNameNorm)
                .Select(profile => profile.DisplayName)
                .Take(4)
                .ToListAsync(cancellationToken);
            var title = PrivateSpaceTitleMapper.BuildDefaultGroupTitle(names);
            var now = DateTime.UtcNow;
            var listPositions = await PrivateSpaceListOrder
                .GetNextTopPositionsAsync(
                    _db,
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
                Description = null,
                RequiredServerRoleId = null,
                Position = 0,
                IsSystem = false,
                CreatedAt = now,
                UpdatedAt = now
            };
            var group = new PrivateSpace
            {
                SpaceId = space.Id,
                Space = space,
                CreatedByUserId = currentUserId,
                OwnerUserId = currentUserId,
                Kind = PrivateSpaceKindCodes.Group,
                Title = title,
                CreatedAt = now,
                UpdatedAt = now
            };
            PrivateSpaceMember? addedMember = null;
            foreach (var userId in memberUserIds)
            {
                var membership = new PrivateSpaceMember
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
                };
                group.Members.Add(membership);
                if (userId == newUserId)
                {
                    addedMember = membership;
                }
            }

            _db.PrivateSpaces.Add(group);
            var invitedUserIds = memberUserIds
                .Where(userId => userId != currentUserId)
                .ToArray();
            foreach (var invitedUserId in invitedUserIds)
            {
                await _notifications.StagePrivateSpaceInviteAsync(
                    invitedUserId,
                    currentUserId,
                    space.Id,
                    title,
                    cancellationToken);
            }
            await _presenceCoordinator.ExecuteMutationAsync(
                memberUserIds,
                token => _db.SaveChangesAsync(token),
                cancellationToken);
            await _presenceCoordinator.AudienceChangedAsync(
                memberUserIds,
                CancellationToken.None);
            await _notifier.NotifySpacesChangedAsync(
                space.Id,
                CancellationToken.None);
            await _notifications.NotifyChangedAsync(
                invitedUserIds,
                CancellationToken.None);

            if (addedMember == null)
            {
                return null;
            }

            var response = await LoadMemberResponseAsync(
                currentUserId,
                addedMember.Id,
                cancellationToken);
            return response == null
                ? null
                : new PrivateSpaceMembershipMutationResponse
                {
                    SpaceId = space.Id,
                    CreatedGroup = true,
                    Member = response
                };
        }

        public async Task<bool> LeaveAsync(
            Guid currentUserId,
            Guid spaceId,
            CancellationToken cancellationToken = default)
        {
            var member = await _db.PrivateSpaceMembers
                .Include(item => item.PrivateSpace)
                .FirstOrDefaultAsync(
                    x => x.SpaceId == spaceId &&
                         x.UserId == currentUserId &&
                         x.StatusId == PrivateSpaceIds.MemberStatusActive,
                    cancellationToken);

            if (member == null)
            {
                return false;
            }
            if (member.PrivateSpace.Kind == PrivateSpaceKindCodes.Direct)
            {
                return await _history.ClearAsync(
                    currentUserId,
                    spaceId,
                    hideDirectFromList: true,
                    cancellationToken);
            }

            return await CloseMemberAsync(
                currentUserId,
                member,
                PrivateSpaceIds.MemberStatusLeft,
                requireOwner: false,
                cancellationToken);
        }

        public Task<bool> ClearHistoryAsync(
            Guid currentUserId,
            Guid spaceId,
            CancellationToken cancellationToken = default)
        {
            return _history.ClearAsync(
                currentUserId,
                spaceId,
                hideDirectFromList: false,
                cancellationToken);
        }

        public async Task<bool> RemoveMemberAsync(
            Guid currentUserId,
            Guid spaceId,
            Guid memberId,
            CancellationToken cancellationToken = default)
        {
            var privateSpace = await _db.PrivateSpaces
                .FirstOrDefaultAsync(
                    x => x.SpaceId == spaceId &&
                         x.DeletedAt == null,
                    cancellationToken);

            if (privateSpace == null ||
                privateSpace.Kind != PrivateSpaceKindCodes.Group ||
                privateSpace.OwnerUserId != currentUserId)
            {
                return false;
            }

            var member = await _db.PrivateSpaceMembers
                .FirstOrDefaultAsync(
                    x => x.Id == memberId &&
                         x.SpaceId == spaceId &&
                         x.UserId != currentUserId &&
                         x.StatusId == PrivateSpaceIds.MemberStatusActive,
                    cancellationToken);

            return member != null &&
                   await CloseMemberAsync(
                       currentUserId,
                       member,
                       PrivateSpaceIds.MemberStatusRemoved,
                       requireOwner: true,
                       cancellationToken);
        }

        private async Task<bool> CloseMemberAsync(
            Guid currentUserId,
            PrivateSpaceMember member,
            Guid statusId,
            bool requireOwner,
            CancellationToken cancellationToken)
        {
            var mutationSucceeded = false;
            var presenceSubjects = await _presenceCoordinator
                .ExecuteTopologyMutationAsync(
                    UserPresenceTopologyKey.PrivateSpace(member.SpaceId),
                    [currentUserId, member.UserId],
                    token => ResolveActivePrivateSpaceUserIdsAsync(
                        member.SpaceId,
                        token),
                    async token =>
                    {
                        await _db.Entry(member).ReloadAsync(token);
                        var privateSpace = await _db.PrivateSpaces
                            .Include(space => space.Space)
                            .FirstOrDefaultAsync(
                                space =>
                                    space.SpaceId == member.SpaceId &&
                                    space.DeletedAt == null,
                                token);
                        if (privateSpace == null ||
                            member.StatusId != PrivateSpaceIds.MemberStatusActive ||
                            (requireOwner &&
                             (privateSpace.OwnerUserId != currentUserId ||
                              member.UserId == currentUserId)))
                        {
                            return;
                        }

                        var now = DateTime.UtcNow;
                        member.StatusId = statusId;
                        member.LeftAt = now;
                        member.UpdatedAt = now;
                        if (!requireOwner &&
                            privateSpace.Kind == PrivateSpaceKindCodes.Group &&
                            privateSpace.OwnerUserId == member.UserId)
                        {
                            var successorUserId = await _db.PrivateSpaceMembers
                                .Where(candidate =>
                                    candidate.SpaceId == member.SpaceId &&
                                    candidate.UserId != member.UserId &&
                                    candidate.StatusId ==
                                    PrivateSpaceIds.MemberStatusActive)
                                .OrderBy(candidate => candidate.JoinedAt)
                                .ThenBy(candidate => candidate.Id)
                                .Select(candidate => (Guid?)candidate.UserId)
                                .FirstOrDefaultAsync(token);
                            if (successorUserId.HasValue)
                            {
                                privateSpace.OwnerUserId =
                                    successorUserId.Value;
                            }
                            else
                            {
                                privateSpace.DeletedAt = now;
                                privateSpace.Space.DeletedAt = now;
                            }
                        }
                        await _activity.TouchAsync(member.SpaceId, now, token);
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
            await _voiceAccess.RevokeMemberBestEffortAsync(member.SpaceId, member.UserId);
            await _notifier.NotifySpacesChangedAsync(
                member.SpaceId,
                cancellationToken,
                member.UserId);
            return true;
        }

        private async Task<IReadOnlyCollection<Guid>> ResolveActivePrivateSpaceUserIdsAsync(
            Guid spaceId,
            CancellationToken cancellationToken)
        {
            return await _db.PrivateSpaceMembers
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

        private async Task<PrivateSpaceMemberResponse?> LoadMemberResponseAsync(
            Guid currentUserId,
            Guid memberId,
            CancellationToken cancellationToken)
        {
            var member = await _db.PrivateSpaceMembers
                .AsNoTracking()
                .Include(x => x.Status)
                .Include(x => x.User)
                    .ThenInclude(x => x.Profile)
                .FirstOrDefaultAsync(x => x.Id == memberId, cancellationToken);

            if (member == null)
            {
                return null;
            }

            var presence = await _presencePolicy.ResolveAsync(
                currentUserId,
                [member.UserId],
                cancellationToken);

            return ToMemberResponse(
                member,
                presence.GetValueOrDefault(
                    member.UserId,
                    UserPresenceSnapshot.Hidden));
        }
    }
}
