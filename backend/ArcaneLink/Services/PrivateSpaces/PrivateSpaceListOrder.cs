using ArcaneLink.DataBase._Data;
using ArcaneLink.DataBase.Constants;
using Microsoft.EntityFrameworkCore;

namespace ArcaneLink.Services.PrivateSpaces
{
    internal static class PrivateSpaceListOrder
    {
        internal static async Task<Dictionary<Guid, int>> GetNextTopPositionsAsync(
            AppDbContext db,
            IEnumerable<Guid> userIds,
            CancellationToken cancellationToken)
        {
            var requestedUserIds = userIds.Distinct().ToArray();
            if (requestedUserIds.Length == 0)
            {
                return [];
            }

            var minimumPositions = await db.PrivateSpaceMembers
                .Where(member =>
                    requestedUserIds.Contains(member.UserId) &&
                    member.StatusId == PrivateSpaceIds.MemberStatusActive &&
                    member.PrivateSpace.DeletedAt == null)
                .GroupBy(member => member.UserId)
                .Select(group => new
                {
                    UserId = group.Key,
                    Position = group.Min(member => member.ListPosition)
                })
                .ToDictionaryAsync(
                    item => item.UserId,
                    item => item.Position,
                    cancellationToken);

            var result = new Dictionary<Guid, int>(requestedUserIds.Length);
            foreach (var userId in requestedUserIds)
            {
                if (!minimumPositions.TryGetValue(userId, out var minimumPosition))
                {
                    result[userId] = 0;
                    continue;
                }

                if (minimumPosition > int.MinValue)
                {
                    result[userId] = minimumPosition - 1;
                    continue;
                }

                var memberships = await db.PrivateSpaceMembers
                    .Where(member =>
                        member.UserId == userId &&
                        member.StatusId == PrivateSpaceIds.MemberStatusActive &&
                        member.PrivateSpace.DeletedAt == null)
                    .OrderBy(member => member.ListPosition)
                    .ThenByDescending(member => member.PrivateSpace.UpdatedAt)
                    .ThenBy(member => member.SpaceId)
                    .ToListAsync(cancellationToken);
                for (var index = 0; index < memberships.Count; index++)
                {
                    memberships[index].ListPosition = index + 1;
                }

                result[userId] = 0;
            }

            return result;
        }
    }
}
