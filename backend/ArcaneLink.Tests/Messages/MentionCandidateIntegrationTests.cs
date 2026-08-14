using System.Net;
using System.Net.Http.Json;
using ArcaneLink.DataBase._Data;
using ArcaneLink.DataBase.Constants;
using ArcaneLink.DataBase.DTOs.Messages;
using ArcaneLink.DataBase.DTOs.Servers;
using ArcaneLink.DataBase.DTOs.Spaces;
using ArcaneLink.DataBase.DTOs.Users;
using ArcaneLink.DataBase.Models.AssetsModels;
using ArcaneLink.DataBase.Models.ServersModels;
using ArcaneLink.Tests.Infrastructure;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace ArcaneLink.Tests.Messages;

public sealed class MentionCandidateIntegrationTests
{
    [Fact]
    public async Task Query_FiltersByDisplayNameAndLogin_AndLimitsUsersToFive()
    {
        using var factory = new ArcaneLinkApiFactory();
        using var client = factory.CreateClient();
        var registrations = new[]
        {
            ("displayneedle", "Display Needle", "display-needle"),
            ("loginneedle", "Unrelated Person", "login-needle"),
            ("bulkneedle00", "Bulk Needle 00", "bulk-00"),
            ("bulkneedle01", "Bulk Needle 01", "bulk-01"),
            ("bulkneedle02", "Bulk Needle 02", "bulk-02"),
            ("bulkneedle03", "Bulk Needle 03", "bulk-03"),
            ("bulkneedle04", "Bulk Needle 04", "bulk-04"),
            ("bulkneedle05", "Bulk Needle 05", "bulk-05")
        };
        var registeredUsers = new List<UserResponse>();
        foreach (var (login, displayName, emailPrefix) in registrations)
        {
            using var registrationResponse = await client.PostAsJsonAsync(
                "/api/auth/register",
                new CreateUserRequest
                {
                    Login = login,
                    DisplayName = displayName,
                    Email = $"{emailPrefix}@example.test",
                    Password = ArcaneLinkApiFactory.Password
                });
            await ApiClientExtensions.EnsureSuccessWithBodyAsync(registrationResponse);
            registeredUsers.Add((await registrationResponse.Content
                .ReadFromJsonAsync<UserResponse>())!);
        }

        await using (var scope = factory.Services.CreateAsyncScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            var now = DateTime.UtcNow;
            db.ServerMembers.AddRange(registeredUsers.Select(user => new ServerMember
            {
                Id = Guid.NewGuid(),
                ServerId = ArcaneLinkApiFactory.ServerId,
                UserId = user.Id,
                StatusId = ServerMemberStatusIds.Active,
                JoinedAt = now,
                CreatedAt = now,
                UpdatedAt = now
            }));
            await db.SaveChangesAsync();
        }

        client.AuthorizeWith(await client.LoginAsync("owner"));
        var displayMatch = await client
            .GetFromJsonAsync<SpaceMentionAutocompleteResponse>(
                $"{CandidatesPath(ArcaneLinkApiFactory.TextSpaceId)}?query=Display%20Needle");
        var loginMatch = await client
            .GetFromJsonAsync<SpaceMentionAutocompleteResponse>(
                $"{CandidatesPath(ArcaneLinkApiFactory.TextSpaceId)}?query=loginneedle");
        var limited = await client
            .GetFromJsonAsync<SpaceMentionAutocompleteResponse>(
                $"{CandidatesPath(ArcaneLinkApiFactory.TextSpaceId)}?query=Bulk%20Needle");

        Assert.Equal("displayneedle", Assert.Single(displayMatch!.Users).Login);
        Assert.Equal("loginneedle", Assert.Single(loginMatch!.Users).Login);
        Assert.Equal(5, limited!.Users.Count);
        Assert.All(
            limited.Users,
            candidate => Assert.Contains(
                "Bulk Needle",
                candidate.DisplayName,
                StringComparison.OrdinalIgnoreCase));
    }

