import { useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import type { ServerMemberResponse, SpaceResponse } from '../../../../shared/types'
import { serverCopy, SystemIcon } from '../../../shared'
import styles from './ServerOverview.module.css'
import {
  getServerOverviewSpaceGroups,
  type ServerOverviewSpaceNode,
} from './serverOverviewSpaceGroups'
export function ServerOverview({
  server,
  memberCount,
  roleCount,
  spaces,
  headerActions,
}: {
  server: ServerMemberResponse['server']
  memberCount: number
  roleCount: number | null
  spaces: SpaceResponse[]
  headerActions?: ReactNode
}) {
  const [spaceSearchQuery, setSpaceSearchQuery] = useState('')
  const normalizedQuery = spaceSearchQuery.trim().toLocaleLowerCase('ru-RU')
  const spaceGroups = useMemo(
    () => getServerOverviewSpaceGroups(spaces, normalizedQuery),
    [normalizedQuery, spaces],
  )
  const categoryCount = spaces.filter((space) => space.typeCode === 'category').length
  const textSpaceCount = spaces.filter((space) => space.typeCode === 'text_room').length
  const voiceSpaceCount = spaces.filter((space) => space.typeCode === 'voice_room').length
  const defaultTextSpace = server.defaultTextSpaceId
    ? spaces.find((space) => space.id === server.defaultTextSpaceId)
    : null

  return (
    <section className={styles.overviewSurface}>
      <header className={styles.workspaceHeader}>
        <div className={styles.workspaceHeaderTitle}>
          <span className={styles.workspaceHeaderIcon} aria-hidden="true">
            <SystemIcon name="server" size={18} />
          </span>
          <strong>
            {serverCopy.overview.serverOverview} {server.title}
          </strong>
        </div>
        {headerActions ? (
          <div className={styles.workspaceHeaderActions}>{headerActions}</div>
        ) : null}
      </header>

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
              {server.description || serverCopy.overview.defaultDescription}
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
            {spaceGroups.length > 0 ? (
              spaceGroups.map((group) =>
                group.kind === 'category' ? (
                  <SpaceOverviewNode
                    key={group.id}
                    depth={0}
                    node={group.node}
                    defaultTextSpaceId={server.defaultTextSpaceId}
                  />
                ) : (
                  <section
                    className={`${styles.spaceOverviewCategory} ${styles.spaceOverviewUncategorized}`}
                    key={group.id}
                  >
                    <SpaceOverviewGroupHeader
                      title={serverCopy.overview.uncategorizedTitle}
                      summary={serverCopy.overview.groupSummary(
                        group.spaces.length,
                        serverCopy.overview.uncategorizedDescription,
                      )}
                      badge={serverCopy.overview.uncategorizedBadge}
                    />
                    <div className={styles.spaceOverviewChildren}>
                      {group.spaces.map((space) => (
                        <SpaceOverviewRow
                          key={space.id}
                          depth={0}
                          space={space}
                          defaultTextSpaceId={server.defaultTextSpaceId}
                        />
                      ))}
                    </div>
                  </section>
                ),
              )
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
    </section>
  )
}

function SpaceOverviewNode({
  depth,
  node,
  defaultTextSpaceId,
}: {
  depth: number
  node: ServerOverviewSpaceNode
  defaultTextSpaceId: string | null
}) {
  const { space, children } = node

  if (space.typeCode === 'category') {
    return (
      <section className={styles.spaceOverviewCategory} data-depth={depth}>
        <SpaceOverviewGroupHeader
          title={space.title}
          summary={serverCopy.overview.groupSummary(
            children.length,
            space.description || serverCopy.overview.categoryDescription,
          )}
          badge="category"
        />
        <div className={styles.spaceOverviewChildren}>
          {children.map((child) => (
            <SpaceOverviewNode
              key={child.space.id}
              depth={depth + 1}
              node={child}
              defaultTextSpaceId={defaultTextSpaceId}
            />
          ))}
        </div>
      </section>
    )
  }

  return (
    <SpaceOverviewRow
      depth={depth}
      space={space}
      defaultTextSpaceId={defaultTextSpaceId}
    />
  )
}

function SpaceOverviewGroupHeader({
  title,
  summary,
  badge,
}: {
  title: string
  summary: string
  badge: string
}) {
  return (
    <header>
      <span aria-hidden="true">▾</span>
      <div>
        <h3>{title}</h3>
        <small>{summary}</small>
      </div>
      <em>{badge}</em>
    </header>
  )
}

function SpaceOverviewRow({
  depth,
  space,
  defaultTextSpaceId,
}: {
  depth: number
  space: SpaceResponse
  defaultTextSpaceId: string | null
}) {
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

