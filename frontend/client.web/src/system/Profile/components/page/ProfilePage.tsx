import { useEffect, useRef, useState } from 'react';
import type { CSSProperties, RefObject, SyntheticEvent } from 'react';

import type {
  OwnUserProfileResponse,
  UserResponse
} from '../../../../shared/types';
import { AssetPreviewOverlay } from '../../../shared/components/asset-preview/AssetPreviewOverlay';
import { SystemIcon } from '../../../shared/icons/SystemIcon';
import { profileCopy } from '../../../shared/index';
import { SystemPopover } from '../../../shared/ui/SystemPopover';
import {
  fallbackAvatarAccent,
  toAvatarAccent
} from '../../../shared/utils/avatarAccent';

import styles from './ProfilePage.module.css';

const showcaseRunes = ['A', 'R', 'C', 'A', 'N', 'E', 'L', 'I', 'N', 'K'];

type ProfilePageProps = {
  user: UserResponse;
  publicProfile: OwnUserProfileResponse;
  avatarSrc: string;
  avatarStyle: CSSProperties;
  isAvatarDraftActive: boolean;
  isAvatarMenuOpen: boolean;
  fileInputRef: RefObject<HTMLInputElement | null>;
  onToggleAvatarMenu: () => void;
  onCloseAvatarMenu: () => void;
  onOpenAvatarPicker: () => void;
  onShowAvatarLibrary: () => void;
  onSelectAvatarFile: (file: File | undefined) => void;
  onMarkBrokenAvatar: (url: string) => void;
  formatDate: (value: string) => string;
};

