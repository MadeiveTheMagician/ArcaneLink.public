type RefreshTask = () => Promise<void> | void

export function getSpaceReadStateRefreshTargets(
  serverId: string | null | undefined,
  selectedServerId: string | null | undefined,
) {
  if (!serverId) {
    return {
      serverList: false,
      currentServerSpaces: false,
      privateSpaces: true,
    }
  }

  return {
    serverList: true,
    currentServerSpaces:
      serverId.toLowerCase() === selectedServerId?.toLowerCase(),
    privateSpaces: false,
  }
}

export function createRealtimeRefreshCoalescer(
  task: RefreshTask,
  debounceMs = 80,
) {
  let timeoutId: ReturnType<typeof setTimeout> | null = null
  let isRunning = false
  let rerunRequested = false
  let isDisposed = false

  async function run() {
    if (isDisposed || isRunning) {
      if (isRunning) {
        rerunRequested = true
      }
      return
    }

    isRunning = true

    try {
      do {
        rerunRequested = false
        try {
          await task()
        } catch {
          // Realtime refresh is best-effort; foreground flows surface errors.
        }
      } while (rerunRequested && !isDisposed)
    } finally {
      isRunning = false
    }
  }

  function request() {
    if (isDisposed) {
      return
    }

    if (isRunning) {
      rerunRequested = true
      return
    }

    if (timeoutId !== null) {
      return
    }

    timeoutId = setTimeout(() => {
      timeoutId = null
      void run()
    }, debounceMs)
  }

  return {
    request,
    dispose() {
      isDisposed = true
      rerunRequested = false

      if (timeoutId !== null) {
        clearTimeout(timeoutId)
        timeoutId = null
      }
    },
  }
}
