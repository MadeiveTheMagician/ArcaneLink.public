export type ResumableVoiceAudioContext = {
  readonly state: AudioContextState
  resume: () => Promise<void>
}

export function resolveVoiceAudioContext<TContext extends { state: AudioContextState }>(
  existingContext: TContext | null,
  createContext: () => TContext,
) {
  return !existingContext || existingContext.state === 'closed'
    ? createContext()
    : existingContext
}

export async function resumeVoiceAudioContext(
  audioContext: ResumableVoiceAudioContext | null,
) {
  if (!audioContext || audioContext.state === 'closed') {
    return false
  }
  if (audioContext.state === 'running') {
    return true
  }

  try {
    await audioContext.resume()
  } catch {
    return false
  }

  return (audioContext.state as AudioContextState) === 'running'
}
