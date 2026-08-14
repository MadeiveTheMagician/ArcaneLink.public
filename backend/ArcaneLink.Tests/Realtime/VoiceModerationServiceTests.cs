using System.Text.Json;
using ArcaneLink.DataBase._Data;
using ArcaneLink.DataBase.Constants;
using ArcaneLink.DataBase.Models.ServersModels;
using ArcaneLink.Services.Realtime;
using ArcaneLink.Services.Realtime.Abstractions;
using ArcaneLink.Services.Spaces;
using ArcaneLink.Services.Spaces.Abstractions;
using ArcaneLink.Tests.Infrastructure;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging.Abstractions;

namespace ArcaneLink.Tests.Realtime;

public sealed class VoiceModerationServiceTests : IClassFixture<ArcaneLinkApiFactory>
{
    private readonly ArcaneLinkApiFactory _factory;

    public VoiceModerationServiceTests(ArcaneLinkApiFactory factory)
    {
        _factory = factory;
    }

    [Fact]
    public async Task OwnerModeration_IsAuthoritativeAcrossSelfUpdates_AndAppearsInRoster()
    {
        using var scope = _factory.Services.CreateScope();
        var service = CreateService(scope);
        var spaceId = Guid.NewGuid();
        var connectionId = $"voice-moderation-owner-{Guid.NewGuid():N}";
        var reconnectedConnectionId =
            $"voice-moderation-owner-reconnected-{Guid.NewGuid():N}";
        VoiceJoinResult? rejoined = null;

        try
        {
            var joined = await service.JoinAsync(
                connectionId,
                ArcaneLinkApiFactory.MemberUserId,
                ArcaneLinkApiFactory.ServerId,
                spaceId,
                new VoiceStateUpdate(false, false, false, false));
            Assert.NotNull(joined);

            Assert.Null(await service.UpdateParticipantModerationAsync(
                ArcaneLinkApiFactory.MemberUserId,
                ArcaneLinkApiFactory.ServerId,
                spaceId,
                joined!.ParticipantId,
                isServerMuted: true,
                isServerDeafened: null));

            var moderated = await service.UpdateParticipantModerationAsync(
                ArcaneLinkApiFactory.OwnerUserId,
                ArcaneLinkApiFactory.ServerId,
                spaceId,
                joined.ParticipantId,
                isServerMuted: true,
                isServerDeafened: true);
            Assert.NotNull(moderated);
            Assert.True(moderated!.IsServerMuted);
            Assert.True(moderated.IsServerDeafened);

            Assert.NotNull(await service.UpdateStateAsync(
                connectionId,
                spaceId,
                new VoiceStateUpdate(false, false, true, false)));

            using var roster = JsonDocument.Parse(JsonSerializer.Serialize(
                await service.GetChannelStatePayloadAsync(
                    ArcaneLinkApiFactory.ServerId,
                    spaceId)));
            var participant = Assert.Single(
                roster.RootElement.GetProperty("participants").EnumerateArray());
            Assert.True(participant.GetProperty("isMuted").GetBoolean());
            Assert.True(participant.GetProperty("isDeafened").GetBoolean());
            Assert.True(participant.GetProperty("isServerMuted").GetBoolean());
            Assert.True(participant.GetProperty("isServerDeafened").GetBoolean());

            await service.DisconnectAsync(connectionId);
            rejoined = await service.JoinAsync(
                reconnectedConnectionId,
                ArcaneLinkApiFactory.MemberUserId,
                ArcaneLinkApiFactory.ServerId,
                spaceId,
                new VoiceStateUpdate(false, false, false, false));
            Assert.NotNull(rejoined);

            using var reconnectedRoster = JsonDocument.Parse(JsonSerializer.Serialize(
                await service.GetChannelStatePayloadAsync(
                    ArcaneLinkApiFactory.ServerId,
                    spaceId)));
            var reconnectedParticipant = Assert.Single(
                reconnectedRoster.RootElement
                    .GetProperty("participants")
                    .EnumerateArray());
            Assert.True(
                reconnectedParticipant.GetProperty("isServerMuted").GetBoolean());
            Assert.True(
                reconnectedParticipant.GetProperty("isServerDeafened").GetBoolean());

            var cleared = await service.UpdateParticipantModerationAsync(
                ArcaneLinkApiFactory.OwnerUserId,
                ArcaneLinkApiFactory.ServerId,
                spaceId,
                rejoined!.ParticipantId,
                isServerMuted: false,
                isServerDeafened: false);
            Assert.NotNull(cleared);
            Assert.False(cleared!.IsServerMuted);
            Assert.False(cleared.IsServerDeafened);
        }
        finally
        {
            if (rejoined != null)
            {
                await service.UpdateParticipantModerationAsync(
                    ArcaneLinkApiFactory.OwnerUserId,
                    ArcaneLinkApiFactory.ServerId,
                    spaceId,
                    rejoined.ParticipantId,
                    isServerMuted: false,
                    isServerDeafened: false);
            }
            await service.DisconnectAsync(connectionId);
            await service.DisconnectAsync(reconnectedConnectionId);
        }
    }