export function ProfilePage({
  user,
  publicProfile,
  avatarSrc,
  avatarStyle,
  isAvatarDraftActive,
  isAvatarMenuOpen,
  fileInputRef,
  onToggleAvatarMenu,
  onCloseAvatarMenu,
  onOpenAvatarPicker,
  onShowAvatarLibrary,
  onSelectAvatarFile,
  onMarkBrokenAvatar
}: ProfilePageProps) {
  const bio = publicProfile.bio || profileCopy.bio.default;
  const subscriptionType =
    publicProfile.subscriptionType ?? user.subscriptionType;
  const [avatarAccent, setAvatarAccent] = useState(fallbackAvatarAccent);
  const [isAvatarPreviewOpen, setIsAvatarPreviewOpen] = useState(false);
  const avatarMenuRef = useRef<HTMLDivElement | null>(null);
  const avatarOriginalSrc = publicProfile.avatarSourceAssetId
    ? `/api/assets/${publicProfile.avatarSourceAssetId}/content`
    : avatarSrc;

  useEffect(() => {
    if (!isAvatarMenuOpen) return undefined;

    function closeFromOutside(event: PointerEvent) {
      if (
        event.target instanceof Node &&
        avatarMenuRef.current?.contains(event.target)
      ) {
        return;
      }

      onCloseAvatarMenu();
    }

    function closeFromKeyboard(event: KeyboardEvent) {
      if (event.key === 'Escape') onCloseAvatarMenu();
    }

    document.addEventListener('pointerdown', closeFromOutside, true);
    window.addEventListener('keydown', closeFromKeyboard);

    return () => {
      document.removeEventListener('pointerdown', closeFromOutside, true);
      window.removeEventListener('keydown', closeFromKeyboard);
    };
  }, [isAvatarMenuOpen, onCloseAvatarMenu]);

  function handleAvatarLoad(event: SyntheticEvent<HTMLImageElement>) {
    try {
      setAvatarAccent(toAvatarAccent(event.currentTarget));
    } catch {
      setAvatarAccent(fallbackAvatarAccent);
    }
  }

  return (
    <section className={styles.profileCard}>
      <div className={styles.profileSummary}>
        <div className={styles.avatarMenuWrap} ref={avatarMenuRef}>
          <button
            className={styles.avatarAction}
            type="button"
            onClick={onToggleAvatarMenu}
            aria-label={profileCopy.labels.avatarMenu}
            style={
              {
                '--profile-avatar-accent': avatarAccent,
                '--profile-avatar-glow-image': `url("${avatarSrc}")`
              } as CSSProperties
            }
          >
            <span className={styles.avatarViewport}>
              <img
                className={`${styles.avatar} ui-media-fit`}
                src={avatarSrc}
                alt=""
                style={isAvatarDraftActive ? undefined : avatarStyle}
                onLoad={handleAvatarLoad}
                onError={() => onMarkBrokenAvatar(avatarSrc)}
              />
            </span>
          </button>
          {isAvatarMenuOpen && (
            <SystemPopover className={styles.avatarContext}>
              <button
                className={styles.avatarContextRow}
                type="button"
                onClick={() => {
                  onCloseAvatarMenu();
                  setIsAvatarPreviewOpen(true);
                }}
              >
                <SystemIcon name="eye" size={18} />
                <span>{profileCopy.actions.openAvatarOriginal}</span>
              </button>
              <button
                className={styles.avatarContextRow}
                type="button"
                onClick={onOpenAvatarPicker}
              >
                <SystemIcon name="plus" size={18} />
                <span>{profileCopy.actions.uploadAvatar}</span>
              </button>
              <button
                className={styles.avatarContextRow}
                type="button"
                onClick={onShowAvatarLibrary}
              >
                <SystemIcon name="folder" size={18} />
                <span>{profileCopy.actions.chooseSavedAvatar}</span>
              </button>
            </SystemPopover>
          )}
        </div>
        <input
          ref={fileInputRef}
          className={styles.fileInput}
          name="profileAvatar"
          type="file"
          accept="image/*"
          onChange={(event) => onSelectAvatarFile(event.target.files?.[0])}
        />

        <div className={styles.profileIdentity}>
          <h1>{publicProfile.displayName || user.displayName}</h1>
          <span className={styles.profileMeta}>
            <span>@{user.login}</span>
            <em>{subscriptionType.title}</em>
          </span>
          <p>{bio}</p>
        </div>
      </div>

      <div
        className={styles.profileBanner}
        style={
          publicProfile.bannerAssetId
            ? {
                backgroundImage: `url(/api/assets/${publicProfile.bannerAssetId}/content)`
              }
            : undefined
        }
        aria-hidden={true}
      />

      <div className={styles.profileSections}>
        <section className={styles.profileSection}>
          <header>
            <h2>{profileCopy.labels.stampShowcase}</h2>
          </header>
          <div className={styles.runeGrid}>
            {showcaseRunes.map((rune, index) => (
              <span key={`${rune}-${index}`}>{rune}</span>
            ))}
            <span className={styles.locked}>{profileCopy.state.locked}</span>
            <span className={styles.locked}>{profileCopy.state.locked}</span>
          </div>
        </section>

        <section className={`${styles.profileSection} ${styles.aboutSection}`}>
          <header>
            <h2>{profileCopy.labels.about}</h2>
          </header>
          <p>{bio}</p>
          <dl className={styles.profileFacts}>
            <div>
              <dt>{profileCopy.labels.email}</dt>
              <dd>{user.email}</dd>
            </div>
            <div>
              <dt>{profileCopy.labels.subscription}</dt>
              <dd>{subscriptionType.title}</dd>
            </div>
            <div>
              <dt>{profileCopy.labels.site}</dt>
              <dd>
                {publicProfile.websiteUrl || profileCopy.state.siteMissing}
              </dd>
            </div>
          </dl>
        </section>

        <section className={`${styles.profileSection} ${styles.emptyActivity}`}>
          <header>
            <h2>{profileCopy.labels.activity}</h2>
          </header>
          <div>
            <strong>{profileCopy.state.noActivity}</strong>
            <p>{profileCopy.state.activityEmptyDescription}</p>
          </div>
        </section>
      </div>
      {isAvatarPreviewOpen && (
        <AssetPreviewOverlay
          asset={{
            url: avatarOriginalSrc,
            title: publicProfile.displayName || user.displayName,
            createdAt: publicProfile.createdAt
          }}
          author={{
            displayName: publicProfile.displayName || user.displayName,
            avatarUrl: avatarSrc,
            avatarCropOffsetX: publicProfile.avatarCropOffsetX,
            avatarCropOffsetY: publicProfile.avatarCropOffsetY,
            avatarCropZoom: publicProfile.avatarCropZoom
          }}
          onClose={() => setIsAvatarPreviewOpen(false)}
        />
      )}
    </section>
  );
}
