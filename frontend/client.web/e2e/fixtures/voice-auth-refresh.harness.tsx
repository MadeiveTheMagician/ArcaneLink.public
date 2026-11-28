import '@vitejs/plugin-react/preamble'
import { useState } from 'react'
import { createRoot } from 'react-dom/client'
import { useVoiceChannel } from '../../src/system/Server/hooks/voice/useVoiceChannel'

const voiceChannel = {
  serverId: 'server-1',
  spaceId: 'voice-room-1',
  title: 'Voice room',
  channelScope: 'server' as const,
}

function VoiceAuthRefreshHarness() {
  const [credentials, setCredentials] = useState({
    accessToken: 'initial-token',
    deviceSessionId: 'device-1',
  })
  const voice = useVoiceChannel(
    credentials.accessToken,
    'same-user',
    credentials.deviceSessionId,
  )

  return (
    <main>
      <button onClick={() => void voice.joinVoiceChannel(voiceChannel)}>Join voice</button>
      <button onClick={voice.toggleMuted}>Toggle microphone</button>
      <button onClick={() => setCredentials({ accessToken: 'refreshed-token', deviceSessionId: 'device-1' })}>
        Rotate access token
      </button>
      <button onClick={() => setCredentials({ accessToken: 'replacement-token', deviceSessionId: 'device-2' })}>
        Change device session
      </button>
      <output data-testid="voice-state">{voice.voiceLifecycleState}</output>
      <output data-testid="microphone">{voice.hasLocalAudioTrack ? 'live' : 'stopped'}</output>
    </main>
  )
}

createRoot(document.getElementById('root')!).render(<VoiceAuthRefreshHarness />)