    [Fact]
    public async Task Query_FiltersRoles_AndLimitsResponseToTwenty()
    {
        using var factory = new ArcaneLinkApiFactory();
        using var client = factory.CreateClient();
        await using (var scope = factory.Services.CreateAsyncScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            var now = DateTime.UtcNow;
            for (var index = 0; index < 21; index++)
            {
                var role = new ServerRole
                {
                    Id = Guid.NewGuid(),
                    ServerId = ArcaneLinkApiFactory.ServerId,
                    Title = $"Query Role {index:D2}",
                    Level = index,
                    IsSystem = false,
                    Mentionable = true,
                    CreatedAt = now,
                    UpdatedAt = now
                };
                db.ServerRoles.Add(role);
                db.ServerMemberRoles.Add(new ServerMemberRole
                {
                    Id = Guid.NewGuid(),
                    ServerId = ArcaneLinkApiFactory.ServerId,
                    MemberId = ArcaneLinkApiFactory.MemberMemberId,
                    RoleId = role.Id,
                    AssignedByUserId = ArcaneLinkApiFactory.OwnerUserId,
                    AssignedAt = now
                });
            }
            await db.SaveChangesAsync();
        }

        client.AuthorizeWith(await client.LoginAsync("owner"));
        var response = await client.GetFromJsonAsync<SpaceMentionAutocompleteResponse>(
            $"{CandidatesPath(ArcaneLinkApiFactory.TextSpaceId)}?query=Query%20Role");

        Assert.Equal(20, response!.Roles.Count);
        Assert.All(
            response.Roles,
            candidate => Assert.StartsWith(
                "Query Role",
                candidate.Title,
                StringComparison.OrdinalIgnoreCase));
    }

    [Fact]
    public async Task Query_ReturnsOnlyMentionableStandardNonSystemRoles_EvenForOwner()
    {
        using var factory = new ArcaneLinkApiFactory();
        var eligibleRoleId = Guid.NewGuid();
        var notMentionableRoleId = Guid.NewGuid();
        var integrationRoleId = Guid.NewGuid();
        var systemRoleId = Guid.NewGuid();

        await using (var scope = factory.Services.CreateAsyncScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            var now = DateTime.UtcNow;
            var roles = new[]
            {
                new ServerRole
                {
                    Id = eligibleRoleId,
                    ServerId = ArcaneLinkApiFactory.ServerId,
                    Title = "Mention policy eligible",
                    Kind = ServerRoleKindCodes.Standard,
                    Mentionable = true,
                    IsSystem = false,
                    CreatedAt = now,
                    UpdatedAt = now
                },
                new ServerRole
                {
                    Id = notMentionableRoleId,
                    ServerId = ArcaneLinkApiFactory.ServerId,
                    Title = "Mention policy disabled",
                    Kind = ServerRoleKindCodes.Standard,
                    Mentionable = false,
                    IsSystem = false,
                    CreatedAt = now,
                    UpdatedAt = now
                },
                new ServerRole
                {
                    Id = integrationRoleId,
                    ServerId = ArcaneLinkApiFactory.ServerId,
                    Title = "Mention policy integration",
                    Kind = ServerRoleKindCodes.Integration,
                    Mentionable = true,
                    IsSystem = false,
                    CreatedAt = now,
                    UpdatedAt = now
                },
                new ServerRole
                {
                    Id = systemRoleId,
                    ServerId = ArcaneLinkApiFactory.ServerId,
                    Title = "Mention policy system",
                    Kind = ServerRoleKindCodes.Standard,
                    Mentionable = true,
                    IsSystem = true,
                    CreatedAt = now,
                    UpdatedAt = now
                }
            };
            db.ServerRoles.AddRange(roles);
            db.ServerMemberRoles.AddRange(roles.Select(role => new ServerMemberRole
            {
                Id = Guid.NewGuid(),
                ServerId = ArcaneLinkApiFactory.ServerId,
                MemberId = ArcaneLinkApiFactory.MemberMemberId,
                RoleId = role.Id,
                AssignedByUserId = ArcaneLinkApiFactory.OwnerUserId,
                AssignedAt = now
            }));
            await db.SaveChangesAsync();
        }

        using var client = factory.CreateClient();
        client.AuthorizeWith(await client.LoginAsync("owner"));
        var response = await client.GetFromJsonAsync<SpaceMentionAutocompleteResponse>(
            $"{CandidatesPath(ArcaneLinkApiFactory.TextSpaceId)}?query=Mention%20policy");

        var candidate = Assert.Single(response!.Roles);
        Assert.Equal(eligibleRoleId, candidate.Id);
        Assert.DoesNotContain(response.Roles, role => role.Id == notMentionableRoleId);
        Assert.DoesNotContain(response.Roles, role => role.Id == integrationRoleId);
        Assert.DoesNotContain(response.Roles, role => role.Id == systemRoleId);
    }

