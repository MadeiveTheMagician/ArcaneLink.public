import { useEffect, useMemo, useState } from 'react';

import { ApiError, apiJson } from '../../../../shared/api/api';
import type { ServerInvitePreviewResponse } from '../../../../shared/types';
import { SystemIcon } from '../../../shared/icons/SystemIcon';
import {
  type ServerInviteMessageLink,
  findServerInviteMessageLinks
} from './serverInviteLinkModel';
import {
  getServerInviteRefreshDelayMs,
  resolveServerInviteClientExpiration,
  shouldRefreshServerInviteOnAttention
} from './serverInviteRefreshModel';

import styles from './ServerInviteMessageCards.module.css';

type ServerInviteMessageCardsProps = {
  body: string | null;
  accessToken: string;
  currentOrigin: string;
};

type ServerInviteMessageCardProps = {
  inviteLink: ServerInviteMessageLink;
  accessToken: string;
};

type PreviewState =
  | { status: 'loading' }
  | { status: 'loaded'; preview: ServerInvitePreviewResponse }
  | { status: 'missing' };

const countFormatter = new Intl.NumberFormat('ru-RU');

export function ServerInviteMessageCards({
  body,
  accessToken,
  currentOrigin
}: ServerInviteMessageCardsProps) {
  const inviteLinks = useMemo(
    () => findServerInviteMessageLinks(body, currentOrigin),
    [body, currentOrigin]
  );

  if (inviteLinks.length === 0) {
    return null;
  }

  return (
    <div className={styles.list} aria-label="Приглашения на серверы">
      {inviteLinks.map((inviteLink) => (
        <ServerInviteMessageCard
          key={inviteLink.code}
          inviteLink={inviteLink}
          accessToken={accessToken}
        />
      ))}
    </div>
  );
}

export function ServerInviteMessageCard({
  inviteLink,
  accessToken
}: ServerInviteMessageCardProps) {
  const [state, setState] = useState<PreviewState>({ status: 'loading' });

  useEffect(() => {
    let isDisposed = false;
    let refreshTimerId: number | null = null;
    let activeRequest: AbortController | null = null;
    let currentPreview: ServerInvitePreviewResponse | null = null;
    let hasLoadedPreview = false;
    let lastRequestedAtMs = 0;

    function clearRefreshTimer() {
      if (refreshTimerId !== null) {
        window.clearTimeout(refreshTimerId);
        refreshTimerId = null;
      }
    }

    function updateClientExpiration(nowMs: number) {
      if (!currentPreview) {
        return;
      }

      const effectivePreview = resolveServerInviteClientExpiration(
        currentPreview,
        nowMs
      );

      if (effectivePreview !== currentPreview) {
        currentPreview = effectivePreview;
        setState({ status: 'loaded', preview: effectivePreview });
      }
    }

    function scheduleRefresh(preview: ServerInvitePreviewResponse) {
      clearRefreshTimer();
      const delayMs = getServerInviteRefreshDelayMs(preview, Date.now());

      if (delayMs === null) {
        return;
      }

      refreshTimerId = window.setTimeout(() => {
        refreshTimerId = null;
        updateClientExpiration(Date.now());

        if (document.visibilityState === 'hidden') {
          if (currentPreview?.isActive) {
            scheduleRefresh(currentPreview);
          }

          return;
        }

        void refreshPreview();
      }, delayMs);
    }

    async function refreshPreview() {
      if (isDisposed || activeRequest) {
        return;
      }

      const request = new AbortController();
      activeRequest = request;
      lastRequestedAtMs = Date.now();

      try {
        const loadedPreview = await apiJson<ServerInvitePreviewResponse>(
          `/api/server-invites/${encodeURIComponent(inviteLink.code)}`,
          {
            accessToken,
            signal: request.signal
          }
        );

        if (isDisposed || activeRequest !== request) {
          return;
        }

        const preview = resolveServerInviteClientExpiration(
          loadedPreview,
          Date.now()
        );
        currentPreview = preview;
        hasLoadedPreview = true;
        setState({ status: 'loaded', preview });
        scheduleRefresh(preview);
      } catch (error) {
        if (isDisposed || request.signal.aborted) {
          return;
        }

        if (error instanceof ApiError && error.status === 404) {
          currentPreview = null;
          hasLoadedPreview = true;
          clearRefreshTimer();
          setState({ status: 'missing' });
          return;
        }

        if (!hasLoadedPreview) {
          setState({ status: 'missing' });
        } else if (currentPreview?.isActive) {
          scheduleRefresh(currentPreview);
        }
      } finally {
        if (activeRequest === request) {
          activeRequest = null;
        }
      }
    }

    function refreshOnAttention() {
      if (document.visibilityState === 'hidden') {
        return;
      }

      const nowMs = Date.now();
      updateClientExpiration(nowMs);

      if (
        shouldRefreshServerInviteOnAttention(
          currentPreview,
          lastRequestedAtMs,
          nowMs
        )
      ) {
        void refreshPreview();
      }
    }

    setState({ status: 'loading' });
    window.addEventListener('focus', refreshOnAttention);
    document.addEventListener('visibilitychange', refreshOnAttention);
    void refreshPreview();

    return () => {
      isDisposed = true;
      clearRefreshTimer();
      activeRequest?.abort();
      activeRequest = null;
      window.removeEventListener('focus', refreshOnAttention);
      document.removeEventListener('visibilitychange', refreshOnAttention);
    };
  }, [accessToken, inviteLink.code]);

  if (state.status === 'loading') {
    return <ServerInviteLoadingCard />;
  }

  if (state.status === 'missing' || !state.preview.isActive) {
    return (
      <ServerInviteInvalidCard
        reason={
          state.status === 'loaded' ? state.preview.invalidReason : 'not_found'
        }
      />
    );
  }

  return (
    <ServerInviteActiveCard inviteLink={inviteLink} preview={state.preview} />
  );
}

