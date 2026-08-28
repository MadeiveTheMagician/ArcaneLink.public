import { useEffect, useState } from 'react';

import type { ProfileSettingsDraft } from '../../../Profile/hooks/useProfileSettings';
import { SystemSelect, commonCopy } from '../../../shared';
import { settingsCopy } from '../../../shared/copy';
import { SettingsSection, ToggleField } from './SystemSettingsControls';
import {
  type DirectMessagePrivacyCategory,
  type DirectMessagePrivacyDraft,
  mergeDirectMessagePermission,
  selectDirectMessageGlobal,
  toDirectMessagePrivacyDraft,
  toggleDirectMessageCategory
} from './directMessagePrivacyModel';
import {
  type PresenceSettingsDraft,
  mergePresenceSettings,
  toPresenceSettingsDraft
} from './presenceSettingsModel';
import {
  type PresenceVisibilityCategory,
  type PresenceVisibilityDraft,
  selectPresenceVisibilityGlobal,
  serializePresenceVisibility,
  toPresenceVisibilityDraft,
  togglePresenceVisibilityCategory
} from './presenceVisibilityModel';

import sharedStyles from './SystemSettingsControls.module.css';
import styles from './SystemSettingsPrivacyTab.module.css';

type SystemSettingsPrivacyTabProps = {
  settings: ProfileSettingsDraft;
  isSaving: boolean;
  onChange: (settings: ProfileSettingsDraft) => void;
  onCommit: (settings: ProfileSettingsDraft) => Promise<void> | void;
};

