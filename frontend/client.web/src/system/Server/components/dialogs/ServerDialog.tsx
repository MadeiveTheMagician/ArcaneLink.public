import type { FormEvent, RefObject } from 'react';

import type { ServerAccessMode } from '../../../../shared/types';
import { serverCopy } from '../../../shared';
import { SystemPlusIcon } from '../../../shared/icons/components/SystemPlusIcon';

import buttonStyles from '../../../shared/styles/Button.module.css';
import dialogStyles from '../../../shared/styles/Dialog.module.css';
import styles from './ServerDialog.module.css';

export type ServerDialogState = { mode: 'create' };

export type ServerFormState = {
  title: string;
  description: string;
  accessMode: ServerAccessMode;
  iconAssetId: string | null;
  iconPreviewUrl: string | null;
  iconPreviewIsObjectUrl: boolean;
  iconCropOffsetX: number;
  iconCropOffsetY: number;
  iconCropZoom: number;
  iconFile?: File;
};

type ServerDialogProps = {
  form: ServerFormState;
  notice: string | null;
  isSaving: boolean;
  iconInputRef: RefObject<HTMLInputElement | null>;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onClose: () => void;
  onUpdateForm: (nextForm: Partial<ServerFormState>) => void;
  onChooseIconFile: (file: File | undefined) => void;
  onShowIconLibrary: () => void;
  onClearIcon: () => void;
};

const accessModes: ServerAccessMode[] = ['public', 'restricted', 'private'];

export function ServerDialog({
  form,
  notice,
  isSaving,
  iconInputRef,
  onSubmit,
  onClose,
  onUpdateForm,
  onChooseIconFile,
  onShowIconLibrary,
  onClearIcon
}: ServerDialogProps) {
  return (
    <div className={dialogStyles.backdrop} role="presentation">
      <section
        className={`${dialogStyles.dialog} ${styles.dialog}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="server-dialog-title"
      >
        <div className={styles.header}>
          <h2 id="server-dialog-title">{serverCopy.dialog.createTitle}</h2>
          {notice && <p>{notice}</p>}
        </div>

        <form className={styles.form} onSubmit={onSubmit}>
          <div className={styles.iconField}>
            <button
              className={styles.iconPicker}
              type="button"
              onClick={() => iconInputRef.current?.click()}
              aria-label={serverCopy.dialog.chooseAvatarAria}
            >
              {form.iconPreviewUrl ? (
                <img
                  className="ui-media-fit"
                  src={form.iconPreviewUrl}
                  alt=""
                  style={{
                    transform: `translate(${
                      form.iconCropOffsetX * 100
                    }%, ${form.iconCropOffsetY * 100}%) scale(${
                      form.iconCropZoom
                    })`
                  }}
                />
              ) : (
                <span>
                  {form.title.trim() ? (
                    form.title.slice(0, 1).toUpperCase()
                  ) : (
                    <SystemPlusIcon size="large" />
                  )}
                </span>
              )}
            </button>
            <div>
              <strong>{serverCopy.dialog.avatar}</strong>
              <p>{serverCopy.dialog.avatarDescription}</p>
              <div className={styles.iconActions}>
                <button
                  className={`${buttonStyles.button} ${buttonStyles.ghost} ${styles.smallButton}`}
                  type="button"
                  onClick={() => iconInputRef.current?.click()}
                  disabled={isSaving}
                >
                  {serverCopy.dialog.chooseAvatar}
                </button>
                <button
                  className={`${buttonStyles.button} ${buttonStyles.ghost} ${styles.smallButton}`}
                  type="button"
                  onClick={onShowIconLibrary}
                  disabled={isSaving}
                >
                  {serverCopy.dialog.savedAssets}
                </button>
                {(form.iconPreviewUrl || form.iconAssetId) && (
                  <button
                    className={`${buttonStyles.button} ${buttonStyles.ghost} ${styles.smallButton}`}
                    type="button"
                    onClick={onClearIcon}
                    disabled={isSaving}
                  >
                    {serverCopy.dialog.removeAvatar}
                  </button>
                )}
              </div>
            </div>
            <input
              ref={iconInputRef}
              className={styles.fileInput}
              name="serverIcon"
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={(event) => onChooseIconFile(event.target.files?.[0])}
            />
          </div>
          <label>
            <span>{serverCopy.dialog.name}</span>
            <input
              className="ui-field-control"
              name="serverTitle"
              value={form.title}
              onChange={(event) =>
                onUpdateForm({
                  title: event.target.value
                })
              }
              minLength={3}
              maxLength={128}
              required
            />
          </label>
          <label>
            <span>{serverCopy.dialog.description}</span>
            <textarea
              className="ui-field-control"
              name="serverDescription"
              value={form.description}
              onChange={(event) =>
                onUpdateForm({
                  description: event.target.value
                })
              }
              maxLength={512}
            />
          </label>
          <fieldset className={styles.accessModeFieldset}>
            <legend>{serverCopy.dialog.accessModeLabel}</legend>
            <p>{serverCopy.dialog.accessModeDescription}</p>
            <div className={styles.accessModeGrid}>
              {accessModes.map((accessMode) => {
                const copy = serverCopy.dialog.accessModes[accessMode];
                const isSelected = form.accessMode === accessMode;

                return (
                  <label
                    key={accessMode}
                    className={`${styles.accessModeOption} ${
                      isSelected ? styles.accessModeOptionSelected : ''
                    }`}
                  >
                    <input
                      name="accessMode"
                      type="radio"
                      value={accessMode}
                      checked={isSelected}
                      onChange={() => onUpdateForm({ accessMode })}
                    />
                    <span>
                      <strong>{copy.label}</strong>
                      <small>{copy.description}</small>
                    </span>
                  </label>
                );
              })}
            </div>
          </fieldset>
          <div className={`${dialogStyles.actions} ${styles.actions}`}>
            <button
              className={`${buttonStyles.button} ${buttonStyles.ghost} ${styles.actionButton}`}
              type="button"
              onClick={onClose}
              disabled={isSaving}
            >
              {serverCopy.dialog.cancel}
            </button>
            <button
              className={`${buttonStyles.button} ${buttonStyles.primary} ${styles.actionButton}`}
              type="submit"
              disabled={isSaving}
            >
              {isSaving ? serverCopy.dialog.saving : serverCopy.dialog.save}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
