using ArcaneLink.DataBase.Constants;
using ArcaneLink.Services.Servers.Authorization;
using ArcaneLink.Services.Spaces;

namespace ArcaneLink.Tests.Spaces;

public sealed class LegacySpacePermissionMaskAdapterTests
{
    [Theory]
    [InlineData("SEND_MESSAGES", SpaceAction.Send)]
    [InlineData("ATTACH_FILES", SpaceAction.Send)]
    [InlineData("CONNECT_VOICE", SpaceAction.Connect)]
    [InlineData("USE_VIDEO", SpaceAction.Connect)]
    [InlineData("VIEW_TEXT_SPACES", SpaceAction.View)]
    [InlineData("MANAGE_SPACE_ACCESS", SpaceAction.View)]
    public void ExactPermission_SelectsMandatoryLegacyGate(
        string permissionCode,
        SpaceAction expected)
    {
        var adapter = new LegacySpacePermissionMaskAdapter();

        Assert.True(adapter.TryGetLegacyGate(permissionCode, out var actual));
        Assert.Equal(expected, actual);
    }

    [Fact]
    public void UnknownPermission_FailsClosed()
    {
        var adapter = new LegacySpacePermissionMaskAdapter();

        Assert.False(adapter.TryGetLegacyGate("FUTURE_UNKNOWN", out _));
        Assert.False(adapter.TryCreateMask(Guid.NewGuid(), out _));
    }

    [Fact]
    public void ManageSpace_ExpandsToCrudReorderAndModerationBundle()
    {
        var adapter = new LegacySpacePermissionMaskAdapter();

        Assert.True(adapter.TryCreateMask(
            SpacePermissionIds.ManageSpace,
            out var mask));
        var codes = ServerPermissionRegistry.GetCodes(mask);

        Assert.Contains("MANAGE_SPACE_SETTINGS", codes);
        Assert.Contains("MANAGE_SPACE_ACCESS", codes);
        Assert.Contains("REORDER_SPACES_AND_CATEGORIES", codes);
        Assert.Contains("CREATE_PRIVATE_VOICE_SPACES", codes);
        Assert.Contains("DELETE_CATEGORIES", codes);
        Assert.Contains("MANAGE_MESSAGES", codes);
        Assert.Contains("DISCONNECT_VOICE_MEMBERS", codes);
        Assert.DoesNotContain(ServerPermissionRegistry.AdministratorCode, codes);
    }

    [Fact]
    public void CoarseContentPermissions_ExpandOnlyWithinTheirFamilies()
    {
        var adapter = new LegacySpacePermissionMaskAdapter();

        Assert.True(adapter.TryCreateMask(
            SpacePermissionIds.SendMessages,
            out var sendMask));
        Assert.True(adapter.TryCreateMask(
            SpacePermissionIds.ConnectVoice,
            out var voiceMask));

        Assert.True(sendMask.Contains(
            ServerPermissionRegistry.GetRequired("ATTACH_FILES").Bit));
        Assert.False(sendMask.Contains(
            ServerPermissionRegistry.GetRequired("MANAGE_MESSAGES").Bit));
        Assert.True(voiceMask.Contains(
            ServerPermissionRegistry.GetRequired("SHARE_SCREEN").Bit));
        Assert.False(voiceMask.Contains(
            ServerPermissionRegistry.GetRequired("MOVE_VOICE_MEMBERS").Bit));
    }
}
