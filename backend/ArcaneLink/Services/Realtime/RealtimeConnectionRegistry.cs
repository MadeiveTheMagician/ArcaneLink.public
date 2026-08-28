namespace ArcaneLink.Services.Realtime
{
    public readonly record struct RealtimeConnectionRegistrationResult(
        Guid UserId,
        bool WasAdded,
        bool IsFirstConnection,
        Guid? PreviousUserId,
        bool PreviousUserLostLastConnection);

    public readonly record struct RealtimeConnectionUnregistrationResult(
        Guid UserId,
        bool WasLastConnection);

    public sealed class RealtimeConnectionRegistry
    {
        private readonly object _sync = new();
        private readonly Dictionary<string, Guid> _usersByConnection =
            new(StringComparer.Ordinal);
        private readonly Dictionary<Guid, HashSet<string>> _connectionsByUser = [];

        public RealtimeConnectionRegistrationResult Register(
            Guid userId,
            string connectionId)
        {
            ArgumentNullException.ThrowIfNull(connectionId);

            lock (this._sync)
            {
                Guid? previousUserId = null;
                var previousUserLostLastConnection = false;

                if (this._usersByConnection.TryGetValue(connectionId, out var currentUserId))
                {
                    if (currentUserId == userId)
                    {
                        return new RealtimeConnectionRegistrationResult(
                            userId,
                            WasAdded: false,
                            IsFirstConnection: false,
                            PreviousUserId: null,
                            PreviousUserLostLastConnection: false);
                    }

                    previousUserId = currentUserId;
                    previousUserLostLastConnection = this.RemoveFromUser(
                        currentUserId,
                        connectionId);
                }

                if (!this._connectionsByUser.TryGetValue(userId, out var connectionIds))
                {
                    connectionIds = new HashSet<string>(StringComparer.Ordinal);
                    this._connectionsByUser.Add(userId, connectionIds);
                }

                var isFirstConnection = connectionIds.Count == 0;
                connectionIds.Add(connectionId);
                this._usersByConnection[connectionId] = userId;

                return new RealtimeConnectionRegistrationResult(
                    userId,
                    WasAdded: true,
                    IsFirstConnection: isFirstConnection,
                    PreviousUserId: previousUserId,
                    PreviousUserLostLastConnection: previousUserLostLastConnection);
            }
        }

        public RealtimeConnectionUnregistrationResult? Unregister(string connectionId)
        {
            ArgumentNullException.ThrowIfNull(connectionId);

            lock (this._sync)
            {
                if (!this._usersByConnection.Remove(connectionId, out var userId))
                {
                    return null;
                }

                var wasLastConnection = this.RemoveFromUser(userId, connectionId);
                return new RealtimeConnectionUnregistrationResult(
                    userId,
                    wasLastConnection);
            }
        }

        public IReadOnlyList<string> GetConnectionIds(Guid userId)
        {
            lock (this._sync)
            {
                return this._connectionsByUser.TryGetValue(userId, out var connectionIds)
                    ? connectionIds.ToArray()
                    : [];
            }
        }

        public bool HasConnections(Guid userId)
        {
            lock (this._sync)
            {
                return this._connectionsByUser.ContainsKey(userId);
            }
        }

        public int GetConnectionCount(Guid userId)
        {
            lock (this._sync)
            {
                return this._connectionsByUser.TryGetValue(userId, out var connectionIds)
                    ? connectionIds.Count
                    : 0;
            }
        }

        private bool RemoveFromUser(Guid userId, string connectionId)
        {
            if (!this._connectionsByUser.TryGetValue(userId, out var connectionIds))
            {
                return false;
            }

            connectionIds.Remove(connectionId);
            if (connectionIds.Count > 0)
            {
                return false;
            }

            this._connectionsByUser.Remove(userId);
            return true;
        }
    }
}
