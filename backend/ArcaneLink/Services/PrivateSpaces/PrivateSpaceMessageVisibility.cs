using ArcaneLink.DataBase._Data;
using ArcaneLink.DataBase.Constants;
using ArcaneLink.DataBase.Models.MessagesModels;

namespace ArcaneLink.Services.PrivateSpaces;

internal static class PrivateSpaceMessageVisibility
{
    internal static IQueryable<SpaceMessage> ApplyHistoryCutoff(
        this IQueryable<SpaceMessage> query,
        AppDbContext db,
        Guid currentUserId)
    {
        return query.Where(message =>
            db.PrivateSpaceMembers.Any(member =>
                member.SpaceId == message.SpaceId &&
                member.UserId == currentUserId &&
                member.StatusId == PrivateSpaceIds.MemberStatusActive &&
                (!member.HistoryClearedAt.HasValue ||
                 message.CreatedAt > member.HistoryClearedAt.Value)));
    }
}
