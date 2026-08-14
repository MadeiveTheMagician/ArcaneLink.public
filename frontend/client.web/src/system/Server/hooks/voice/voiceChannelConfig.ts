import {
  VoiceIceCredentialsError,
  voiceIceCredentialsClient,
  type VoiceIceCredentialsClient,
} from './voiceIceCredentialsClient'

const developmentPeerConfiguration: RTCConfiguration = {
  iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
  iceTransportPolicy: 'all',
}

type ResolveVoicePeerConfigurationOptions = {
  accessToken: string
  cacheScope: string
  allowDevelopmentFallback?: boolean
  isDevelopmentBuild?: boolean
  credentialsClient?: Pick<VoiceIceCredentialsClient, 'get'>
}

export async function resolveVoicePeerConfiguration({
  accessToken,
  cacheScope,
  allowDevelopmentFallback = isDevelopmentStunFallbackEnabled(),
  isDevelopmentBuild = import.meta.env?.DEV === true,
  credentialsClient = voiceIceCredentialsClient,
}: ResolveVoicePeerConfigurationOptions): Promise<RTCConfiguration> {
  try {
    const credentials = await credentialsClient.get({
      accessToken,
      cacheScope,
    })

    return {
      iceServers: credentials.iceServers,
      iceTransportPolicy: 'relay',
    }
  } catch (error) {
    if (allowDevelopmentFallback && isDevelopmentBuild) {
      console.warn(
        'TURN credentials unavailable. Using the explicitly enabled development STUN fallback.',
      )
      return developmentPeerConfiguration
    }

    if (error instanceof VoiceIceCredentialsError) {
      throw error
    }

    throw new VoiceIceCredentialsError(
      'request_failed',
      'TURN credentials are unavailable.',
      { cause: error },
    )
  }
}

export function describeIceServers(iceServers: RTCIceServer[] | undefined) {
  return iceServers?.map((server) => ({
    urls: server.urls,
    hasUsername: Boolean(server.username),
    hasCredential: Boolean(server.credential),
  }))
}

function isDevelopmentStunFallbackEnabled() {
  return (
    import.meta.env.DEV &&
    import.meta.env.VITE_VOICE_DEV_ALLOW_STUN_FALLBACK === 'true'
  )
}
