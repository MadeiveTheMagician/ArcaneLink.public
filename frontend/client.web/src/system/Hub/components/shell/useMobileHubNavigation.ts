import { useEffect, useRef, useState } from 'react'
import type { MobileHubTab } from '../../../Mobile/components/MobileHubNav'
import type { HubWorkspace } from './useHubWorkspace'

type MobilePageTransitionDirection = 'left' | 'right' | null

const mobileTabOrder: MobileHubTab[] = [
  'servers',
  'messages',
  'profile',
  'menu',
]

export const MOBILE_PAGE_TRANSITION_DURATION_MS = 350

type UseMobileHubNavigationOptions = {
  activeWorkspace: HubWorkspace
  initialTab?: MobileHubTab
  showProfileWorkspace: () => void
  showServersWorkspace: () => void
}

export function useMobileHubNavigation({
  activeWorkspace,
  initialTab = 'profile',
  showProfileWorkspace,
  showServersWorkspace,
}: UseMobileHubNavigationOptions) {
  const [mobileTab, setMobileTab] = useState<MobileHubTab>(initialTab)
  const [isMobilePageTransitioning, setIsMobilePageTransitioning] =
    useState(false)
  const [mobilePageTransitionDirection, setMobilePageTransitionDirection] =
    useState<MobilePageTransitionDirection>(null)
  const [isMobilePrivateChatClosing, setIsMobilePrivateChatClosing] =
    useState(false)
  const mobileTransitionTimeoutRef = useRef<number | null>(null)
  const mobilePrivateChatCloseTimeoutRef = useRef<number | null>(null)

  useEffect(() => {
    if (activeWorkspace === 'servers') {
      setMobileTab('servers')
      return
    }

    if (activeWorkspace === 'profile') {
      setMobileTab((current) => (current === 'messages' ? current : 'profile'))
      return
    }

    if (activeWorkspace === 'private-space') {
      setMobileTab('messages')
    }
  }, [activeWorkspace])

  useEffect(() => {
    return () => {
      if (mobileTransitionTimeoutRef.current !== null) {
        window.clearTimeout(mobileTransitionTimeoutRef.current)
      }

      if (mobilePrivateChatCloseTimeoutRef.current !== null) {
        window.clearTimeout(mobilePrivateChatCloseTimeoutRef.current)
      }
    }
  }, [])

  function switchMobileTab(nextTab: MobileHubTab, action?: () => void) {
    if (nextTab !== mobileTab) {
      if (mobileTransitionTimeoutRef.current !== null) {
        window.clearTimeout(mobileTransitionTimeoutRef.current)
      }

      const currentIndex = mobileTabOrder.indexOf(mobileTab)
      const nextIndex = mobileTabOrder.indexOf(nextTab)

      setIsMobilePageTransitioning(true)
      setMobilePageTransitionDirection(
        nextIndex < currentIndex ? 'left' : 'right',
      )
      mobileTransitionTimeoutRef.current = window.setTimeout(() => {
        setIsMobilePageTransitioning(false)
        setMobilePageTransitionDirection(null)
        mobileTransitionTimeoutRef.current = null
      }, MOBILE_PAGE_TRANSITION_DURATION_MS)
    }

    setMobileTab(nextTab)
    action?.()
  }

  function closeMobilePrivateChat() {
    if (mobileTab !== 'messages' || activeWorkspace !== 'private-space') {
      switchMobileTab('messages', showProfileWorkspace)
      return
    }

    if (isMobilePrivateChatClosing) {
      return
    }

    if (mobilePrivateChatCloseTimeoutRef.current !== null) {
      window.clearTimeout(mobilePrivateChatCloseTimeoutRef.current)
    }

    setIsMobilePrivateChatClosing(true)
    mobilePrivateChatCloseTimeoutRef.current = window.setTimeout(() => {
      showProfileWorkspace()
      setIsMobilePrivateChatClosing(false)
      mobilePrivateChatCloseTimeoutRef.current = null
    }, MOBILE_PAGE_TRANSITION_DURATION_MS)
  }

  return {
    mobileTab,
    isMobilePageTransitioning,
    mobilePageTransitionDirection,
    isMobilePrivateChatClosing,
    openMobileServers: () => switchMobileTab('servers', showServersWorkspace),
    openMobileMessages: closeMobilePrivateChat,
    openMobileProfile: () => switchMobileTab('profile', showProfileWorkspace),
    openMobileMenu: () => switchMobileTab('menu'),
    closeMobilePrivateChat,
  }
}
