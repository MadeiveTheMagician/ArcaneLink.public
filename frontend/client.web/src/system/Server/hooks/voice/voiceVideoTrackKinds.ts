export type VoiceVideoTrackKind = 'camera' | 'screen';

const receiverKindByTrack = new WeakMap<
  MediaStreamTrack,
  VoiceVideoTrackKind
>();

export function registerVoiceVideoReceiverTrack(
  track: MediaStreamTrack,
  kind: VoiceVideoTrackKind
) {
  receiverKindByTrack.set(track, kind);
}

export function getVoiceVideoReceiverTrackKind(track: MediaStreamTrack) {
  return receiverKindByTrack.get(track) ?? null;
}
