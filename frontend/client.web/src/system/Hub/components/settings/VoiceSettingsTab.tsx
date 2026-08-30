import { useRef, useState } from 'react';
import type { KeyboardEvent as ReactKeyboardEvent } from 'react';

import type { VoiceNoiseSuppressionTelemetry } from '../../../Server/hooks/voice/useVoiceChannel';
import type { VoiceConnectionDiagnostics } from '../../../Server/hooks/voice/voiceChannelTypes';
import { settingsCopy } from '../../../shared/copy';
import { SystemSelect } from '../../../shared/ui/SystemSelect';
import { useVoiceSettings } from '../../../shared/voice/useVoiceSettings';
import {
  getVoiceSettings,
  isPushToTalkKeyCodeAllowed,
  isVoiceSpatialAudioAvailable
} from '../../../shared/voice/voiceSettings';
import type {
  VoiceInputMode,
  VoiceSpatialAudioMode,
  VoiceThresholdMode,
  VoiceTransmissionQualityProfile
} from '../../../shared/voice/voiceSettings';
import { SettingsSection, ToggleField } from './SystemSettingsControls';
import { VoiceConnectionDiagnosticsSettings } from './VoiceConnectionDiagnosticsSettings';
import { VoiceInputSensitivityMeter } from './VoiceInputSensitivityMeter';
import { VoiceProfilesPanel } from './VoiceProfilesPanel';
import { useVoiceAudioDevices } from './useVoiceAudioDevices';

import sharedStyles from './SystemSettingsControls.module.css';
import styles from './VoiceSettingsTab.module.css';