export function SystemSettingsPrivacyTab({
  settings,
  isSaving,
  onChange,
  onCommit
}: SystemSettingsPrivacyTabProps) {
  const [draft, setDraft] = useState<PresenceSettingsDraft>(() =>
    toPresenceSettingsDraft(settings)
  );
  const [directMessagePrivacy, setDirectMessagePrivacy] =
    useState<DirectMessagePrivacyDraft>(() =>
      toDirectMessagePrivacyDraft(settings.directMessagePermission)
    );
  const [presenceVisibility, setPresenceVisibility] =
    useState<PresenceVisibilityDraft>(() =>
      toPresenceVisibilityDraft(settings.presenceVisibility)
    );
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isSavingLocally, setIsSavingLocally] = useState(false);

  useEffect(() => {
    setDraft(
      toPresenceSettingsDraft({
        presenceMode: settings.presenceMode,
        presenceVisibility: settings.presenceVisibility,
        showLastSeen: settings.showLastSeen
      })
    );
  }, [
    settings.presenceMode,
    settings.presenceVisibility,
    settings.showLastSeen
  ]);

  useEffect(() => {
    setDirectMessagePrivacy(
      toDirectMessagePrivacyDraft(settings.directMessagePermission)
    );
  }, [settings.directMessagePermission]);

  useEffect(() => {
    setPresenceVisibility(
      toPresenceVisibilityDraft(settings.presenceVisibility)
    );
  }, [settings.presenceVisibility]);

  function updateDraft(patch: Partial<PresenceSettingsDraft>) {
    setSaveError(null);
    setDraft((current) => ({ ...current, ...patch }));
  }

  async function savePrivacySettings() {
    const nextSettings = mergeDirectMessagePermission(
      mergePresenceSettings(settings, {
        ...draft,
        presenceVisibility: serializePresenceVisibility(presenceVisibility)
      }),
      directMessagePrivacy
    );

    setSaveError(null);
    setIsSavingLocally(true);
    onChange(nextSettings);

    try {
      await onCommit(nextSettings);
    } catch {
      setSaveError(settingsCopy.privacy.saveError);
    } finally {
      setIsSavingLocally(false);
    }
  }

  const saving = isSaving || isSavingLocally;

  return (
    <>
      <SettingsSection
        title={settingsCopy.privacy.directMessagesTitle}
        description={settingsCopy.privacy.directMessagesDescription}
      >
        <p className={styles.permissionHint}>
          {settingsCopy.privacy.directMessagesHint}
        </p>
        <div
          className={styles.permissionList}
          role="group"
          aria-label={settingsCopy.privacy.directMessagesLabel}
        >
          <PrivacyChoiceRow
            label={settingsCopy.privacy.directMessagesEveryone}
            description={settingsCopy.privacy.directMessagesEveryoneDescription}
            checked={directMessagePrivacy.mode === 'everyone'}
            disabled={saving}
            onChange={() => {
              setSaveError(null);
              setDirectMessagePrivacy(selectDirectMessageGlobal('everyone'));
            }}
          />

          <PrivacySeparator
            label={settingsCopy.privacy.directMessagesCustomSeparator}
          />

          <PrivacyChoiceRow
            label={settingsCopy.privacy.directMessagesFriends}
            description={settingsCopy.privacy.directMessagesFriendsDescription}
            checked={
              directMessagePrivacy.mode === 'custom' &&
              directMessagePrivacy.friends
            }
            disabled={saving}
            onChange={(checked) =>
              updateDirectMessageCategory('friends', checked)
            }
          />
          <PrivacyChoiceRow
            label={settingsCopy.privacy.directMessagesFriendsOfFriends}
            description={
              settingsCopy.privacy.directMessagesFriendsOfFriendsDescription
            }
            checked={
              directMessagePrivacy.mode === 'custom' &&
              directMessagePrivacy.friendsOfFriends
            }
            disabled={saving}
            onChange={(checked) =>
              updateDirectMessageCategory('friends_of_friends', checked)
            }
          />
          <PrivacyChoiceRow
            label={settingsCopy.privacy.directMessagesSharedServers}
            description={
              settingsCopy.privacy.directMessagesSharedServersDescription
            }
            checked={
              directMessagePrivacy.mode === 'custom' &&
              directMessagePrivacy.sharedServers
            }
            disabled={saving}
            onChange={(checked) =>
              updateDirectMessageCategory('shared_servers', checked)
            }
          />

          <PrivacySeparator />

          <PrivacyChoiceRow
            label={settingsCopy.privacy.directMessagesNobody}
            description={settingsCopy.privacy.directMessagesNobodyDescription}
            checked={directMessagePrivacy.mode === 'nobody'}
            disabled={saving}
            onChange={() => {
              setSaveError(null);
              setDirectMessagePrivacy(selectDirectMessageGlobal('nobody'));
            }}
          />
        </div>
      </SettingsSection>

      <SettingsSection
        title={settingsCopy.privacy.visibilityTitle}
        description={settingsCopy.privacy.visibilityDescription}
      >
        <p className={styles.permissionHint}>
          {settingsCopy.privacy.visibilityHint}
        </p>
        <div
          className={styles.permissionList}
          role="group"
          aria-label={settingsCopy.privacy.visibilityLabel}
        >
          <PrivacyChoiceRow
            label={settingsCopy.privacy.visibilityEveryone}
            description={settingsCopy.privacy.visibilityEveryoneDescription}
            checked={presenceVisibility.mode === 'everyone'}
            disabled={saving}
            onChange={() => {
              setSaveError(null);
              setPresenceVisibility(selectPresenceVisibilityGlobal('everyone'));
            }}
          />

          <PrivacySeparator
            label={settingsCopy.privacy.visibilityCustomSeparator}
          />

          <PrivacyChoiceRow
            label={settingsCopy.privacy.visibilityFriends}
            description={settingsCopy.privacy.visibilityFriendsDescription}
            checked={
              presenceVisibility.mode === 'custom' && presenceVisibility.friends
            }
            disabled={saving}
            onChange={(checked) =>
              updatePresenceVisibilityCategory('friends', checked)
            }
          />
          <PrivacyChoiceRow
            label={settingsCopy.privacy.visibilityFriendsOfFriends}
            description={
              settingsCopy.privacy.visibilityFriendsOfFriendsDescription
            }
            checked={
              presenceVisibility.mode === 'custom' &&
              presenceVisibility.friendsOfFriends
            }
            disabled={saving}
            onChange={(checked) =>
              updatePresenceVisibilityCategory('friends_of_friends', checked)
            }
          />
          <PrivacyChoiceRow
            label={settingsCopy.privacy.visibilitySharedServers}
            description={
              settingsCopy.privacy.visibilitySharedServersDescription
            }
            checked={
              presenceVisibility.mode === 'custom' &&
              presenceVisibility.sharedServers
            }
            disabled={saving}
            onChange={(checked) =>
              updatePresenceVisibilityCategory('shared_servers', checked)
            }
          />

          <PrivacySeparator />

          <PrivacyChoiceRow
            label={settingsCopy.privacy.visibilityNobody}
            description={settingsCopy.privacy.visibilityNobodyDescription}
            checked={presenceVisibility.mode === 'nobody'}
            disabled={saving}
            onChange={() => {
              setSaveError(null);
              setPresenceVisibility(selectPresenceVisibilityGlobal('nobody'));
            }}
          />
        </div>

        <ToggleField
          label={settingsCopy.privacy.showLastSeen}
          description={settingsCopy.privacy.showLastSeenDescription}
          checked={draft.showLastSeen}
          onChange={(showLastSeen) => updateDraft({ showLastSeen })}
        />
      </SettingsSection>

      <SettingsSection
        title={settingsCopy.privacy.modeTitle}
        description={settingsCopy.privacy.modeDescription}
      >
        <label className={styles.selectField}>
          <span>
            <strong>{settingsCopy.privacy.modeLabel}</strong>
            <small>{settingsCopy.privacy.modeHint}</small>
          </span>
          <SystemSelect
            name="presenceMode"
            value={draft.presenceMode}
            disabled={saving}
            onValueChange={(value) =>
              updateDraft({
                presenceMode: value as PresenceSettingsDraft['presenceMode']
              })
            }
          >
            <option value="automatic">
              {settingsCopy.privacy.modeAutomatic}
            </option>
            <option value="invisible">
              {settingsCopy.privacy.modeInvisible}
            </option>
          </SystemSelect>
        </label>
      </SettingsSection>

      <div className={styles.actions}>
        <button
          className={sharedStyles.secondaryAction}
          type="button"
          disabled={saving}
          onClick={() => void savePrivacySettings()}
        >
          {saving ? settingsCopy.root.saving : commonCopy.actions.save}
        </button>
        {saveError && (
          <p className={styles.error} role="alert">
            {saveError}
          </p>
        )}
      </div>
    </>
  );

  function updateDirectMessageCategory(
    category: DirectMessagePrivacyCategory,
    checked: boolean
  ) {
    setSaveError(null);
    setDirectMessagePrivacy((current) =>
      toggleDirectMessageCategory(current, category, checked)
    );
  }

  function updatePresenceVisibilityCategory(
    category: PresenceVisibilityCategory,
    checked: boolean
  ) {
    setSaveError(null);
    setPresenceVisibility((current) =>
      togglePresenceVisibilityCategory(current, category, checked)
    );
  }
}

function PrivacyChoiceRow({
  label,
  description,
  checked,
  disabled,
  onChange
}: {
  label: string;
  description: string;
  checked: boolean;
  disabled: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label
      className={`${styles.permissionRow} ${
        checked ? styles.permissionRowSelected : ''
      }`}
    >
      <span>
        <strong>{label}</strong>
        <small>{description}</small>
      </span>
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
      />
    </label>
  );
}

function PrivacySeparator({ label }: { label?: string }) {
  return (
    <div className={styles.permissionSeparator} role="separator">
      {label && <span>{label}</span>}
    </div>
  );
}
