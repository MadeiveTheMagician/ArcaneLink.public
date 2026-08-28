using System.Globalization;
using System.Text;
using System.Text.RegularExpressions;
using ArcaneLink.DataBase._Data;
using ArcaneLink.DataBase.Constants;
using ArcaneLink.DataBase.DTOs.Messages;
using ArcaneLink.DataBase.Models.MessagesModels;
using ArcaneLink.Services.Notifications;
using ArcaneLink.Services.Notifications.Abstractions;
using Microsoft.EntityFrameworkCore;

namespace ArcaneLink.Services.Messages
{
    public partial class SpaceMessageMentionService
    {
        private const int MaxMentions = 100;
        private const int AutocompleteUserLimit = 5;
        private const int AutocompleteRoleLimit = 20;
        private const int AutocompleteScanBatchSize = 50;
        private const int AutocompleteQueryLengthLimit = 100;
        private readonly AppDbContext _db;
        private readonly IUserNotificationService _notifications;
        private readonly SpaceMessageAccessService _access;
        private readonly TimeProvider _timeProvider;

        public SpaceMessageMentionService(
            AppDbContext db,
            IUserNotificationService notifications,
            SpaceMessageAccessService access,
            TimeProvider timeProvider)
        {
            this._db = db;
            this._notifications = notifications;
            this._access = access;
            this._timeProvider = timeProvider;
        }