    [Fact]
    public async Task MemberModeration_RequiresGranularPermissionsAndStrictlyHigherRole()
    {
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var now = DateTime.UtcNow;
        var spaceId = Guid.NewGuid();
        var targetSpaceId = Guid.NewGuid();
        var authorization = new AllowVoiceAuthorizationService();
        authorization.DeniedPermissionCodes.UnionWith(
            ["MUTE_VOICE_MEMBERS", "MOVE_VOICE_MEMBERS"]);
        var service = CreateService(scope, authorization);
        var connectionId = $"voice-moderation-hierarchy-{Guid.NewGuid():N}";
        var targetMember = new ServerMember
        {
            Id = Guid.NewGuid(),
            ServerId = ArcaneLinkApiFactory.ServerId,
            UserId = ArcaneLinkApiFactory.OutsiderUserId,
            StatusId = ServerMemberStatusIds.Active,
            JoinedAt = now,
            CreatedAt = now,
            UpdatedAt = now
        };
        var actorRole = CreateRole("voice-moderator", 10, now);
        var targetRole = CreateRole("voice-target", 20, now);
        var actorAssignment = CreateAssignment(
            ArcaneLinkApiFactory.MemberMemberId,
            actorRole.Id,
            now);
        var targetAssignment = CreateAssignment(targetMember.Id, targetRole.Id, now);
        db.ServerMembers.Add(targetMember);
        db.ServerRoles.AddRange(actorRole, targetRole);
        db.ServerMemberRoles.AddRange(actorAssignment, targetAssignment);
        await db.SaveChangesAsync();

        try
        {
            var joined = await service.JoinAsync(
                connectionId,
                ArcaneLinkApiFactory.OutsiderUserId,
                ArcaneLinkApiFactory.ServerId,
                spaceId,
                new VoiceStateUpdate(false, false, false, false));
            Assert.NotNull(joined);

            Assert.Null(await service.UpdateParticipantModerationAsync(
                ArcaneLinkApiFactory.MemberUserId,
                ArcaneLinkApiFactory.ServerId,
                spaceId,
                joined!.ParticipantId,
                isServerMuted: true,
                isServerDeafened: null));
            Assert.Null(await service.MoveParticipantAsync(
                ArcaneLinkApiFactory.MemberUserId,
                ArcaneLinkApiFactory.ServerId,
                spaceId,
                targetSpaceId,
                joined.ParticipantId));

            authorization.DeniedPermissionCodes.Clear();
            var moved = await service.MoveParticipantAsync(
                ArcaneLinkApiFactory.MemberUserId,
                ArcaneLinkApiFactory.ServerId,
                spaceId,
                targetSpaceId,
                joined.ParticipantId);
            Assert.NotNull(moved);
            Assert.NotNull(await service.UpdateParticipantModerationAsync(
                ArcaneLinkApiFactory.MemberUserId,
                ArcaneLinkApiFactory.ServerId,
                targetSpaceId,
                joined.ParticipantId,
                isServerMuted: true,
                isServerDeafened: null));

            targetRole.Level = 5;
            targetRole.UpdatedAt = DateTime.UtcNow;
            await db.SaveChangesAsync();
            Assert.Null(await service.MoveParticipantAsync(
                ArcaneLinkApiFactory.MemberUserId,
                ArcaneLinkApiFactory.ServerId,
                targetSpaceId,
                spaceId,
                joined.ParticipantId));
            Assert.Null(await service.UpdateParticipantModerationAsync(
                ArcaneLinkApiFactory.MemberUserId,
                ArcaneLinkApiFactory.ServerId,
                targetSpaceId,
                joined.ParticipantId,
                isServerMuted: false,
                isServerDeafened: true));

            Assert.NotNull(await service.UpdateParticipantModerationAsync(
                ArcaneLinkApiFactory.OwnerUserId,
                ArcaneLinkApiFactory.ServerId,
                targetSpaceId,
                joined.ParticipantId,
                isServerMuted: false,
                isServerDeafened: false));
        }
        finally
        {
            await service.DisconnectAsync(connectionId);
            db.ServerMemberRoles.RemoveRange(actorAssignment, targetAssignment);
            db.ServerRoles.RemoveRange(actorRole, targetRole);
            db.ServerMembers.Remove(targetMember);
            await db.SaveChangesAsync();
        }
    }

