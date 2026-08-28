using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using System.Collections.Concurrent;
using ArcaneLink.DataBase._Data;
using ArcaneLink.DataBase.Constants;
using ArcaneLink.DataBase.DTOs.Assets;
using ArcaneLink.DataBase.DTOs.Messages;
using ArcaneLink.DataBase.DTOs.Servers;
using ArcaneLink.DataBase.Models.AssetsModels;
using ArcaneLink.DataBase.Models.ServersModels;
using ArcaneLink.DataBase.Models.UsersModels;
using ArcaneLink.Services.Realtime;
using ArcaneLink.Services.Realtime.Abstractions;
using ArcaneLink.Services.Servers.Authorization;
using ArcaneLink.Tests.Infrastructure;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using SkiaSharp;

namespace ArcaneLink.Tests.Servers;

public sealed class ServerMemberProfileIntegrationTests
{
    [Fact]
    public async Task ViewerProfile_ReturnsServerIdentityAppearanceRolesAndMutualContextWithoutPermissions()
    {
        using var factory = new ArcaneLinkApiFactory();
        _ = factory.Services;
        var now = DateTime.UtcNow;
        var roleId = Guid.NewGuid();
        var roleAssignmentId = Guid.NewGuid();
        var backgroundAssetId = Guid.NewGuid();
        var secondServerId = Guid.NewGuid();
        var ownerFriendRequestId = Guid.NewGuid();
        var memberFriendRequestId = Guid.NewGuid();

        await using (var scope = factory.Services.CreateAsyncScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            var memberSettings = await db.UserProfileSettings.SingleAsync(
                settings => settings.UserId == ArcaneLinkApiFactory.MemberUserId);
            memberSettings.SelectedThemeId = SystemThemeIds.Graphite;
            memberSettings.ProfileColor = "#334455";
            memberSettings.ProfileBackgroundAssetId = backgroundAssetId;

            db.Assets.Add(new Asset
            {
                Id = backgroundAssetId,
                OwnerUserId = ArcaneLinkApiFactory.MemberUserId,
                AssetTypeId = AssetTypeIds.ProfileBackground,
                StorageKey = $"tests/profile-background/{backgroundAssetId}.webp",
                OriginalFileName = "profile-background.webp",
                MimeType = "image/webp",
                SizeBytes = 1,
                Sha256 = new string('c', 64),
                Width = 1,
                Height = 1,
                CreatedAt = now
            });

            db.ServerRoles.Add(new ServerRole
            {
                Id = roleId,
                ServerId = ArcaneLinkApiFactory.ServerId,
                Title = "Archivist",
                Kind = ServerRoleKindCodes.Standard,
                Color = "#aabbcc",
                Level = 12,
                PermissionMask = ServerRolePermissionMaskCodec.Encode(
                    ServerPermissionRegistry.CreateMask(["ADMINISTRATOR"])),
                PermissionSchemaVersion = ServerPermissionRegistry.SchemaVersion,
                CreatedAt = now,
                UpdatedAt = now
            });
            db.ServerMemberRoles.Add(new ServerMemberRole
            {
                Id = roleAssignmentId,
                ServerId = ArcaneLinkApiFactory.ServerId,
                MemberId = ArcaneLinkApiFactory.MemberMemberId,
                RoleId = roleId,
                AssignedByUserId = ArcaneLinkApiFactory.OwnerUserId,
                AssignedAt = now
            });

            db.FriendRequests.AddRange(
                new FriendRequest
                {
                    Id = ownerFriendRequestId,
                    FromUserId = ArcaneLinkApiFactory.OwnerUserId,
                    ToUserId = ArcaneLinkApiFactory.OutsiderUserId,
                    StatusId = FriendRequestStatusIds.Accepted,
                    CreatedAt = now,
                    UpdatedAt = now,
                    RespondedAt = now
                },
                new FriendRequest
                {
                    Id = memberFriendRequestId,
                    FromUserId = ArcaneLinkApiFactory.MemberUserId,
                    ToUserId = ArcaneLinkApiFactory.OutsiderUserId,
                    StatusId = FriendRequestStatusIds.Accepted,
                    CreatedAt = now,
                    UpdatedAt = now,
                    RespondedAt = now
                });
            db.UserFriends.AddRange(
                new UserFriend
                {
                    UserId = ArcaneLinkApiFactory.OwnerUserId,
                    FriendUserId = ArcaneLinkApiFactory.OutsiderUserId,
                    CreatedByRequestId = ownerFriendRequestId,
                    CreatedAt = now
                },
                new UserFriend
                {
                    UserId = ArcaneLinkApiFactory.OutsiderUserId,
                    FriendUserId = ArcaneLinkApiFactory.OwnerUserId,
                    CreatedByRequestId = ownerFriendRequestId,
                    CreatedAt = now
                },
                new UserFriend
                {
                    UserId = ArcaneLinkApiFactory.MemberUserId,
                    FriendUserId = ArcaneLinkApiFactory.OutsiderUserId,
                    CreatedByRequestId = memberFriendRequestId,
                    CreatedAt = now
                },
                new UserFriend
                {
                    UserId = ArcaneLinkApiFactory.OutsiderUserId,
                    FriendUserId = ArcaneLinkApiFactory.MemberUserId,
                    CreatedByRequestId = memberFriendRequestId,
                    CreatedAt = now
                });

            db.Servers.Add(new Server
            {
                Id = secondServerId,
                CreatedByUserId = ArcaneLinkApiFactory.OwnerUserId,
                OwnerUserId = ArcaneLinkApiFactory.OwnerUserId,
                Slug = $"shared-{secondServerId:N}",
                Title = "Another Shared Server",
                AccessMode = ServerAccessModeCodes.Private,
                CreatedAt = now,
                UpdatedAt = now
            });
            db.ServerMembers.AddRange(
                new ServerMember
                {
                    Id = Guid.NewGuid(),
                    ServerId = secondServerId,
                    UserId = ArcaneLinkApiFactory.OwnerUserId,
                    StatusId = ServerMemberStatusIds.Active,
                    JoinedAt = now,
                    CreatedAt = now,
                    UpdatedAt = now
                },
                new ServerMember
                {
                    Id = Guid.NewGuid(),
                    ServerId = secondServerId,
                    UserId = ArcaneLinkApiFactory.MemberUserId,
                    StatusId = ServerMemberStatusIds.Active,
                    JoinedAt = now,
                    CreatedAt = now,
                    UpdatedAt = now
                });
            await db.SaveChangesAsync();
        }

        using var client = factory.CreateClient();
        client.AuthorizeWith(await client.LoginAsync("owner"));
        using var response = await client.GetAsync(
            ProfilePath(ArcaneLinkApiFactory.MemberUserId.ToString()));
        response.EnsureSuccessStatusCode();
        var json = await response.Content.ReadAsStringAsync();
        Assert.DoesNotContain("permission", json, StringComparison.OrdinalIgnoreCase);

        var profile = JsonSerializer.Deserialize<ServerMemberViewerProfileResponse>(
            json,
            new JsonSerializerOptions(JsonSerializerDefaults.Web));
        Assert.NotNull(profile);
        Assert.Equal(ArcaneLinkApiFactory.MemberMemberId, profile.MemberId);
        Assert.Equal("member", profile.Login);
        Assert.Equal("graphite", profile.ProfileThemeCode);
        Assert.Equal("#334455", profile.ProfileColor);
        Assert.Equal(backgroundAssetId, profile.ProfileBackgroundAssetId);
        var role = Assert.Single(profile.Roles);
        Assert.Equal(roleId, role.Id);
        Assert.Equal("Archivist", role.Title);
        Assert.Equal("#aabbcc", role.Color);
        Assert.Equal(1, profile.MutualFriendCount);
        var mutualFriend = Assert.Single(profile.MutualFriends);
        Assert.Equal(ArcaneLinkApiFactory.OutsiderUserId, mutualFriend.UserId);
        Assert.Equal(2, profile.MutualServerCount);
        Assert.Equal(
            ["Another Shared Server", "Test Server"],
            profile.MutualServers.Select(server => server.Title).ToArray());

        client.AuthorizeWith(await client.LoginAsync("member"));
        using var selfResponse = await client.GetAsync(
            ProfilePath(ArcaneLinkApiFactory.MemberUserId.ToString()));
        selfResponse.EnsureSuccessStatusCode();
        var selfJson = await selfResponse.Content.ReadAsStringAsync();
        Assert.DoesNotContain(
            "permission",
            selfJson,
            StringComparison.OrdinalIgnoreCase);

        var selfProfile = JsonSerializer.Deserialize<ServerMemberViewerProfileResponse>(
            selfJson,
            new JsonSerializerOptions(JsonSerializerDefaults.Web));
        Assert.NotNull(selfProfile);
        Assert.Equal(ArcaneLinkApiFactory.MemberMemberId, selfProfile.MemberId);
        Assert.Equal("member", selfProfile.Login);
        Assert.Equal("graphite", selfProfile.ProfileThemeCode);
        Assert.Equal("#334455", selfProfile.ProfileColor);
        Assert.Equal(backgroundAssetId, selfProfile.ProfileBackgroundAssetId);
        var selfRole = Assert.Single(selfProfile.Roles);
        Assert.Equal(roleId, selfRole.Id);
        Assert.Equal(0, selfProfile.MutualFriendCount);
        Assert.Empty(selfProfile.MutualFriends);
        Assert.Equal(0, selfProfile.MutualServerCount);
        Assert.Empty(selfProfile.MutualServers);
    }

