using ArcaneLink.DataBase.Models.MessagesModels;
using ArcaneLink.Services.Moderation;

namespace ArcaneLink.Tests.Moderation;

public sealed class ModerationEvidenceHasherTests
{
    [Fact]
    public void Compute_IncludesFullContentBeyondStoredExcerptLength()
    {
        var sharedPrefix = new string('a', 2000);
        var first = new SpaceMessage
        {
            Id = Guid.NewGuid(),
            Body = sharedPrefix + "first-tail"
        };
        var second = new SpaceMessage
        {
            Id = first.Id,
            Body = sharedPrefix + "second-tail"
        };

        var firstHash = ModerationEvidenceHasher.Compute(first, []);
        var secondHash = ModerationEvidenceHasher.Compute(second, []);

        Assert.NotEqual(firstHash, secondHash);
        Assert.Equal(64, firstHash.Length);
    }
}
