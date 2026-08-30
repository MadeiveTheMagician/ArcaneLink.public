import { useCallback, useEffect, useRef, useState } from 'react';

import { apiJson } from '../../../shared/api/api';
import { SettingsSection } from '../../Hub/components/settings/SystemSettingsControls';
import { createRealtimeRefreshCoalescer } from '../../shared/hooks/realtimeRefreshCoalescer';
import { myModerationReportsChangedWindowEvent } from '../../shared/moderation/moderationRealtime';
import {
  getModerationReasonLabel,
  getUserReportStatusLabel,
  moderationCopy
} from '../moderationCopy.ru';
import type { ModerationReportResponse } from '../moderationTypes';

import styles from './MyModerationReportsTab.module.css';

export function MyModerationReportsTab({
  accessToken
}: {
  accessToken: string;
}) {
  const [reports, setReports] = useState<ModerationReportResponse[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const requestIdRef = useRef(0);
  const reportsRef = useRef<ModerationReportResponse[]>([]);

  const loadReports = useCallback(
    async (silent = false) => {
      const requestId = ++requestIdRef.current;
      if (!silent) {
        setIsLoading(true);
      }
      if (!silent) {
        setError(null);
      }

      try {
        const nextReports = await apiJson<ModerationReportResponse[]>(
          '/api/users/me/moderation-reports',
          { accessToken }
        );

        if (requestId === requestIdRef.current) {
          reportsRef.current = nextReports;
          setReports(nextReports);
          setError(null);
        }
      } catch (requestError) {
        if (
          requestId === requestIdRef.current &&
          (!silent || reportsRef.current.length === 0)
        ) {
          setError(
            requestError instanceof Error && requestError.message
              ? requestError.message
              : moderationCopy.myReports.failed
          );
        }
      } finally {
        if (requestId === requestIdRef.current) {
          setIsLoading(false);
        }
      }
    },
    [accessToken]
  );

  useEffect(() => {
    void loadReports();

    const refresh = createRealtimeRefreshCoalescer(
      () => loadReports(true),
      120
    );
    const refreshFromRealtime = () => refresh.request();

    window.addEventListener(
      myModerationReportsChangedWindowEvent,
      refreshFromRealtime
    );

    return () => {
      requestIdRef.current += 1;
      refresh.dispose();
      window.removeEventListener(
        myModerationReportsChangedWindowEvent,
        refreshFromRealtime
      );
    };
  }, [loadReports]);

  return (
    <SettingsSection
      title={moderationCopy.myReports.title}
      description={moderationCopy.myReports.description}
    >
      <div className={styles.status} aria-live="polite">
        {isLoading && moderationCopy.myReports.loading}
        {!isLoading && error && (
          <>
            <span role="alert">{error}</span>
            <button type="button" onClick={() => void loadReports()}>
              {moderationCopy.myReports.retry}
            </button>
          </>
        )}
      </div>

      {!isLoading && !error && reports.length === 0 && (
        <p className={styles.empty}>{moderationCopy.myReports.empty}</p>
      )}

      {!error && reports.length > 0 && (
        <div className={styles.list}>
          {reports.map((report) => (
            <article key={report.reportId} className={styles.report}>
              <header>
                <div>
                  <strong>
                    {moderationCopy.myReports.reportForMessage(
                      report.messageId
                    )}
                  </strong>
                  <span>{getModerationReasonLabel(report.reasonCode)}</span>
                </div>
                <em data-status={report.status}>
                  {getUserReportStatusLabel(report.status)}
                </em>
              </header>
              {report.details && <p>{report.details}</p>}
              <dl>
                <div>
                  <dt>{moderationCopy.myReports.submitted}</dt>
                  <dd>{formatDateTime(report.submittedAt)}</dd>
                </div>
                <div>
                  <dt>{moderationCopy.myReports.updated}</dt>
                  <dd>{formatDateTime(report.updatedAt)}</dd>
                </div>
              </dl>
            </article>
          ))}
        </div>
      )}
    </SettingsSection>
  );
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat('ru-RU', {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(new Date(value));
}