        public async Task<SpaceMentionAutocompleteResponse?> GetServerAutocompleteAsync(
            Guid currentUserId,
            Guid serverId,
            Guid spaceId,
            string? query,
            CancellationToken cancellationToken = default)
        {
            if (await this._access.GetViewableMessageSpaceAsync(
                    currentUserId,
                    serverId,
                    spaceId,
                    cancellationToken) == null)
            {
                return null;
            }

            var normalizedQuery = NormalizeAutocompleteQuery(query);
            var activeMemberQuery = this._db.ServerMembers
                .AsNoTracking()
                .Where(member =>
                    member.ServerId == serverId &&
                    member.UserId != currentUserId &&
                    member.StatusId == ServerMemberStatusIds.Active &&
                    member.BannedAt == null &&
                    member.User.StatusId == UserStatusIds.Active &&
                    member.User.DeletedAt == null);
            if (normalizedQuery.Length > 0)
            {
                activeMemberQuery = activeMemberQuery.Where(member =>
                    member.User.LoginNorm.Contains(normalizedQuery) ||
                    (member.ServerProfile != null &&
                     member.ServerProfile.DisplayNameNorm != null
                        ? member.ServerProfile.DisplayNameNorm
                        : member.User.Profile.DisplayNameNorm)
                    .Contains(normalizedQuery));
            }

            var users = new List<SpaceMentionUserOptionResponse>(
                AutocompleteUserLimit);
            var memberOffset = 0;
            while (users.Count < AutocompleteUserLimit)
            {
                var memberBatch = await activeMemberQuery
                    .OrderBy(member =>
                        normalizedQuery.Length == 0 ||
                        member.User.LoginNorm == normalizedQuery ||
                        (member.ServerProfile != null &&
                         member.ServerProfile.DisplayNameNorm != null
                            ? member.ServerProfile.DisplayNameNorm
                            : member.User.Profile.DisplayNameNorm) == normalizedQuery
                            ? 0
                            : member.User.LoginNorm.StartsWith(normalizedQuery) ||
                              (member.ServerProfile != null &&
                               member.ServerProfile.DisplayNameNorm != null
                                  ? member.ServerProfile.DisplayNameNorm
                                  : member.User.Profile.DisplayNameNorm)
                              .StartsWith(normalizedQuery)
                                ? 1
                                : 2)
                    .ThenBy(member =>
                        member.ServerProfile != null &&
                        member.ServerProfile.DisplayNameNorm != null
                            ? member.ServerProfile.DisplayNameNorm
                            : member.User.Profile.DisplayNameNorm)
                    .ThenBy(member => member.User.LoginNorm)
                    .ThenBy(member => member.UserId)
                    .Skip(memberOffset)
                    .Take(AutocompleteScanBatchSize)
                    .Select(member => new
                    {
                        member.UserId,
                        member.User.Login,
                        DisplayName = member.ServerProfile != null &&
                                      member.ServerProfile.DisplayName != null
                            ? member.ServerProfile.DisplayName
                            : member.User.Profile.DisplayName,
                        AvatarAssetId = member.ServerProfile != null &&
                                        member.ServerProfile.AvatarAssetId != null
                            ? member.ServerProfile.AvatarAssetId
                            : member.User.Profile.AvatarAssetId,
                        AvatarCropOffsetX = member.ServerProfile != null &&
                                            member.ServerProfile.AvatarAssetId != null
                            ? 0
                            : member.User.Profile.AvatarCropOffsetX,
                        AvatarCropOffsetY = member.ServerProfile != null &&
                                            member.ServerProfile.AvatarAssetId != null
                            ? 0
                            : member.User.Profile.AvatarCropOffsetY,
                        AvatarCropZoom = member.ServerProfile != null &&
                                         member.ServerProfile.AvatarAssetId != null
                            ? 1
                            : member.User.Profile.AvatarCropZoom
                    })
                    .ToListAsync(cancellationToken);
                if (memberBatch.Count == 0)
                {
                    break;
                }

                memberOffset += memberBatch.Count;
                var allowedUserIds = (await this._access.FilterViewableMessageUserIdsAsync(
                        serverId,
                        spaceId,
                        memberBatch.Select(member => member.UserId),
                        cancellationToken))
                    .ToHashSet();
                foreach (var member in memberBatch)
                {
                    if (!allowedUserIds.Contains(member.UserId))
                    {
                        continue;
                    }

                    users.Add(new SpaceMentionUserOptionResponse
                    {
                        Id = member.UserId,
                        Login = member.Login,
                        DisplayName = member.DisplayName,
                        AvatarAssetId = member.AvatarAssetId,
                        AvatarCropOffsetX = member.AvatarCropOffsetX,
                        AvatarCropOffsetY = member.AvatarCropOffsetY,
                        AvatarCropZoom = member.AvatarCropZoom
                    });
                    if (users.Count == AutocompleteUserLimit)
                    {
                        break;
                    }
                }

                if (memberBatch.Count < AutocompleteScanBatchSize)
                {
                    break;
                }
            }

            var roleQuery = this._db.ServerRoles
                .AsNoTracking()
                .Where(role =>
                    role.ServerId == serverId &&
                    role.DeletedAt == null &&
                    role.Mentionable &&
                    role.Kind == ServerRoleKindCodes.Standard &&
                    !role.IsSystem &&
                    role.MemberRoles.Any(assignment =>
                        assignment.ServerId == serverId &&
                        assignment.RevokedAt == null &&
                        assignment.Member.UserId != currentUserId &&
                        assignment.Member.StatusId == ServerMemberStatusIds.Active &&
                        assignment.Member.BannedAt == null &&
                        assignment.Member.User.StatusId == UserStatusIds.Active &&
                        assignment.Member.User.DeletedAt == null));
            if (normalizedQuery.Length > 0)
            {
                roleQuery = roleQuery.Where(role =>
                    role.Title.ToUpper().Contains(normalizedQuery));
            }

            var roles = new List<SpaceMentionRoleOptionResponse>(
                AutocompleteRoleLimit);
            var roleOffset = 0;
            while (roles.Count < AutocompleteRoleLimit)
            {
                var roleBatch = await roleQuery
                    .OrderBy(role =>
                        normalizedQuery.Length == 0 ||
                        role.Title.ToUpper() == normalizedQuery
                            ? 0
                            : role.Title.ToUpper().StartsWith(normalizedQuery)
                                ? 1
                                : 2)
                    .ThenBy(role => role.Title)
                    .ThenBy(role => role.Id)
                    .Skip(roleOffset)
                    .Take(AutocompleteRoleLimit)
                    .Select(role => new SpaceMentionRoleOptionResponse
                    {
                        Id = role.Id,
                        Title = role.Title
                    })
                    .ToListAsync(cancellationToken);
                if (roleBatch.Count == 0)
                {
                    break;
                }

                roleOffset += roleBatch.Count;
                var roleIds = roleBatch
                    .Select(role => role.Id)
                    .ToArray();
                var roleMembers = await this._db.ServerMemberRoles
                    .AsNoTracking()
                    .Where(assignment =>
                        assignment.ServerId == serverId &&
                        roleIds.Contains(assignment.RoleId) &&
                        assignment.RevokedAt == null &&
                        assignment.Member.UserId != currentUserId &&
                        assignment.Member.StatusId == ServerMemberStatusIds.Active &&
                        assignment.Member.BannedAt == null &&
                        assignment.Member.User.StatusId == UserStatusIds.Active &&
                        assignment.Member.User.DeletedAt == null)
                    .Select(assignment => new
                    {
                        assignment.RoleId,
                        assignment.Member.UserId
                    })
                    .Distinct()
                    .ToListAsync(cancellationToken);
                var authorizedUserIds = (await this._access
                        .FilterViewableMessageUserIdsAsync(
                            serverId,
                            spaceId,
                            roleMembers.Select(member => member.UserId),
                            cancellationToken))
                    .ToHashSet();
                var authorizedRoleIds = roleMembers
                    .Where(member => authorizedUserIds.Contains(member.UserId))
                    .Select(member => member.RoleId)
                    .ToHashSet();
                foreach (var role in roleBatch)
                {
                    if (!authorizedRoleIds.Contains(role.Id))
                    {
                        continue;
                    }

                    roles.Add(role);
                    if (roles.Count == AutocompleteRoleLimit)
                    {
                        break;
                    }
                }

                if (roleBatch.Count < AutocompleteRoleLimit)
                {
                    break;
                }
            }

            return new SpaceMentionAutocompleteResponse
            {
                Users = users,
                Roles = roles
            };
        }

