import type { VoiceTransmissionQualityProfile } from '../../../shared/voice/voiceSettings'
import type { VoiceConnectionQualityState } from './voiceConnectionQualityModel'

export type VoiceTransmissionQualityPlanReason =
  | 'fixed-profile'
  | 'adaptation-disabled'
  | 'adaptive-good'
  | 'adaptive-degraded'
  | 'adaptive-poor'
  | 'adaptive-transitional'

export type VoiceTransmissionQualityPlan = {
  requestedProfile: VoiceTransmissionQualityProfile
  maxBitrateBps: number
  isAdaptive: boolean
  reason: VoiceTransmissionQualityPlanReason
}

export type ResolveVoiceTransmissionQualityOptions = {
  qualityProfile: VoiceTransmissionQualityProfile
  adaptiveQuality: boolean
  diagnosticsQualityState: VoiceConnectionQualityState
}

/**
 * Nominal Opus ceilings for voice. Explicit profiles are deliberate user
 * overrides and therefore stay fixed even if adaptiveQuality is enabled.
 */
export const voiceTransmissionProfileMaxBitrateBps: Readonly<
  Record<VoiceTransmissionQualityProfile, number>
> = Object.freeze({
  automatic: 64_000,
  'data-saver': 24_000,
  balanced: 48_000,
  high: 96_000,
})

const automaticMaxBitrateByQuality: Readonly<
  Record<VoiceConnectionQualityState, number>
> = Object.freeze({
  connecting: 48_000,
  good: voiceTransmissionProfileMaxBitrateBps.automatic,
  degraded: 40_000,
  poor: voiceTransmissionProfileMaxBitrateBps['data-saver'],
  reconnecting: voiceTransmissionProfileMaxBitrateBps['data-saver'],
  disconnected: voiceTransmissionProfileMaxBitrateBps['data-saver'],
  unknown: voiceTransmissionProfileMaxBitrateBps.balanced,
})

/**
 * adaptiveQuality has intentionally narrow semantics: it enables diagnostics-
 * driven bitrate changes only for the automatic profile. Data saver, balanced
 * and high are fixed user choices. Automatic with adaptation disabled uses its
 * nominal 64 kbit/s ceiling.
 */
export function resolveVoiceTransmissionQualityPlan({
  qualityProfile,
  adaptiveQuality,
  diagnosticsQualityState,
}: ResolveVoiceTransmissionQualityOptions): VoiceTransmissionQualityPlan {
  if (qualityProfile !== 'automatic') {
    return {
      requestedProfile: qualityProfile,
      maxBitrateBps: voiceTransmissionProfileMaxBitrateBps[qualityProfile],
      isAdaptive: false,
      reason: 'fixed-profile',
    }
  }

  if (!adaptiveQuality) {
    return {
      requestedProfile: qualityProfile,
      maxBitrateBps: voiceTransmissionProfileMaxBitrateBps.automatic,
      isAdaptive: false,
      reason: 'adaptation-disabled',
    }
  }

  return {
    requestedProfile: qualityProfile,
    maxBitrateBps: automaticMaxBitrateByQuality[diagnosticsQualityState],
    isAdaptive: true,
    reason: resolveAdaptiveReason(diagnosticsQualityState),
  }
}

export function resolveVoiceTransmissionMaxBitrateBps(
  options: ResolveVoiceTransmissionQualityOptions,
) {
  return resolveVoiceTransmissionQualityPlan(options).maxBitrateBps
}

function resolveAdaptiveReason(
  qualityState: VoiceConnectionQualityState,
): VoiceTransmissionQualityPlanReason {
  if (qualityState === 'good') {
    return 'adaptive-good'
  }
  if (qualityState === 'degraded') {
    return 'adaptive-degraded'
  }
  if (qualityState === 'poor') {
    return 'adaptive-poor'
  }

  return 'adaptive-transitional'
}