export function VoiceSettingsTab({
  diagnostics = null,
  noiseSuppressionTelemetry = null
}: {
  diagnostics?: VoiceConnectionDiagnostics | null;
  noiseSuppressionTelemetry?: VoiceNoiseSuppressionTelemetry | null;
}) {
  const { settings, updateSettings, resetSettings } = useVoiceSettings();
  const {
    chooseAudioOutput,
    deviceListStatus,
    inputDevices,
    inputLevelDb,
    inputThresholdDb,
    isInputLive,
    isInputSpeaking,
    microphoneTestStatus,
    outputDevices,
    refreshDevices,
    speakerTestStatus,
    startMicrophoneTest,
    stopMicrophoneTest,
    switchMicrophoneTestInput,
    supportsAudioOutputPrompt,
    supportsAudioOutputRouting,
    supportsKeyboardPushToTalk,
    testSpeaker,
    voiceProcessingCapabilities
  } = useVoiceAudioDevices(settings);
  const [isCapturingKey, setIsCapturingKey] = useState(false);
  const [keyCaptureStatus, setKeyCaptureStatus] = useState<string | null>(null);
  const [outputSelectionError, setOutputSelectionError] = useState(false);
  const keyCaptureButtonRef = useRef<HTMLButtonElement>(null);

  function beginKeyCapture() {
    setKeyCaptureStatus(null);
    setIsCapturingKey(true);
    requestAnimationFrame(() => keyCaptureButtonRef.current?.focus());
  }

  function handlePushToTalkKey(event: ReactKeyboardEvent<HTMLButtonElement>) {
    if (!isCapturingKey) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    if (event.code === 'Escape') {
      setIsCapturingKey(false);
      setKeyCaptureStatus(settingsCopy.voice.keyCaptureCancelled);
      return;
    }

    if (event.code === 'Delete' || event.code === 'Backspace') {
      updateSettings({ pushToTalkKeyCode: null });
      setIsCapturingKey(false);
      setKeyCaptureStatus(null);
      return;
    }

    if (!isPushToTalkKeyCodeAllowed(event.code, event)) {
      setKeyCaptureStatus(settingsCopy.voice.keyCaptureInvalid);
      return;
    }

    updateSettings({ pushToTalkKeyCode: event.code });
    setIsCapturingKey(false);
    setKeyCaptureStatus(null);
  }

  async function selectAudioOutput() {
    setOutputSelectionError(false);
    const result = await chooseAudioOutput();
    if (result.status === 'selected') {
      updateSettings({ outputDeviceId: result.device.deviceId });
      return;
    }

    setOutputSelectionError(true);
  }

  async function testAudioOutput() {
    const result = await testSpeaker();
    if (
      result?.didFallback &&
      getVoiceSettings().outputDeviceId === result.requestedOutputDeviceId
    ) {
      updateSettings({ outputDeviceId: 'default' });
    }
  }

  return (
    <>
      <VoiceProfilesPanel onBeforeApplyProfile={stopMicrophoneTest} />

      <SettingsSection
        title={settingsCopy.voice.deviceTitle}
        description={settingsCopy.voice.deviceDescription}
      >
        <div className={styles.deviceGrid}>
          <DeviceSelect
            id="voice-input-device"
            label={settingsCopy.voice.inputDevice}
            value={settings.inputDeviceId}
            devices={inputDevices}
            fallbackLabel={settingsCopy.voice.inputDeviceFallback}
            emptyLabel={settingsCopy.voice.inputDeviceMissing}
            disabled={deviceListStatus === 'unsupported'}
            onChange={(inputDeviceId) => {
              updateSettings({ inputDeviceId });
              if (microphoneTestStatus === 'running') {
                void switchMicrophoneTestInput(inputDeviceId);
              }
            }}
          />
          <DeviceSelect
            id="voice-output-device"
            label={settingsCopy.voice.outputDevice}
            value={settings.outputDeviceId}
            devices={outputDevices}
            fallbackLabel={settingsCopy.voice.outputDeviceFallback}
            emptyLabel={settingsCopy.voice.outputDeviceMissing}
            disabled={!supportsAudioOutputRouting}
            onChange={(outputDeviceId) => updateSettings({ outputDeviceId })}
          />
        </div>

        {!supportsAudioOutputRouting ? (
          <p className={styles.notice}>
            {settingsCopy.voice.outputSelectionDescription}
          </p>
        ) : null}

        <div className={styles.actionRow}>
          <button
            className={sharedStyles.secondaryAction}
            type="button"
            disabled={deviceListStatus === 'loading'}
            onClick={() => void refreshDevices(true)}
          >
            {settingsCopy.voice.refreshDevices}
          </button>
          {supportsAudioOutputRouting && supportsAudioOutputPrompt ? (
            <button
              className={sharedStyles.secondaryAction}
              type="button"
              onClick={() => void selectAudioOutput()}
            >
              {settingsCopy.voice.chooseOutputDevice}
            </button>
          ) : null}
        </div>

        {deviceListStatus === 'error' ? (
          <p className={styles.errorText} role="status">
            {settingsCopy.voice.deviceLoadError}
          </p>
        ) : null}
        {outputSelectionError ? (
          <p className={styles.errorText} role="status">
            {settingsCopy.voice.outputSelectionError}
          </p>
        ) : null}

        <div className={styles.levelGrid}>
          <RangeField
            id="voice-microphone-gain"
            label={settingsCopy.voice.microphoneGain}
            description={settingsCopy.voice.microphoneGainDescription}
            value={settings.microphoneGainPercent}
            min={0}
            max={200}
            step={1}
            valueLabel={`${settings.microphoneGainPercent}%`}
            onChange={(microphoneGainPercent) =>
              updateSettings({ microphoneGainPercent })
            }
          />
          <RangeField
            id="voice-output-volume"
            label={settingsCopy.voice.outputVolume}
            description={settingsCopy.voice.outputVolumeDescription}
            value={settings.outputVolumePercent}
            min={0}
            max={100}
            step={1}
            valueLabel={`${settings.outputVolumePercent}%`}
            onChange={(outputVolumePercent) =>
              updateSettings({ outputVolumePercent })
            }
          />
        </div>

        <div className={styles.testPanel}>
          <div className={styles.actionRow}>
            <button
              className={sharedStyles.secondaryAction}
              type="button"
              disabled={microphoneTestStatus === 'starting'}
              onClick={() => {
                if (microphoneTestStatus === 'running') {
                  stopMicrophoneTest();
                } else {
                  void startMicrophoneTest();
                }
              }}
            >
              {microphoneTestStatus === 'running'
                ? settingsCopy.voice.stopMicrophoneTest
                : settingsCopy.voice.startMicrophoneTest}
            </button>
            <button
              className={sharedStyles.secondaryAction}
              type="button"
              disabled={speakerTestStatus === 'starting'}
              onClick={() => void testAudioOutput()}
            >
              {settingsCopy.voice.startSpeakerTest}
            </button>
          </div>
          {microphoneTestStatus === 'error' ? (
            <p className={styles.errorText} role="status">
              {settingsCopy.voice.microphoneTestError}
            </p>
          ) : null}
          {speakerTestStatus === 'starting' ? (
            <p className={styles.notice} role="status">
              {settingsCopy.voice.testingSpeaker}
            </p>
          ) : null}
          {speakerTestStatus === 'error' ? (
            <p className={styles.errorText} role="status">
              {settingsCopy.voice.speakerTestError}
            </p>
          ) : null}
          {speakerTestStatus === 'fallback' ? (
            <p className={styles.notice} role="status">
              {settingsCopy.voice.speakerTestFallback}
            </p>
          ) : null}
        </div>
      </SettingsSection>

      <SettingsSection
        title={settingsCopy.voice.inputProcessingTitle}
        description={settingsCopy.voice.inputProcessingDescription}
      >
        <div className={styles.toggleList}>
          <ToggleField
            label={settingsCopy.voice.echoCancellation}
            description={getProcessingDescription(
              settingsCopy.voice.echoCancellationDescription,
              voiceProcessingCapabilities.echoCancellation
            )}
            checked={settings.echoCancellation}
            disabled={!voiceProcessingCapabilities.echoCancellation}
            onChange={(echoCancellation) =>
              updateSettings({ echoCancellation })
            }
          />
          <ToggleField
            label={settingsCopy.voice.noiseSuppression}
            description={getProcessingDescription(
              settingsCopy.voice.noiseSuppressionDescription,
              voiceProcessingCapabilities.noiseSuppression
            )}
            checked={settings.noiseSuppression}
            disabled={!voiceProcessingCapabilities.noiseSuppression}
            onChange={(noiseSuppression) =>
              updateSettings({ noiseSuppression })
            }
          />
          <ToggleField
            label={settingsCopy.voice.mlNoiseSuppression}
            description={settingsCopy.voice.mlNoiseSuppressionDescription}
            checked={settings.mlNoiseSuppression}
            onChange={(mlNoiseSuppression) =>
              updateSettings({ mlNoiseSuppression })
            }
          />
          <NoiseSuppressionRuntimeStatus
            enabled={settings.mlNoiseSuppression}
            telemetry={noiseSuppressionTelemetry}
          />
          <ToggleField
            label={settingsCopy.voice.autoGainControl}
            description={getProcessingDescription(
              settingsCopy.voice.autoGainControlDescription,
              voiceProcessingCapabilities.autoGainControl
            )}
            checked={settings.autoGainControl}
            disabled={!voiceProcessingCapabilities.autoGainControl}
            onChange={(autoGainControl) => updateSettings({ autoGainControl })}
          />
        </div>
      </SettingsSection>

      <SettingsSection
        title={settingsCopy.voice.spatialAudioTitle}
        description={settingsCopy.voice.spatialAudioDescription}
        disabled={!isVoiceSpatialAudioAvailable}
      >
        <ChoiceGroup<VoiceSpatialAudioMode>
          label={settingsCopy.voice.spatialAudioTitle}
          name="voice-spatial-audio-mode"
          value={settings.spatialAudioMode}
          options={[
            {
              value: 'off',
              label: settingsCopy.voice.spatialAudioOff,
              description: settingsCopy.voice.spatialAudioOffDescription
            },
            {
              value: 'balanced',
              label: settingsCopy.voice.spatialAudioBalanced,
              description: settingsCopy.voice.spatialAudioBalancedDescription
            },
            {
              value: 'immersive',
              label: settingsCopy.voice.spatialAudioImmersive,
              description: settingsCopy.voice.spatialAudioImmersiveDescription
            }
          ]}
          onChange={(spatialAudioMode) => updateSettings({ spatialAudioMode })}
        />
      </SettingsSection>

      <SettingsSection
        title={settingsCopy.voice.qualityTitle}
        description={settingsCopy.voice.qualityDescription}
      >
        <ChoiceGroup
          label={settingsCopy.voice.qualityTitle}
          name="voice-quality-profile"
          value={settings.qualityProfile}
          options={[
            {
              value: 'automatic',
              label: settingsCopy.voice.qualityAutomatic,
              description: settingsCopy.voice.qualityAutomaticDescription
            },
            {
              value: 'data-saver',
              label: settingsCopy.voice.qualityDataSaver,
              description: settingsCopy.voice.qualityDataSaverDescription
            },
            {
              value: 'balanced',
              label: settingsCopy.voice.qualityBalanced,
              description: settingsCopy.voice.qualityBalancedDescription
            },
            {
              value: 'high',
              label: settingsCopy.voice.qualityHigh,
              description: settingsCopy.voice.qualityHighDescription
            }
          ]}
          onChange={(qualityProfile) => updateSettings({ qualityProfile })}
        />

        <div className={styles.toggleList}>
          <ToggleField
            label={settingsCopy.voice.adaptiveQuality}
            description={settingsCopy.voice.adaptiveQualityDescription}
            checked={settings.adaptiveQuality}
            disabled={settings.qualityProfile !== 'automatic'}
            onChange={(adaptiveQuality) => updateSettings({ adaptiveQuality })}
          />
        </div>
      </SettingsSection>

      <VoiceConnectionDiagnosticsSettings
        diagnostics={diagnostics}
        qualityProfile={settings.qualityProfile}
        adaptiveQuality={settings.adaptiveQuality}
      />

      <SettingsSection
        title={settingsCopy.voice.connectionBehaviorTitle}
        description={settingsCopy.voice.connectionBehaviorDescription}
      >
        <ChoiceGroup
          label={settingsCopy.voice.connectionBehaviorTitle}
          name="voice-input-mode"
          value={settings.inputMode}
          options={[
            {
              value: 'voice-activity',
              label: settingsCopy.voice.inputModeVoiceActivity,
              description: settingsCopy.voice.inputModeVoiceActivityDescription
            },
            {
              value: 'push-to-talk',
              label: settingsCopy.voice.inputModePushToTalk,
              description: settingsCopy.voice.inputModePushToTalkDescription,
              disabled: !supportsKeyboardPushToTalk
            }
          ]}
          onChange={(inputMode) => updateSettings({ inputMode })}
        />

        {!supportsKeyboardPushToTalk ? (
          <p className={styles.notice}>
            {settingsCopy.voice.pushToTalkMobileUnavailable}
          </p>
        ) : null}

        {settings.inputMode === 'push-to-talk' ? (
          <div className={styles.keyCapturePanel}>
            <span>
              <strong>{settingsCopy.voice.pushToTalkKey}</strong>
              <small>
                {settings.pushToTalkKeyCode
                  ? formatKeyboardCode(settings.pushToTalkKeyCode)
                  : settingsCopy.voice.pushToTalkKeyMissing}
              </small>
            </span>
            <div className={styles.actionRow}>
              <button
                ref={keyCaptureButtonRef}
                className={sharedStyles.secondaryAction}
                type="button"
                aria-pressed={isCapturingKey}
                onClick={beginKeyCapture}
                onKeyDown={handlePushToTalkKey}
              >
                {isCapturingKey
                  ? settingsCopy.voice.keyCaptureHint
                  : settingsCopy.voice.choosePushToTalkKey}
              </button>
              {settings.pushToTalkKeyCode ? (
                <button
                  className={sharedStyles.secondaryAction}
                  type="button"
                  onClick={() => updateSettings({ pushToTalkKeyCode: null })}
                >
                  {settingsCopy.voice.clearPushToTalkKey}
                </button>
              ) : null}
            </div>
            {keyCaptureStatus ? (
              <p className={styles.notice} role="status">
                {keyCaptureStatus}
              </p>
            ) : null}
          </div>
        ) : (
          <VoiceInputSensitivityMeter
            automaticDescription={
              settingsCopy.voice.automaticThresholdDescription
            }
            automaticLabel={settingsCopy.voice.automaticThreshold}
            dbUnit={settingsCopy.voice.dbFsUnit}
            idleLabel={settingsCopy.voice.inputLevelIdle}
            isLive={isInputLive}
            isSpeaking={isInputSpeaking}
            levelDb={inputLevelDb}
            liveLabel={settingsCopy.voice.inputLevelLive}
            manualDescription={settingsCopy.voice.manualThresholdDescription}
            manualLabel={settingsCopy.voice.manualThreshold}
            manualThresholdDb={settings.manualThresholdDb}
            meterLabel={settingsCopy.voice.inputLevel}
            thresholdDb={inputThresholdDb}
            thresholdMode={settings.thresholdMode}
            onManualThresholdChange={(manualThresholdDb) =>
              updateSettings({ manualThresholdDb })
            }
            onThresholdModeChange={(thresholdMode) =>
              updateSettings({ thresholdMode })
            }
          />
        )}
      </SettingsSection>

      <SettingsSection
        title={settingsCopy.voice.warningTitle}
        description={settingsCopy.voice.warningDescription}
      >
        <div className={styles.toggleList}>
          <ToggleField
            label={settingsCopy.voice.warnInputUnavailable}
            description={settingsCopy.voice.warnInputUnavailableDescription}
            checked={settings.warnInputUnavailable}
            onChange={(warnInputUnavailable) =>
              updateSettings({ warnInputUnavailable })
            }
          />
          <ToggleField
            label={settingsCopy.voice.warnSpeakingWhileMuted}
            description={settingsCopy.voice.warnSpeakingWhileMutedDescription}
            checked={settings.warnSpeakingWhileMuted}
            onChange={(warnSpeakingWhileMuted) =>
              updateSettings({ warnSpeakingWhileMuted })
            }
          />
        </div>
        <p className={styles.notice}>
          {settingsCopy.voice.warningLocalAnalysis}
        </p>
      </SettingsSection>

      <button
        className={sharedStyles.secondaryAction}
        type="button"
        onClick={() => {
          stopMicrophoneTest();
          resetSettings();
        }}
      >
        {settingsCopy.actions.resetVoice}
      </button>
    </>
  );
}