        private static string NormalizeAutocompleteQuery(string? query)
        {
            var value = (query ?? string.Empty).Trim();
            if (value.StartsWith('@'))
            {
                value = value[1..];
            }
            if (value.Length > AutocompleteQueryLengthLimit)
            {
                value = value[..AutocompleteQueryLengthLimit];
            }

            return value
                .Normalize(NormalizationForm.FormKC)
                .ToUpperInvariant();
        }

        public async Task<MentionStageResult?> ResolveAndStageServerAsync(
            Guid actorUserId,
            Guid serverId,
            Guid spaceId,
            SpaceMessage message,
            string? body,
            IReadOnlyList<SpaceMessageMentionRequest>? requests,
            bool replaceExisting,
            CancellationToken cancellationToken = default)
        {
            var context = await this._db.Spaces
                .Where(x => x.Id == spaceId && x.ServerId == serverId)
                .Select(x => new
                {
                    x.Title,
                    NotificationSpaceId = x.ParentVoiceSpaceId ?? x.Id
                })
                .FirstOrDefaultAsync(cancellationToken);
            if (context == null)
            {
                return null;
            }

            var resolution = requests == null
                ? await this.ResolveLegacyServerAsync(serverId, message.Id, body, cancellationToken)
                : await this.ResolveExplicitServerAsync(serverId, message.Id, body, requests, cancellationToken);
            if (resolution == null)
            {
                return null;
            }

            if (resolution.Mentions.Any(mention =>
                    mention.Kind == MentionKinds.Everyone) &&
                await this._access.GetEveryoneMentionableMessageSpaceAsync(
                    actorUserId,
                    serverId,
                    spaceId,
                    cancellationToken) == null)
            {
                return null;
            }

            var recipients = await this.ResolveServerRecipientsAsync(
                actorUserId,
                serverId,
                context.NotificationSpaceId,
                resolution.Mentions,
                cancellationToken);

            this.ReplaceMentions(message, resolution.Mentions, replaceExisting);
            var notified = await this._notifications.StageResolvedMentionsAsync(
                actorUserId,
                serverId,
                context.NotificationSpaceId,
                context.Title,
                message.Id,
                body,
                recipients,
                cancellationToken);
            return new MentionStageResult(notified);
        }

