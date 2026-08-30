namespace ArcaneLink.Hubs;

public static class RealtimeGroups
{
    public static string User(Guid userId) => $"user:{userId}";

    public static string Server(Guid serverId) => $"server:{serverId}";
}
