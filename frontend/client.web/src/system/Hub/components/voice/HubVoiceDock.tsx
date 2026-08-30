import {
  type CSSProperties,
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState
} from 'react';

import type { UserResponse } from '../../../../shared/types';
import { MobileVoiceDock } from '../../../Mobile/components/MobileVoiceDock';
import type {
  ConnectedVoiceChannel,
  VoiceChannelController
} from '../../../Server/hooks/voice/useVoiceChannel';
import { SystemIcon, voiceCopy } from '../../../shared';
import { useDismissableLayer } from '../../../shared/hooks/useDismissableLayer';
import { VoiceConnectionStatusIcon } from '../../../shared/icons/VoiceConnectionStatusIcon';
import type { VoiceConnectionStatusIconState } from '../../../shared/icons/VoiceConnectionStatusIcon';
import { requestSystemSettingsNavigation } from '../../../shared/navigation/systemSettingsNavigation';
import { VoiceConnectionDiagnosticsDetails } from './VoiceConnectionDiagnosticsDetails';
import type { VoiceConnectionDiagnosticsDisplay } from './VoiceConnectionDiagnosticsDetails';

import styles from './HubVoiceDock.module.css';

type HubVoiceDockProps = {
  avatarSrc: string;
  isServerPanelOpen: boolean;
  isServerPanelPinned: boolean;
  onOpenSettings: () => void;
  onOpenActiveVoiceSpace: () => void;
  onToggleServerPanel: () => void;
  serverTitle: string | null;
  user: UserResponse;
  voice: VoiceChannelController;
};