        public async Task<MentionStageResult?> ResolveAndStagePrivateAsync(
            Guid actorUserId,
            Guid spaceId,
            SpaceMessage message,
            string? body,
            IReadOnlyList<SpaceMessageMentionRequest>? requests,
            bool replaceExisting,
            CancellationToken cancellationToken = default)
        {
            var context = await this._db.PrivateSpaces
                .Where(x => x.SpaceId == spaceId && x.DeletedAt == null)
                .Select(x => new { x.Space.Title })
                .FirstOrDefaultAsync(cancellationToken);
            if (context == null)
            {
                return null;
            }

            var resolution = requests == null
                ? await this.ResolveLegacyPrivateAsync(spaceId, message.Id, body, cancellationToken)
                : await this.ResolveExplicitPrivateAsync(spaceId, message.Id, body, requests, cancellationToken);
            if (resolution == null)
            {
                return null;
            }

            var recipients = await this.ResolvePrivateRecipientsAsync(
                actorUserId,
                spaceId,
                resolution.Mentions,
                cancellationToken);
            this.ReplaceMentions(message, resolution.Mentions, replaceExisting);
            var notified = await this._notifications.StageResolvedMentionsAsync(
                actorUserId,
                serverId: null,
                spaceId,
                context.Title,
                message.Id,
                body,
                recipients,
                cancellationToken);
            return new MentionStageResult(notified);
        }

        private async Task<MentionResolution?> ResolveExplicitServerAsync(
            Guid serverId,
            Guid messageId,
            string? body,
            IReadOnlyList<SpaceMessageMentionRequest> requests,
            CancellationToken cancellationToken)
        {
            if (!ValidateRequestShape(body, requests, allowRoles: true))
            {
                return null;
            }

            if (requests.Count == 0)
            {
                return new MentionResolution([]);
            }

            var userIds = requests
                .Where(x => x.Kind == MentionKinds.User)
                .Select(x => x.TargetId!.Value)
                .Distinct()
                .ToList();
            var roleIds = requests
                .Where(x => x.Kind == MentionKinds.Role)
                .Select(x => x.TargetId!.Value)
                .Distinct()
                .ToList();
            var users = await this._db.ServerMembers
                .AsNoTracking()
                .Where(x =>
                    x.ServerId == serverId &&
                    userIds.Contains(x.UserId) &&
                    x.StatusId == ServerMemberStatusIds.Active &&
                    x.BannedAt == null &&
                    x.User.StatusId == UserStatusIds.Active &&
                    x.User.DeletedAt == null)
                .Select(x => new { x.UserId, x.User.Login })
                .ToDictionaryAsync(x => x.UserId, cancellationToken);
            var roles = await this._db.ServerRoles
                .AsNoTracking()
                .Where(x =>
                    x.ServerId == serverId &&
                    roleIds.Contains(x.Id) &&
                    x.DeletedAt == null &&
                    x.Mentionable &&
                    x.Kind == ServerRoleKindCodes.Standard &&
                    !x.IsSystem)
                .Select(x => new { x.Id, x.Title })
                .ToDictionaryAsync(x => x.Id, cancellationToken);

            var now = DateTime.UtcNow;
            var mentions = new List<SpaceMessageMention>(requests.Count);
            foreach (var request in requests)
            {
                string displayText;
                Guid? targetUserId = null;
                Guid? targetRoleId = null;
                switch (request.Kind)
                {
                    case MentionKinds.User:
                        if (!users.TryGetValue(request.TargetId!.Value, out var user)) return null;
                        targetUserId = user.UserId;
                        displayText = $"@{user.Login}";
                        break;
                    case MentionKinds.Role:
                        if (!roles.TryGetValue(request.TargetId!.Value, out var role)) return null;
                        targetRoleId = role.Id;
                        displayText = $"@{role.Title}";
                        break;
                    default:
                        displayText = "@everyone";
                        break;
                }

                if (!MatchesCanonicalToken(body!, request, displayText))
                {
                    return null;
                }

                mentions.Add(CreateMention(
                    messageId,
                    request.Kind,
                    targetUserId,
                    targetRoleId,
                    displayText,
                    request.Start,
                    request.Length,
                    now));
            }

            return new MentionResolution(mentions);
        }

