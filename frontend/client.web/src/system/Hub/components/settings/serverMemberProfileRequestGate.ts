export type ServerMemberProfileRequestTicket = {
  serverId: string
  signal: AbortSignal
  isCurrent: (activeServerId: string) => boolean
  cancel: () => void
}

export class ServerMemberProfileRequestGate {
  private version = 0
  private controller: AbortController | null = null

  begin(serverId: string): ServerMemberProfileRequestTicket {
    this.cancel()

    const version = ++this.version
    const controller = new AbortController()
    this.controller = controller

    return {
      serverId,
      signal: controller.signal,
      isCurrent: (activeServerId) =>
        !controller.signal.aborted &&
        this.version === version &&
        activeServerId === serverId,
      cancel: () => {
        if (this.version !== version) return
        controller.abort()
        this.controller = null
        this.version += 1
      },
    }
  }

  cancel() {
    this.controller?.abort()
    this.controller = null
    this.version += 1
  }
}
