import type {
  FriendUserResponse,
  PrivateSpaceResponse,
} from '../../../../shared/types'
import { getPrivateSpaceViewerAvatar } from '../private-space/privateSpaceAvatarModel'
import { getPrivateSpaceOtherMember } from './directMessageModel'

export function PrivateSpaceAvatar({
  className,
  space,
  currentUserId,
  title,
}: {
  className: string
  space: PrivateSpaceResponse
  currentUserId: string
  title: string
}) {
  const otherMember = getPrivateSpaceOtherMember(space, currentUserId)
  const viewerAvatar = getPrivateSpaceViewerAvatar(space)

  if (viewerAvatar) {
    return (
      <AssetAvatar
        className={className}
        assetId={viewerAvatar.assetId}
        cropOffsetX={viewerAvatar.cropOffsetX}
        cropOffsetY={viewerAvatar.cropOffsetY}
        cropZoom={viewerAvatar.cropZoom}
        title={title}
      />
    )
  }

  if (space.kind === 'direct' && otherMember) {
    return (
      <UserAvatar
        className={className}
        user={otherMember.user}
        title={otherMember.user.displayName}
      />
    )
  }

  if (space.kind === 'group' && space.avatarAssetId) {
    return (
      <AssetAvatar
        className={className}
        assetId={space.avatarAssetId}
        cropOffsetX={space.avatarCropOffsetX}
        cropOffsetY={space.avatarCropOffsetY}
        cropZoom={space.avatarCropZoom}
        title={title}
      />
    )
  }

  return <UserAvatar className={className} title={title} />
}

function AssetAvatar({
  className,
  assetId,
  cropOffsetX,
  cropOffsetY,
  cropZoom,
  title,
}: {
  className: string
  assetId: string
  cropOffsetX: number
  cropOffsetY: number
  cropZoom: number
  title: string
}) {
  return (
    <span className={`${className} ui-frame`} aria-hidden="true">
      <img
        className="ui-media-fit"
        src={`/api/assets/${assetId}/content`}
        alt=""
        draggable={false}
        style={{
          transform: `translate(${cropOffsetX * 100}%, ${
            cropOffsetY * 100
          }%) scale(${cropZoom})`,
        }}
      />
      <span className="sr-only">{title}</span>
    </span>
  )
}

export function UserAvatar({
  className,
  user,
  title,
}: {
  className: string
  user?: Pick<
    FriendUserResponse,
    | 'avatarAssetId'
    | 'avatarCropOffsetX'
    | 'avatarCropOffsetY'
    | 'avatarCropZoom'
  >
  title: string
}) {
  const avatarUrl = user?.avatarAssetId
    ? `/api/assets/${user.avatarAssetId}/content`
    : null

  return (
    <span
      className={`${className} ui-frame`}
      aria-hidden="true"
    >
      {avatarUrl ? (
        <img
          className="ui-media-fit"
          src={avatarUrl}
          alt=""
          draggable={false}
          style={{
            transform: `translate(${(user?.avatarCropOffsetX ?? 0) * 100}%, ${
              (user?.avatarCropOffsetY ?? 0) * 100
            }%) scale(${user?.avatarCropZoom ?? 1})`,
          }}
        />
      ) : (
        title.slice(0, 1).toUpperCase()
      )}
    </span>
  )
}
