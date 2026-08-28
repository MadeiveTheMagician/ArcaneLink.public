import { useEffect, useMemo, useState } from 'react';

import { apiJson, apiNoContent } from '../../../../shared/api/api';
import type { UserDeviceSessionResponse } from '../../../../shared/types';
import { settingsCopy } from '../../../shared/copy/index';
import {
  getOtherAccountSessions,
  isAccountSessionCurrent,
  sortAccountSessions
} from './accountSessionModel';

type UseAccountSessionsOptions = {
  accessToken: string;
  currentDeviceSessionId?: string | null;
};

export function useAccountSessions({
  accessToken,
  currentDeviceSessionId
}: UseAccountSessionsOptions) {
  const [sessions, setSessions] = useState<UserDeviceSessionResponse[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [loadVersion, setLoadVersion] = useState(0);
  const [revokingSessionId, setRevokingSessionId] = useState<string | null>(
    null
  );
  const [isRevokingOthers, setIsRevokingOthers] = useState(false);
  const [isRevokingAll, setIsRevokingAll] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    let isDisposed = false;
    const abortController = new AbortController();

    async function loadSessions() {
      setIsLoading(true);
      setError(null);

      try {
        const data = await apiJson<UserDeviceSessionResponse[]>(
          '/api/auth/sessions',
          { accessToken, signal: abortController.signal }
        );

        if (!isDisposed) {
          if (!Array.isArray(data)) {
            throw new Error(settingsCopy.errors.loadSessions);
          }

          setSessions(data);
        }
      } catch {
        if (!isDisposed && !abortController.signal.aborted) {
          setError(settingsCopy.errors.loadSessions);
        }
      } finally {
        if (!isDisposed) {
          setIsLoading(false);
        }
      }
    }

    void loadSessions();

    return () => {
      isDisposed = true;
      abortController.abort();
    };
  }, [accessToken, isOpen, loadVersion]);

  const sortedSessions = useMemo(
    () => sortAccountSessions(sessions, currentDeviceSessionId),
    [currentDeviceSessionId, sessions]
  );

  const otherSessionCount = getOtherAccountSessions(
    sortedSessions,
    currentDeviceSessionId
  ).length;

  async function revokeSession(sessionId: string) {
    const session = sessions.find((candidate) => candidate.id === sessionId);

    if (
      !session ||
      isAccountSessionCurrent(session, currentDeviceSessionId) ||
      revokingSessionId ||
      isRevokingOthers ||
      isRevokingAll
    ) {
      return false;
    }

    setRevokingSessionId(sessionId);
    setActionError(null);

    try {
      await apiNoContent(`/api/auth/sessions/${sessionId}/revoke`, {
        method: 'POST',
        accessToken
      });
      setSessions((current) =>
        current.filter((candidate) => candidate.id !== sessionId)
      );
      return true;
    } catch {
      setActionError(settingsCopy.errors.revokeSession);
      return false;
    } finally {
      setRevokingSessionId(null);
    }
  }

  async function revokeOtherSessions() {
    if (
      !currentDeviceSessionId ||
      otherSessionCount === 0 ||
      revokingSessionId ||
      isRevokingOthers ||
      isRevokingAll
    ) {
      return false;
    }

    setIsRevokingOthers(true);
    setActionError(null);

    try {
      await apiNoContent('/api/auth/sessions/revoke-others', {
        method: 'POST',
        accessToken
      });
      setSessions((current) =>
        current.filter((session) =>
          isAccountSessionCurrent(session, currentDeviceSessionId)
        )
      );
      return true;
    } catch {
      setActionError(settingsCopy.errors.revokeOtherSessions);
      return false;
    } finally {
      setIsRevokingOthers(false);
    }
  }

  async function revokeAllSessions() {
    if (
      sessions.length === 0 ||
      revokingSessionId ||
      isRevokingOthers ||
      isRevokingAll
    ) {
      return false;
    }

    setIsRevokingAll(true);
    setActionError(null);

    try {
      await apiNoContent('/api/auth/sessions/revoke-all', {
        method: 'POST',
        accessToken
      });
      setSessions([]);
      return true;
    } catch {
      setActionError(settingsCopy.errors.revokeAllSessions);
      return false;
    } finally {
      setIsRevokingAll(false);
    }
  }

  return {
    sessions: sortedSessions,
    isOpen,
    isLoading,
    error,
    actionError,
    revokingSessionId,
    isRevokingOthers,
    isRevokingAll,
    otherSessionCount,
    toggle: () => setIsOpen((current) => !current),
    retry: () => setLoadVersion((current) => current + 1),
    revokeSession,
    revokeOtherSessions,
    revokeAllSessions
  };
}
