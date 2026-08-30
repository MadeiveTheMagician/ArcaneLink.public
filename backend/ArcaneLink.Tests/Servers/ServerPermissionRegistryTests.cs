using System.Text.Json;
using ArcaneLink.Services.Servers.Authorization;

namespace ArcaneLink.Tests.Servers;

public sealed class ServerPermissionRegistryTests
{
    [Fact]
    public void Registry_UsesStableUniqueBitsInsideThe256BitMask()
    {
        var expected = new (int Bit, string Code)[]
        {
            (0, "VIEW_TEXT_SPACES"),
            (1, "VIEW_VOICE_SPACES"),
            (2, "READ_MESSAGE_HISTORY"),
            (3, "READ_VOICE_CHAT_HISTORY"),
            (4, "SEND_MESSAGES"),
            (5, "SEND_MESSAGES_IN_VOICE_CHAT"),
            (6, "SEND_LINKS"),
            (7, "ATTACH_FILES"),
            (8, "ADD_REACTIONS"),
            (9, "MENTION_EVERYONE"),
            (10, "MENTION_HERE"),
            (11, "MANAGE_PINS"),
            (12, "MANAGE_MESSAGES"),
            (13, "CONNECT_VOICE"),
            (14, "SPEAK_IN_VOICE"),
            (15, "USE_VIDEO"),
            (16, "SHARE_SCREEN"),
            (17, "MUTE_VOICE_MEMBERS"),
            (18, "DEAFEN_VOICE_MEMBERS"),
            (19, "MOVE_VOICE_MEMBERS"),
            (20, "DISCONNECT_VOICE_MEMBERS"),
            (21, "CHANGE_OWN_NICKNAME"),
            (22, "MANAGE_NICKNAMES"),
            (23, "APPROVE_JOIN_REQUESTS"),
            (24, "KICK_MEMBERS"),
            (25, "BAN_MEMBERS"),
            (26, "MANAGE_BANS"),
            (27, "TIMEOUT_MEMBERS"),
            (28, "MANAGE_ROLES"),
            (29, "ASSIGN_ROLES"),
            (30, "MANAGE_DEFAULT_PERMISSIONS"),
            (31, "ADMINISTRATOR"),
            (32, "MANAGE_SPACE_SETTINGS"),
            (33, "MANAGE_SPACE_ACCESS"),
            (34, "REORDER_SPACES_AND_CATEGORIES"),
            (35, "CREATE_PUBLIC_CATEGORIES"),
            (36, "CREATE_PUBLIC_TEXT_SPACES"),
            (37, "CREATE_PUBLIC_VOICE_SPACES"),
            (38, "CREATE_PRIVATE_CATEGORIES"),
            (39, "CREATE_PRIVATE_TEXT_SPACES"),
            (40, "CREATE_PRIVATE_VOICE_SPACES"),
            (41, "DELETE_CATEGORIES"),
            (42, "DELETE_TEXT_SPACES"),
            (43, "DELETE_VOICE_SPACES"),
            (44, "CREATE_INVITES"),
            (45, "VIEW_INVITE_LOG"),
            (46, "MANAGE_INVITES"),
            (47, "MANAGE_SERVER_PROFILE"),
            (48, "MANAGE_SERVER_SETTINGS"),
            (49, "VIEW_AUDIT_LOG"),
            (50, "MANAGE_REPORTS")
        };

        Assert.Equal(1, ServerPermissionRegistry.SchemaVersion);
        Assert.Equal(expected.Length, ServerPermissionRegistry.All.Count);
        Assert.Equal(
            expected,
            ServerPermissionRegistry.All.Select(x => (x.Bit, x.Code)));
        Assert.Equal(
            ServerPermissionRegistry.All.Count,
            ServerPermissionRegistry.All.Select(x => x.Bit).Distinct().Count());
        Assert.Equal(
            ServerPermissionRegistry.All.Count,
            ServerPermissionRegistry.All.Select(x => x.Code).Distinct().Count());
        Assert.All(
            ServerPermissionRegistry.All,
            definition => Assert.InRange(
                definition.Bit,
                0,
                PermissionMask256.BitCapacity - 1));

        Assert.Equal(0, ServerPermissionRegistry.GetRequired("VIEW_TEXT_SPACES").Bit);
        Assert.Equal(31, ServerPermissionRegistry.Administrator.Bit);
        Assert.Equal(49, ServerPermissionRegistry.GetRequired("VIEW_AUDIT_LOG").Bit);
        Assert.Equal(50, ServerPermissionRegistry.GetRequired("MANAGE_REPORTS").Bit);
        Assert.Empty(ServerPermissionRegistry.RetiredBits);
    }