type ChoiceOption<TValue extends string> = {
  value: TValue;
  label: string;
  description: string;
  disabled?: boolean;
};

function ChoiceGroup<
  TValue extends
    | VoiceInputMode
    | VoiceSpatialAudioMode
    | VoiceThresholdMode
    | VoiceTransmissionQualityProfile
>({
  label,
  name,
  value,
  options,
  onChange
}: {
  label: string;
  name: string;
  value: TValue;
  options: readonly ChoiceOption<TValue>[];
  onChange: (value: TValue) => void;
}) {
  return (
    <fieldset className={styles.choiceFieldset} aria-label={label}>
      <div className={styles.choiceGrid}>
        {options.map((option) => (
          <label
            className={`${styles.choiceCard} ${
              value === option.value ? styles.choiceCardActive : ''
            }`}
            key={option.value}
          >
            <input
              type="radio"
              name={name}
              value={option.value}
              checked={value === option.value}
              disabled={option.disabled}
              onChange={() => onChange(option.value)}
            />
            <span>
              <strong>{option.label}</strong>
              <small>{option.description}</small>
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

function DeviceSelect({
  id,
  label,
  value,
  devices,
  fallbackLabel,
  emptyLabel,
  disabled,
  onChange
}: {
  id: string;
  label: string;
  value: string;
  devices: readonly MediaDeviceInfo[];
  fallbackLabel: string;
  emptyLabel: string;
  disabled: boolean;
  onChange: (value: string) => void;
}) {
  const isSelectedDeviceAvailable =
    value === 'default' || devices.some((device) => device.deviceId === value);

  return (
    <label className={styles.deviceField} htmlFor={id}>
      <strong>{label}</strong>
      <SystemSelect
        id={id}
        value={value}
        disabled={disabled}
        onValueChange={onChange}
      >
        <option value="default">
          {settingsCopy.voice.systemDefaultDevice}
        </option>
        {!isSelectedDeviceAvailable ? (
          <option value={value} disabled>
            {settingsCopy.voice.deviceUnavailable}
          </option>
        ) : null}
        {devices.map((device, index) => (
          <option key={device.deviceId} value={device.deviceId}>
            {device.label || `${fallbackLabel} ${index + 1}`}
          </option>
        ))}
      </SystemSelect>
      {devices.length === 0 ? <small>{emptyLabel}</small> : null}
    </label>
  );
}

function RangeField({
  id,
  label,
  description,
  value,
  min,
  max,
  step,
  valueLabel,
  onChange
}: {
  id: string;
  label: string;
  description: string;
  value: number;
  min: number;
  max: number;
  step: number;
  valueLabel: string;
  onChange: (value: number) => void;
}) {
  return (
    <label className={styles.rangeField} htmlFor={id}>
      <span>
        <strong>{label}</strong>
        <em>{valueLabel}</em>
      </span>
      <small>{description}</small>
      <input
        id={id}
        type="range"
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </label>
  );
}

function formatKeyboardCode(code: string) {
  if (/^Key[A-Z]$/.test(code)) {
    return code.slice(3);
  }

  if (/^Digit[0-9]$/.test(code)) {
    return code.slice(5);
  }

  return code;
}

function getProcessingDescription(description: string, isSupported: boolean) {
  return isSupported
    ? description
    : `${description} ${settingsCopy.voice.processingUnavailable}`;
}

function NoiseSuppressionRuntimeStatus({
  enabled,
  telemetry
}: {
  enabled: boolean;
  telemetry: VoiceNoiseSuppressionTelemetry | null;
}) {
  if (!enabled) {
    return null;
  }

  const status = resolveNoiseSuppressionRuntimeStatus(telemetry);
  const isDegraded =
    telemetry?.health === 'degraded' ||
    telemetry?.health === 'failed' ||
    telemetry?.lifecycle === 'fallback';

  return (
    <aside
      className={`${styles.noiseRuntimePanel} ${
        isDegraded ? styles.noiseRuntimePanelDegraded : ''
      }`}
      aria-live="polite"
    >
      <header>
        <strong>{settingsCopy.voice.mlNoiseRuntimeTitle}</strong>
        <span>{status}</span>
      </header>
      {telemetry ? (
        <dl>
          <RuntimeMetric
            label={settingsCopy.voice.mlNoiseRuntimeProvider}
            value={telemetry.providerId ?? 'RNNoise'}
          />
          <RuntimeMetric
            label={settingsCopy.voice.mlNoiseRuntimeLatency}
            value={formatRuntimeMetric(telemetry.latencyMs, 'мс')}
          />
          <RuntimeMetric
            label={settingsCopy.voice.mlNoiseRuntimeProcessing}
            value={formatRuntimeMetric(telemetry.averageProcessingTimeMs, 'мс')}
          />
          <RuntimeMetric
            label={settingsCopy.voice.mlNoiseRuntimeCpu}
            value={formatRuntimeMetric(telemetry.cpuLoadPercent, '%')}
          />
          <RuntimeMetric
            label={settingsCopy.voice.mlNoiseRuntimeDrops}
            value={`${telemetry.droppedFrames} / ${telemetry.outputUnderruns}`}
          />
        </dl>
      ) : null}
    </aside>
  );
}

function RuntimeMetric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

function resolveNoiseSuppressionRuntimeStatus(
  telemetry: VoiceNoiseSuppressionTelemetry | null
) {
  if (!telemetry) {
    return settingsCopy.voice.mlNoiseRuntimeIdle;
  }
  if (telemetry.lifecycle === 'initializing') {
    return settingsCopy.voice.mlNoiseRuntimeInitializing;
  }
  if (telemetry.lifecycle === 'active' && telemetry.activeMode === 'ml') {
    return settingsCopy.voice.mlNoiseRuntimeActive;
  }
  if (telemetry.activeMode === 'native') {
    return settingsCopy.voice.mlNoiseRuntimeFallback;
  }

  return settingsCopy.voice.mlNoiseRuntimeFailed;
}

function formatRuntimeMetric(value: number | null, unit: string) {
  return value === null ? '—' : `${Math.round(value * 10) / 10} ${unit}`;
}
