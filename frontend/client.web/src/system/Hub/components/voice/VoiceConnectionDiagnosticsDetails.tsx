import type { VoiceConnectionDiagnostics } from '../../../Server/hooks/voice/voiceChannelTypes'
import { voiceCopy } from '../../../shared/copy/voice.ru'
import styles from './VoiceConnectionDiagnosticsDetails.module.css'
import { formatVoiceCodecLabel } from './voiceConnectionDiagnosticsDisplay'

export type VoiceConnectionDiagnosticsDisplay = VoiceConnectionDiagnostics

type VoiceConnectionDiagnosticsDetailsProps = {
  diagnostics: VoiceConnectionDiagnosticsDisplay | null | undefined
  mode?: 'compact' | 'full'
}

const compactNumberFormatter = new Intl.NumberFormat('ru-RU', {
  maximumFractionDigits: 1,
})

export function VoiceConnectionDiagnosticsDetails({
  diagnostics,
  mode = 'compact',
}: VoiceConnectionDiagnosticsDetailsProps) {
  const codec = formatVoiceCodecLabel(diagnostics?.codec)
  const route = formatRouteLabel(diagnostics?.route)

  return (
    <dl
      className={`${styles.details} ${
        mode === 'full' ? styles.full : styles.compact
      }`}
      aria-label={voiceCopy.dock.diagnosticsMetrics}
    >
      <DiagnosticValue
        label={voiceCopy.dock.roundTripTime}
        value={formatMilliseconds(diagnostics?.roundTripTimeMs)}
      />
      <DiagnosticValue
        label={voiceCopy.dock.jitter}
        value={formatMilliseconds(diagnostics?.jitterMs)}
      />
      <DiagnosticValue
        label={voiceCopy.dock.packetLoss}
        value={formatPercent(diagnostics?.packetLossPercent)}
      />
      <DiagnosticValue
        label={voiceCopy.dock.inboundBitrate}
        value={formatBitrate(diagnostics?.inboundBitrateBps)}
      />
      <DiagnosticValue
        label={voiceCopy.dock.outboundBitrate}
        value={formatBitrate(diagnostics?.outboundBitrateBps)}
      />
      {codec && <DiagnosticValue label={voiceCopy.dock.codec} value={codec} />}
      {route && <DiagnosticValue label={voiceCopy.dock.route} value={route} />}
    </dl>
  )
}

function DiagnosticValue({ label, value }: { label: string; value: string }) {
  return (
    <div className={styles.metric}>
      <dt>{label}</dt>
      <dd title={value}>{value}</dd>
    </div>
  )
}

function formatMilliseconds(value: number | null | undefined) {
  return isDiagnosticNumber(value)
    ? `${compactNumberFormatter.format(value)} ${voiceCopy.dock.millisecondsShort}`
    : voiceCopy.dock.metricUnavailable
}

function formatPercent(value: number | null | undefined) {
  return isDiagnosticNumber(value)
    ? `${compactNumberFormatter.format(value)}%`
    : voiceCopy.dock.metricUnavailable
}

function formatBitrate(value: number | null | undefined) {
  if (!isDiagnosticNumber(value)) {
    return voiceCopy.dock.metricUnavailable
  }

  if (value >= 1_000_000) {
    return `${compactNumberFormatter.format(value / 1_000_000)} ${voiceCopy.dock.megabitsPerSecondShort}`
  }

  if (value >= 1_000) {
    return `${compactNumberFormatter.format(value / 1_000)} ${voiceCopy.dock.kilobitsPerSecondShort}`
  }

  return `${compactNumberFormatter.format(value)} ${voiceCopy.dock.bitsPerSecondShort}`
}

function normalizeDiagnosticLabel(value: string | null | undefined) {
  const normalized = value?.trim()
  return normalized ? normalized : null
}

function formatRouteLabel(value: string | null | undefined) {
  const normalized = normalizeDiagnosticLabel(value)
  if (!normalized) {
    return null
  }

  return normalized
    .split(/\s*\+\s*/)
    .map(formatSingleRoute)
    .join(' + ')
}

function formatSingleRoute(value: string) {
  const [path = 'unknown', protocol = 'unknown'] = value
    .trim()
    .toLowerCase()
    .split('/')

  if (path === 'unknown') {
    return voiceCopy.dock.routeUnknown
  }

  const pathLabel =
    path === 'direct'
      ? voiceCopy.dock.routeDirect
      : path === 'relay'
        ? voiceCopy.dock.routeRelay
        : voiceCopy.dock.routeUnknown

  if (pathLabel === voiceCopy.dock.routeUnknown) {
    return pathLabel
  }

  const protocolLabel =
    protocol === 'unknown'
      ? voiceCopy.dock.routeUnknown
      : protocol.toLocaleUpperCase('ru-RU')

  return `${pathLabel} · ${protocolLabel}`
}

function isDiagnosticNumber(value: number | null | undefined): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
}
