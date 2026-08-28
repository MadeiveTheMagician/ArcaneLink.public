namespace ArcaneLink.DataBase.Constants;

public static class FriendRequestStatusIds
{
    public static readonly Guid Pending = new("31000000-0000-0000-0000-000000000001");
    public static readonly Guid Accepted = new("31000000-0000-0000-0000-000000000002");
    public static readonly Guid Declined = new("31000000-0000-0000-0000-000000000003");
    public static readonly Guid Canceled = new("31000000-0000-0000-0000-000000000004");
}
