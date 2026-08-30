using ArcaneLink.DataBase._Data;
using ArcaneLink.DataBase.Models.MessagesModels;
using ArcaneLink.DataBase.Models.SpacesModels;
using Microsoft.EntityFrameworkCore;

namespace ArcaneLink.Services.PrivateSpaces;

internal static class PrivateSpaceQueries
{
    internal static IQueryable<PrivateSpace> LoadSpaces(AppDbContext db)
    {
        return db.PrivateSpaces
            .AsNoTracking()
            .Include(x => x.Members)
                .ThenInclude(x => x.Status)
            .Include(x => x.Members)
                .ThenInclude(x => x.User)
                .ThenInclude(x => x.Profile);
    }

    internal static IQueryable<SpaceMessage> LoadMessages(AppDbContext db)
    {
        return db.SpaceMessages
            .AsNoTracking()
            .AsSplitQuery()
            .Include(x => x.Space)
            .Include(x => x.MessageType)
            .Include(x => x.SenderUser)
                .ThenInclude(x => x.Profile)
            .Include(x => x.ReplyToMessage)
                .ThenInclude(x => x!.SenderUser)
                .ThenInclude(x => x.Profile)
            .Include(x => x.ReplyToMessage)
                .ThenInclude(x => x!.UserDeletions)
            .Include(x => x.Assets)
                .ThenInclude(x => x.Asset)
            .Include(x => x.Reactions)
            .Include(x => x.Mentions);
    }
}