    [Fact]
    public void PermissionMask_RoundTripsEveryWordBoundary()
    {
        var bits = new[] { 0, 63, 64, 127, 128, 191, 192, 255 };
        var mask = PermissionMask256.FromBits(bits);

        var restored = PermissionMask256.FromByteArray(mask.ToByteArray());

        Assert.Equal(mask, restored);
        Assert.Equal(PermissionMask256.ByteLength, mask.ToByteArray().Length);
        Assert.All(bits, bit => Assert.True(restored.Contains(bit)));
        Assert.False(restored.Contains(62));
        Assert.False(restored.Contains(254));
    }

    [Fact]
    public void PermissionMask_CombinesAllowsAndRemovesDenies()
    {
        var send = ServerPermissionRegistry.CreateMask(
            ["SEND_MESSAGES", "SEND_LINKS"]);
        var attachments = ServerPermissionRegistry.CreateMask(
            ["ATTACH_FILES"]);
        var denied = ServerPermissionRegistry.CreateMask(
            ["SEND_LINKS"]);

        var effective = (send | attachments).Except(denied);

        Assert.True(effective.Contains(
            ServerPermissionRegistry.GetRequired("SEND_MESSAGES").Bit));
        Assert.True(effective.Contains(
            ServerPermissionRegistry.GetRequired("ATTACH_FILES").Bit));
        Assert.False(effective.Contains(
            ServerPermissionRegistry.GetRequired("SEND_LINKS").Bit));
    }

    [Fact]
    public void Registry_RejectsUnknownCodesAndInvalidMaskData()
    {
        Assert.False(ServerPermissionRegistry.TryGet("send_messages", out _));
        Assert.Throws<KeyNotFoundException>(() =>
            ServerPermissionRegistry.GetRequired("UNKNOWN_PERMISSION"));
        Assert.Throws<ArgumentException>(() =>
            PermissionMask256.FromByteArray(new byte[31]));
        Assert.Throws<ArgumentOutOfRangeException>(() =>
            PermissionMask256.Empty.With(256));

        var unknownBit = PermissionMask256.Empty.With(51);
        Assert.Throws<InvalidOperationException>(() =>
            ServerPermissionRegistry.ValidateForWrite(
                unknownBit,
                ServerPermissionRegistry.SchemaVersion));
        Assert.Throws<InvalidOperationException>(() =>
            ServerPermissionRegistry.ValidateForWrite(
                PermissionMask256.Empty,
                ServerPermissionRegistry.SchemaVersion + 1));
    }

    [Fact]
    public void PermissionMask_UsesAnExplicitBase64JsonContract()
    {
        var mask = ServerPermissionRegistry.CreateMask(
            ["VIEW_TEXT_SPACES", "ADMINISTRATOR", "VIEW_AUDIT_LOG"]);

        var json = JsonSerializer.Serialize(mask);
        var restored = JsonSerializer.Deserialize<PermissionMask256>(json);

        Assert.Equal(mask, restored);
        Assert.Throws<JsonException>(() =>
            JsonSerializer.Deserialize<PermissionMask256>("\"not-base64\""));
    }
}
