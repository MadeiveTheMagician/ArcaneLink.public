export type WebNotificationTimerAdapter = {
  set: (callback: () => void, delayMs: number) => unknown;
  clear: (handle: unknown) => void;
};

type ScheduledNotification = {
  persistent: boolean;
  onElapsed: () => void;
  handle: unknown | null;
};

export class WebNotificationTimerScheduler {
  private readonly entries = new Map<string, ScheduledNotification>();
  private readonly timer: WebNotificationTimerAdapter;
  private readonly lifetimeMs: number;
  private isPaused = false;

  constructor(timer: WebNotificationTimerAdapter, lifetimeMs: number) {
    this.timer = timer;
    this.lifetimeMs = lifetimeMs;
  }

  track(id: string, persistent: boolean, onElapsed: () => void) {
    this.untrack(id);

    const entry: ScheduledNotification = {
      persistent,
      onElapsed,
      handle: null
    };
    this.entries.set(id, entry);

    if (!persistent && !this.isPaused) {
      this.schedule(id, entry);
    }
  }

  untrack(id: string) {
    const entry = this.entries.get(id);
    if (!entry) {
      return;
    }

    this.clearHandle(entry);
    this.entries.delete(id);
  }

  retain(ids: ReadonlySet<string>) {
    for (const id of this.entries.keys()) {
      if (!ids.has(id)) {
        this.untrack(id);
      }
    }
  }

  pause() {
    if (this.isPaused) {
      return;
    }

    this.isPaused = true;
    for (const entry of this.entries.values()) {
      this.clearHandle(entry);
    }
  }

  resume() {
    if (!this.isPaused) {
      return;
    }

    this.isPaused = false;
    for (const [id, entry] of this.entries) {
      if (!entry.persistent && entry.handle === null) {
        this.schedule(id, entry);
      }
    }
  }

  dispose() {
    for (const entry of this.entries.values()) {
      this.clearHandle(entry);
    }
    this.entries.clear();
  }

  private schedule(id: string, entry: ScheduledNotification) {
    entry.handle = this.timer.set(() => {
      const current = this.entries.get(id);
      if (current !== entry) {
        return;
      }

      this.entries.delete(id);
      entry.handle = null;
      entry.onElapsed();
    }, this.lifetimeMs);
  }

  private clearHandle(entry: ScheduledNotification) {
    if (entry.handle === null) {
      return;
    }

    this.timer.clear(entry.handle);
    entry.handle = null;
  }
}