    [Fact]
    public async Task AllowedCandidate_ReturnsAvatarMetadata()
    {
        using var factory = new ArcaneLinkApiFactory();
        var avatarAssetId = Guid.NewGuid();

        await using (var scope = factory.Services.CreateAsyncScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            db.Assets.Add(new Asset
            {
                Id = avatarAssetId,
                OwnerUserId = ArcaneLinkApiFactory.MemberUserId,
                AssetTypeId = AssetTypeIds.CurrentAvatar,
                StorageKey = $"tests/mention-avatar/{avatarAssetId}.png",
                OriginalFileName = "avatar.png",
                MimeType = "image/png",
                SizeBytes = 1,
                Sha256 = new string('a', 64),
                Width = 1,
                Height = 1,
                CreatedAt = DateTime.UtcNow
            });
            var profile = await db.UserProfiles.SingleAsync(candidate =>
                candidate.UserId == ArcaneLinkApiFactory.MemberUserId);
            profile.AvatarAssetId = avatarAssetId;
            profile.AvatarCropOffsetX = 0.125;
            profile.AvatarCropOffsetY = -0.25;
            profile.AvatarCropZoom = 1.4;
            await db.SaveChangesAsync();
        }

        using var client = factory.CreateClient();
        client.AuthorizeWith(await client.LoginAsync("owner"));
        var response = await client.GetFromJsonAsync<SpaceMentionAutocompleteResponse>(
            CandidatesPath(ArcaneLinkApiFactory.TextSpaceId));

        var member = Assert.Single(response!.Users, candidate =>
            candidate.Id == ArcaneLinkApiFactory.MemberUserId);
        Assert.Equal(avatarAssetId, member.AvatarAssetId);
        Assert.Equal(0.125, member.AvatarCropOffsetX);
        Assert.Equal(-0.25, member.AvatarCropOffsetY);
        Assert.Equal(1.4, member.AvatarCropZoom);
    }

    [Fact]
    public async Task Query_UsesEffectiveServerDisplayNameAndAvatar()
    {
        using var factory = new ArcaneLinkApiFactory();
        var avatarAssetId = Guid.NewGuid();

        await using (var scope = factory.Services.CreateAsyncScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            db.Assets.Add(new Asset
            {
                Id = avatarAssetId,
                OwnerUserId = ArcaneLinkApiFactory.MemberUserId,
                AssetTypeId = AssetTypeIds.CurrentAvatar,
                StorageKey = $"tests/server-mention-avatar/{avatarAssetId}.webp",
                OriginalFileName = "server-mention-avatar.webp",
                MimeType = "image/webp",
                SizeBytes = 1,
                Sha256 = new string('c', 64),
                Width = 1,
                Height = 1,
                CreatedAt = DateTime.UtcNow
            });
            var globalProfile = await db.UserProfiles.SingleAsync(profile =>
                profile.UserId == ArcaneLinkApiFactory.MemberUserId);
            globalProfile.DisplayName = "Global Hidden Needle";
            globalProfile.DisplayNameNorm = "GLOBAL HIDDEN NEEDLE";
            db.ServerMemberProfiles.Add(new ServerMemberProfile
            {
                ServerMemberId = ArcaneLinkApiFactory.MemberMemberId,
                DisplayName = "Server Alias Needle",
                DisplayNameNorm = "SERVER ALIAS NEEDLE",
                AvatarAssetId = avatarAssetId,
                AvatarCropOffsetX = -0.1,
                AvatarCropOffsetY = 0.3,
                AvatarCropZoom = 1.6,
                UpdatedAt = DateTime.UtcNow
            });
            await db.SaveChangesAsync();
        }

        using var client = factory.CreateClient();
        client.AuthorizeWith(await client.LoginAsync("owner"));
        var serverMatch = await client
            .GetFromJsonAsync<SpaceMentionAutocompleteResponse>(
                $"{CandidatesPath(ArcaneLinkApiFactory.TextSpaceId)}?query=Server%20Alias");
        var globalMatch = await client
            .GetFromJsonAsync<SpaceMentionAutocompleteResponse>(
                $"{CandidatesPath(ArcaneLinkApiFactory.TextSpaceId)}?query=Global%20Hidden");

        var member = Assert.Single(serverMatch!.Users);
        Assert.Equal(ArcaneLinkApiFactory.MemberUserId, member.Id);
        Assert.Equal("Server Alias Needle", member.DisplayName);
        Assert.Equal(avatarAssetId, member.AvatarAssetId);
        Assert.Equal(0, member.AvatarCropOffsetX);
        Assert.Equal(0, member.AvatarCropOffsetY);
        Assert.Equal(1, member.AvatarCropZoom);
        Assert.Empty(globalMatch!.Users);
    }

