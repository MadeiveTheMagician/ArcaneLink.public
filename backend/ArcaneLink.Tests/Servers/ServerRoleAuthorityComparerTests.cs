using ArcaneLink.Services.Servers.Authorization;

namespace ArcaneLink.Tests.Servers;

public sealed class ServerRoleAuthorityComparerTests
{
    private static readonly Guid ServerId =
        Guid.Parse("21000000-0000-0000-0000-000000000001");

    [Fact]
    public void AuthorityTiers_AreOwnerThenAdministratorThenStandardThenEveryone()
    {
        var owner = ServerRoleAuthority.Owner(ServerId);
        var administrator = ServerRoleAuthority.Administrator(ServerId, 50);
        var standard = ServerRoleAuthority.Standard(ServerId, 0);
        var everyone = ServerRoleAuthority.Everyone(ServerId);

        Assert.True(ServerRoleAuthorityComparer.TryCompare(
            owner,
            administrator,
            out var ownerVsAdministrator));
        Assert.True(ownerVsAdministrator > 0);
        Assert.True(ServerRoleAuthorityComparer.TryCompare(
            administrator,
            standard,
            out var administratorVsStandard));
        Assert.True(administratorVsStandard > 0);
        Assert.True(ServerRoleAuthorityComparer.TryCompare(
            standard,
            everyone,
            out var standardVsEveryone));
        Assert.True(standardVsEveryone > 0);
    }

    [Fact]
    public void SmallerPosition_IsStrongerWithinTheSameTier()
    {
        var stronger = ServerRoleAuthority.Administrator(ServerId, 10);
        var weaker = ServerRoleAuthority.Administrator(ServerId, 20);

        Assert.True(ServerRoleAuthorityComparer.CanAffectSubject(stronger, weaker));
        Assert.False(ServerRoleAuthorityComparer.CanAffectSubject(weaker, stronger));
    }

    [Fact]
    public void ResourceUsesGreaterOrEqual_ButSubjectUsesStrictlyGreater()
    {
        var authority = ServerRoleAuthority.Standard(ServerId, 10);

        Assert.True(ServerRoleAuthorityComparer.CanManageResource(
            authority,
            authority));
        Assert.False(ServerRoleAuthorityComparer.CanAffectSubject(
            authority,
            authority));
    }

    [Fact]
    public void OwnerSubjectAndCrossServerComparisons_FailClosed()
    {
        var owner = ServerRoleAuthority.Owner(ServerId);
        var otherOwner = ServerRoleAuthority.Owner(ServerId);
        var crossServerEveryone = ServerRoleAuthority.Everyone(Guid.NewGuid());

        Assert.False(ServerRoleAuthorityComparer.CanAffectSubject(owner, otherOwner));
        Assert.False(ServerRoleAuthorityComparer.CanManageResource(
            owner,
            crossServerEveryone));
        Assert.False(ServerRoleAuthorityComparer.CanAffectSubject(
            owner,
            crossServerEveryone));
    }
}
