import { useEffect, useMemo, useState } from 'react';

import { ApiError } from '../../../../../shared/api/api';
import type { ServerMemberDisplayColorResponse } from '../../../../../shared/types';
import { SystemIcon, SystemSelect } from '../../../../shared';
import {
  loadServerMemberDisplayColor,
  updateServerMemberDisplayColor
} from './serverRoleSettingsApi';
import {
  formatDisplayColorSelection,
  parseDisplayColorSelection
} from './serverRoleSettingsModel';

import styles from './ServerRolesSettings.module.css';

type ServerMemberDisplayColorSettingsProps = {
  accessToken: string;
  serverId: string;
};

export function ServerMemberDisplayColorSettings({
  accessToken,
  serverId
}: ServerMemberDisplayColorSettingsProps) {
  const [settings, setSettings] =
    useState<ServerMemberDisplayColorResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const apiContext = useMemo(
    () => ({ accessToken, serverId }),
    [accessToken, serverId]
  );

  useEffect(() => {
    let isCancelled = false;
    setIsLoading(true);
    setError(null);
    setNotice(null);

    void loadServerMemberDisplayColor(apiContext)
      .then((response) => {
        if (!isCancelled) {
          setSettings(response);
        }
      })
      .catch(() => {
        if (!isCancelled) {
          setSettings(null);
          setError('Не удалось загрузить настройку цвета имени.');
        }
      })
      .finally(() => {
        if (!isCancelled) {
          setIsLoading(false);
        }
      });

    return () => {
      isCancelled = true;
    };
  }, [apiContext]);

  const selectionValue = settings
    ? formatDisplayColorSelection(settings.mode, settings.roleId)
    : 'default';

  async function selectDisplayColor(value: string) {
    if (!settings || isSaving) {
      return;
    }

    const selection = parseDisplayColorSelection(value);
    if (!selection) {
      return;
    }

    setIsSaving(true);
    setError(null);
    setNotice(null);

    try {
      const response = await updateServerMemberDisplayColor(
        apiContext,
        settings,
        selection
      );
      setSettings(response);
      setNotice('Цвет имени обновлён.');
    } catch (caughtError) {
      if (
        getApiErrorCode(caughtError) === 'server_member_display_color_conflict'
      ) {
        try {
          setSettings(await loadServerMemberDisplayColor(apiContext));
        } catch {
          setSettings(null);
        }
        setError(
          'Состав ваших ролей изменился. Настройка обновлена — выберите цвет снова.'
        );
      } else {
        setError('Не удалось изменить цвет имени.');
      }
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <section
      className={styles.displayColorSettings}
      aria-labelledby="server-display-color-title"
    >
      <span
        className={styles.displayColorSwatch}
        style={{ backgroundColor: settings?.resolvedColor ?? 'transparent' }}
        data-empty={!settings?.resolvedColor || undefined}
        aria-hidden="true"
      />
      <div className={styles.displayColorCopy}>
        <h3 id="server-display-color-title">Цвет имени</h3>
        <p>
          Выберите цвет из назначенных вам ролей. Настройка не влияет на права
          или положение в иерархии.
        </p>
      </div>
      <label className={styles.displayColorControl}>
        <span>Отображать имя</span>
        <SystemSelect
          aria-label="Цвет имени на сервере"
          value={selectionValue}
          disabled={isLoading || isSaving || !settings}
          onValueChange={(value) => void selectDisplayColor(value)}
        >
          <option value="auto">Автоматически</option>
          <option value="default">Системный цвет</option>
          {settings?.availableRoles.map((role) => (
            <option key={role.id} value={`role:${role.id}`}>
              {role.title}
            </option>
          ))}
        </SystemSelect>
      </label>
      <span className={styles.displayColorPreview} aria-live="polite">
        <SystemIcon name="user" size={15} />
        <strong style={{ color: settings?.resolvedColor ?? undefined }}>
          Ваше имя
        </strong>
      </span>
      {isLoading ? (
        <small className={styles.displayColorStatus}>
          Загружаем настройку…
        </small>
      ) : error ? (
        <small className={styles.displayColorError} role="alert">
          {error}
        </small>
      ) : notice ? (
        <small className={styles.displayColorStatus} role="status">
          {notice}
        </small>
      ) : null}
    </section>
  );
}

function getApiErrorCode(error: unknown) {
  if (
    !(error instanceof ApiError) ||
    !error.data ||
    typeof error.data !== 'object'
  ) {
    return null;
  }

  return 'code' in error.data && typeof error.data.code === 'string'
    ? error.data.code
    : null;
}
