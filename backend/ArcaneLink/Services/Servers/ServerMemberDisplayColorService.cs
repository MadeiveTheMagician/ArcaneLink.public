using System.Data;
using ArcaneLink.DataBase._Data;
using ArcaneLink.DataBase.Constants;
using ArcaneLink.DataBase.DTOs.Servers;
using ArcaneLink.DataBase.Models.ServersModels;
using ArcaneLink.Services.Realtime;
using ArcaneLink.Services.Realtime.Abstractions;
using ArcaneLink.Services.Servers.Abstractions;
using Microsoft.EntityFrameworkCore;
using Npgsql;

namespace ArcaneLink.Services.Servers;

public sealed class ServerMemberDisplayColorService : IServerMemberDisplayColorService
{
    private readonly AppDbContext _db;
    private readonly IRealtimeNotificationService _realtime;
    private readonly ILogger<ServerMemberDisplayColorService> _logger;

    public ServerMemberDisplayColorService(
        AppDbContext db,
        IRealtimeNotificationService realtime,
        ILogger<ServerMemberDisplayColorService> logger)
    {
        this._db = db;
        this._realtime = realtime;
        this._logger = logger;
    }

    public async Task<ServerMemberDisplayColorResponse?> GetAsync(
        Guid currentUserId,
        Guid serverId,
        CancellationToken cancellationToken = default)
    {
        var member = await this.LoadMemberAsync(
            currentUserId,
            serverId,
            tracked: false,
            cancellationToken);
        return member == null ? null : ToResponse(member);
    }

    public async Task<UpdateServerMemberDisplayColorResult> UpdateAsync(
        Guid currentUserId,
        Guid serverId,
        UpdateServerMemberDisplayColorRequest request,
        CancellationToken cancellationToken = default)
    {
        var mode = request.Mode?.Trim().ToLowerInvariant();
        if (request.ExpectedRolesVersion == Guid.Empty ||
            mode == null ||
            !ServerMemberDisplayColorModeCodes.All.Contains(mode) ||
            (mode == ServerMemberDisplayColorModeCodes.Role) != request.RoleId.HasValue)
        {
            return UpdateServerMemberDisplayColorResult.InvalidRequest();
        }

        try
        {
            return await this.UpdateTransactionAsync(
                currentUserId,
                serverId,
                mode,
                request.RoleId,
                request.ExpectedRolesVersion,
                cancellationToken);
        }
        catch (DbUpdateConcurrencyException)
        {
            this._db.ChangeTracker.Clear();
            return UpdateServerMemberDisplayColorResult.Conflict();
        }
        catch (Exception exception) when (IsPostgresSerializationFailure(exception))
        {
            this._db.ChangeTracker.Clear();
            return UpdateServerMemberDisplayColorResult.Conflict();
        }
    }

    private async Task<UpdateServerMemberDisplayColorResult> UpdateTransactionAsync(
        Guid currentUserId,
        Guid serverId,
        string mode,
        Guid? roleId,
        Guid expectedRolesVersion,
        CancellationToken cancellationToken)
    {
        await using var transaction = await this._db.Database.BeginTransactionAsync(
            IsolationLevel.Serializable,
            cancellationToken);
        var member = await this.LoadMemberAsync(
            currentUserId,
            serverId,
            tracked: true,
            cancellationToken);
        if (member == null)
        {
            return UpdateServerMemberDisplayColorResult.NotFound();
        }

        if (member.RolesVersion != expectedRolesVersion)
        {
            return UpdateServerMemberDisplayColorResult.Conflict();
        }

        if (mode == ServerMemberDisplayColorModeCodes.Role &&
            !GetAvailableRoles(member).Any(role => role.Id == roleId))
        {
            return UpdateServerMemberDisplayColorResult.InvalidRequest();
        }

        if (string.Equals(member.DisplayColorMode, mode, StringComparison.Ordinal) &&
            member.DisplayColorRoleId == roleId)
        {
            return UpdateServerMemberDisplayColorResult.Success(ToResponse(member));
        }

        member.DisplayColorMode = mode;
        member.DisplayColorRoleId = roleId;
        member.RolesVersion = Guid.NewGuid();
        member.UpdatedAt = DateTime.UtcNow;
        await this._db.SaveChangesAsync(cancellationToken);
        await transaction.CommitAsync(cancellationToken);

        await this._realtime.NotifyServerBestEffortAsync(
            this._logger,
            serverId,
            RealtimeEventNames.ServerMembersChanged,
            new { serverId, memberId = member.Id },
            CancellationToken.None);
        return UpdateServerMemberDisplayColorResult.Success(ToResponse(member));
    }