        private async Task<MentionResolution?> ResolveExplicitPrivateAsync(
            Guid spaceId,
            Guid messageId,
            string? body,
            IReadOnlyList<SpaceMessageMentionRequest> requests,
            CancellationToken cancellationToken)
        {
            if (!ValidateRequestShape(body, requests, allowRoles: false))
            {
                return null;
            }

            if (requests.Count == 0)
            {
                return new MentionResolution([]);
            }

            var userIds = requests
                .Where(x => x.Kind == MentionKinds.User)
                .Select(x => x.TargetId!.Value)
                .Distinct()
                .ToList();
            var users = await this._db.PrivateSpaceMembers
                .AsNoTracking()
                .Where(x =>
                    x.SpaceId == spaceId &&
                    userIds.Contains(x.UserId) &&
                    x.StatusId == PrivateSpaceIds.MemberStatusActive &&
                    x.User.StatusId == UserStatusIds.Active &&
                    x.User.DeletedAt == null)
                .Select(x => new { x.UserId, x.User.Login })
                .ToDictionaryAsync(x => x.UserId, cancellationToken);

            var now = DateTime.UtcNow;
            var mentions = new List<SpaceMessageMention>(requests.Count);
            foreach (var request in requests)
            {
                string displayText;
                Guid? targetUserId = null;
                if (request.Kind == MentionKinds.User)
                {
                    if (!users.TryGetValue(request.TargetId!.Value, out var user)) return null;
                    targetUserId = user.UserId;
                    displayText = $"@{user.Login}";
                }
                else
                {
                    displayText = "@everyone";
                }

                if (!MatchesCanonicalToken(body!, request, displayText))
                {
                    return null;
                }

                mentions.Add(CreateMention(
                    messageId,
                    request.Kind,
                    targetUserId,
                    targetRoleId: null,
                    displayText,
                    request.Start,
                    request.Length,
                    now));
            }

            return new MentionResolution(mentions);
        }

        private async Task<MentionResolution> ResolveLegacyServerAsync(
            Guid serverId,
            Guid messageId,
            string? body,
            CancellationToken cancellationToken)
        {
            if (string.IsNullOrEmpty(body)) return new MentionResolution([]);
            var matches = LegacyMentionRegex().Matches(body).Cast<Match>().ToList();
            if (matches.Count == 0) return new MentionResolution([]);
            var loginNorms = GetLegacyLoginNormCandidates(matches);
            var users = await this._db.ServerMembers
                .AsNoTracking()
                .Where(x =>
                    x.ServerId == serverId &&
                    x.StatusId == ServerMemberStatusIds.Active &&
                    x.BannedAt == null &&
                    x.User.StatusId == UserStatusIds.Active &&
                    x.User.DeletedAt == null &&
                    loginNorms.Contains(x.User.LoginNorm))
                .Select(x => new LegacyMentionTarget(x.UserId, x.User.Login, x.User.LoginNorm))
                .ToListAsync(cancellationToken);
            return new MentionResolution(BuildLegacyMentions(messageId, body, matches, users));
        }

        private async Task<MentionResolution> ResolveLegacyPrivateAsync(
            Guid spaceId,
            Guid messageId,
            string? body,
            CancellationToken cancellationToken)
        {
            if (string.IsNullOrEmpty(body)) return new MentionResolution([]);
            var matches = LegacyMentionRegex().Matches(body).Cast<Match>().ToList();
            if (matches.Count == 0) return new MentionResolution([]);
            var loginNorms = GetLegacyLoginNormCandidates(matches);
            var users = await this._db.PrivateSpaceMembers
                .AsNoTracking()
                .Where(x =>
                    x.SpaceId == spaceId &&
                    x.StatusId == PrivateSpaceIds.MemberStatusActive &&
                    x.User.StatusId == UserStatusIds.Active &&
                    x.User.DeletedAt == null &&
                    loginNorms.Contains(x.User.LoginNorm))
                .Select(x => new LegacyMentionTarget(x.UserId, x.User.Login, x.User.LoginNorm))
                .ToListAsync(cancellationToken);
            return new MentionResolution(BuildLegacyMentions(messageId, body, matches, users));
        }

        private static IReadOnlyList<string> GetLegacyLoginNormCandidates(
            IReadOnlyCollection<Match> matches)
        {
            var candidates = new HashSet<string>(StringComparer.Ordinal);
            foreach (var match in matches)
            {
                var value = match.Groups["login"].Value;
                candidates.Add(value.ToUpperInvariant());
                for (var index = 0; index < value.Length; index++)
                {
                    if (value[index] == '.' &&
                        (index + 1 == value.Length ||
                         !IsMentionWordCharacter(value[index + 1])))
                    {
                        candidates.Add(value[..index].ToUpperInvariant());
                    }
                }
            }
            return candidates.Where(candidate => candidate.Length > 0).ToList();
        }

