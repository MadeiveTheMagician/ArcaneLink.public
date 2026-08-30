using ArcaneLink.DataBase.Constants;
using ArcaneLink.DataBase.Models.SpacesModels;

namespace ArcaneLink.Services.Spaces;

internal static class SpaceTreeUtility
{
    public const int MaxCategoryDepth = 3;

    public static IReadOnlyList<Space> CollectSpaceTree(
        IReadOnlyList<Space> spaces,
        Guid rootId)
    {
        var result = new List<Space>();
        var queue = new Queue<Guid>();
        queue.Enqueue(rootId);

        while (queue.Count > 0)
        {
            var currentId = queue.Dequeue();
            var current = spaces.FirstOrDefault(x => x.Id == currentId);

            if (current == null || result.Any(x => x.Id == current.Id))
            {
                continue;
            }

            result.Add(current);

            foreach (var child in spaces.Where(x => x.ParentSpaceId == current.Id))
            {
                queue.Enqueue(child.Id);
            }
        }

        return result;
    }

    public static bool IsValidHierarchy(
        Space space,
        Guid? parentSpaceId,
        IReadOnlyList<Space> allSpaces)
    {
        return IsValidHierarchy(space, parentSpaceId, allSpaces, space.Id);
    }

    public static bool IsValidHierarchy(
        Space space,
        Guid? parentSpaceId,
        IReadOnlyList<Space> allSpaces,
        Guid? movingSpaceId)
    {
        if (space.TypeId == SpaceIds.TypeCategory)
        {
            return IsValidCategoryParent(parentSpaceId, allSpaces, movingSpaceId);
        }

        return parentSpaceId == null ||
               allSpaces.Any(x =>
                   x.Id == parentSpaceId &&
                   x.TypeId == SpaceIds.TypeCategory);
    }

    public static bool IsDescendant(
        Guid possibleDescendantId,
        Guid ancestorId,
        IReadOnlyList<Space> allSpaces)
    {
        var current = allSpaces.FirstOrDefault(x => x.Id == possibleDescendantId);
        var visited = new HashSet<Guid>();

        while (current?.ParentSpaceId != null)
        {
            if (!visited.Add(current.Id))
            {
                return true;
            }

            if (current.ParentSpaceId.Value == ancestorId)
            {
                return true;
            }

            current = allSpaces.FirstOrDefault(x => x.Id == current.ParentSpaceId.Value);
        }

        return false;
    }

    private static bool IsValidCategoryParent(
        Guid? parentSpaceId,
        IReadOnlyList<Space> allSpaces,
        Guid? movingSpaceId)
    {
        var subtreeHeight = movingSpaceId.HasValue
            ? GetCategorySubtreeHeight(movingSpaceId.Value, allSpaces)
            : 1;
        if (subtreeHeight > MaxCategoryDepth)
        {
            return false;
        }

        if (parentSpaceId == null)
        {
            return subtreeHeight <= MaxCategoryDepth;
        }

        var parent = allSpaces.FirstOrDefault(x =>
            x.Id == parentSpaceId &&
            x.TypeId == SpaceIds.TypeCategory);

        if (parent == null)
        {
            return false;
        }

        if (movingSpaceId != null &&
            (parent.Id == movingSpaceId.Value ||
             IsDescendant(parent.Id, movingSpaceId.Value, allSpaces)))
        {
            return false;
        }

        return GetCategoryDepth(parent, allSpaces) + subtreeHeight <=
               MaxCategoryDepth;
    }

    private static int GetCategorySubtreeHeight(
        Guid rootId,
        IReadOnlyList<Space> allSpaces)
    {
        var categoryChildren = allSpaces
            .Where(space => space.TypeId == SpaceIds.TypeCategory &&
                            space.ParentSpaceId.HasValue)
            .GroupBy(space => space.ParentSpaceId!.Value)
            .ToDictionary(group => group.Key, group => group.ToList());
        var memoizedHeights = new Dictionary<Guid, int>();
        var visiting = new HashSet<Guid>();

        return GetCategorySubtreeHeight(
            rootId,
            categoryChildren,
            memoizedHeights,
            visiting);
    }

    private static int GetCategorySubtreeHeight(
        Guid categoryId,
        IReadOnlyDictionary<Guid, List<Space>> categoryChildren,
        IDictionary<Guid, int> memoizedHeights,
        ISet<Guid> visiting)
    {
        if (memoizedHeights.TryGetValue(categoryId, out var cachedHeight))
        {
            return cachedHeight;
        }

        if (!visiting.Add(categoryId))
        {
            return MaxCategoryDepth + 1;
        }

        var height = 1;
        foreach (var child in categoryChildren.GetValueOrDefault(categoryId) ?? [])
        {
            var childHeight = GetCategorySubtreeHeight(
                child.Id,
                categoryChildren,
                memoizedHeights,
                visiting);
            height = Math.Max(height, childHeight + 1);
            if (height > MaxCategoryDepth)
            {
                break;
            }
        }

        visiting.Remove(categoryId);
        memoizedHeights[categoryId] = height;
        return height;
    }

    private static int GetCategoryDepth(
        Space category,
        IReadOnlyList<Space> allSpaces)
    {
        var depth = 1;
        var current = category;
        var visited = new HashSet<Guid> { category.Id };

        while (current.ParentSpaceId != null)
        {
            current = allSpaces.FirstOrDefault(x => x.Id == current.ParentSpaceId.Value);

            if (current == null || current.TypeId != SpaceIds.TypeCategory)
            {
                break;
            }

            if (!visited.Add(current.Id))
            {
                return MaxCategoryDepth;
            }

            depth++;
        }

        return depth;
    }
}
