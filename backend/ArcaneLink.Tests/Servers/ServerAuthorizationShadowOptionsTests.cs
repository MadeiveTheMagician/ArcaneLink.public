using ArcaneLink.Services.Servers.Authorization;

namespace ArcaneLink.Tests.Servers;

public sealed class ServerAuthorizationShadowOptionsTests
{
    [Theory]
    [InlineData("ADMINISTRATOR")]
    [InlineData("manage_roles")]
    [InlineData("MANAGE_INVITES")]
    [InlineData("KICK_MEMBERS")]
    [InlineData("VIEW_AUDIT_LOG")]
    [InlineData("MANAGE_REPORTS")]
    public void KnownRepresentativePermission_IsAccepted(string permissionCode)
    {
        var options = new ServerAuthorizationShadowOptions
        {
            EnforcedPermissionCodes = [permissionCode]
        };

        Assert.True(options.HasValidEnforcementConfiguration());
        Assert.True(options.IsEnforced(permissionCode.ToUpperInvariant()));
    }

    [Theory]
    [InlineData("")]
    [InlineData(" ")]
    [InlineData("VIEW_CHANNEL")]
    [InlineData("UNKNOWN_PERMISSION")]
    public void UnsupportedPermission_IsRejected(string permissionCode)
    {
        var options = new ServerAuthorizationShadowOptions
        {
            EnforcedPermissionCodes = [permissionCode]
        };

        Assert.False(options.HasValidEnforcementConfiguration());
    }

    [Fact]
    public void NullPermissionList_IsRejectedWithoutThrowing()
    {
        var options = new ServerAuthorizationShadowOptions
        {
            EnforcedPermissionCodes = null!
        };

        Assert.False(options.HasValidEnforcementConfiguration());
        Assert.False(options.IsEnforced("VIEW_AUDIT_LOG"));
    }
}
