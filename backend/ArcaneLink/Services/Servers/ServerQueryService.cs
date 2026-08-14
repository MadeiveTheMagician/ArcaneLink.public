using ArcaneLink.DataBase._Data;
using ArcaneLink.DataBase.Constants;
using ArcaneLink.DataBase.DTOs.Servers;
using ArcaneLink.Exceptions;
using ArcaneLink.Exceptions.ServerExceptions;
using ArcaneLink.Services.Servers.Abstractions;
using ArcaneLink.Services.Messages;
using ArcaneLink.Services.Spaces;
using ArcaneLink.Services.Spaces.Abstractions;
using Microsoft.EntityFrameworkCore;
using static ArcaneLink.Services.Servers.ServerResponseMapper;

namespace ArcaneLink.Services.Servers
{
    public class ServerQueryService : IServerQueryService
    {
        private readonly AppDbContext _db;
        private readonly ServerLastMessageQueryService _lastMessages;
        private readonly ISpaceAuthorizationService _spaceAuthorization;
        private readonly UnreadCountService _unreadCounts;

        public ServerQueryService(
            AppDbContext db,
            ServerLastMessageQueryService lastMessages,
            ISpaceAuthorizationService spaceAuthorization,
            UnreadCountService unreadCounts)
        {
            _db = db;
            _lastMessages = lastMessages;
            _spaceAuthorization = spaceAuthorization;
            _unreadCounts = unreadCounts;
        }

        public async Task<IReadOnlyList<ServerMemberResponse>> GetMyServersAsync(
            Guid currentUserId,
            CancellationToken cancellationToken = default)
        {
            var memberships = await _db.ServerMembers
                .AsNoTracking()
                .Include(x => x.Status)
                .Include(x => x.Server)
                .Where(x => x.UserId == currentUserId &&
                            x.StatusId == ServerMemberStatusIds.Active &&
                            x.BannedAt == null &&
                            x.Server.DeletedAt == null)
                .OrderByDescending(x => x.UpdatedAt)
                .ToListAsync(cancellationToken);
            var serverIds = memberships.Select(x => x.ServerId).ToList();
            var snapshots = await _spaceAuthorization.GetSnapshotsAsync(
                currentUserId,
                serverIds,
                cancellationToken);
            var lastMessages = await _lastMessages.GetAsync(
                currentUserId,
                serverIds,
                snapshots,
                cancellationToken);
            var unreadCounts = await _unreadCounts.GetServerUnreadCountsAsync(
                currentUserId,
                serverIds,
                snapshots,
                cancellationToken);

            var responses = memberships
                .Select(member => ToServerMemberResponse(
                    member,
                    lastMessages.GetValueOrDefault(member.ServerId),
                    unreadCounts.GetValueOrDefault(member.ServerId)))
                .ToList();
            foreach (var response in responses)
            {
                response.Server.DefaultTextSpaceId =
                    await ResolveVisibleDefaultTextSpaceIdAsync(
                        currentUserId,
                        response.ServerId,
                        response.Server.DefaultTextSpaceId,
                        cancellationToken);
            }

            return responses;
        }

        public async Task<ServerResponse?> GetServerAsync(
            Guid currentUserId,
            Guid serverId,
            CancellationToken cancellationToken = default)
        {
            var server = await _db.Servers
                .AsNoTracking()
                .FirstOrDefaultAsync(
                    x => x.Id == serverId &&
                         x.DeletedAt == null &&
                         (x.AccessMode != ServerAccessModeCodes.Private ||
                          x.Members.Any(member =>
                              member.UserId == currentUserId &&
                              member.StatusId ==
                                  ServerMemberStatusIds.Active &&
                              member.BannedAt == null)),
                    cancellationToken);

            if (server == null)
            {
                return null;
            }

            var response = ToServerResponse(server);
            response.DefaultTextSpaceId =
                await ResolveVisibleDefaultTextSpaceIdAsync(
                    currentUserId,
                    server.Id,
                    server.DefaultTextSpaceId,
                    cancellationToken);
            return response;
        }

        public async Task<ServerResponse?> GetServerBySlugAsync(
            Guid currentUserId,
            string slug,
            CancellationToken cancellationToken = default)
        {
            var normalizedSlug = NormalizeSlug(slug);
            var server = await _db.Servers
                .AsNoTracking()
                .FirstOrDefaultAsync(
                    x => x.Slug == normalizedSlug &&
                         x.DeletedAt == null &&
                         (x.AccessMode != ServerAccessModeCodes.Private ||
                          x.Members.Any(member =>
                              member.UserId == currentUserId &&
                              member.StatusId ==
                                  ServerMemberStatusIds.Active &&
                              member.BannedAt == null)),
                    cancellationToken);

            if (server == null)
            {
                return null;
            }

            var response = ToServerResponse(server);
            response.DefaultTextSpaceId =
                await ResolveVisibleDefaultTextSpaceIdAsync(
                    currentUserId,
                    server.Id,
                    server.DefaultTextSpaceId,
                    cancellationToken);
            return response;
        }

        private async Task<Guid?> ResolveVisibleDefaultTextSpaceIdAsync(
            Guid currentUserId,
            Guid serverId,
            Guid? defaultTextSpaceId,
            CancellationToken cancellationToken)
        {
            if (!defaultTextSpaceId.HasValue)
            {
                return null;
            }

            var capabilities = await _spaceAuthorization
                .GetGranularCapabilitiesAsync(
                    currentUserId,
                    serverId,
                    defaultTextSpaceId.Value,
                    cancellationToken);
            return capabilities?.CanView == true
                ? defaultTextSpaceId
                : null;
        }

        private static string NormalizeSlug(string slug)
        {
            var normalizedSlug = slug.Trim().ToLowerInvariant();

            if (string.IsNullOrWhiteSpace(normalizedSlug) ||
                normalizedSlug.Length is < 3 or > 64 ||
                !normalizedSlug.All(IsSlugCharacter))
            {
                throw new InvalidServerDataException(
                    ExceptionMessages.ServerSlugIsInvalid);
            }

            return normalizedSlug;
        }

        private static bool IsSlugCharacter(char character)
        {
            return char.IsAsciiLetterOrDigit(character) ||
                   character == '-' ||
                   character == '_';
        }
    }
}
