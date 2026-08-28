import { SystemIcon, voiceCopy } from '../../../../shared';
import {
  ServerMessagePanel,
  type ServerMessagePanelProps
} from '../../messages/ServerMessagePanel';

import styles from './VoiceSpaceChatPanel.module.css';

export type VoiceSpaceChatContentProps = Omit<
  ServerMessagePanelProps,
  'headerActions' | 'leadingAction' | 'titleIcon'
>;

type VoiceSpaceChatPanelProps = VoiceSpaceChatContentProps & {
  placement: 'workspace' | 'detached';
  onClose: () => void;
};

export function VoiceSpaceChatPanel({
  placement,
  onClose,
  ...messagePanelProps
}: VoiceSpaceChatPanelProps) {
  return (
    <div className={styles.panel} data-placement={placement}>
      <ServerMessagePanel
        {...messagePanelProps}
        titleIcon={<SystemIcon name="message" size={18} />}
        headerActions={
          <button
            className={styles.closeButton}
            type="button"
            aria-label={voiceCopy.channel.closeChat}
            title={voiceCopy.channel.closeChat}
            onClick={onClose}
          >
            <SystemIcon name="close" size={18} />
          </button>
        }
      />
    </div>
  );
}
