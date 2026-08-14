using System.Collections.Concurrent;
using ArcaneLink.Services.Realtime;

namespace ArcaneLink.Tests.Realtime;

public sealed class RealtimeConnectionRegistryTests
{
    [Fact]
    public void RegisterAndUnregister_MultipleTabs_ReportOnlyBoundaryTransitions()
    {
        var registry = new RealtimeConnectionRegistry();
        var userId = Guid.NewGuid();

        Assert.False(registry.HasConnections(userId));
        Assert.Equal(0, registry.GetConnectionCount(userId));

        var firstRegistration = registry.Register(userId, "connection-1");

        Assert.True(registry.HasConnections(userId));
        Assert.Equal(1, registry.GetConnectionCount(userId));

        var secondRegistration = registry.Register(userId, "connection-2");

        Assert.True(firstRegistration.WasAdded);
        Assert.True(firstRegistration.IsFirstConnection);
        Assert.True(secondRegistration.WasAdded);
        Assert.False(secondRegistration.IsFirstConnection);
        Assert.True(registry.HasConnections(userId));
        Assert.Equal(2, registry.GetConnectionCount(userId));
        Assert.Equal(
            ["connection-1", "connection-2"],
            registry.GetConnectionIds(userId).Order(StringComparer.Ordinal));

        var firstUnregistration = registry.Unregister("connection-1");

        Assert.True(registry.HasConnections(userId));
        Assert.Equal(1, registry.GetConnectionCount(userId));

        var lastUnregistration = registry.Unregister("connection-2");

        Assert.Equal(userId, firstUnregistration?.UserId);
        Assert.False(firstUnregistration?.WasLastConnection);
        Assert.Equal(userId, lastUnregistration?.UserId);
        Assert.True(lastUnregistration?.WasLastConnection);
        Assert.False(registry.HasConnections(userId));
        Assert.Equal(0, registry.GetConnectionCount(userId));
        Assert.Empty(registry.GetConnectionIds(userId));
    }

    [Fact]
    public void DuplicateRegisterAndUnregister_AreIdempotent()
    {
        var registry = new RealtimeConnectionRegistry();
        var userId = Guid.NewGuid();

        var firstRegistration = registry.Register(userId, "connection-1");
        var duplicateRegistration = registry.Register(userId, "connection-1");

        Assert.True(firstRegistration.WasAdded);
        Assert.False(duplicateRegistration.WasAdded);
        Assert.False(duplicateRegistration.IsFirstConnection);
        Assert.Null(duplicateRegistration.PreviousUserId);
        Assert.False(duplicateRegistration.PreviousUserLostLastConnection);
        Assert.Equal(["connection-1"], registry.GetConnectionIds(userId));

        var unregistration = registry.Unregister("connection-1");

        Assert.Equal(userId, unregistration?.UserId);
        Assert.True(unregistration?.WasLastConnection);
        Assert.Null(registry.Unregister("connection-1"));
        Assert.Null(registry.Unregister("connection-does-not-exist"));
    }

    [Fact]
    public void Register_ReusedConnection_MovesItAndReportsBothUserTransitions()
    {
        var registry = new RealtimeConnectionRegistry();
        var firstUserId = Guid.NewGuid();
        var secondUserId = Guid.NewGuid();
        registry.Register(firstUserId, "connection-1");
        registry.Register(firstUserId, "connection-2");

        var firstMove = registry.Register(secondUserId, "connection-1");

        Assert.True(firstMove.WasAdded);
        Assert.True(firstMove.IsFirstConnection);
        Assert.Equal(firstUserId, firstMove.PreviousUserId);
        Assert.False(firstMove.PreviousUserLostLastConnection);
        Assert.Equal(["connection-2"], registry.GetConnectionIds(firstUserId));
        Assert.Equal(["connection-1"], registry.GetConnectionIds(secondUserId));

        var lastMove = registry.Register(secondUserId, "connection-2");

        Assert.True(lastMove.WasAdded);
        Assert.False(lastMove.IsFirstConnection);
        Assert.Equal(firstUserId, lastMove.PreviousUserId);
        Assert.True(lastMove.PreviousUserLostLastConnection);
        Assert.Empty(registry.GetConnectionIds(firstUserId));
        Assert.Equal(
            ["connection-1", "connection-2"],
            registry.GetConnectionIds(secondUserId).Order(StringComparer.Ordinal));
    }

    [Fact]
    public void ConcurrentRegisterAndUnregister_ReportSingleBoundaryTransitions()
    {
        const int connectionCount = 256;
        var registry = new RealtimeConnectionRegistry();
        var userId = Guid.NewGuid();
        var registrations = new ConcurrentBag<RealtimeConnectionRegistrationResult>();

        Parallel.For(
            0,
            connectionCount,
            index => registrations.Add(
                registry.Register(userId, $"connection-{index}")));

        Assert.Equal(connectionCount, registrations.Count);
        Assert.All(registrations, result => Assert.True(result.WasAdded));
        Assert.Single(registrations, result => result.IsFirstConnection);
        Assert.Equal(
            connectionCount,
            registry.GetConnectionIds(userId).Distinct(StringComparer.Ordinal).Count());

        var unregistrations =
            new ConcurrentBag<RealtimeConnectionUnregistrationResult>();
        Parallel.For(
            0,
            connectionCount,
            index =>
            {
                var result = registry.Unregister($"connection-{index}");
                Assert.True(result.HasValue);
                unregistrations.Add(result.Value);
            });

        Assert.Equal(connectionCount, unregistrations.Count);
        Assert.All(
            unregistrations,
            result => Assert.Equal(userId, result.UserId));
        Assert.Single(unregistrations, result => result.WasLastConnection);
        Assert.Empty(registry.GetConnectionIds(userId));
    }
}
