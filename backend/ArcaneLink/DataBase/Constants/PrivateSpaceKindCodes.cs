namespace ArcaneLink.DataBase.Constants;

public static class PrivateSpaceKindCodes
{
    public const string Direct = "direct";
    public const string Group = "group";

    public static bool IsSupported(string? value) =>
        value is Direct or Group;
}
