import { useId } from 'react';

import type { VoiceThresholdMode } from '../../../shared/voice/voiceSettings';
import {
  getVoiceInputThresholdTrackRatio,
  normalizeVoiceInputMeterDb,
  voiceInputMeterCeilingDb,
  voiceInputMeterFloorDb,
  voiceInputThresholdMaximumDb
} from './voiceInputMeterModel';

import styles from './VoiceInputSensitivityMeter.module.css';

export function VoiceInputSensitivityMeter({
  automaticDescription,
  automaticLabel,
  dbUnit,
  idleLabel,
  isLive,
  isSpeaking,
  levelDb,
  liveLabel,
  manualDescription,
  manualLabel,
  manualThresholdDb,
  meterLabel,
  onManualThresholdChange,
  onThresholdModeChange,
  thresholdDb,
  thresholdMode
}: {
  automaticDescription: string;
  automaticLabel: string;
  dbUnit: string;
  idleLabel: string;
  isLive: boolean;
  isSpeaking: boolean;
  levelDb: number;
  liveLabel: string;
  manualDescription: string;
  manualLabel: string;
  manualThresholdDb: number;
  meterLabel: string;
  onManualThresholdChange: (thresholdDb: number) => void;
  onThresholdModeChange: (mode: VoiceThresholdMode) => void;
  thresholdDb: number;
  thresholdMode: VoiceThresholdMode;
}) {
  const levelRatio = normalizeVoiceInputMeterDb(levelDb);
  const thresholdRatio = normalizeVoiceInputMeterDb(thresholdDb);
  const thresholdTrackRatio = getVoiceInputThresholdTrackRatio();
  const thresholdModeName = useId();
  const accessibleLevelDb = Math.min(
    voiceInputMeterCeilingDb,
    Math.max(voiceInputMeterFloorDb, Math.round(levelDb))
  );

  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <span>
          <strong>{meterLabel}</strong>
          <small>{isLive ? liveLabel : idleLabel}</small>
        </span>
        <div
          className={styles.modeSelector}
          role="radiogroup"
          aria-label={meterLabel}
        >
          <ModeOption
            checked={thresholdMode === 'automatic'}
            label={automaticLabel}
            name={thresholdModeName}
            onChange={() => onThresholdModeChange('automatic')}
          />
          <ModeOption
            checked={thresholdMode === 'manual'}
            label={manualLabel}
            name={thresholdModeName}
            onChange={() => onThresholdModeChange('manual')}
          />
        </div>
      </div>

      <div className={styles.meterShell}>
        <div
          className={`${styles.meter} ${isSpeaking ? styles.meterSpeaking : ''}`}
          role="progressbar"
          aria-label={meterLabel}
          aria-valuemin={voiceInputMeterFloorDb}
          aria-valuemax={voiceInputMeterCeilingDb}
          aria-valuenow={accessibleLevelDb}
        >
          <span
            className={styles.level}
            style={{ transform: `scaleX(${levelRatio})` }}
          />
          <span
            className={styles.thresholdMarker}
            style={{ left: `${thresholdRatio * 100}%` }}
          />
        </div>
        {thresholdMode === 'manual' ? (
          <input
            className={styles.thresholdInput}
            style={{ width: `${thresholdTrackRatio * 100}%` }}
            type="range"
            min={voiceInputMeterFloorDb}
            max={voiceInputThresholdMaximumDb}
            step={1}
            value={manualThresholdDb}
            aria-label={manualLabel}
            onChange={(event) =>
              onManualThresholdChange(Number(event.target.value))
            }
          />
        ) : null}
      </div>

      <div className={styles.scale} aria-hidden="true">
        <span>{voiceInputMeterFloorDb}</span>
        <output>
          {Math.round(thresholdDb)} {dbUnit}
        </output>
        <span>{voiceInputMeterCeilingDb}</span>
      </div>

      <p>
        {thresholdMode === 'automatic'
          ? automaticDescription
          : manualDescription}
      </p>
    </div>
  );
}

function ModeOption({
  checked,
  label,
  name,
  onChange
}: {
  checked: boolean;
  label: string;
  name: string;
  onChange: () => void;
}) {
  return (
    <label className={checked ? styles.modeActive : undefined}>
      <input type="radio" name={name} checked={checked} onChange={onChange} />
      <span>{label}</span>
    </label>
  );
}
