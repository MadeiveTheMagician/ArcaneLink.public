using ArcaneLink.DataBase.DTOs.Servers;

namespace ArcaneLink.Services.Servers.Abstractions;

public interface IServerMemberService
{
    Task<ServerMemberPageResponse?> GetServerMembersAsync(
        Guid currentUserId,
        Guid serverId,
        int? afterPriority,
        DateTime? afterJoinedAt,
        Guid? afterId,
        string? query,
        Guid? roleId,
        int limit,
        CancellationToken cancellationToken = default);

    Task<ServerMemberDetailsResponse?> GetServerMemberByUserIdAsync(
        Guid currentUserId,
        Guid serverId,
        Guid targetUserId,
        CancellationToken cancellationToken = default);

    Task<bool> LeaveServerAsync(
        Guid currentUserId,
        Guid serverId,
        CancellationToken cancellationToken = default);

    Task<bool> RemoveServerMemberAsync(
        Guid currentUserId,
        Guid serverId,
        Guid memberId,
        CancellationToken cancellationToken = default);

    Task<ServerBanResponse?> BanServerMemberAsync(
        Guid currentUserId,
        Guid serverId,
        Guid memberId,
        BanServerMemberRequest request,
        CancellationToken cancellationToken = default);

    Task<IReadOnlyList<ServerBanResponse>?> GetServerBansAsync(
        Guid currentUserId,
        Guid serverId,
        CancellationToken cancellationToken = default);

    Task<bool> UnbanServerMemberAsync(
        Guid currentUserId,
        Guid serverId,
        Guid memberId,
        CancellationToken cancellationToken = default);
}
