namespace ArcaneLink.DataBase.Constants
{
    public static class UserStatusIds
    {
        public static readonly Guid Active = new("10000000-0000-0000-0000-000000000000");

        public static readonly Guid Banned = new("20000000-0000-0000-0000-000000000000");

        public static readonly Guid Deleted = new("30000000-0000-0000-0000-000000000000");

        public static readonly Guid PendingEmailVerification = new("40000000-0000-0000-0000-000000000000");
    }
}