    [Fact]
    public async Task ViewDeny_HidesUserAndTheirOnlyRole_AndConcealsEndpointFromThem()
    {
        using var factory = new ArcaneLinkApiFactory();
        using var client = factory.CreateClient();
        client.AuthorizeWith(await client.LoginAsync("owner"));
        var role = await CreateRoleAsync(client, "Denied mention role");
        await AssignRoleAsync(client, role.Id);

        var before = await client.GetFromJsonAsync<SpaceMentionAutocompleteResponse>(
            CandidatesPath(ArcaneLinkApiFactory.TextSpaceId));
        Assert.Contains(before!.Users, user => user.Id == ArcaneLinkApiFactory.MemberUserId);
        Assert.Contains(before.Roles, candidate => candidate.Id == role.Id);

        using (var denyResponse = await client.PutAsJsonAsync(
                   OverridePath(ArcaneLinkApiFactory.TextSpaceId),
                   new UpsertSpacePermissionOverrideRequest
                   {
                       MemberId = ArcaneLinkApiFactory.MemberMemberId,
                       PermissionId = SpacePermissionIds.ViewSpace,
                       Deny = true
                   }))
        {
            await ApiClientExtensions.EnsureSuccessWithBodyAsync(denyResponse);
        }

        var after = await client.GetFromJsonAsync<SpaceMentionAutocompleteResponse>(
            CandidatesPath(ArcaneLinkApiFactory.TextSpaceId));
        Assert.Empty(after!.Users);
        Assert.DoesNotContain(after.Users, user => user.Id == ArcaneLinkApiFactory.MemberUserId);
        Assert.DoesNotContain(after.Roles, candidate => candidate.Id == role.Id);

        client.AuthorizeWith(await client.LoginAsync("member"));
        using var forbidden = await client.GetAsync(
            CandidatesPath(ArcaneLinkApiFactory.TextSpaceId));
        Assert.Equal(HttpStatusCode.NotFound, forbidden.StatusCode);
    }

    [Fact]
    public async Task RequiredRole_ReturnsOnlyMembersWhoActuallyPassTheGate()
    {
        using var factory = new ArcaneLinkApiFactory();
        using var client = factory.CreateClient();
        client.AuthorizeWith(await client.LoginAsync("owner"));
        var role = await CreateRoleAsync(client, "Required mention role");
        await AssignRoleAsync(client, role.Id);
        var space = await CreateTextSpaceAsync(client, role.Id);

        var ownerResponse = await client.GetFromJsonAsync<SpaceMentionAutocompleteResponse>(
            CandidatesPath(space.Id));
        Assert.DoesNotContain(ownerResponse!.Users, user => user.Id == ArcaneLinkApiFactory.OwnerUserId);
        Assert.Contains(ownerResponse.Users, user => user.Id == ArcaneLinkApiFactory.MemberUserId);
        Assert.Contains(ownerResponse.Roles, candidate => candidate.Id == role.Id);

        client.AuthorizeWith(await client.LoginAsync("member"));
        using var memberHttpResponse = await client.GetAsync(CandidatesPath(space.Id));
        memberHttpResponse.EnsureSuccessStatusCode();
        var memberResponse = (await memberHttpResponse.Content
            .ReadFromJsonAsync<SpaceMentionAutocompleteResponse>())!;
        Assert.Contains(memberResponse.Users, user => user.Id == ArcaneLinkApiFactory.OwnerUserId);
        Assert.DoesNotContain(memberResponse.Users, user => user.Id == ArcaneLinkApiFactory.MemberUserId);
        Assert.DoesNotContain(memberResponse.Roles, candidate => candidate.Id == role.Id);
    }