        private static IReadOnlyList<SpaceMessageMention> BuildLegacyMentions(
            Guid messageId,
            string body,
            IReadOnlyCollection<Match> matches,
            IReadOnlyCollection<LegacyMentionTarget> users)
        {
            var targets = users
                .OrderByDescending(user => user.Login.Length)
                .ThenBy(user => user.UserId)
                .ToList();
            var mentions = new List<SpaceMessageMention>();
            var now = DateTime.UtcNow;
            foreach (var match in matches)
            {
                var tokenStart = match.Index;
                var loginStart = tokenStart + 1;
                var candidateLength = match.Groups["login"].Length;
                var target = targets.FirstOrDefault(user =>
                    user.Login.Length <= candidateLength &&
                    body.AsSpan(loginStart, user.Login.Length)
                        .Equals(user.Login.AsSpan(), StringComparison.OrdinalIgnoreCase) &&
                    !IsMentionSuffixContinuation(body, loginStart + user.Login.Length));
                if (target == null)
                {
                    continue;
                }

                mentions.Add(CreateMention(
                    messageId,
                    MentionKinds.User,
                    target.UserId,
                    null,
                    $"@{target.Login}",
                    tokenStart,
                    target.Login.Length + 1,
                    now));
                if (mentions.Count == MaxMentions)
                {
                    break;
                }
            }
            return mentions;
        }

        private async Task<IReadOnlyList<Guid>> ResolveServerRecipientsAsync(
            Guid actorUserId,
            Guid serverId,
            Guid spaceId,
            IReadOnlyCollection<SpaceMessageMention> mentions,
            CancellationToken cancellationToken)
        {
            if (mentions.Count == 0) return [];
            var candidates = mentions
                .Where(x => x.TargetUserId.HasValue)
                .Select(x => x.TargetUserId!.Value)
                .ToHashSet();
            var roleIds = mentions
                .Where(x => x.TargetRoleId.HasValue)
                .Select(x => x.TargetRoleId!.Value)
                .ToList();
            if (roleIds.Count > 0)
            {
                candidates.UnionWith(await this._db.ServerMemberRoles
                    .AsNoTracking()
                    .Where(x =>
                        x.ServerId == serverId &&
                        roleIds.Contains(x.RoleId) &&
                        x.RevokedAt == null &&
                        x.Role.DeletedAt == null &&
                        x.Member.StatusId == ServerMemberStatusIds.Active &&
                        x.Member.BannedAt == null &&
                        x.Member.User.StatusId == UserStatusIds.Active &&
                        x.Member.User.DeletedAt == null)
                    .Select(x => x.Member.UserId)
                    .Distinct()
                    .ToListAsync(cancellationToken));
            }
            if (mentions.Any(x => x.Kind == MentionKinds.Everyone))
            {
                candidates.UnionWith(await this._db.ServerMembers
                    .AsNoTracking()
                    .Where(x =>
                        x.ServerId == serverId &&
                        x.StatusId == ServerMemberStatusIds.Active &&
                        x.BannedAt == null &&
                        x.User.StatusId == UserStatusIds.Active &&
                        x.User.DeletedAt == null)
                    .Select(x => x.UserId)
                    .ToListAsync(cancellationToken));
            }
            candidates.Remove(actorUserId);
            return await this._access.FilterReadableMessageUserIdsAsync(
                serverId,
                spaceId,
                candidates,
                cancellationToken);
        }

        private async Task<IReadOnlyList<Guid>> ResolvePrivateRecipientsAsync(
            Guid actorUserId,
            Guid spaceId,
            IReadOnlyCollection<SpaceMessageMention> mentions,
            CancellationToken cancellationToken)
        {
            if (mentions.Count == 0) return [];
            var targeted = mentions
                .Where(x => x.TargetUserId.HasValue)
                .Select(x => x.TargetUserId!.Value)
                .ToHashSet();
            var everyone = mentions.Any(x => x.Kind == MentionKinds.Everyone);
            var now = this._timeProvider.GetUtcNow().UtcDateTime;
            var candidates = await this._db.PrivateSpaceMembers
                .AsNoTracking()
                .Where(x =>
                    x.SpaceId == spaceId &&
                    x.UserId != actorUserId &&
                    x.StatusId == PrivateSpaceIds.MemberStatusActive &&
                    !x.IsMutedIndefinitely &&
                    (!x.MutedUntil.HasValue || x.MutedUntil <= now) &&
                    x.User.StatusId == UserStatusIds.Active &&
                    x.User.DeletedAt == null &&
                    (everyone || targeted.Contains(x.UserId)))
                .Select(x => x.UserId)
                .Distinct()
                .ToListAsync(cancellationToken);
            return candidates;
        }

