namespace ArcaneLink.DataBase.Constants;

public static class SpacePermissionIds
{
    public static readonly Guid ViewSpace =
        Guid.Parse("24000000-0000-0000-0000-000000000206");
    public static readonly Guid SendMessages =
        Guid.Parse("24000000-0000-0000-0000-000000000207");
    public static readonly Guid ConnectVoice =
        Guid.Parse("24000000-0000-0000-0000-000000000208");
    public static readonly Guid ManageSpace =
        Guid.Parse("24000000-0000-0000-0000-000000000209");

    public static IReadOnlyList<Guid> All { get; } = Array.AsReadOnly(
    [
        ViewSpace,
        SendMessages,
        ConnectVoice,
        ManageSpace
    ]);

    public static bool Contains(Guid permissionId)
    {
        return permissionId == ViewSpace ||
               permissionId == SendMessages ||
               permissionId == ConnectVoice ||
               permissionId == ManageSpace;
    }
}