    [Theory]
    [InlineData(false)]
    [InlineData(true)]
    public async Task InactiveMemberOrUser_IsExcludedTogetherWithTheirOnlyRole(
        bool deactivateUser)
    {
        using var factory = new ArcaneLinkApiFactory();
        using var client = factory.CreateClient();
        client.AuthorizeWith(await client.LoginAsync("owner"));
        var role = await CreateRoleAsync(client, "Inactive mention role");
        await AssignRoleAsync(client, role.Id);

        await using (var scope = factory.Services.CreateAsyncScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            if (deactivateUser)
            {
                await db.Users
                    .Where(user => user.Id == ArcaneLinkApiFactory.MemberUserId)
                    .ExecuteUpdateAsync(update => update
                        .SetProperty(user => user.StatusId, UserStatusIds.Banned));
            }
            else
            {
                await db.ServerMembers
                    .Where(member => member.Id == ArcaneLinkApiFactory.MemberMemberId)
                    .ExecuteUpdateAsync(update => update
                        .SetProperty(member => member.StatusId, ServerMemberStatusIds.Left)
                        .SetProperty(member => member.LeftAt, DateTime.UtcNow));
            }
        }

        var response = await client.GetFromJsonAsync<SpaceMentionAutocompleteResponse>(
            CandidatesPath(ArcaneLinkApiFactory.TextSpaceId));
        Assert.Empty(response!.Users);
        Assert.DoesNotContain(response.Users, user => user.Id == ArcaneLinkApiFactory.MemberUserId);
        Assert.DoesNotContain(response.Roles, candidate => candidate.Id == role.Id);
    }

    private static async Task<ServerRoleResponse> CreateRoleAsync(
        HttpClient client,
        string title)
    {
        using var response = await client.PostAsJsonAsync(
            $"/api/servers/{ArcaneLinkApiFactory.ServerId}/roles",
            new CreateServerRoleRequest
            {
                Title = title,
                Mentionable = true
            });
        await ApiClientExtensions.EnsureSuccessWithBodyAsync(response);
        return (await response.Content.ReadFromJsonAsync<ServerRoleResponse>())!;
    }

    private static async Task AssignRoleAsync(HttpClient client, Guid roleId)
    {
        using var response = await client.PostAsJsonAsync(
            $"/api/servers/{ArcaneLinkApiFactory.ServerId}/members/{ArcaneLinkApiFactory.MemberMemberId}/roles",
            new AssignServerRoleRequest { RoleId = roleId });
        await ApiClientExtensions.EnsureSuccessWithBodyAsync(response);
    }

    private static async Task<SpaceResponse> CreateTextSpaceAsync(
        HttpClient client,
        Guid requiredRoleId)
    {
        using var response = await client.PostAsJsonAsync(
            $"/api/servers/{ArcaneLinkApiFactory.ServerId}/spaces",
            new CreateSpaceRequest
            {
                TypeCode = "text_room",
                Title = "Required mention room",
                RequiredServerRoleId = requiredRoleId
            });
        await ApiClientExtensions.EnsureSuccessWithBodyAsync(response);
        return (await response.Content.ReadFromJsonAsync<SpaceResponse>())!;
    }

    private static string CandidatesPath(Guid spaceId) =>
        $"/api/servers/{ArcaneLinkApiFactory.ServerId}/spaces/{spaceId}/messages/mention-candidates";

    private static string OverridePath(Guid spaceId) =>
        $"/api/servers/{ArcaneLinkApiFactory.ServerId}/spaces/{spaceId}/permission-overrides";
}