function ServerInviteActiveCard({
  inviteLink,
  preview
}: {
  inviteLink: ServerInviteMessageLink;
  preview: ServerInvitePreviewResponse;
}) {
  const serverTitle = preview.serverTitle?.trim() || 'Сервер ArcaneLink';
  const iconUrl = preview.serverIconAssetId
    ? `/api/assets/${preview.serverIconAssetId}/content`
    : null;

  return (
    <article className={`${styles.card} ${styles.activeCard}`}>
      <div className={styles.cardIntro}>Приглашение на сервер</div>
      <div className={styles.summary}>
        <div className={styles.serverBadge} aria-hidden="true">
          {iconUrl ? (
            <img
              src={iconUrl}
              alt=""
              style={{
                transform: `translate(${
                  -50 + preview.serverIconCropOffsetX * 100
                }%, ${
                  -50 + preview.serverIconCropOffsetY * 100
                }%) scale(${preview.serverIconCropZoom})`
              }}
            />
          ) : (
            serverTitle.slice(0, 1).toUpperCase()
          )}
        </div>

        <div className={styles.details}>
          <div className={styles.titleLine}>
            <strong>{serverTitle}</strong>
            <span className={styles.activeState}>
              <i aria-hidden="true" />
              Действительно
            </span>
          </div>
          <div className={styles.metrics}>
            <span>
              <i className={styles.onlineDot} aria-hidden="true" />
              {countFormatter.format(preview.onlineCount)} онлайн
            </span>
            <span>
              <SystemIcon name="friends" size="small" />
              {countFormatter.format(preview.memberCount)} участников
            </span>
          </div>
        </div>
      </div>

      <a className={styles.openLink} href={inviteLink.sourceUrl}>
        Открыть приглашение
        <SystemIcon name="chevron-right" size="small" />
      </a>
    </article>
  );
}

function ServerInviteInvalidCard({ reason }: { reason: string | null }) {
  return (
    <article className={`${styles.card} ${styles.invalidCard}`}>
      <div className={styles.invalidIntro}>Вы отправили приглашение, но</div>
      <div className={styles.invalidSummary}>
        <div className={styles.invalidBadge} aria-hidden="true">
          <SystemIcon name="mail" size="medium" />
        </div>
        <div className={styles.details}>
          <strong className={styles.invalidTitle}>
            Приглашение недействительно
          </strong>
          <span className={styles.invalidDescription}>
            {getInvalidInviteMessage(reason)}
          </span>
        </div>
      </div>
    </article>
  );
}

function ServerInviteLoadingCard() {
  return (
    <article
      className={`${styles.card} ${styles.loadingCard}`}
      aria-label="Загружается приглашение на сервер"
      aria-busy="true"
    >
      <div className={styles.loadingIntro} />
      <div className={styles.loadingSummary}>
        <div className={styles.loadingBadge} />
        <div className={styles.loadingLines}>
          <span />
          <span />
        </div>
      </div>
    </article>
  );
}

function getInvalidInviteMessage(reason: string | null) {
  if (reason === 'expired') {
    return 'Срок действия приглашения истёк';
  }

  if (reason === 'max_uses_reached') {
    return 'Лимит использований приглашения исчерпан';
  }

  if (reason === 'revoked') {
    return 'Приглашение было отозвано';
  }

  return 'Попробуйте отправить новое приглашение';
}
