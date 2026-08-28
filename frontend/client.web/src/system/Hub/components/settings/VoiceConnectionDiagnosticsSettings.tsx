import { useEffect, useMemo, useState } from 'react';

import type { VoiceConnectionDiagnostics } from '../../../Server/hooks/voice/voiceChannelTypes';
import { settingsCopy } from '../../../shared/copy';
import { VoiceConnectionStatusIcon } from '../../../shared/icons/VoiceConnectionStatusIcon';
import { voiceDiagnosticsSettingsTargetId } from '../../../shared/navigation/systemSettingsNavigation';
import type { VoiceTransmissionQualityProfile } from '../../../shared/voice/voiceSettings';
import { VoiceConnectionDiagnosticsDetails } from '../voice/VoiceConnectionDiagnosticsDetails';
import { SettingsSection } from './SystemSettingsControls';
import {
  createPrivacySafeVoiceDiagnosticsReport,
  createVoiceTransmissionLimitSummary,
  formatPrivacySafeVoiceCodec,
  formatPrivacySafeVoiceRoute,
  formatVoiceDiagnosticsSampleTime,
  getVoiceDiagnosticsQualityDescription,
  getVoiceDiagnosticsQualityLabel
} from './voiceConnectionDiagnosticsPresentation';

import sharedStyles from './SystemSettingsControls.module.css';
import styles from './VoiceConnectionDiagnosticsSettings.module.css';

type VoiceConnectionDiagnosticsSettingsProps = {
  diagnostics: VoiceConnectionDiagnostics | null;
  qualityProfile: VoiceTransmissionQualityProfile;
  adaptiveQuality: boolean;
};

type CopyStatus = 'idle' | 'success' | 'error';

export function VoiceConnectionDiagnosticsSettings({
  diagnostics,
  qualityProfile,
  adaptiveQuality
}: VoiceConnectionDiagnosticsSettingsProps) {
  const [copyStatus, setCopyStatus] = useState<CopyStatus>('idle');
  const qualityState = diagnostics?.qualityState ?? 'disconnected';
  const transmissionSummary = useMemo(
    () =>
      createVoiceTransmissionLimitSummary({
        diagnostics,
        qualityProfile,
        adaptiveQuality
      }),
    [adaptiveQuality, diagnostics, qualityProfile]
  );
  const safeDiagnostics = useMemo(
    () =>
      diagnostics
        ? {
            ...diagnostics,
            codec: formatPrivacySafeVoiceCodec(diagnostics.codec),
            route: formatPrivacySafeVoiceRoute(diagnostics.route)
          }
        : null,
    [diagnostics]
  );
  const sampleTime = formatVoiceDiagnosticsSampleTime(diagnostics?.sampledAtMs);

  useEffect(() => {
    if (copyStatus === 'idle') return undefined;

    const resetTimer = window.setTimeout(() => setCopyStatus('idle'), 3_500);
    return () => window.clearTimeout(resetTimer);
  }, [copyStatus]);

  async function copyDiagnosticReport() {
    const report = createPrivacySafeVoiceDiagnosticsReport({
      diagnostics,
      qualityProfile,
      adaptiveQuality
    });

    try {
      if (!navigator.clipboard?.writeText) {
        throw new TypeError();
      }

      await navigator.clipboard.writeText(report);
      setCopyStatus('success');
    } catch {
      setCopyStatus('error');
    }
  }

  return (
    <div
      id={voiceDiagnosticsSettingsTargetId}
      className={styles.anchor}
      tabIndex={-1}
    >
      <SettingsSection
        title={settingsCopy.voice.connectionDiagnosticsTitle}
        description={settingsCopy.voice.connectionDiagnosticsDescription}
      >
        <div className={styles.panel} data-quality={qualityState}>
          <header className={styles.statusHeader}>
            <span className={styles.statusIcon}>
              <VoiceConnectionStatusIcon state={qualityState} />
            </span>
            <span className={styles.statusCopy}>
              <strong>{getVoiceDiagnosticsQualityLabel(qualityState)}</strong>
              <small>
                {getVoiceDiagnosticsQualityDescription(qualityState)}
              </small>
            </span>
          </header>

          <dl className={styles.summaryGrid}>
            <SummaryValue
              label={settingsCopy.voice.diagnosticsConnectedPeers}
              value={
                diagnostics
                  ? settingsCopy.voice.diagnosticsConnectedPeersValue(
                      diagnostics.connectedPeerCount,
                      diagnostics.peerCount
                    )
                  : settingsCopy.voice.diagnosticsMetricUnavailable
              }
            />
            <SummaryValue
              label={settingsCopy.voice.diagnosticsTransmissionTarget}
              value={transmissionSummary.value}
              hint={transmissionSummary.modeLabel}
            />
            <SummaryValue
              label={settingsCopy.voice.diagnosticsLastSample}
              value={
                sampleTime ?? settingsCopy.voice.diagnosticsMetricUnavailable
              }
            />
          </dl>

          <VoiceConnectionDiagnosticsDetails
            diagnostics={safeDiagnostics}
            mode="full"
          />

          <footer className={styles.footer}>
            <p>{settingsCopy.voice.diagnosticsReportPrivacyNote}</p>
            <button
              className={sharedStyles.secondaryAction}
              type="button"
              onClick={() => void copyDiagnosticReport()}
            >
              {settingsCopy.voice.diagnosticsCopyReport}
            </button>
          </footer>

          {copyStatus !== 'idle' ? (
            <p
              className={`${styles.copyStatus} ${
                copyStatus === 'error' ? styles.copyStatusError : ''
              }`}
              role="status"
            >
              {copyStatus === 'success'
                ? settingsCopy.voice.diagnosticsCopySuccess
                : settingsCopy.voice.diagnosticsCopyError}
            </p>
          ) : null}
        </div>
      </SettingsSection>
    </div>
  );
}

function SummaryValue({
  label,
  value,
  hint
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className={styles.summaryValue}>
      <dt>{label}</dt>
      <dd>{value}</dd>
      {hint ? <small>{hint}</small> : null}
    </div>
  );
}
