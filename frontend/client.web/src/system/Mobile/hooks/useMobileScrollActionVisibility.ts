import { useCallback, useEffect, useRef, useState } from 'react'
import type { UIEvent as ReactUIEvent } from 'react'

type MobileScrollActionVisibilityOptions = {
  dependencyKey: string | number | boolean
}

export function useMobileScrollActionVisibility({
  dependencyKey,
}: MobileScrollActionVisibilityOptions) {
  const [isActionVisible, setIsActionVisible] = useState(true)
  const scrollRef = useRef<HTMLDivElement | null>(null)
  const previousScrollTopRef = useRef(0)

  function isScrollable(element: HTMLDivElement) {
    return element.scrollHeight > element.clientHeight + 1
  }

  const updateAvailability = useCallback(() => {
    const element = scrollRef.current
    if (!element) return

    previousScrollTopRef.current = element.scrollTop
    setIsActionVisible(!isScrollable(element) || element.scrollTop <= 4)
  }, [])

  useEffect(() => {
    const frameId = window.requestAnimationFrame(updateAvailability)
    window.addEventListener('resize', updateAvailability)

    return () => {
      window.cancelAnimationFrame(frameId)
      window.removeEventListener('resize', updateAvailability)
    }
  }, [dependencyKey, updateAvailability])

  function handleScroll(event: ReactUIEvent<HTMLDivElement>) {
    const element = event.currentTarget
    if (!isScrollable(element)) {
      setIsActionVisible(true)
      return
    }

    const nextScrollTop = element.scrollTop
    const delta = nextScrollTop - previousScrollTopRef.current
    if (Math.abs(delta) < 4) return

    setIsActionVisible(nextScrollTop <= 4 || delta < 0)
    previousScrollTopRef.current = nextScrollTop
  }

  return {
    scrollRef,
    isActionVisible,
    handleScroll,
  }
}
