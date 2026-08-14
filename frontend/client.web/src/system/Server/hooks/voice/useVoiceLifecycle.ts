import { useRef, useState } from 'react'
import type { VoiceLifecycleState } from './voiceChannelTypes'

export function useVoiceLifecycle() {
  const voiceOperationIdRef = useRef(0)
  const [voiceLifecycleState, setVoiceLifecycleState] =
    useState<VoiceLifecycleState>('idle')
  const isVoiceConnecting =
    voiceLifecycleState === 'joining' ||
    voiceLifecycleState === 'switching' ||
    voiceLifecycleState === 'reconnecting'

  function beginVoiceOperation(nextState: VoiceLifecycleState) {
    voiceOperationIdRef.current += 1
    setVoiceLifecycleState(nextState)
    return voiceOperationIdRef.current
  }

  function invalidateVoiceOperations() {
    voiceOperationIdRef.current += 1
  }

  function isCurrentVoiceOperation(operationId: number) {
    return voiceOperationIdRef.current === operationId
  }

  function setVoiceLifecycle(nextState: VoiceLifecycleState) {
    setVoiceLifecycleState(nextState)
  }

  function getCurrentVoiceOperationId() {
    return voiceOperationIdRef.current
  }

  return {
    voiceLifecycleState,
    isVoiceConnecting,
    beginVoiceOperation,
    invalidateVoiceOperations,
    isCurrentVoiceOperation,
    setVoiceLifecycle,
    getCurrentVoiceOperationId,
  }
}
