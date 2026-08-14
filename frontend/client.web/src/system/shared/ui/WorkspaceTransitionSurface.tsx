import {
  useLayoutEffect,
  useRef,
  type AnimationEvent,
  type HTMLAttributes,
  type ReactNode,
} from 'react'
import styles from './WorkspaceTransitionSurface.module.css'

type WorkspaceTransitionSurfaceProps = Omit<
  HTMLAttributes<HTMLDivElement>,
  'children'
> & {
  children: ReactNode
  transitionKey: string
}

export function WorkspaceTransitionSurface({
  children,
  className = '',
  onAnimationEnd,
  transitionKey,
  ...props
}: WorkspaceTransitionSurfaceProps) {
  const surfaceRef = useRef<HTMLDivElement>(null)
  const previousTransitionKeyRef = useRef(transitionKey)

  useLayoutEffect(() => {
    if (previousTransitionKeyRef.current === transitionKey) {
      return
    }

    previousTransitionKeyRef.current = transitionKey

    const surface = surfaceRef.current
    if (!surface) {
      return
    }

    surface.classList.remove(styles.entering)
    void surface.offsetWidth
    surface.classList.add(styles.entering)
  }, [transitionKey])

  function handleAnimationEnd(event: AnimationEvent<HTMLDivElement>) {
    const target = event.target
    if (
      target instanceof HTMLElement &&
      target.dataset.workspaceTransitionContent === 'true'
    ) {
      event.currentTarget.classList.remove(styles.entering)
    }

    onAnimationEnd?.(event)
  }

  return (
    <div
      {...props}
      ref={surfaceRef}
      className={[styles.surface, className].filter(Boolean).join(' ')}
      data-workspace-transition-key={transitionKey}
      onAnimationEnd={handleAnimationEnd}
    >
      {children}
    </div>
  )
}