    private async Task<ServerMember?> LoadMemberAsync(
        Guid userId,
        Guid serverId,
        bool tracked,
        CancellationToken cancellationToken)
    {
        IQueryable<ServerMember> query = this._db.ServerMembers
            .Include(member => member.Roles.Where(assignment =>
                assignment.RevokedAt == null &&
                assignment.Role.DeletedAt == null))
                .ThenInclude(assignment => assignment.Role)
            .Where(member =>
                member.ServerId == serverId &&
                member.UserId == userId &&
                member.StatusId == ServerMemberStatusIds.Active &&
                member.BannedAt == null &&
                member.Server.DeletedAt == null &&
                member.User.DeletedAt == null &&
                member.User.StatusId == UserStatusIds.Active);
        if (!tracked)
        {
            query = query.AsNoTracking();
        }

        return await query.SingleOrDefaultAsync(cancellationToken);
    }

    private static ServerMemberDisplayColorResponse ToResponse(ServerMember member)
    {
        var availableRoles = GetAvailableRoles(member);
        var mode = member.DisplayColorMode;
        var configuredRoleId = member.DisplayColorRoleId;
        ServerMemberDisplayColorRoleResponse? resolvedRole = null;

        if (mode == ServerMemberDisplayColorModeCodes.Role)
        {
            resolvedRole = availableRoles.FirstOrDefault(role => role.Id == configuredRoleId);
            if (resolvedRole == null)
            {
                mode = ServerMemberDisplayColorModeCodes.Auto;
                configuredRoleId = null;
            }
        }

        if (mode == ServerMemberDisplayColorModeCodes.Auto)
        {
            resolvedRole = availableRoles.FirstOrDefault();
        }

        return new ServerMemberDisplayColorResponse
        {
            Mode = mode,
            RoleId = configuredRoleId,
            RolesVersion = member.RolesVersion,
            ResolvedRoleId = resolvedRole?.Id,
            ResolvedColor = resolvedRole?.Color,
            AvailableRoles = availableRoles
        };
    }

    private static IReadOnlyList<ServerMemberDisplayColorRoleResponse> GetAvailableRoles(
        ServerMember member)
    {
        return member.Roles
            .Where(assignment =>
                assignment.RevokedAt == null &&
                assignment.Role.DeletedAt == null &&
                !string.IsNullOrWhiteSpace(assignment.Role.Color))
            .Select(assignment => new ServerMemberDisplayColorRoleResponse
            {
                Id = assignment.Role.Id,
                Title = assignment.Role.Title,
                Color = assignment.Role.Color!.ToLowerInvariant(),
                Level = assignment.Role.Level
            })
            .OrderBy(role => role.Level)
            .ThenBy(role => role.Title, StringComparer.Ordinal)
            .ThenBy(role => role.Id)
            .ToList();
    }

    private static bool IsPostgresSerializationFailure(Exception exception)
    {
        for (Exception? current = exception; current != null; current = current.InnerException)
        {
            if (current is PostgresException postgresException)
            {
                return postgresException.SqlState == PostgresErrorCodes.SerializationFailure;
            }
        }

        return false;
    }
}
