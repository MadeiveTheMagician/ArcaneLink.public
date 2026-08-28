using System.Text.Json;
using ArcaneLink.DataBase._Data;
using ArcaneLink.DataBase.Constants;
using ArcaneLink.DataBase.Models.AssetsModels;
using ArcaneLink.DataBase.Models.ServersModels;
using ArcaneLink.DataBase.Models.SpacesModels;
using ArcaneLink.Services.Realtime.Abstractions;
using ArcaneLink.Tests.Infrastructure;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace ArcaneLink.Tests.Realtime;

public sealed class VoiceServerProfileIdentityTests
{
    [Fact]
    public async Task ServerVoiceRosterUsesEffectiveServerDisplayName()
    {
        using var factory = new ArcaneLinkApiFactory();
        await using var scope = factory.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var voice = scope.ServiceProvider.GetRequiredService<IVoiceConnectionService>();
        var voiceSpaceId = Guid.NewGuid();
        var serverAvatarAssetId = Guid.NewGuid();
        var globalAvatarAssetId = Guid.NewGuid();
        var connectionId = $"server-profile-voice-{Guid.NewGuid():N}";
        var now = DateTime.UtcNow;

        db.Spaces.Add(new Space
        {
            Id = voiceSpaceId,
            ServerId = ArcaneLinkApiFactory.ServerId,
            TypeId = SpaceIds.TypeVoiceRoom,
            CreatedByUserId = ArcaneLinkApiFactory.OwnerUserId,
            Title = "server-profile-voice",
            Position = 100,
            IsSystem = false,
            CreatedAt = now,
            UpdatedAt = now
        });
        db.Assets.AddRange(
            CreateAvatarAsset(serverAvatarAssetId, "server", now),
            CreateAvatarAsset(globalAvatarAssetId, "global", now));
        var globalProfile = await db.UserProfiles.SingleAsync(profile =>
            profile.UserId == ArcaneLinkApiFactory.MemberUserId);
        globalProfile.AvatarAssetId = globalAvatarAssetId;
        globalProfile.AvatarCropOffsetX = 0.125;
        globalProfile.AvatarCropOffsetY = -0.25;
        globalProfile.AvatarCropZoom = 1.4;
        var serverProfile = new ServerMemberProfile
        {
            ServerMemberId = ArcaneLinkApiFactory.MemberMemberId,
            DisplayName = "Voice Server Alias",
            DisplayNameNorm = "VOICE SERVER ALIAS",
            AvatarAssetId = serverAvatarAssetId,
            AvatarCropOffsetX = -0.4,
            AvatarCropOffsetY = 0.35,
            AvatarCropZoom = 1.8,
            UpdatedAt = now
        };
        db.ServerMemberProfiles.Add(serverProfile);
        await db.SaveChangesAsync();

        try
        {
            var joined = await voice.JoinAsync(
                connectionId,
                ArcaneLinkApiFactory.MemberUserId,
                ArcaneLinkApiFactory.ServerId,
                voiceSpaceId,
                new VoiceStateUpdate(false, false, false, false));
            Assert.NotNull(joined);

            var payload = JsonSerializer.SerializeToElement(
                await voice.GetChannelStatePayloadAsync(
                    ArcaneLinkApiFactory.ServerId,
                    voiceSpaceId,
                    VoiceChannelScopes.Server));
            var participant = Assert.Single(
                payload.GetProperty("participants").EnumerateArray().ToArray());

            Assert.Equal(
                "Voice Server Alias",
                participant.GetProperty("displayName").GetString());
            Assert.Equal(
                ArcaneLinkApiFactory.MemberUserId,
                participant.GetProperty("userId").GetGuid());
            Assert.Equal("member", participant.GetProperty("login").GetString());
            Assert.Equal(
                serverAvatarAssetId,
                participant.GetProperty("avatarAssetId").GetGuid());
            Assert.Equal(0, participant.GetProperty("avatarCropOffsetX").GetDouble());
            Assert.Equal(0, participant.GetProperty("avatarCropOffsetY").GetDouble());
            Assert.Equal(1, participant.GetProperty("avatarCropZoom").GetDouble());

            serverProfile.DisplayName = "Refreshed Voice Alias";
            serverProfile.DisplayNameNorm = "REFRESHED VOICE ALIAS";
            serverProfile.AvatarAssetId = null;
            serverProfile.UpdatedAt = now.AddMinutes(1);
            await db.SaveChangesAsync();

            var refreshed = await voice.RefreshUserIdentityAsync(
                ArcaneLinkApiFactory.MemberUserId);
            Assert.Single(refreshed);
            var refreshedPayload = JsonSerializer.SerializeToElement(
                await voice.GetChannelStatePayloadAsync(
                    ArcaneLinkApiFactory.ServerId,
                    voiceSpaceId,
                    VoiceChannelScopes.Server));
            var refreshedParticipant = Assert.Single(
                refreshedPayload.GetProperty("participants")
                    .EnumerateArray()
                    .ToArray());

            Assert.Equal(
                "Refreshed Voice Alias",
                refreshedParticipant.GetProperty("displayName").GetString());
            Assert.Equal(
                globalAvatarAssetId,
                refreshedParticipant.GetProperty("avatarAssetId").GetGuid());
            Assert.Equal(
                0.125,
                refreshedParticipant.GetProperty("avatarCropOffsetX").GetDouble());
            Assert.Equal(
                -0.25,
                refreshedParticipant.GetProperty("avatarCropOffsetY").GetDouble());
            Assert.Equal(
                1.4,
                refreshedParticipant.GetProperty("avatarCropZoom").GetDouble());
        }
        finally
        {
            await voice.DisconnectAsync(connectionId);
        }
    }

    private static Asset CreateAvatarAsset(
        Guid assetId,
        string suffix,
        DateTime createdAt)
    {
        return new Asset
        {
            Id = assetId,
            OwnerUserId = ArcaneLinkApiFactory.MemberUserId,
            AssetTypeId = AssetTypeIds.CurrentAvatar,
            StorageKey = $"tests/voice-avatar/{suffix}-{assetId:N}.webp",
            OriginalFileName = $"{suffix}-avatar.webp",
            MimeType = "image/webp",
            SizeBytes = 1,
            Sha256 = new string(suffix[0], 64),
            Width = 320,
            Height = 320,
            CreatedAt = createdAt
        };
    }
}
