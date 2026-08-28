import { useEffect, useState } from 'react';

import { apiJson } from '../../shared/api/api';
import type {
  ServerInvitePreviewResponse,
  ServerMemberResponse
} from '../../shared/types';
import { invitePageCopy } from './InvitePage.copy';

import styles from './InvitePage.module.css';

type InvitePageProps = {
  code: string;
  accessToken: string;
  onAccepted: (membership: ServerMemberResponse) => void;
  onDeclined: () => void;
};

function formatCount(value: number) {
  return new Intl.NumberFormat('ru-RU').format(value);
}

function getInvalidText(reason: string | null) {
  if (reason === 'expired') {
    return invitePageCopy.errors.expired;
  }

  if (reason === 'max_uses_reached') {
    return invitePageCopy.errors.maxUsesReached;
  }

  if (reason === 'revoked') {
    return invitePageCopy.errors.revoked;
  }

  return invitePageCopy.errors.invalid;
}

export function InvitePage({
  code,
  accessToken,
  onAccepted,
  onDeclined
}: InvitePageProps) {
  const [preview, setPreview] = useState<ServerInvitePreviewResponse | null>(
    null
  );
  const [isLoading, setIsLoading] = useState(true);
  const [isAccepting, setIsAccepting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    apiJson<ServerInvitePreviewResponse>(`/api/server-invites/${code}`, {
      accessToken
    })
      .then((invitePreview) => {
        if (isMounted) {
          setPreview(invitePreview);
          setMessage(null);
        }
      })
      .catch((error) => {
        if (isMounted) {
          setPreview(null);
          setMessage(
            error instanceof Error
              ? error.message
              : invitePageCopy.errors.invalid
          );
        }
      })
      .finally(() => {
        if (isMounted) {
          setIsLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [accessToken, code]);

  async function acceptInvite() {
    if (!preview?.isActive) {
      return;
    }

    setIsAccepting(true);
    setMessage(null);

    try {
      const membership = await apiJson<ServerMemberResponse>(
        '/api/server-invites/accept',
        {
          method: 'POST',
          accessToken,
          body: { code }
        }
      );
      onAccepted(membership);
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : invitePageCopy.errors.acceptFailed
      );
    } finally {
      setIsAccepting(false);
    }
  }

  const isInvalid = !isLoading && (!preview || !preview.isActive);
  const activePreview = preview?.isActive ? preview : null;
  const title =
    activePreview?.serverTitle ?? preview?.serverTitle ?? 'ArcaneLink';
  const iconUrl = activePreview?.serverIconAssetId
    ? `/api/assets/${activePreview.serverIconAssetId}/content`
    : null;

  return (
    <main className={styles.page}>
      <section className={styles.invitationCard} aria-live="polite">
        {isLoading ? (
          <div className={styles.loading}>
            <img src="/brand/logo-mark.svg" alt="" />
            <span>{invitePageCopy.loading}</span>
          </div>
        ) : isInvalid ? (
          <>
            <div className={styles.invalidMark}>!</div>
            <span className={styles.eyebrow}>
              {invitePageCopy.state.unavailable}
            </span>
            <h1>{invitePageCopy.state.invalidTitle}</h1>
            <p>{getInvalidText(preview?.invalidReason ?? null)}</p>
            {message && <small>{message}</small>}
            <button type="button" onClick={onDeclined}>
              {invitePageCopy.actions.returnBack}
            </button>
          </>
        ) : (
          activePreview && (
            <>
              <div className={styles.invitationSummary}>
                <div className={styles.serverAvatar}>
                  {iconUrl ? (
                    <img
                      src={iconUrl}
                      alt=""
                      style={{
                        transform: `translate(${
                          -50 + activePreview.serverIconCropOffsetX * 100
                        }%, ${
                          -50 + activePreview.serverIconCropOffsetY * 100
                        }%) scale(${activePreview.serverIconCropZoom})`
                      }}
                    />
                  ) : (
                    title.slice(0, 1).toUpperCase()
                  )}
                </div>
                <div className={styles.serverDetails}>
                  <span className={styles.eyebrow}>
                    {invitePageCopy.labels.invitedToServer}
                  </span>
                  <h1>{title}</h1>
                  <div className={styles.stats}>
                    <span>
                      <i className={styles.isOnline} />{' '}
                      {formatCount(activePreview.onlineCount)}{' '}
                      {invitePageCopy.labels.online}
                    </span>
                    <span>
                      ♟ {formatCount(activePreview.memberCount)}{' '}
                      {invitePageCopy.labels.members}
                    </span>
                  </div>
                </div>
              </div>

              {activePreview.expiresAt && (
                <p className={styles.meta}>
                  {invitePageCopy.labels.linkExpiresAt}{' '}
                  {new Intl.DateTimeFormat('ru-RU', {
                    day: '2-digit',
                    month: 'long',
                    year: 'numeric'
                  }).format(new Date(activePreview.expiresAt))}
                  .
                </p>
              )}
              {message && <p className={styles.error}>{message}</p>}

              <div className={styles.actions}>
                <button
                  className={styles.accept}
                  type="button"
                  onClick={() => void acceptInvite()}
                  disabled={isAccepting}
                >
                  {isAccepting
                    ? invitePageCopy.actions.accepting
                    : invitePageCopy.actions.accept}
                </button>
                <button
                  type="button"
                  onClick={onDeclined}
                  disabled={isAccepting}
                >
                  {invitePageCopy.actions.decline}
                </button>
              </div>
            </>
          )
        )}
      </section>
    </main>
  );
}
