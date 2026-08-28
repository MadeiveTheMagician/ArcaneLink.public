using Microsoft.EntityFrameworkCore;

namespace ArcaneLink.DataBase._Data;

public static class ServerAclRevisionExtensions
{
    public static async Task<Guid> StageServerAclRevisionBumpAsync(
        this AppDbContext db,
        Guid serverId,
        CancellationToken cancellationToken = default)
    {
        var server = db.Servers.Local.FirstOrDefault(x => x.Id == serverId) ??
                     await db.Servers.SingleAsync(
                         x => x.Id == serverId,
                         cancellationToken);
        var previousRevision = server.SpaceAclRevision;
        Guid nextRevision;

        do
        {
            nextRevision = Guid.NewGuid();
        }
        while (nextRevision == Guid.Empty || nextRevision == previousRevision);

        server.SpaceAclRevision = nextRevision;
        server.AuthorizationVersion = nextRevision;
        return nextRevision;
    }

    public static async Task<Guid> StageMemberRolesVersionBumpAsync(
        this AppDbContext db,
        Guid serverId,
        Guid memberId,
        CancellationToken cancellationToken = default)
    {
        var member = db.ServerMembers.Local.FirstOrDefault(x =>
                         x.Id == memberId && x.ServerId == serverId) ??
                     await db.ServerMembers.SingleAsync(
                         x => x.Id == memberId && x.ServerId == serverId,
                         cancellationToken);
        var previousRevision = member.RolesVersion;
        Guid nextRevision;

        do
        {
            nextRevision = Guid.NewGuid();
        }
        while (nextRevision == Guid.Empty || nextRevision == previousRevision);

        member.RolesVersion = nextRevision;
        return nextRevision;
    }
}
