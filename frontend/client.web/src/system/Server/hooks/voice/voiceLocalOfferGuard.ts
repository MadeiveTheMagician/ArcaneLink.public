const defaultPendingOfferTimeoutMs = 10_000;

export type VoiceLocalOfferRunResult<T> =
  { status: 'completed'; value: T } | { status: 'superseded' };

type VoiceLocalOfferRequest = {
  requiresStable: boolean;
  priority: 'normal' | 'ice-restart';
  pendingTimeoutMs: number;
  operation: () => Promise<unknown>;
  resolve: (result: VoiceLocalOfferRunResult<unknown>) => void;
  reject: (reason?: unknown) => void;
  timeoutId: ReturnType<typeof setTimeout> | null;
};

type VoiceLocalOfferState = {
  makingOffer: boolean;
  pending: VoiceLocalOfferRequest | null;
};

const localOffersByPeer = new WeakMap<
  RTCPeerConnection,
  VoiceLocalOfferState
>();

function settleAsSuperseded(request: VoiceLocalOfferRequest) {
  if (request.timeoutId !== null) {
    clearTimeout(request.timeoutId);
    request.timeoutId = null;
  }
  request.resolve({ status: 'superseded' });
}

function canStartRequest(
  peer: RTCPeerConnection,
  request: VoiceLocalOfferRequest
) {
  return !request.requiresStable || peer.signalingState === 'stable';
}

function armPendingTimeout(
  peer: RTCPeerConnection,
  state: VoiceLocalOfferState,
  request: VoiceLocalOfferRequest
) {
  if (request.timeoutId !== null) {
    return;
  }
  request.timeoutId = setTimeout(() => {
    if (state.pending !== request) {
      return;
    }
    state.pending = null;
    settleAsSuperseded(request);
    localOffersByPeer.delete(peer);
  }, request.pendingTimeoutMs);
}

function flushVoiceLocalOfferState(
  peer: RTCPeerConnection,
  state: VoiceLocalOfferState
) {
  if (state.makingOffer || !state.pending) {
    return;
  }
  if (peer.signalingState === 'closed') {
    settleAsSuperseded(state.pending);
    state.pending = null;
    localOffersByPeer.delete(peer);
    return;
  }
  if (!canStartRequest(peer, state.pending)) {
    armPendingTimeout(peer, state, state.pending);
    return;
  }

  const request = state.pending;
  state.pending = null;
  if (request.timeoutId !== null) {
    clearTimeout(request.timeoutId);
    request.timeoutId = null;
  }
  state.makingOffer = true;
  void request
    .operation()
    .then((value) => request.resolve({ status: 'completed', value }))
    .catch(request.reject)
    .finally(() => {
      state.makingOffer = false;
      flushVoiceLocalOfferState(peer, state);
      if (!state.makingOffer && !state.pending) {
        localOffersByPeer.delete(peer);
      }
    });
}

export function isVoicePeerMakingLocalOffer(peer: RTCPeerConnection) {
  return localOffersByPeer.get(peer)?.makingOffer === true;
}

export function flushVoiceLocalOffer(peer: RTCPeerConnection) {
  const state = localOffersByPeer.get(peer);
  if (state) {
    flushVoiceLocalOfferState(peer, state);
  }
}

export function cancelPendingVoiceLocalOffer(peer: RTCPeerConnection) {
  const state = localOffersByPeer.get(peer);
  if (!state?.pending) {
    return;
  }
  settleAsSuperseded(state.pending);
  state.pending = null;
  if (!state.makingOffer) {
    localOffersByPeer.delete(peer);
  }
}

export function runVoiceLocalOffer<T>(
  peer: RTCPeerConnection,
  operation: () => Promise<T>,
  options: {
    requiresStable?: boolean;
    pendingTimeoutMs?: number;
    priority?: 'normal' | 'ice-restart';
  } = {}
): Promise<VoiceLocalOfferRunResult<T>> {
  const state = localOffersByPeer.get(peer) ?? {
    makingOffer: false,
    pending: null
  };
  localOffersByPeer.set(peer, state);

  return new Promise((resolve, reject) => {
    const request: VoiceLocalOfferRequest = {
      requiresStable: options.requiresStable ?? true,
      priority: options.priority ?? 'normal',
      pendingTimeoutMs:
        options.pendingTimeoutMs ?? defaultPendingOfferTimeoutMs,
      operation,
      resolve: resolve as (result: VoiceLocalOfferRunResult<unknown>) => void,
      reject,
      timeoutId: null
    };

    if (state.pending) {
      if (
        state.pending.priority === 'ice-restart' &&
        request.priority === 'normal'
      ) {
        settleAsSuperseded(request);
        return;
      }
      settleAsSuperseded(state.pending);
    }
    state.pending = request;

    if (!state.makingOffer) {
      flushVoiceLocalOfferState(peer, state);
    }
  });
}