        private void ReplaceMentions(
            SpaceMessage message,
            IReadOnlyCollection<SpaceMessageMention> mentions,
            bool replaceExisting)
        {
            if (replaceExisting)
            {
                this._db.SpaceMessageMentions.RemoveRange(message.Mentions);
                message.Mentions.Clear();
            }
            foreach (var mention in mentions)
            {
                message.Mentions.Add(mention);
            }
        }

        private static bool ValidateRequestShape(
            string? body,
            IReadOnlyList<SpaceMessageMentionRequest> requests,
            bool allowRoles)
        {
            if (requests.Count > MaxMentions || (requests.Count > 0 && body == null)) return false;
            var ordered = requests.OrderBy(x => x.Start).ToList();
            var previousEnd = -1;
            foreach (var request in ordered)
            {
                if (request.Kind != MentionKinds.User &&
                    request.Kind != MentionKinds.Everyone &&
                    (!allowRoles || request.Kind != MentionKinds.Role)) return false;
                if ((request.Kind == MentionKinds.Everyone) != (request.TargetId == null)) return false;
                if (request.Start < 0 || request.Length <= 0 ||
                    request.Start > body!.Length - request.Length) return false;
                if (request.Start < previousEnd) return false;
                previousEnd = request.Start + request.Length;
            }
            return true;
        }

        private static bool MatchesCanonicalToken(
            string body,
            SpaceMessageMentionRequest request,
            string canonical)
        {
            if (request.Length != canonical.Length ||
                !body.AsSpan(request.Start, request.Length).SequenceEqual(canonical.AsSpan()))
            {
                return false;
            }
            return (request.Start == 0 || !IsMentionPrefixContinuation(body[request.Start - 1])) &&
                   (request.Start + request.Length == body.Length ||
                    !IsMentionSuffixContinuation(body, request.Start + request.Length));
        }

        private static bool IsMentionWordCharacter(char value) =>
            char.IsLetterOrDigit(value) ||
            char.GetUnicodeCategory(value) is
                UnicodeCategory.NonSpacingMark or
                UnicodeCategory.SpacingCombiningMark or
                UnicodeCategory.EnclosingMark ||
            value is '_' or '@' or '-';

        private static bool IsMentionPrefixContinuation(char value) =>
            value == '.' || IsMentionWordCharacter(value);

        private static bool IsMentionSuffixContinuation(string body, int index)
        {
            var value = body[index];
            return IsMentionWordCharacter(value) ||
                   value == '.' &&
                   index + 1 < body.Length &&
                   IsMentionWordCharacter(body[index + 1]);
        }

        private static SpaceMessageMention CreateMention(
            Guid messageId,
            string kind,
            Guid? targetUserId,
            Guid? targetRoleId,
            string displayText,
            int start,
            int length,
            DateTime createdAt) => new()
            {
                Id = Guid.NewGuid(),
                MessageId = messageId,
                Kind = kind,
                TargetUserId = targetUserId,
                TargetRoleId = targetRoleId,
                DisplayText = displayText,
                Start = start,
                Length = length,
                CreatedAt = createdAt
            };

        [GeneratedRegex(
            @"(?<![\p{L}\p{N}\p{M}_.@-])@(?<login>[\p{L}\p{N}\p{M}_.-]{1,50})",
            RegexOptions.CultureInvariant)]
        private static partial Regex LegacyMentionRegex();

        private sealed record MentionResolution(IReadOnlyList<SpaceMessageMention> Mentions);
        private sealed record LegacyMentionTarget(Guid UserId, string Login, string LoginNorm);
    }

    public sealed record MentionStageResult(IReadOnlyList<Guid> NotifiedUserIds);

    public static class MentionKinds
    {
        public const string User = "user";
        public const string Role = "role";
        public const string Everyone = "everyone";
    }
}
