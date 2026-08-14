using ArcaneLink.DataBase.DTOs.Servers;

namespace ArcaneLink.Services.Servers.Abstractions;

public interface IServerMemberDisplayColorService
{
    Task<ServerMemberDisplayColorResponse?> GetAsync(
        Guid currentUserId,
        Guid serverId,
        CancellationToken cancellationToken = default);

    Task<UpdateServerMemberDisplayColorResult> UpdateAsync(
        Guid currentUserId,
        Guid serverId,
        UpdateServerMemberDisplayColorRequest request,
        CancellationToken cancellationToken = default);
}

public enum UpdateServerMemberDisplayColorStatus
{
    Success,
    InvalidRequest,
    NotFound,
    Conflict
}

public sealed record UpdateServerMemberDisplayColorResult(
    UpdateServerMemberDisplayColorStatus Status,
    ServerMemberDisplayColorResponse? DisplayColor = null)
{
    public static UpdateServerMemberDisplayColorResult Success(
        ServerMemberDisplayColorResponse response) =>
        new(UpdateServerMemberDisplayColorStatus.Success, response);

    public static UpdateServerMemberDisplayColorResult InvalidRequest() =>
        new(UpdateServerMemberDisplayColorStatus.InvalidRequest);

    public static UpdateServerMemberDisplayColorResult NotFound() =>
        new(UpdateServerMemberDisplayColorStatus.NotFound);

    public static UpdateServerMemberDisplayColorResult Conflict() =>
        new(UpdateServerMemberDisplayColorStatus.Conflict);
}
