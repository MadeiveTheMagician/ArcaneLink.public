namespace ArcaneLink.DataBase.Constants;

// Fixed GUIDs for asset_types seed data.
//
// Business logic can reference well-known asset types directly
// without querying by string Code in every workflow.
public static class AssetTypeIds
{
    public static readonly Guid Avatar = new("11000000-0000-0000-0000-000000000000");
    public static readonly Guid Banner = new("12000000-0000-0000-0000-000000000000");
    public static readonly Guid MessageAttachment = new("13000000-0000-0000-0000-000000000000");
    public static readonly Guid ServerIcon = new("14000000-0000-0000-0000-000000000000");
    public static readonly Guid GameAvatar = new("15000000-0000-0000-0000-000000000000");
    public static readonly Guid ProfileBackground = new("16000000-0000-0000-0000-000000000000");
    public static readonly Guid CurrentAvatar = new("17000000-0000-0000-0000-000000000000");
    public static readonly Guid Other = new("19000000-0000-0000-0000-000000000000");
}
