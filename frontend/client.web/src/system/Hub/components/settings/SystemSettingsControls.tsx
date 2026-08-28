import { type ReactNode, useId, useState } from 'react';

import { commonCopy } from '../../../shared';
import { SystemIcon } from '../../../shared/icons/SystemIcon';

import styles from './SystemSettingsControls.module.css';

export function SettingsSection({
  title,
  description,
  children,
  disabled = false
}: {
  title: string;
  description?: string;
  children: ReactNode;
  disabled?: boolean;
}) {
  const contentId = useId();
  const [isExpanded, setIsExpanded] = useState(() => !disabled);

  return (
    <section className={styles.section}>
      <header className={styles.sectionHeader}>
        <h3>
          <button
            className={styles.sectionToggle}
            type="button"
            aria-controls={contentId}
            aria-expanded={isExpanded}
            disabled={disabled}
            title={
              disabled
                ? title
                : [
                    isExpanded
                      ? commonCopy.actions.collapse
                      : commonCopy.actions.expand,
                    title
                  ].join(': ')
            }
            data-settings-section-toggle
            onClick={() => setIsExpanded((current) => !current)}
          >
            <span>{title}</span>
            <SystemIcon
              className={[
                styles.sectionChevron,
                isExpanded ? styles.sectionChevronExpanded : ''
              ].join(' ')}
              name="chevron-down"
              size={16}
            />
          </button>
        </h3>
      </header>
      <div
        className={`${styles.sectionDisclosure} ${
          isExpanded ? styles.sectionDisclosureExpanded : ''
        }`}
        id={contentId}
        data-settings-section-content
        aria-hidden={!isExpanded}
        inert={!isExpanded ? true : undefined}
      >
        <div className={styles.sectionDisclosureClip}>
          <div className={styles.sectionDisclosureBody}>
            {description ? (
              <p className={styles.sectionDescription}>{description}</p>
            ) : null}
            <div className={styles.sectionContent}>{children}</div>
          </div>
        </div>
      </div>
    </section>
  );
}

export function ReadOnlyField({
  label,
  value,
  actionLabel = commonCopy.actions.edit
}: {
  label: string;
  value: string;
  actionLabel?: string;
}) {
  return (
    <div className={styles.fieldRow}>
      <span className={styles.fieldLabel}>{label}</span>
      <strong className={styles.fieldValue}>{value}</strong>
      <button className={styles.inlineButton} type="button" disabled>
        {actionLabel}
      </button>
    </div>
  );
}

export function ScaleControl({
  label,
  value,
  min,
  max,
  step,
  onChange,
  onCommit,
  formatValue = (currentValue) => `${Math.round(currentValue * 100)}%`
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
  onCommit: (value: number) => void;
  formatValue?: (value: number) => string;
}) {
  function commitValue(target: EventTarget & HTMLInputElement) {
    onCommit(Number(target.value));
  }

  return (
    <label className={styles.control}>
      <span>
        <strong>{label}</strong>
        <em>{formatValue(value)}</em>
      </span>
      <input
        name={`${label.replace(/\s+/g, '-').toLowerCase()}Scale`}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        onBlur={(event) => commitValue(event.currentTarget)}
        onKeyUp={(event) => commitValue(event.currentTarget)}
        onPointerUp={(event) => commitValue(event.currentTarget)}
      />
    </label>
  );
}

export function ToggleField({
  id,
  label,
  description,
  checked,
  disabled = false,
  onChange
}: {
  id?: string;
  label: string;
  description: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label
      id={id}
      className={styles.toggleRow}
      aria-disabled={disabled || undefined}
    >
      <span>
        <strong>{label}</strong>
        <small>{description}</small>
      </span>
      <span className={styles.switch}>
        <input
          name={`${label.replace(/\s+/g, '-').toLowerCase()}Enabled`}
          type="checkbox"
          checked={checked}
          disabled={disabled}
          onChange={(event) => onChange(event.target.checked)}
        />
        <span aria-hidden="true" />
      </span>
    </label>
  );
}
