import { useState } from 'react'
import type { ServerMemberResponse, SpaceResponse } from '../../../../shared/types'
import { serverCopy } from '../../../shared'
import styles from './ServerOverview.module.css'
export function ServerOverview({
  server,
  memberCount,
  roleCount,
  spaces,
}: {
  server: ServerMemberResponse['server']
  memberCount: number
  roleCount: number | null
  spaces: SpaceResponse[]
}) {
  const [spaceSearchQuery, setSpaceSearchQuery] = useState('')
  const normalizedQuery = spaceSearchQuery.trim().toLocaleLowerCase('ru-RU')
  const rootSpaces = spaces
    .filter((space) => !space.parentSpaceId)
    .sort(compareSpaces)
    .filter((space) => spaceMatchesSearchTree(space, spaces, normalizedQuery))
  const categoryCount = spaces.filter((space) => space.typeCode === 'category').length
  const textSpaceCount = spaces.filter((space) => space.typeCode === 'text_room').length
  const voiceSpaceCount = spaces.filter((space) => space.typeCode === 'voice_room').length
  const defaultTextSpace = server.defaultTextSpaceId
    ? spaces.find((space) => space.id === server.defaultTextSpaceId)
    : null

  return (
    <div className={styles.overview}>
      <section className={styles.serverSummary}>
        <span className={`${styles.serverIcon} ui-frame`}>
          {server.iconAssetId ? (
            <img
              className="ui-media-fit"
              src={`/api/assets/${server.iconAssetId}/content`}
              alt=""
              style={{
                transform: `translate(${server.iconCropOffsetX * 100}%, ${
                  server.iconCropOffsetY * 100
                }%) scale(${server.iconCropZoom})`,
              }}
            />
          ) : (
            server.title.slice(0, 1).toUpperCase()
          )}
        </span>
        <div>
          <span>{serverCopy.overview.serverOverview}</span>
          <h1>{server.title}</h1>
          <p>
            {server.description ||
              serverCopy.overview.defaultDescription}
          </p>
        </div>
        <dl>
          <div>
            <dt>{memberCount}</dt>
            <dd>{serverCopy.overview.members}</dd>
          </div>
          <div>
            <dt>{roleCount ?? '—'}</dt>
            <dd>
              {roleCount == null
                ? serverCopy.overview.hiddenRoles
                : serverCopy.overview.roles}
            </dd>
          </div>
          <div>
            <dt>{spaces.length}</dt>
            <dd>{serverCopy.overview.spaces}</dd>
          </div>
        </dl>
      </section>

      <section className={styles.spaceDirectory}>
        <header>
          <div>
            <span>{serverCopy.overview.browserKicker}</span>
            <h2>{serverCopy.overview.browserTitle}</h2>
            <p>{serverCopy.overview.browserDescription}</p>
          </div>
          <span className={styles.defaultSpaceBadge}>
            {defaultTextSpace
              ? serverCopy.overview.startSpace(defaultTextSpace.title)
              : serverCopy.overview.defaultStartSpace}
          </span>
        </header>

        <label className={styles.spaceSearch}>
          <span aria-hidden="true">⌕</span>
          <input
            name="spaceSearch"
            value={spaceSearchQuery}
            onChange={(event) => setSpaceSearchQuery(event.target.value)}
            placeholder={serverCopy.overview.searchPlaceholder}
          />
        </label>

        <div className={styles.spaceStats}>
          <span>{serverCopy.overview.categoriesCount(categoryCount)}</span>
          <span>{serverCopy.overview.textSpacesCount(textSpaceCount)}</span>
          <span>{serverCopy.overview.voiceSpacesCount(voiceSpaceCount)}</span>
        </div>

        <div className={styles.spaceOverviewList}>
          {rootSpaces.length > 0 ? (
            rootSpaces.map((space) => (
              <SpaceOverviewNode
                key={space.id}
                depth={0}
                space={space}
                spaces={spaces}
                defaultTextSpaceId={server.defaultTextSpaceId}
                query={normalizedQuery}
              />
            ))
          ) : (
            <p>
              {spaces.length === 0
                ? serverCopy.overview.noSpaces
                : serverCopy.overview.noSearchResults}
            </p>
          )}
        </div>
      </section>
    </div>
  )
}

function SpaceOverviewNode({
  depth,
  space,
  spaces,
  defaultTextSpaceId,
  query,
}: {
  depth: number
  space: SpaceResponse
  spaces: SpaceResponse[]
  defaultTextSpaceId: string | null
  query: string
}) {
  if (space.typeCode === 'category') {
    const children = spaces
      .filter((item) => item.parentSpaceId === space.id)
      .sort(compareSpaces)
      .filter((item) => spaceMatchesSearchTree(item, spaces, query))

    return (
      <section className={styles.spaceOverviewCategory} data-depth={depth}>
        <header>
          <span aria-hidden="true">▾</span>
          <div>
            <h3>{space.title}</h3>
            <small>
              {serverCopy.overview.nestedCount(
                children.length,
                space.description || serverCopy.overview.categoryDescription,
              )}
            </small>
          </div>
          <em>category</em>
        </header>
        <div>
          {children.map((child) => (
            <SpaceOverviewNode
              key={child.id}
              depth={depth + 1}
              space={child}
              spaces={spaces}
              defaultTextSpaceId={defaultTextSpaceId}
              query={query}
            />
          ))}
        </div>
      </section>
    )
  }

  const isDefaultTextSpace = space.id === defaultTextSpaceId
  const isVoice = space.typeCode === 'voice_room'

  return (
    <article className={styles.spaceOverviewRow} data-depth={depth}>
      <span aria-hidden="true">{isVoice ? '◖' : '#'}</span>
      <div>
        <strong>{space.title}</strong>
        <small>
          {space.description ||
            (isVoice
              ? serverCopy.overview.voiceSpaceDescription
              : serverCopy.overview.textSpaceDescription)}
        </small>
      </div>
      <em className={isDefaultTextSpace ? styles.spaceOverviewStartBadge : ''}>
        {isDefaultTextSpace ? 'start' : isVoice ? 'voice' : 'text'}
      </em>
    </article>
  )
}

function compareSpaces(first: SpaceResponse, second: SpaceResponse) {
  return first.position - second.position || first.title.localeCompare(second.title)
}

function spaceMatchesSearchTree(
  space: SpaceResponse,
  spaces: SpaceResponse[],
  query: string,
): boolean {
  if (!query) {
    return true
  }

  if (spaceMatchesSearch(space, query)) {
    return true
  }

  if (space.typeCode !== 'category') {
    return false
  }

  return spaces
    .filter((item) => item.parentSpaceId === space.id)
    .some((child) => spaceMatchesSearchTree(child, spaces, query))
}

function spaceMatchesSearch(space: SpaceResponse, query: string): boolean {
  return [space.title, space.description ?? '', space.typeCode]
    .some((value) => value.toLocaleLowerCase('ru-RU').includes(query))
}