export function HubVoiceDock({
  avatarSrc,
  isServerPanelOpen,
  isServerPanelPinned,
  onOpenSettings,
  onOpenActiveVoiceSpace,
  onToggleServerPanel,
  serverTitle,
  user,
  voice
}: HubVoiceDockProps) {
  const connectedChannel = voice.connectedChannel;
  const connectionTargetChannel = voice.connectionTargetChannel;
  const connectionDiagnostics = voice.connectionDiagnostics;
  const isTargetChannelPending =
    voice.voiceLifecycleState === 'joining' ||
    voice.voiceLifecycleState === 'switching';
  const displayChannel =
    (isTargetChannelPending ? connectionTargetChannel : null) ??
    connectedChannel ??
    connectionTargetChannel;
  const isConnected = Boolean(connectedChannel);
  const connectedConnectionTitle = createConnectionTitle(
    connectedChannel,
    serverTitle
  );
  const connectionTitle =
    createConnectionTitle(displayChannel, serverTitle) ??
    voiceCopy.dock.connectionPreparing;
  const connectionState = resolveConnectionState(
    connectionDiagnostics,
    voice.voiceLifecycleState,
    isConnected
  );
  const connectionStateLabel = resolveConnectionStateLabel(
    connectionState,
    voice.voiceLifecycleState,
    Boolean(voice.voiceError),
    isConnected && connectionDiagnostics?.peerCount === 0
  );
  const shouldShowDesktopConnection =
    Boolean(displayChannel) || voice.voiceLifecycleState !== 'idle';
  const [isConnectionVisible, setIsConnectionVisible] = useState(
    shouldShowDesktopConnection
  );
  const [isConnectionClosing, setIsConnectionClosing] = useState(false);
  const [displayConnectionTitle, setDisplayConnectionTitle] =
    useState(connectionTitle);
  const [isMobileConnectionVisible, setIsMobileConnectionVisible] =
    useState(isConnected);
  const [isMobileConnectionClosing, setIsMobileConnectionClosing] =
    useState(false);
  const [displayMobileConnectionTitle, setDisplayMobileConnectionTitle] =
    useState(connectedConnectionTitle);
  const [isDiagnosticsOpen, setIsDiagnosticsOpen] = useState(false);
  const diagnosticsId = useId();
  const diagnosticsTriggerRef = useRef<HTMLButtonElement | null>(null);
  const diagnosticsCloseRef = useRef<HTMLButtonElement | null>(null);
  const diagnosticsLayerRef = useRef<HTMLElement | null>(null);
  const [diagnosticsAvailableHeight, setDiagnosticsAvailableHeight] =
    useState(420);
  const closeDiagnostics = useCallback(() => {
    setIsDiagnosticsOpen(false);
    window.requestAnimationFrame(() => diagnosticsTriggerRef.current?.focus());
  }, []);
  const isExpanded = shouldShowDesktopConnection || isConnectionVisible;

  useDismissableLayer({
    isOpen: isDiagnosticsOpen,
    layerRef: diagnosticsLayerRef,
    onDismiss: closeDiagnostics,
    triggerRef: diagnosticsTriggerRef
  });

  useEffect(() => {
    if (shouldShowDesktopConnection) {
      setIsConnectionVisible(true);
      setIsConnectionClosing(false);
      setDisplayConnectionTitle(connectionTitle);
      return;
    }

    if (!isConnectionVisible) {
      return;
    }

    setIsConnectionClosing(true);
    const timeoutId = window.setTimeout(() => {
      setIsConnectionVisible(false);
      setIsConnectionClosing(false);
      setDisplayConnectionTitle(voiceCopy.dock.connectionPreparing);
    }, 190);

    return () => window.clearTimeout(timeoutId);
  }, [connectionTitle, isConnectionVisible, shouldShowDesktopConnection]);

  useEffect(() => {
    if (isConnected) {
      setIsMobileConnectionVisible(true);
      setIsMobileConnectionClosing(false);
      setDisplayMobileConnectionTitle(connectedConnectionTitle);
      return;
    }

    if (!isMobileConnectionVisible) {
      return;
    }

    setIsMobileConnectionClosing(true);
    const timeoutId = window.setTimeout(() => {
      setIsMobileConnectionVisible(false);
      setIsMobileConnectionClosing(false);
      setDisplayMobileConnectionTitle(null);
    }, 190);

    return () => window.clearTimeout(timeoutId);
  }, [connectedConnectionTitle, isConnected, isMobileConnectionVisible]);

  useEffect(() => {
    if (!shouldShowDesktopConnection) {
      setIsDiagnosticsOpen(false);
    }
  }, [shouldShowDesktopConnection]);

  useLayoutEffect(() => {
    if (!isDiagnosticsOpen) {
      return undefined;
    }

    function updateAvailableHeight() {
      const trigger = diagnosticsTriggerRef.current;
      if (!trigger) {
        return;
      }

      const visualViewportTop = window.visualViewport?.offsetTop ?? 0;
      const availableHeight = Math.floor(
        trigger.getBoundingClientRect().top - visualViewportTop - 18
      );
      setDiagnosticsAvailableHeight(
        Math.max(48, Math.min(420, availableHeight))
      );
    }

    updateAvailableHeight();
    diagnosticsCloseRef.current?.focus();
    window.addEventListener('resize', updateAvailableHeight);
    window.visualViewport?.addEventListener('resize', updateAvailableHeight);
    window.visualViewport?.addEventListener('scroll', updateAvailableHeight);

    return () => {
      window.removeEventListener('resize', updateAvailableHeight);
      window.visualViewport?.removeEventListener(
        'resize',
        updateAvailableHeight
      );
      window.visualViewport?.removeEventListener(
        'scroll',
        updateAvailableHeight
      );
    };
  }, [isDiagnosticsOpen]);

  function openDetailedVoiceSettings() {
    setIsDiagnosticsOpen(false);
    requestSystemSettingsNavigation('voice-diagnostics');
  }

  const showConnectionActions = isConnected || isConnectionClosing;

  return (
    <>
      <aside
        className={`${styles.dock} ${isServerPanelOpen ? styles.railOpen : ''} ${
          isExpanded ? styles.connected : ''
        } ${!isServerPanelPinned ? styles.withRailToggle : ''} ${
          !isConnected ? styles.mobileDisconnected : ''
        }`}
        aria-label={voiceCopy.dock.label}
      >
        {isConnectionVisible && (
          <>
            <div
              className={`${styles.connectionOverview} ${
                isConnectionClosing ? styles.connectionClosing : ''
              }`}
              data-state={connectionState}
            >
              <button
                ref={diagnosticsTriggerRef}
                className={styles.connectionSummary}
                type="button"
                aria-controls={diagnosticsId}
                aria-expanded={isDiagnosticsOpen}
                aria-haspopup="dialog"
                aria-label={`${voiceCopy.dock.openDiagnostics}: ${connectionStateLabel}`}
                onClick={() => setIsDiagnosticsOpen((isOpen) => !isOpen)}
              >
                <span className={styles.connectionSignal}>
                  <VoiceConnectionStatusIcon
                    className={styles.connectionSignalIcon}
                    state={connectionState}
                  />
                </span>
                <span className={styles.connectionText} aria-live="polite">
                  <strong className="ui-ellipsis">
                    {connectionStateLabel}
                  </strong>
                  <small className="ui-ellipsis">
                    {displayConnectionTitle}
                  </small>
                </span>
                <SystemIcon
                  className={styles.connectionChevron}
                  name="chevron-down"
                  size={16}
                />
              </button>

              {isDiagnosticsOpen && (
                <section
                  ref={diagnosticsLayerRef}
                  id={diagnosticsId}
                  className={styles.diagnosticsPopover}
                  style={
                    {
                      '--voice-diagnostics-available-height': `${diagnosticsAvailableHeight}px`
                    } as CSSProperties
                  }
                  role="dialog"
                  aria-label={voiceCopy.dock.diagnostics}
                >
                  <header className={styles.diagnosticsHeader}>
                    <div>
                      <strong>{voiceCopy.dock.diagnostics}</strong>
                      <small>{voiceCopy.dock.diagnosticsDescription}</small>
                    </div>
                    <button
                      ref={diagnosticsCloseRef}
                      className={styles.diagnosticsClose}
                      type="button"
                      aria-label={voiceCopy.participantMenu.close}
                      onClick={closeDiagnostics}
                    >
                      <SystemIcon name="close" size={16} />
                    </button>
                  </header>

                  <div className={styles.diagnosticsStatus}>
                    <VoiceConnectionStatusIcon
                      className={styles.diagnosticsStatusIcon}
                      state={connectionState}
                    />
                    <span>{connectionStateLabel}</span>
                  </div>

                  <VoiceConnectionDiagnosticsDetails
                    diagnostics={connectionDiagnostics}
                    mode="compact"
                  />

                  {voice.voiceError && (
                    <p className={styles.diagnosticsError} role="status">
                      {voice.voiceError}
                    </p>
                  )}

                  <button
                    className={styles.diagnosticsSettings}
                    type="button"
                    onClick={openDetailedVoiceSettings}
                  >
                    <span>{voiceCopy.dock.openVoiceSettings}</span>
                    <SystemIcon name="chevron-right" size={16} />
                  </button>
                </section>
              )}
            </div>

            {showConnectionActions && (
              <div
                className={`${styles.connectionActions} ${
                  isConnectionClosing ? styles.connectionClosing : ''
                } ${
                  connectedChannel?.channelScope === 'private'
                    ? styles.privateConnectionActions
                    : ''
                }`}
              >
                {connectedChannel?.channelScope === 'private' && (
                  <button
                    className={`${styles.connectionAction} ${styles.returnToCallAction}`}
                    type="button"
                    onClick={onOpenActiveVoiceSpace}
                    aria-label={voiceCopy.dock.returnToPrivateCall}
                    title={voiceCopy.dock.returnToPrivateCall}
                  >
                    <SystemIcon name="message" size={20} />
                  </button>
                )}
                <button
                  className={`${styles.connectionAction} ${
                    voice.isCameraEnabled ? styles.active : ''
                  }`}
                  type="button"
                  onClick={() => void voice.toggleCamera()}
                  aria-label={voiceCopy.controls.camera}
                >
                  <SystemIcon name="camera" size={20} />
                </button>
                <button
                  className={`${styles.connectionAction} ${
                    voice.isScreenSharing ? styles.active : ''
                  }`}
                  type="button"
                  onClick={() => void voice.toggleScreenShare()}
                  aria-label={voiceCopy.controls.screenOn}
                >
                  <SystemIcon name="screen" size={20} />
                </button>
                <button
                  className={`${styles.connectionAction} ${styles.leaveAction}`}
                  type="button"
                  onClick={() => void voice.leaveVoiceChannel()}
                  aria-label={voiceCopy.controls.leave}
                >
                  <SystemIcon name="leave" size={20} />
                </button>
              </div>
            )}
          </>
        )}

        {!isServerPanelPinned && (
          <button
            className={`${styles.railToggle} ${
              isServerPanelOpen ? styles.railToggleOpen : ''
            }`}
            type="button"
            onClick={onToggleServerPanel}
            aria-label={
              isServerPanelOpen
                ? voiceCopy.dock.closeServerRail
                : voiceCopy.dock.openServerRail
            }
            aria-expanded={isServerPanelOpen}
          >
            <SystemIcon
              className={styles.railToggleIcon}
              name="chevron-right"
              size={20}
            />
          </button>
        )}

        <span className={styles.avatarFrame} aria-hidden="true">
          <img className={styles.avatar} src={avatarSrc} alt="" />
        </span>
        <div className={styles.identity}>
          <strong className="ui-ellipsis">{user.displayName}</strong>
          <small className="ui-ellipsis">
            {connectedChannel?.title ?? voiceCopy.state.notConnected}
          </small>
        </div>
        <div className={styles.controls}>
          <button
            className={`${styles.control} ${voice.isMuted ? styles.active : ''}`}
            type="button"
            aria-label={voiceCopy.dock.microphone}
            onClick={voice.toggleMuted}
          >
            <SystemIcon
              className={styles.controlIcon}
              name={voice.isMuted ? 'mic-off' : 'mic-on'}
              size={22}
              tone={voice.isMuted ? 'danger' : 'default'}
            />
          </button>
          <button
            className={`${styles.control} ${voice.isDeafened ? styles.active : ''}`}
            type="button"
            aria-label={voiceCopy.dock.sound}
            onClick={voice.toggleDeafened}
          >
            <SystemIcon
              className={styles.controlIcon}
              name={voice.isDeafened ? 'headphones-off' : 'headphones-on'}
              size={22}
              tone={voice.isDeafened ? 'danger' : 'default'}
            />
          </button>
          <button
            className={`${styles.control} ${styles.settingsControl}`}
            type="button"
            aria-label={voiceCopy.dock.systemSettings}
            onClick={onOpenSettings}
          >
            <SystemIcon
              className={styles.controlIcon}
              name="settings"
              size={22}
            />
          </button>
        </div>
      </aside>

      {isMobileConnectionVisible && (
        <MobileVoiceDock
          avatarSrc={avatarSrc}
          connectionTitle={displayMobileConnectionTitle}
          isClosing={isMobileConnectionClosing}
          onOpenActiveVoiceSpace={onOpenActiveVoiceSpace}
          onOpenSettings={onOpenSettings}
          user={user}
          voice={voice}
        />
      )}
    </>
  );
}

