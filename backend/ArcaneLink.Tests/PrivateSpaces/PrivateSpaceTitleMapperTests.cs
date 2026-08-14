using ArcaneLink.Services.PrivateSpaces;

namespace ArcaneLink.Tests.PrivateSpaces;

public sealed class PrivateSpaceTitleMapperTests
{
    [Fact]
    public void BuildDefaultGroupTitle_UsesThreeMembersAndCollapsesTheRest()
    {
        var title = PrivateSpaceTitleMapper.BuildDefaultGroupTitle(
            ["Алекс", "Борис", "Вера", "Галина"]);

        Assert.Equal(
            "Группа пользователей Алекс, Борис, Вера и др.",
            title);
    }

    [Fact]
    public void BuildDefaultGroupTitle_CountsEveryDisplayedMemberIncludingViewer()
    {
        var title = PrivateSpaceTitleMapper.BuildDefaultGroupTitle(
            ["Текущий пользователь", "Борис", "Вера", "Галина"]);

        Assert.Equal(
            "Группа пользователей Текущий пользователь, Борис, Вера и др.",
            title);
    }

    [Fact]
    public void BuildDefaultGroupTitle_HandlesEmptyAndShortGroups()
    {
        Assert.Equal(
            "Новая группа",
            PrivateSpaceTitleMapper.BuildDefaultGroupTitle([]));
        Assert.Equal(
            "Группа пользователей Алекс, Борис, Вера",
            PrivateSpaceTitleMapper.BuildDefaultGroupTitle(
                [" Алекс ", "Борис", "Вера"]));
    }
}
