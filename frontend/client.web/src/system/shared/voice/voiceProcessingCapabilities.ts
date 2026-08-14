export type VoiceProcessingCapabilities = {
  echoCancellation: boolean
  noiseSuppression: boolean
  autoGainControl: boolean
}

type SupportedConstraintsProvider = {
  getSupportedConstraints?: () => MediaTrackSupportedConstraints
}

export function getVoiceProcessingCapabilities(
  mediaDevices?: SupportedConstraintsProvider | null,
): VoiceProcessingCapabilities {
  const candidate =
    mediaDevices === undefined
      ? typeof navigator === 'undefined'
        ? null
        : navigator.mediaDevices
      : mediaDevices

  if (typeof candidate?.getSupportedConstraints !== 'function') {
    return unsupportedVoiceProcessingCapabilities()
  }

  try {
    const constraints = candidate.getSupportedConstraints()
    return {
      echoCancellation: constraints.echoCancellation === true,
      noiseSuppression: constraints.noiseSuppression === true,
      autoGainControl: constraints.autoGainControl === true,
    }
  } catch {
    return unsupportedVoiceProcessingCapabilities()
  }
}

export function refineVoiceProcessingCapabilities(
  declaredCapabilities: VoiceProcessingCapabilities,
  appliedSettings: MediaTrackSettings | null | undefined,
): VoiceProcessingCapabilities {
  if (!appliedSettings) {
    return declaredCapabilities
  }

  return {
    echoCancellation:
      declaredCapabilities.echoCancellation &&
      hasOwnSetting(appliedSettings, 'echoCancellation'),
    noiseSuppression:
      declaredCapabilities.noiseSuppression &&
      hasOwnSetting(appliedSettings, 'noiseSuppression'),
    autoGainControl:
      declaredCapabilities.autoGainControl &&
      hasOwnSetting(appliedSettings, 'autoGainControl'),
  }
}

function unsupportedVoiceProcessingCapabilities(): VoiceProcessingCapabilities {
  return {
    echoCancellation: false,
    noiseSuppression: false,
    autoGainControl: false,
  }
}

function hasOwnSetting(settings: MediaTrackSettings, key: string) {
  return Object.prototype.hasOwnProperty.call(settings, key)
}
