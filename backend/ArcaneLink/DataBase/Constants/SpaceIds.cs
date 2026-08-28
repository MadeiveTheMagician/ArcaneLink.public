namespace ArcaneLink.DataBase.Constants;

public static class SpaceIds
{
    public static readonly Guid TypeCategory = Guid.Parse("25000000-0000-0000-0000-000000000001");
    public static readonly Guid TypeTextRoom = Guid.Parse("25000000-0000-0000-0000-000000000002");
    public static readonly Guid TypeVoiceRoom = Guid.Parse("25000000-0000-0000-0000-000000000003");

    public static readonly Guid MessageTypeText = Guid.Parse("25000000-0000-0000-0000-000000000101");
    public static readonly Guid MessageTypeSystem = Guid.Parse("25000000-0000-0000-0000-000000000102");
    public static readonly Guid MessageTypeMedia = Guid.Parse("25000000-0000-0000-0000-000000000103");
    public static readonly Guid MessageTypeEvent = Guid.Parse("25000000-0000-0000-0000-000000000104");
}
