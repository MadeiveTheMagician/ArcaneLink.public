import type { VoiceChannelController } from '../../../Server/hooks/voice/useVoiceChannel'
import { voiceCopy } from '../../../shared'
import styles from './HubVoiceParticipantsPanel.module.css'

type HubVoiceParticipantsPanelProps = {
  className?: string
  voice: VoiceChannelController
}

export function HubVoiceParticipantsPanel({
  className,
  voice,
}: HubVoiceParticipantsPanelProps) {
  const participants = voice.connectedChannel
    ? (voice.participantsBySpaceId[voice.connectedChannel.spaceId] ?? [])
    : []

  return (
    <aside
      className={`${styles.panel} ${className ?? ''} ui-panel`}
      aria-label={voiceCopy.panel.activity}
    >
      <header className={styles.header}>
        <span>{voiceCopy.panel.title}</span>
        <strong>{participants.length}</strong>
      </header>
      <div className={`${styles.list} ui-scrollbar-none`}>
        {!voice.connectedChannel && (
          <p className={styles.empty}>{voiceCopy.state.noChannel}</p>
        )}
        {voice.connectedChannel && participants.length === 0 && (
          <p className={styles.empty}>{voiceCopy.state.noParticipants}</p>
        )}
        {participants.map((participant) => (
          <article key={participant.userId} className={styles.participant}>
            <span className={`${styles.avatar} ui-frame`} aria-hidden="true">
              {participant.displayName.slice(0, 1).toUpperCase()}
            </span>
            <span>
              <strong className="ui-ellipsis">{participant.displayName}</strong>
              <small className="ui-ellipsis">@{participant.login}</small>
            </span>
          </article>
        ))}
      </div>
    </aside>
  )
}