    private static VoiceConnectionService CreateService(IServiceScope scope)
    {
        return CreateService(scope, new AllowVoiceAuthorizationService());
    }

    private static VoiceConnectionService CreateService(
        IServiceScope scope,
        ISpaceAuthorizationService authorization)
    {
        return new VoiceConnectionService(
            scope.ServiceProvider.GetRequiredService<AppDbContext>(),
            authorization,
            NullLogger<VoiceConnectionService>.Instance);
    }

    private static ServerRole CreateRole(string title, int level, DateTime now)
    {
        return new ServerRole
        {
            Id = Guid.NewGuid(),
            ServerId = ArcaneLinkApiFactory.ServerId,
            Title = $"{title}-{Guid.NewGuid():N}",
            Level = level,
            IsSystem = false,
            CreatedAt = now,
            UpdatedAt = now
        };
    }

    private static ServerMemberRole CreateAssignment(
        Guid memberId,
        Guid roleId,
        DateTime now)
    {
        return new ServerMemberRole
        {
            Id = Guid.NewGuid(),
            ServerId = ArcaneLinkApiFactory.ServerId,
            MemberId = memberId,
            RoleId = roleId,
            AssignedAt = now
        };
    }

    private sealed class AllowVoiceAuthorizationService : ISpaceAuthorizationService
    {
        private static readonly SpaceAccessCapabilities Capabilities = new(
            CanView: true,
            CanSendMessages: false,
            CanConnectVoice: true,
            CanManage: false);

        public HashSet<Guid> ManagedSpaceIds { get; } = [];
        public HashSet<string> DeniedPermissionCodes { get; } =
            new(StringComparer.Ordinal);

        public Task<SpaceAuthorizationSnapshot?> GetSnapshotAsync(
            Guid userId,
            Guid serverId,
            CancellationToken cancellationToken = default)
        {
            return Task.FromResult<SpaceAuthorizationSnapshot?>(
                new SpaceAuthorizationSnapshot(
                    ManagedSpaceIds.ToDictionary(
                        spaceId => spaceId,
                        _ => Capabilities with { CanManage = true })));
        }

        public Task<SpaceAccessCapabilities?> GetCapabilitiesAsync(
            Guid userId,
            Guid serverId,
            Guid spaceId,
            CancellationToken cancellationToken = default)
        {
            return Task.FromResult<SpaceAccessCapabilities?>(Capabilities);
        }

        public Task<bool> IsAllowedAsync(
            Guid userId,
            Guid serverId,
            Guid spaceId,
            SpaceAuthorizationRequirement requirement,
            CancellationToken cancellationToken = default)
        {
            return Task.FromResult(
                !DeniedPermissionCodes.Contains(requirement.PermissionCode));
        }

        public Task<IReadOnlyList<Guid>?> GetAllowedSpaceIdsAsync(
            Guid userId,
            Guid serverId,
            SpaceAction action,
            CancellationToken cancellationToken = default)
        {
            return Task.FromResult<IReadOnlyList<Guid>?>([]);
        }

        public Task<IReadOnlyList<Guid>> FilterAuthorizedUserIdsAsync(
            Guid serverId,
            Guid spaceId,
            IEnumerable<Guid> userIds,
            SpaceAction action,
            CancellationToken cancellationToken = default)
        {
            return Task.FromResult<IReadOnlyList<Guid>>(userIds.ToList());
        }

        public void InvalidateServer(Guid serverId)
        {
        }
    }
}