function createConnectionTitle(
  channel: ConnectedVoiceChannel | null | undefined,
  serverTitle: string | null
) {
  if (!channel) {
    return null;
  }

  return channel.channelScope === 'private'
    ? `${voiceCopy.dock.privateConversation} / ${channel.title}`
    : `${serverTitle ?? voiceCopy.dock.server} / ${channel.title}`;
}

function resolveConnectionState(
  diagnostics: VoiceConnectionDiagnosticsDisplay | null,
  lifecycleState: VoiceChannelController['voiceLifecycleState'],
  isConnected: boolean
): VoiceConnectionStatusIconState {
  if (lifecycleState === 'joining' || lifecycleState === 'switching') {
    return 'connecting';
  }

  if (lifecycleState === 'reconnecting') {
    return 'reconnecting';
  }

  if (
    lifecycleState === 'error' ||
    lifecycleState === 'leaving' ||
    (lifecycleState === 'idle' && !isConnected)
  ) {
    return 'disconnected';
  }

  return (
    diagnostics?.qualityState ?? (isConnected ? 'unknown' : 'disconnected')
  );
}

function resolveConnectionStateLabel(
  state: VoiceConnectionStatusIconState,
  lifecycleState: VoiceChannelController['voiceLifecycleState'],
  hasError: boolean,
  isSoloConnection: boolean
) {
  switch (state) {
    case 'connecting':
      return lifecycleState === 'switching'
        ? voiceCopy.dock.switching
        : voiceCopy.dock.connecting;
    case 'good':
      return voiceCopy.dock.connected;
    case 'degraded':
      return voiceCopy.dock.degraded;
    case 'poor':
      return voiceCopy.dock.poor;
    case 'reconnecting':
      return voiceCopy.dock.reconnecting;
    case 'disconnected':
      if (lifecycleState === 'leaving') {
        return voiceCopy.dock.disconnecting;
      }

      return hasError
        ? voiceCopy.dock.unavailable
        : voiceCopy.dock.disconnected;
    case 'unknown':
      if (lifecycleState === 'connected' && isSoloConnection) {
        return voiceCopy.dock.connected;
      }

      return lifecycleState === 'connected'
        ? voiceCopy.dock.qualityUnknown
        : voiceCopy.dock.unknown;
  }
}
