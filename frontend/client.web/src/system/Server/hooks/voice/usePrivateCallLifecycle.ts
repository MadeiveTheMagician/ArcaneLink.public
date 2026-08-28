import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { VoiceSettings } from '../../../shared/voice/voiceSettings'
import { createPrivateCallRingtonePlayer } from '../../../shared/voice/privateCallRingtone'
import {
  mergePrivateCallState,
  resolvePrivateCallAudioMode,
  selectIncomingPrivateCalls,
} from './privateCallModel'
import type { PrivateCallState } from './voiceChannelTypes'

type Options = {
  currentUserId: string
  voiceSettings: VoiceSettings
  locallyConnectedPrivateSpaceId: string | null
  onCallBecameActive: (call: PrivateCallState) => void
}

export function usePrivateCallLifecycle({
  currentUserId,
  voiceSettings,
  locallyConnectedPrivateSpaceId,
  onCallBecameActive,
}: Options) {
  const [callsById, setCallsById] = useState<Record<string, PrivateCallState>>({})
  const [dismissedCallIds, setDismissedCallIds] = useState<Set<string>>(() => new Set())
  const callsRef = useRef(callsById)
  const dismissedCallIdsRef = useRef(dismissedCallIds)
  const settingsRef = useRef(voiceSettings)
  const onCallBecameActiveRef = useRef(onCallBecameActive)
  const playerRef = useRef<ReturnType<typeof createPrivateCallRingtonePlayer> | null>(null)

  useEffect(() => { settingsRef.current = voiceSettings }, [voiceSettings])
  useEffect(() => { onCallBecameActiveRef.current = onCallBecameActive }, [onCallBecameActive])

  const applyPrivateCallState = useCallback((incoming: PrivateCallState) => {
    if (!incoming?.callId || !incoming.spaceId) return
    const callKey = incoming.callId.toLowerCase()
    const current = callsRef.current[callKey]
    const merged = mergePrivateCallState(current, incoming)
    if (merged === current) return
    callsRef.current = pruneCallHistory({
      ...callsRef.current,
      [callKey]: merged,
    })
    setCallsById(callsRef.current)
    if (merged.phase === 'active' && current?.phase !== 'active') {
      onCallBecameActiveRef.current(merged)
    }
  }, [])

  const replaceIncomingPrivateCalls = useCallback((incoming: PrivateCallState[]) => {
    const incomingIds = new Set(incoming.map((call) => call.callId.toLowerCase()))
    const nextDismissed = new Set(dismissedCallIdsRef.current)
    for (const call of Object.values(callsRef.current)) {
      if (
        call.ringingUserIds.some((id) => id.toLowerCase() === currentUserId.toLowerCase()) &&
        !incomingIds.has(call.callId.toLowerCase())
      ) {
        nextDismissed.add(call.callId)
      }
    }
    const boundedDismissed = boundDismissedCallIds(nextDismissed)
    dismissedCallIdsRef.current = boundedDismissed
    setDismissedCallIds(boundedDismissed)
    incoming.forEach(applyPrivateCallState)
  }, [applyPrivateCallState, currentUserId])

  const dismissPrivateCall = useCallback((callId: string) => {
    const next = new Set(dismissedCallIdsRef.current)
    next.add(callId)
    const bounded = boundDismissedCallIds(next)
    dismissedCallIdsRef.current = bounded
    setDismissedCallIds(bounded)
  }, [])

  const calls = useMemo(() => Object.values(callsById), [callsById])
  const incomingPrivateCalls = useMemo(
    () => selectIncomingPrivateCalls(calls, currentUserId, dismissedCallIds),
    [calls, currentUserId, dismissedCallIds],
  )
  const audioMode = useMemo(
    () => {
      const mode = resolvePrivateCallAudioMode(
        calls,
        currentUserId,
        dismissedCallIds,
      )
      if (mode !== 'outgoing') return mode
      const localSpaceId = locallyConnectedPrivateSpaceId
      return localSpaceId && calls.some(
        (call) =>
          call.spaceId.toLowerCase() === localSpaceId.toLowerCase() &&
          call.phase === 'ringing' &&
          call.caller.userId.toLowerCase() === currentUserId.toLowerCase(),
      )
        ? mode
        : null
    },
    [calls, currentUserId, dismissedCallIds, locallyConnectedPrivateSpaceId],
  )

  useEffect(() => {
    playerRef.current ??= createPrivateCallRingtonePlayer()
    if (audioMode) playerRef.current.play(audioMode, voiceSettings)
    else playerRef.current.stop()
  }, [audioMode, voiceSettings])

  useEffect(() => () => {
    playerRef.current?.dispose()
    playerRef.current = null
  }, [])

  return {
    privateCalls: calls,
    incomingPrivateCalls,
    applyPrivateCallState,
    replaceIncomingPrivateCalls,
    dismissPrivateCall,
    primePrivateCallAudio: () => {
      playerRef.current ??= createPrivateCallRingtonePlayer()
      playerRef.current.prime(settingsRef.current)
    },
  }
}

function pruneCallHistory(calls: Record<string, PrivateCallState>) {
  const entries = Object.entries(calls)
  if (entries.length <= 48) return calls
  const endedIds = entries
    .filter(([, call]) => call.phase === 'ended')
    .sort(([, left], [, right]) =>
      Date.parse(left.endedAt ?? left.startedAt) -
      Date.parse(right.endedAt ?? right.startedAt),
    )
    .slice(0, Math.max(0, entries.length - 32))
    .map(([callId]) => callId)
  if (!endedIds.length) return calls
  const next = { ...calls }
  endedIds.forEach((callId) => delete next[callId])
  return next
}

function boundDismissedCallIds(callIds: ReadonlySet<string>) {
  return new Set([...callIds].slice(-64))
}
