using System.Text.Json;
using ArcaneLink.DataBase._Data;
using ArcaneLink.DataBase.Constants;
using ArcaneLink.DataBase.Models.ServersModels;
using ArcaneLink.DataBase.Models.SpacesModels;
using ArcaneLink.Services.Realtime.Abstractions;
using ArcaneLink.Tests.Infrastructure;
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
        db.ServerMemberProfiles.Add(new ServerMemberProfile
        {
            ServerMemberId = ArcaneLinkApiFactory.MemberMemberId,
            DisplayName = "Voice Server Alias",
            DisplayNameNorm = "VOICE SERVER ALIAS",
            UpdatedAt = now
        });
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
        }
        finally
        {
            await voice.DisconnectAsync(connectionId);
        }
    }
}
