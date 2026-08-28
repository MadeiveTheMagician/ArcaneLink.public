import { useCallback, useEffect, useRef, useState } from 'react'
import { apiJson } from '../../../../shared/api/api'
import type {
  ServerMemberDetailsResponse,
  ServerMemberViewerProfileResponse,
} from '../../../../shared/types'
import type { ServerMemberProfileAnchor } from '../../components/member-profile/serverMemberProfileModel'

type ServerMemberProfileOverlay = {
  mode: 'compact' | 'full'
  member: ServerMemberDetailsResponse
  anchor: ServerMemberProfileAnchor | null
  focusTarget: HTMLElement | null
}

export function useServerMemberProfileOverlay({
  accessToken,
  serverId,
}: {
  accessToken: string
  serverId: string
}) {
  const [overlay, setOverlay] = useState<ServerMemberProfileOverlay | null>(null)
  const [profile, setProfile] = useState<ServerMemberViewerProfileResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const overlayRef = useRef<ServerMemberProfileOverlay | null>(null)
  const requestVersionRef = useRef(0)
  const focusRestoreFrameRef = useRef<number | null>(null)

  const cancelPendingFocusRestore = useCallback(() => {
    if (focusRestoreFrameRef.current === null || typeof window === 'undefined') return

    window.cancelAnimationFrame(focusRestoreFrameRef.current)
    focusRestoreFrameRef.current = null
  }, [])

  const scheduleFocusRestore = useCallback((focusTarget: HTMLElement | null) => {
    if (typeof document === 'undefined' || typeof window === 'undefined') return

    cancelPendingFocusRestore()
    const frameId = window.requestAnimationFrame(() => {
      if (focusRestoreFrameRef.current === frameId) {
        focusRestoreFrameRef.current = null
      }
      if (overlayRef.current !== null) return

      const workspace = document.querySelector<HTMLElement>('[data-server-workspace]')
      const target = focusTarget?.isConnected ? focusTarget : workspace
      target?.focus({ preventScroll: true })
    })
    focusRestoreFrameRef.current = frameId
  }, [cancelPendingFocusRestore])

  const loadProfile = useCallback(async (member: ServerMemberDetailsResponse) => {
    const requestVersion = ++requestVersionRef.current

    setError(null)
    setProfile(null)
    setIsLoading(true)
    try {
      const loaded = await apiJson<ServerMemberViewerProfileResponse>(
        `/api/servers/${serverId}/member-profiles/${member.userId}`,
        { accessToken },
      )
      if (requestVersionRef.current !== requestVersion) return

      setProfile(loaded)
    } catch (reason) {
      if (requestVersionRef.current !== requestVersion) return
      setError(reason instanceof Error ? reason.message : 'Unknown error')
    } finally {
      if (requestVersionRef.current === requestVersion) setIsLoading(false)
    }
  }, [accessToken, serverId])

  useEffect(() => {
    const focusTarget = overlayRef.current?.focusTarget ?? null
    requestVersionRef.current += 1
    overlayRef.current = null
    setOverlay(null)
    setProfile(null)
    setError(null)
    setIsLoading(false)
    if (focusTarget) scheduleFocusRestore(focusTarget)
  }, [scheduleFocusRestore, serverId])

  useEffect(() => cancelPendingFocusRestore, [cancelPendingFocusRestore])

  const openCompact = useCallback((
    member: ServerMemberDetailsResponse,
    anchor: ServerMemberProfileAnchor,
    focusTarget: HTMLElement,
  ) => {
    cancelPendingFocusRestore()
    const nextOverlay = { mode: 'compact', member, anchor, focusTarget } as const
    overlayRef.current = nextOverlay
    setOverlay(nextOverlay)
    void loadProfile(member)
  }, [cancelPendingFocusRestore, loadProfile])

  const openFull = useCallback((
    member: ServerMemberDetailsResponse,
    focusTarget: HTMLElement | null = null,
  ) => {
    cancelPendingFocusRestore()
    const nextOverlay = { mode: 'full', member, anchor: null, focusTarget } as const
    overlayRef.current = nextOverlay
    setOverlay(nextOverlay)
    void loadProfile(member)
  }, [cancelPendingFocusRestore, loadProfile])

  const expandToFull = useCallback(() => {
    setOverlay((current) => {
      const nextOverlay = current
        ? { ...current, mode: 'full' as const, anchor: null }
        : null
      overlayRef.current = nextOverlay
      return nextOverlay
    })
  }, [])

  const close = useCallback(() => {
    const focusTarget = overlayRef.current?.focusTarget ?? null
    requestVersionRef.current += 1
    overlayRef.current = null
    setOverlay(null)
    setProfile(null)
    setError(null)
    setIsLoading(false)
    scheduleFocusRestore(focusTarget)
  }, [scheduleFocusRestore])

  const retry = useCallback(() => {
    if (overlay) void loadProfile(overlay.member)
  }, [loadProfile, overlay])

  return {
    close,
    error,
    expandToFull,
    isLoading,
    openCompact,
    openFull,
    overlay,
    profile,
    retry,
  }
}
