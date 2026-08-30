using ArcaneLink.Hubs;
using ArcaneLink.Services.Realtime;
using Microsoft.AspNetCore.SignalR;
using Microsoft.Extensions.Logging.Abstractions;

namespace ArcaneLink.Tests.Realtime;

public sealed class RealtimeServerGroupMembershipServiceTests
{
    [Fact]
    public void Registry_TracksMultipleConnectionsAndSupportsReregisterAndUnregister()
    {
        var registry = new RealtimeConnectionRegistry();
        var firstUserId = Guid.NewGuid();
        var secondUserId = Guid.NewGuid();

        registry.Register(firstUserId, "connection-1");
        registry.Register(firstUserId, "connection-2");
        registry.Register(secondUserId, "connection-3");

        Assert.Equal(
            ["connection-1", "connection-2"],
            registry.GetConnectionIds(firstUserId).Order(StringComparer.Ordinal));
        Assert.Equal(["connection-3"], registry.GetConnectionIds(secondUserId));

        registry.Register(secondUserId, "connection-1");

        Assert.Equal(["connection-2"], registry.GetConnectionIds(firstUserId));
        Assert.Equal(
            ["connection-1", "connection-3"],
            registry.GetConnectionIds(secondUserId).Order(StringComparer.Ordinal));

        registry.Unregister("connection-3");
        registry.Unregister("connection-does-not-exist");

        Assert.Equal(["connection-1"], registry.GetConnectionIds(secondUserId));
    }

    [Theory]
    [InlineData(true)]
    [InlineData(false)]
    public async Task MembershipUpdate_UpdatesEveryConnectionForTheRequestedUser(bool add)
    {
        var registry = new RealtimeConnectionRegistry();
        var userId = Guid.NewGuid();
        var otherUserId = Guid.NewGuid();
        var serverId = Guid.NewGuid();
        registry.Register(userId, "connection-1");
        registry.Register(userId, "connection-2");
        registry.Register(otherUserId, "other-connection");
        var groups = new RecordingGroupManager();
        var service = CreateService(registry, groups);

        await UpdateMembershipAsync(service, userId, serverId, add);

        var expectedGroup = RealtimeGroups.Server(serverId);
        var calls = add ? groups.AddCalls : groups.RemoveCalls;
        Assert.Equal(
            [
                new GroupCall("connection-1", expectedGroup),
                new GroupCall("connection-2", expectedGroup)
            ],
            calls.OrderBy(call => call.ConnectionId, StringComparer.Ordinal));
        Assert.Empty(add ? groups.RemoveCalls : groups.AddCalls);
    }

    [Theory]
    [InlineData(true)]
    [InlineData(false)]
    public async Task MembershipUpdate_ContinuesAfterIndividualConnectionFailures(bool add)
    {
        var registry = new RealtimeConnectionRegistry();
        var userId = Guid.NewGuid();
        var serverId = Guid.NewGuid();
        registry.Register(userId, "connection-1");
        registry.Register(userId, "connection-2");
        registry.Register(userId, "connection-3");
        var groups = new RecordingGroupManager(
            failingConnectionIds: ["connection-1", "connection-2"]);
        var service = CreateService(registry, groups);

        await UpdateMembershipAsync(service, userId, serverId, add);

        var expectedGroup = RealtimeGroups.Server(serverId);
        var calls = add ? groups.AddCalls : groups.RemoveCalls;
        Assert.Equal(
            [
                new GroupCall("connection-1", expectedGroup),
                new GroupCall("connection-2", expectedGroup),
                new GroupCall("connection-3", expectedGroup)
            ],
            calls.OrderBy(call => call.ConnectionId, StringComparer.Ordinal));
        Assert.Empty(add ? groups.RemoveCalls : groups.AddCalls);
    }

    private static RealtimeServerGroupMembershipService CreateService(
        RealtimeConnectionRegistry registry,
        RecordingGroupManager groups)
    {
        return new RealtimeServerGroupMembershipService(
            new TestHubContext(groups),
            registry,
            NullLogger<RealtimeServerGroupMembershipService>.Instance);
    }

    private static Task UpdateMembershipAsync(
        RealtimeServerGroupMembershipService service,
        Guid userId,
        Guid serverId,
        bool add)
    {
        return add
            ? service.AddUserBestEffortAsync(userId, serverId)
            : service.RemoveUserBestEffortAsync(userId, serverId);
    }

    private sealed class TestHubContext(IGroupManager groups) : IHubContext<RealtimeHub>
    {
        public IHubClients Clients => throw new NotSupportedException();

        public IGroupManager Groups { get; } = groups;
    }

    private sealed class RecordingGroupManager(
        IEnumerable<string>? failingConnectionIds = null) : IGroupManager
    {
        private readonly HashSet<string> _failingConnectionIds =
            new(failingConnectionIds ?? [], StringComparer.Ordinal);

        public List<GroupCall> AddCalls { get; } = [];

        public List<GroupCall> RemoveCalls { get; } = [];

        public Task AddToGroupAsync(
            string connectionId,
            string groupName,
            CancellationToken cancellationToken = default)
        {
            this.AddCalls.Add(new GroupCall(connectionId, groupName));
            return this.CompleteOrFail(connectionId);
        }

        public Task RemoveFromGroupAsync(
            string connectionId,
            string groupName,
            CancellationToken cancellationToken = default)
        {
            this.RemoveCalls.Add(new GroupCall(connectionId, groupName));
            return this.CompleteOrFail(connectionId);
        }

        private Task CompleteOrFail(string connectionId)
        {
            return this._failingConnectionIds.Contains(connectionId)
                ? Task.FromException(new InvalidOperationException("Simulated group update failure."))
                : Task.CompletedTask;
        }
    }

    private sealed record GroupCall(string ConnectionId, string GroupName);
}