    [Theory]
    [InlineData("not-member")]
    [InlineData("left")]
    [InlineData("banned")]
    public async Task ViewerProfile_HidesTargetsWithoutActiveMembership(
        string targetState)
    {
        using var factory = new ArcaneLinkApiFactory();
        _ = factory.Services;
        var targetUserId = ArcaneLinkApiFactory.MemberUserId;

        if (targetState != "not-member")
        {
            await using var scope = factory.Services.CreateAsyncScope();
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            var member = await db.ServerMembers.SingleAsync(item =>
                item.Id == ArcaneLinkApiFactory.MemberMemberId);
            if (targetState == "left")
            {
                member.StatusId = ServerMemberStatusIds.Left;
                member.LeftAt = DateTime.UtcNow;
            }
            else
            {
                member.StatusId = ServerMemberStatusIds.Banned;
                member.BannedAt = DateTime.UtcNow;
            }

            await db.SaveChangesAsync();
        }
        else
        {
            targetUserId = ArcaneLinkApiFactory.OutsiderUserId;
        }

        using var client = factory.CreateClient();
        client.AuthorizeWith(await client.LoginAsync("owner"));
        using var response = await client.GetAsync(
            ProfilePath(targetUserId.ToString()));
        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task CustomServerNickname_RequiresTheExactGranularPermission()
    {
        using var factory = new ArcaneLinkApiFactory();
        _ = factory.Services;
        var everyoneRoleId = Guid.NewGuid();
        await using (var seedScope = factory.Services.CreateAsyncScope())
        {
            var db = seedScope.ServiceProvider.GetRequiredService<AppDbContext>();
            var server = await db.Servers.SingleAsync(item =>
                item.Id == ArcaneLinkApiFactory.ServerId);
            db.ServerRoles.Add(new ServerRole
            {
                Id = everyoneRoleId,
                ServerId = server.Id,
                Code = "everyone",
                Title = "@everyone",
                Kind = ServerRoleKindCodes.Everyone,
                Level = int.MaxValue,
                IsSystem = true,
                PermissionMask = ServerRolePermissionMaskCodec.Encode(
                    PermissionMask256.Empty),
                PermissionSchemaVersion = ServerPermissionRegistry.SchemaVersion,
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            });
            server.AuthorizationVersion = Guid.NewGuid();
            await db.SaveChangesAsync();
        }

        using var client = factory.CreateClient();
        client.AuthorizeWith(await client.LoginAsync("member"));
        using (var denied = await client.PatchAsJsonAsync(
                   ProfilePath("me"),
                   new UpdateServerMemberProfileRequest
                   {
                       DisplayName = "Denied nickname",
                       About = "Allowed non-nickname field"
                   }))
        {
            Assert.Equal(HttpStatusCode.NotFound, denied.StatusCode);
        }

        await using (var grantScope = factory.Services.CreateAsyncScope())
        {
            var db = grantScope.ServiceProvider.GetRequiredService<AppDbContext>();
            var role = await db.ServerRoles.SingleAsync(item =>
                item.Id == everyoneRoleId);
            role.PermissionMask = ServerRolePermissionMaskCodec.Encode(
                ServerPermissionRegistry.CreateMask(["CHANGE_OWN_NICKNAME"]));
            role.Version = Guid.NewGuid();
            var server = await db.Servers.SingleAsync(item =>
                item.Id == ArcaneLinkApiFactory.ServerId);
            server.AuthorizationVersion = Guid.NewGuid();
            await db.SaveChangesAsync();
        }

        using var allowed = await client.PatchAsJsonAsync(
            ProfilePath("me"),
            new UpdateServerMemberProfileRequest
            {
                DisplayName = "Allowed nickname"
            });
        allowed.EnsureSuccessStatusCode();
        var profile = await allowed.Content
            .ReadFromJsonAsync<ServerMemberProfileResponse>();
        Assert.Equal("Allowed nickname", profile?.DisplayName);
    }

    [Fact]
    public async Task ActiveMember_ProfileInheritsGlobalUntilOverriddenAndReset()
    {
        using var factory = new ArcaneLinkApiFactory();
        using var client = factory.CreateClient();
        client.AuthorizeWith(await client.LoginAsync("member"));

        var inherited = await client.GetFromJsonAsync<ServerMemberProfileResponse>(
            ProfilePath("me"));
        Assert.NotNull(inherited);
        Assert.Equal("Member", inherited.DisplayName);
        Assert.True(inherited.Inheritance.DisplayName);
        Assert.True(inherited.Inheritance.Avatar);
        Assert.True(inherited.Inheritance.Banner);
        Assert.True(inherited.Inheritance.About);

        using var updateResponse = await client.PatchAsJsonAsync(
            ProfilePath("me"),
            new UpdateServerMemberProfileRequest
            {
                DisplayName = "  Server Member  ",
                About = "  Server-specific about  ",
                StatusText = "  Ready for voice  "
            });
        updateResponse.EnsureSuccessStatusCode();
        var updated = await updateResponse.Content
            .ReadFromJsonAsync<ServerMemberProfileResponse>();
        Assert.NotNull(updated);
        Assert.Equal("Server Member", updated.DisplayName);
        Assert.Equal("Server-specific about", updated.About);
        Assert.Equal("Ready for voice", updated.StatusText);
        Assert.False(updated.Inheritance.DisplayName);
        Assert.False(updated.Inheritance.About);

        client.AuthorizeWith(await client.LoginAsync("owner"));
        var visibleToServerMember = await client
            .GetFromJsonAsync<ServerMemberProfileResponse>(
                ProfilePath(ArcaneLinkApiFactory.MemberUserId.ToString()));
        Assert.Equal("Server Member", visibleToServerMember?.DisplayName);

        var page = await client.GetFromJsonAsync<ServerMemberPageResponse>(
            $"/api/servers/{ArcaneLinkApiFactory.ServerId}/members");
        var member = Assert.Single(
            page!.Items,
            item => item.UserId == ArcaneLinkApiFactory.MemberUserId);
        Assert.Equal("Server Member", member.User.DisplayName);
        Assert.Equal("Ready for voice", member.User.ServerStatusText);
        Assert.True(member.User.UsesServerProfile);

        client.AuthorizeWith(await client.LoginAsync("member"));
        using var resetResponse = await client.DeleteAsync(ProfilePath("me"));
        resetResponse.EnsureSuccessStatusCode();
        var reset = await resetResponse.Content
            .ReadFromJsonAsync<ServerMemberProfileResponse>();
        Assert.Equal("Member", reset?.DisplayName);
        Assert.Null(reset?.StatusText);
        Assert.True(reset?.Inheritance.DisplayName);

        await using var scope = factory.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        Assert.False(await db.ServerMemberProfiles.AnyAsync(profile =>
            profile.ServerMemberId == ArcaneLinkApiFactory.MemberMemberId));
    }

    [Fact]
    public async Task OutsiderCannotReadOrCreateServerMemberProfile()
    {
        using var factory = new ArcaneLinkApiFactory();
        using var client = factory.CreateClient();
        client.AuthorizeWith(await client.LoginAsync("outsider"));

        using var getResponse = await client.GetAsync(
            ProfilePath(ArcaneLinkApiFactory.MemberUserId.ToString()));
        using var updateResponse = await client.PatchAsJsonAsync(
            ProfilePath("me"),
            new UpdateServerMemberProfileRequest { DisplayName = "Outsider" });

        Assert.Equal(HttpStatusCode.NotFound, getResponse.StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, updateResponse.StatusCode);
    }

    [Fact]
    public async Task ServerAvatar_IsProcessedToWebp_AndResetKeepsSourceAsset()
    {
        using var factory = new ArcaneLinkApiFactory();
        using var client = factory.CreateClient();
        client.AuthorizeWith(await client.LoginAsync("member"));
        await using var source = CreateSourcePng();
        var sourceBytes = source.ToArray();
        var sourceAsset = await UploadAssetAsync(
            client,
            sourceBytes,
            AssetTypeIds.Avatar,
            "server-avatar-source.png");

        try
        {
            using var setResponse = await client.PostAsJsonAsync(
                AvatarPath(sourceAsset.Id),
                new SetServerMemberProfileAvatarRequest
                {
                    CropOffsetX = 0.16,
                    CropOffsetY = -0.11,
                    CropZoom = 1.7
                });
            await ApiClientExtensions.EnsureSuccessWithBodyAsync(setResponse);
            var profile = await setResponse.Content
                .ReadFromJsonAsync<OwnServerMemberProfileResponse>();

            Assert.NotNull(profile);
            var optimizedAssetId = Assert.IsType<Guid>(profile.AvatarAssetId);
            Assert.NotEqual(sourceAsset.Id, optimizedAssetId);
            Assert.Equal(sourceAsset.Id, profile.AvatarSourceAssetId);
            Assert.Equal(0.16, profile.AvatarCropOffsetX);
            Assert.Equal(-0.11, profile.AvatarCropOffsetY);
            Assert.Equal(1.7, profile.AvatarCropZoom);

            var publicProfile = await client.GetFromJsonAsync<JsonElement>(
                ProfilePath(ArcaneLinkApiFactory.MemberUserId.ToString()));
            Assert.False(publicProfile.TryGetProperty(
                "avatarSourceAssetId",
                out _));
            Assert.Equal(optimizedAssetId.ToString(),
                publicProfile.GetProperty("avatarAssetId").GetString());
            Assert.Equal(0,
                publicProfile.GetProperty("avatarCropOffsetX").GetDouble());
            Assert.Equal(0,
                publicProfile.GetProperty("avatarCropOffsetY").GetDouble());
            Assert.Equal(1,
                publicProfile.GetProperty("avatarCropZoom").GetDouble());

            var optimizedAsset = await client.GetFromJsonAsync<AssetResponse>(
                $"/api/assets/{optimizedAssetId}");
            Assert.NotNull(optimizedAsset);
            Assert.Equal(AssetTypeIds.CurrentAvatar, optimizedAsset.AssetTypeId);
            Assert.Equal("image/webp", optimizedAsset.MimeType);
            Assert.Equal(512, optimizedAsset.Width);
            Assert.Equal(512, optimizedAsset.Height);

            var optimizedBytes = await client.GetByteArrayAsync(
                $"/api/assets/{optimizedAssetId}/content");
            Assert.Equal(
                "RIFF",
                System.Text.Encoding.ASCII.GetString(optimizedBytes, 0, 4));
            Assert.Equal(
                "WEBP",
                System.Text.Encoding.ASCII.GetString(optimizedBytes, 8, 4));

            using var replaceResponse = await client.PostAsJsonAsync(
                AvatarPath(sourceAsset.Id),
                new SetServerMemberProfileAvatarRequest
                {
                    CropOffsetX = -0.2,
                    CropOffsetY = 0.08,
                    CropZoom = 2
                });
            replaceResponse.EnsureSuccessStatusCode();
            var replacement = await replaceResponse.Content
                .ReadFromJsonAsync<OwnServerMemberProfileResponse>();
            var replacementAssetId = Assert.IsType<Guid>(
                replacement!.AvatarAssetId);
            Assert.NotEqual(optimizedAssetId, replacementAssetId);

            using var oldAssetResponse = await client.GetAsync(
                $"/api/assets/{optimizedAssetId}/content");
            Assert.Equal(HttpStatusCode.NotFound, oldAssetResponse.StatusCode);

            using var resetResponse = await client.DeleteAsync(ProfilePath("me"));
            resetResponse.EnsureSuccessStatusCode();
            using var removedCurrentResponse = await client.GetAsync(
                $"/api/assets/{replacementAssetId}/content");
            Assert.Equal(
                HttpStatusCode.NotFound,
                removedCurrentResponse.StatusCode);

            using var retainedSourceResponse = await client.GetAsync(
                $"/api/assets/{sourceAsset.Id}/content");
            Assert.Equal(HttpStatusCode.OK, retainedSourceResponse.StatusCode);
        }
        finally
        {
            await client.DeleteAsync($"/api/assets/{sourceAsset.Id}");
        }
    }

    [Fact]
    public async Task ServerAvatar_RejectsForeignSourceAndRawPatchAssignment()
    {
        using var factory = new ArcaneLinkApiFactory();
        using var client = factory.CreateClient();
        await using var source = CreateSourcePng();
        var sourceBytes = source.ToArray();

        client.AuthorizeWith(await client.LoginAsync("owner"));
        var foreignSource = await UploadAssetAsync(
            client,
            sourceBytes,
            AssetTypeIds.Avatar,
            "owner-avatar.png");

        client.AuthorizeWith(await client.LoginAsync("member"));
        using var foreignResponse = await client.PostAsJsonAsync(
            AvatarPath(foreignSource.Id),
            new SetServerMemberProfileAvatarRequest());
        Assert.Equal(HttpStatusCode.NotFound, foreignResponse.StatusCode);

        var ownSource = await UploadAssetAsync(
            client,
            sourceBytes,
            AssetTypeIds.Avatar,
            "member-avatar.png");
        using var rawPatchResponse = await client.PatchAsJsonAsync(
            ProfilePath("me"),
            new UpdateServerMemberProfileRequest
            {
                AvatarAssetId = ownSource.Id,
                AvatarSourceAssetId = ownSource.Id
            });
        Assert.Equal(HttpStatusCode.BadRequest, rawPatchResponse.StatusCode);

        var wrongTypeAsset = await UploadAssetAsync(
            client,
            sourceBytes,
            AssetTypeIds.Banner,
            "not-an-avatar.png");
        using var wrongTypeResponse = await client.PostAsJsonAsync(
            AvatarPath(wrongTypeAsset.Id),
            new SetServerMemberProfileAvatarRequest());
        Assert.Equal(HttpStatusCode.BadRequest, wrongTypeResponse.StatusCode);

        await client.DeleteAsync($"/api/assets/{ownSource.Id}");
        await client.DeleteAsync($"/api/assets/{wrongTypeAsset.Id}");
        client.AuthorizeWith(await client.LoginAsync("owner"));
        await client.DeleteAsync($"/api/assets/{foreignSource.Id}");
    }

    [Fact]
    public async Task GenericDelete_RejectsAssetsManagedByServerProfileDomain()
    {
        using var factory = new ArcaneLinkApiFactory();
        using var client = factory.CreateClient();
        client.AuthorizeWith(await client.LoginAsync("member"));
        await using var source = CreateSourcePng();
        var sourceAsset = await UploadAssetAsync(
            client,
            source.ToArray(),
            AssetTypeIds.Avatar,
            "delete-avatar-source.png");
        using var setAvatarResponse = await client.PostAsJsonAsync(
            AvatarPath(sourceAsset.Id),
            new SetServerMemberProfileAvatarRequest());
        setAvatarResponse.EnsureSuccessStatusCode();
        var avatarProfile = await setAvatarResponse.Content
            .ReadFromJsonAsync<ServerMemberProfileResponse>();
        var currentAvatarId = Assert.IsType<Guid>(avatarProfile!.AvatarAssetId);

        using var deleteAvatarResponse = await client.DeleteAsync(
            $"/api/assets/{currentAvatarId}");
        Assert.Equal(HttpStatusCode.Conflict, deleteAvatarResponse.StatusCode);
        using var deleteAvatarSourceResponse = await client.DeleteAsync(
            $"/api/assets/{sourceAsset.Id}");
        Assert.Equal(
            HttpStatusCode.Conflict,
            deleteAvatarSourceResponse.StatusCode);

        await using (var scope = factory.Services.CreateAsyncScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            var storedProfile = await db.ServerMemberProfiles
                .AsNoTracking()
                .SingleAsync(profile =>
                    profile.ServerMemberId ==
                    ArcaneLinkApiFactory.MemberMemberId);
            Assert.Equal(currentAvatarId, storedProfile.AvatarAssetId);
            Assert.Equal(sourceAsset.Id, storedProfile.AvatarSourceAssetId);
            Assert.Null(await db.Assets
                .Where(asset => asset.Id == currentAvatarId)
                .Select(asset => asset.DeletedAt)
                .SingleAsync());
        }

        using (var resetAvatarResponse = await client.DeleteAsync(
                   ProfilePath("me")))
        {
            resetAvatarResponse.EnsureSuccessStatusCode();
        }

        var bannerAsset = await UploadAssetAsync(
            client,
            source.ToArray(),
            AssetTypeIds.Banner,
            "delete-banner.png");
        using var setBannerResponse = await client.PatchAsJsonAsync(
            ProfilePath("me"),
            new UpdateServerMemberProfileRequest
            {
                BannerAssetId = bannerAsset.Id
            });
        setBannerResponse.EnsureSuccessStatusCode();
        using var deleteBannerResponse = await client.DeleteAsync(
            $"/api/assets/{bannerAsset.Id}");
        Assert.Equal(HttpStatusCode.Conflict, deleteBannerResponse.StatusCode);

        await using (var scope = factory.Services.CreateAsyncScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            var storedProfile = await db.ServerMemberProfiles
                .AsNoTracking()
                .SingleAsync(profile =>
                    profile.ServerMemberId ==
                    ArcaneLinkApiFactory.MemberMemberId);
            Assert.Equal(bannerAsset.Id, storedProfile.BannerAssetId);
            Assert.Null(await db.Assets
                .Where(asset => asset.Id == bannerAsset.Id)
                .Select(asset => asset.DeletedAt)
                .SingleAsync());
        }

        using (var resetBannerResponse = await client.DeleteAsync(
                   ProfilePath("me")))
        {
            resetBannerResponse.EnsureSuccessStatusCode();
        }
        using var deleteBannerAfterReset = await client.DeleteAsync(
            $"/api/assets/{bannerAsset.Id}");
        Assert.Equal(HttpStatusCode.NoContent, deleteBannerAfterReset.StatusCode);
        await client.DeleteAsync($"/api/assets/{sourceAsset.Id}");
    }

    [Fact]
    public async Task ServerMessagesAndRepliesUseEffectiveServerIdentity()
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
                StorageKey = $"tests/server-profile-message/{avatarAssetId}.png",
                OriginalFileName = "server-avatar.png",
                MimeType = "image/png",
                SizeBytes = 1,
                Sha256 = new string('b', 64),
                Width = 1,
                Height = 1,
                CreatedAt = DateTime.UtcNow
            });
            db.ServerMemberProfiles.Add(new ServerMemberProfile
            {
                ServerMemberId = ArcaneLinkApiFactory.MemberMemberId,
                DisplayName = "Member On Server",
                DisplayNameNorm = "MEMBER ON SERVER",
                AvatarAssetId = avatarAssetId,
                AvatarSourceAssetId = null,
                AvatarCropOffsetX = 0.2,
                AvatarCropOffsetY = -0.15,
                AvatarCropZoom = 1.35,
                UpdatedAt = DateTime.UtcNow
            });
            await db.SaveChangesAsync();
        }

        using var client = factory.CreateClient();
        client.AuthorizeWith(await client.LoginAsync("member"));
        using var originalResponse = await client.PostAsJsonAsync(
            MessagesPath(),
            new CreateSpaceMessageRequest { Body = "server identity" });
        originalResponse.EnsureSuccessStatusCode();
        var original = (await originalResponse.Content
            .ReadFromJsonAsync<SpaceMessageResponse>())!;

        Assert.Equal("Member On Server", original.SenderDisplayName);
        Assert.Equal(avatarAssetId, original.SenderAvatarAssetId);
        Assert.Equal(0, original.SenderAvatarCropOffsetX);
        Assert.Equal(0, original.SenderAvatarCropOffsetY);
        Assert.Equal(1, original.SenderAvatarCropZoom);

        client.AuthorizeWith(await client.LoginAsync("owner"));
        using var replyResponse = await client.PostAsJsonAsync(
            MessagesPath(),
            new CreateSpaceMessageRequest
            {
                Body = "reply",
                ReplyToMessageId = original.Id
            });
        replyResponse.EnsureSuccessStatusCode();
        var reply = (await replyResponse.Content
            .ReadFromJsonAsync<SpaceMessageResponse>())!;

        Assert.Equal("Member On Server", reply.ReplyTo?.SenderDisplayName);
        Assert.Equal(avatarAssetId, reply.ReplyTo?.SenderAvatarAssetId);
        Assert.Equal(0, reply.ReplyTo?.SenderAvatarCropOffsetX);
        Assert.Equal(0, reply.ReplyTo?.SenderAvatarCropOffsetY);
        Assert.Equal(1, reply.ReplyTo?.SenderAvatarCropZoom);
    }

    private static string ProfilePath(string suffix)
    {
        return $"/api/servers/{ArcaneLinkApiFactory.ServerId}/member-profiles/{suffix}";
    }

    private static string AvatarPath(Guid assetId) =>
        ProfilePath($"me/avatar/{assetId}");

    private static async Task<AssetResponse> UploadAssetAsync(
        HttpClient client,
        byte[] bytes,
        Guid assetTypeId,
        string fileName)
    {
        using var content = new MultipartFormDataContent();
        content.Add(
            new StringContent(assetTypeId.ToString()),
            "AssetTypeId");
        var file = new ByteArrayContent(bytes);
        file.Headers.ContentType = new MediaTypeHeaderValue("image/png");
        content.Add(file, "File", fileName);

        using var response = await client.PostAsync("/api/assets/upload", content);
        await ApiClientExtensions.EnsureSuccessWithBodyAsync(response);
        return (await response.Content.ReadFromJsonAsync<AssetResponse>())!;
    }

    private static MemoryStream CreateSourcePng()
    {
        using var bitmap = new SKBitmap(new SKImageInfo(
            640,
            480,
            SKColorType.Rgba8888,
            SKAlphaType.Premul));
        var random = new Random(84);
        var pixels = new SKColor[bitmap.Width * bitmap.Height];
        for (var index = 0; index < pixels.Length; index++)
        {
            pixels[index] = new SKColor(
                (byte)random.Next(256),
                (byte)random.Next(256),
                (byte)random.Next(256),
                255);
        }

        bitmap.Pixels = pixels;
        using var image = SKImage.FromBitmap(bitmap);
        using var png = image.Encode(SKEncodedImageFormat.Png, 100);
        var stream = new MemoryStream();
        png.SaveTo(stream);
        stream.Position = 0;
        return stream;
    }

    private sealed class RecordingRealtimeNotificationService
        : IRealtimeNotificationService
    {
        public ConcurrentQueue<(Guid ServerId, string EventName)>
            ServerNotifications { get; } = new();

        public Task NotifyUserAsync(
            Guid userId,
            string eventName,
            object? payload = null,
            CancellationToken cancellationToken = default) =>
            Task.CompletedTask;

        public Task NotifyUsersAsync(
            IEnumerable<Guid> userIds,
            string eventName,
            object? payload = null,
            CancellationToken cancellationToken = default) =>
            Task.CompletedTask;

        public Task NotifyServerAsync(
            Guid serverId,
            string eventName,
            object? payload = null,
            CancellationToken cancellationToken = default)
        {
            ServerNotifications.Enqueue((serverId, eventName));
            return Task.CompletedTask;
        }
    }

    private static string MessagesPath() =>
        $"/api/servers/{ArcaneLinkApiFactory.ServerId}/spaces/" +
        $"{ArcaneLinkApiFactory.TextSpaceId}/messages";
}
