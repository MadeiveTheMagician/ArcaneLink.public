import { useEffect, useMemo, useState } from 'react';

import { settingsCopy } from '../../../shared/copy';
import { SystemSelect } from '../../../shared/ui/SystemSelect';
import { useVoiceProfiles } from '../../../shared/voice/useVoiceProfiles';
import {
  voiceProfileLimit,
  voiceProfileNameMaxLength
} from '../../../shared/voice/voiceProfiles';
import { SettingsSection } from './SystemSettingsControls';

import sharedStyles from './SystemSettingsControls.module.css';
import styles from './VoiceProfilesPanel.module.css';

type ProfileEditorMode = 'create' | 'rename' | 'delete' | null;

export function VoiceProfilesPanel({
  onBeforeApplyProfile
}: {
  onBeforeApplyProfile?: () => void;
}) {
  const {
    activeProfileId,
    profiles,
    activate,
    create,
    duplicate,
    rename,
    remove
  } = useVoiceProfiles();
  const activeProfile = useMemo(
    () => profiles.find((profile) => profile.id === activeProfileId) ?? null,
    [activeProfileId, profiles]
  );
  const [editorMode, setEditorMode] = useState<ProfileEditorMode>(null);
  const [draftName, setDraftName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const isAtLimit = profiles.length >= voiceProfileLimit;

  useEffect(() => {
    setEditorMode(null);
    setDraftName('');
    setError(null);
  }, [activeProfileId]);

  function openEditor(mode: Exclude<ProfileEditorMode, null>) {
    setError(null);
    setDraftName(mode === 'rename' ? (activeProfile?.name ?? '') : '');
    setEditorMode(mode);
  }

  function closeEditor() {
    setEditorMode(null);
    setDraftName('');
    setError(null);
  }

  function submitName() {
    if (!draftName.trim()) {
      setError(settingsCopy.voice.profileNameEmpty);
      return;
    }

    const result =
      editorMode === 'create'
        ? create(draftName)
        : activeProfile
          ? rename(activeProfile.id, draftName)
          : false;
    if (!result) {
      setError(settingsCopy.voice.profileNameEmpty);
      return;
    }

    closeEditor();
  }

  return (
    <SettingsSection
      title={settingsCopy.voice.profileTitle}
      description={settingsCopy.voice.profileDescription}
    >
      <div className={styles.profilePanel}>
        <label className={styles.profileSelect}>
          <strong>{settingsCopy.voice.activeProfile}</strong>
          <SystemSelect
            aria-label={settingsCopy.voice.activeProfile}
            value={activeProfileId}
            onValueChange={(value) => {
              onBeforeApplyProfile?.();
              activate(value);
            }}
          >
            {profiles.map((profile) => (
              <option key={profile.id} value={profile.id}>
                {profile.name}
              </option>
            ))}
          </SystemSelect>
        </label>

        <div className={styles.profileActions}>
          <button
            className={sharedStyles.secondaryAction}
            type="button"
            disabled={isAtLimit}
            onClick={() => openEditor('create')}
          >
            {settingsCopy.voice.createProfile}
          </button>
          <button
            className={sharedStyles.secondaryAction}
            type="button"
            disabled={!activeProfile || isAtLimit}
            onClick={() => activeProfile && duplicate(activeProfile.id)}
          >
            {settingsCopy.voice.duplicateProfile}
          </button>
          <button
            className={sharedStyles.secondaryAction}
            type="button"
            disabled={!activeProfile || activeProfile.isBuiltIn}
            onClick={() => openEditor('rename')}
          >
            {settingsCopy.voice.renameProfile}
          </button>
          <button
            className={sharedStyles.secondaryAction}
            type="button"
            disabled={!activeProfile || activeProfile.isBuiltIn}
            onClick={() => openEditor('delete')}
          >
            {settingsCopy.voice.deleteProfile}
          </button>
        </div>

        {editorMode === 'create' || editorMode === 'rename' ? (
          <form
            className={styles.profileEditor}
            onSubmit={(event) => {
              event.preventDefault();
              submitName();
            }}
          >
            <input
              autoFocus
              type="text"
              value={draftName}
              maxLength={voiceProfileNameMaxLength}
              placeholder={settingsCopy.voice.profileCreateHint}
              onChange={(event) => {
                setDraftName(event.target.value);
                setError(null);
              }}
            />
            <button className={sharedStyles.secondaryAction} type="submit">
              {settingsCopy.voice.profileSave}
            </button>
            <button
              className={sharedStyles.secondaryAction}
              type="button"
              onClick={closeEditor}
            >
              {settingsCopy.voice.cancel}
            </button>
          </form>
        ) : null}

        {editorMode === 'delete' && activeProfile ? (
          <div className={styles.deleteConfirmation} role="alert">
            <span>{settingsCopy.voice.deleteProfileConfirmation}</span>
            <button
              className={sharedStyles.secondaryAction}
              type="button"
              onClick={() => {
                onBeforeApplyProfile?.();
                remove(activeProfile.id);
                closeEditor();
              }}
            >
              {settingsCopy.voice.deleteProfile}
            </button>
            <button
              className={sharedStyles.secondaryAction}
              type="button"
              onClick={closeEditor}
            >
              {settingsCopy.voice.cancel}
            </button>
          </div>
        ) : null}

        {error ? (
          <p className={styles.error} role="status">
            {error}
          </p>
        ) : null}
        <div className={styles.profileMeta}>
          <span>
            {settingsCopy.voice.profileLimit(
              profiles.length,
              voiceProfileLimit
            )}
          </span>
          {activeProfile?.isBuiltIn ? (
            <span>{settingsCopy.voice.profileBuiltIn}</span>
          ) : null}
        </div>
      </div>
    </SettingsSection>
  );
}
