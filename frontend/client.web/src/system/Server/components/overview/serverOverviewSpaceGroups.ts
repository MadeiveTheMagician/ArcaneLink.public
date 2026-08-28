import type { SpaceResponse } from '../../../../shared/types';

export type ServerOverviewSpaceNode = {
  space: SpaceResponse;
  children: ServerOverviewSpaceNode[];
};

export type ServerOverviewSpaceGroup =
  | {
      id: string;
      kind: 'category';
      node: ServerOverviewSpaceNode;
    }
  | {
      id: 'uncategorized';
      kind: 'uncategorized';
      spaces: SpaceResponse[];
    };

type OrderedGroup = ServerOverviewSpaceGroup & {
  position: number;
  title: string;
};

export function getServerOverviewSpaceGroups(
  spaces: SpaceResponse[],
  query: string
): ServerOverviewSpaceGroup[] {
  const normalizedQuery = query.trim().toLocaleLowerCase('ru-RU');
  const spaceById = new Map(spaces.map((space) => [space.id, space]));
  const childrenByParentId = new Map<string, SpaceResponse[]>();

  for (const space of spaces) {
    if (!space.parentSpaceId) {
      continue;
    }

    const children = childrenByParentId.get(space.parentSpaceId) ?? [];
    children.push(space);
    childrenByParentId.set(space.parentSpaceId, children);
  }

  for (const children of childrenByParentId.values()) {
    children.sort(compareSpaces);
  }

  const rootSpaces = spaces
    .filter((space) => !hasCategoryParent(space, spaceById))
    .sort(compareSpaces);
  const uncategorizedSpaces = rootSpaces
    .filter((space) => space.typeCode !== 'category')
    .filter((space) => spaceMatchesSearch(space, normalizedQuery));
  const groups: OrderedGroup[] = rootSpaces
    .filter((space) => space.typeCode === 'category')
    .filter((space) =>
      spaceMatchesSearchTree(
        space,
        childrenByParentId,
        normalizedQuery,
        new Set()
      )
    )
    .map((space) => ({
      id: `category:${space.id}`,
      kind: 'category' as const,
      node: buildVisibleNode(
        space,
        childrenByParentId,
        normalizedQuery,
        new Set()
      ),
      position: space.position,
      title: space.title
    }));

  if (uncategorizedSpaces.length > 0) {
    groups.push({
      id: 'uncategorized',
      kind: 'uncategorized',
      spaces: uncategorizedSpaces,
      position: Math.min(...uncategorizedSpaces.map((space) => space.position)),
      title: ''
    });
  }

  return groups
    .sort(
      (first, second) =>
        first.position - second.position ||
        first.title.localeCompare(second.title)
    )
    .map((group) =>
      group.kind === 'category'
        ? { id: group.id, kind: group.kind, node: group.node }
        : { id: group.id, kind: group.kind, spaces: group.spaces }
    );
}

function buildVisibleNode(
  space: SpaceResponse,
  childrenByParentId: ReadonlyMap<string, SpaceResponse[]>,
  query: string,
  ancestors: ReadonlySet<string>
): ServerOverviewSpaceNode {
  if (space.typeCode !== 'category' || ancestors.has(space.id)) {
    return { space, children: [] };
  }

  const nextAncestors = new Set(ancestors);
  nextAncestors.add(space.id);
  const children = (childrenByParentId.get(space.id) ?? [])
    .filter((child) =>
      spaceMatchesSearchTree(child, childrenByParentId, query, nextAncestors)
    )
    .map((child) =>
      buildVisibleNode(child, childrenByParentId, query, nextAncestors)
    );

  return { space, children };
}

function hasCategoryParent(
  space: SpaceResponse,
  spaceById: ReadonlyMap<string, SpaceResponse>
): boolean {
  if (!space.parentSpaceId) {
    return false;
  }

  return spaceById.get(space.parentSpaceId)?.typeCode === 'category';
}

function spaceMatchesSearchTree(
  space: SpaceResponse,
  childrenByParentId: ReadonlyMap<string, SpaceResponse[]>,
  query: string,
  ancestors: ReadonlySet<string>
): boolean {
  if (!query || spaceMatchesSearch(space, query)) {
    return true;
  }

  if (space.typeCode !== 'category' || ancestors.has(space.id)) {
    return false;
  }

  const nextAncestors = new Set(ancestors);
  nextAncestors.add(space.id);

  return (childrenByParentId.get(space.id) ?? []).some((child) =>
    spaceMatchesSearchTree(child, childrenByParentId, query, nextAncestors)
  );
}

function spaceMatchesSearch(space: SpaceResponse, query: string): boolean {
  if (!query) {
    return true;
  }

  return [space.title, space.description ?? '', space.typeCode].some((value) =>
    value.toLocaleLowerCase('ru-RU').includes(query)
  );
}

function compareSpaces(first: SpaceResponse, second: SpaceResponse): number {
  return (
    first.position - second.position || first.title.localeCompare(second.title)
  );
}
