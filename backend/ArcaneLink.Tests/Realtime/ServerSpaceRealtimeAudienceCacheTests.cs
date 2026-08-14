using ArcaneLink.DataBase._Data;
using ArcaneLink.DataBase.Constants;
using ArcaneLink.DataBase.Models.SpacesModels;
using ArcaneLink.Services.Realtime;
using ArcaneLink.Services.Spaces;
using ArcaneLink.Tests.Infrastructure;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace ArcaneLink.Tests.Realtime;

public sealed class ServerSpaceRealtimeAudienceCacheTests
{
    [Fact]
    public async Task NewAclRevision_DoesNotReuseCachedAudience()
    {
        using var factory = new ArcaneLinkApiFactory();
        var initial = await GetAudienceAsync(factory);

        Assert.Contains(ArcaneLinkApiFactory.OwnerUserId, initial);
        Assert.Contains(ArcaneLinkApiFactory.MemberUserId, initial);

        using (var scope = factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            var server = await db.Servers.SingleAsync(
                candidate => candidate.Id == ArcaneLinkApiFactory.ServerId);
            var previousRevision = server.SpaceAclRevision;
            server.SpaceAclRevision = Guid.NewGuid();
            db.SpacePermissionOverrides.Add(new SpacePermissionOverride
            {
                Id = Guid.NewGuid(),
                ServerId = ArcaneLinkApiFactory.ServerId,
                SpaceId = ArcaneLinkApiFactory.TextSpaceId,
                MemberId = ArcaneLinkApiFactory.MemberMemberId,
                PermissionId = SpacePermissionIds.SendMessages,
                Deny = true,
                CreatedAt = DateTime.UtcNow
            });
            await db.SaveChangesAsync();

            Assert.NotEqual(previousRevision, server.SpaceAclRevision);
        }

        var afterDeny = await GetAudienceAsync(factory);

        Assert.Contains(ArcaneLinkApiFactory.OwnerUserId, afterDeny);
        Assert.DoesNotContain(ArcaneLinkApiFactory.MemberUserId, afterDeny);
    }

    [Fact]
    public async Task CachedAudience_IsIntersectedWithCurrentActiveUsers()
    {
        using var factory = new ArcaneLinkApiFactory();
        var initial = await GetAudienceAsync(factory);

        Assert.Contains(ArcaneLinkApiFactory.MemberUserId, initial);

        using (var scope = factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            var memberUser = await db.Users.SingleAsync(
                candidate => candidate.Id == ArcaneLinkApiFactory.MemberUserId);
            memberUser.StatusId = UserStatusIds.Banned;
            await db.SaveChangesAsync();
        }

        var afterBan = await GetAudienceAsync(factory);

        Assert.Contains(ArcaneLinkApiFactory.OwnerUserId, afterBan);
        Assert.DoesNotContain(ArcaneLinkApiFactory.MemberUserId, afterBan);
    }

    private static async Task<IReadOnlyList<Guid>> GetAudienceAsync(
        ArcaneLinkApiFactory factory)
    {
        using var scope = factory.Services.CreateScope();
        var audience = scope.ServiceProvider
            .GetRequiredService<ServerSpaceRealtimeAudienceService>();
        return await audience.GetAuthorizedUserIdsAsync(
            ArcaneLinkApiFactory.ServerId,
            ArcaneLinkApiFactory.TextSpaceId,
            SpaceAction.Send);
    }
}
