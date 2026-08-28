namespace ArcaneLink.Tests.Infrastructure;

internal sealed class ManualTimeProvider(DateTimeOffset initialUtcNow) : TimeProvider
{
    private readonly object _sync = new();
    private readonly HashSet<ManualTimer> _timers = [];
    private DateTimeOffset _utcNow = initialUtcNow;

    public override long TimestampFrequency => TimeSpan.TicksPerSecond;

    public override DateTimeOffset GetUtcNow()
    {
        lock (this._sync)
        {
            return this._utcNow;
        }
    }

    public override long GetTimestamp()
    {
        lock (this._sync)
        {
            return this._utcNow.UtcDateTime.Ticks;
        }
    }

    public override ITimer CreateTimer(
        TimerCallback callback,
        object? state,
        TimeSpan dueTime,
        TimeSpan period)
    {
        ArgumentNullException.ThrowIfNull(callback);
        var timer = new ManualTimer(this, callback, state);
        timer.Change(dueTime, period);
        return timer;
    }

    public void Advance(TimeSpan amount)
    {
        if (amount < TimeSpan.Zero)
        {
            throw new ArgumentOutOfRangeException(nameof(amount));
        }

        lock (this._sync)
        {
            this._utcNow += amount;
        }

        this.FireDueTimers();
    }

    public void SetUtcNow(DateTimeOffset value)
    {
        lock (this._sync)
        {
            this._utcNow = value;
        }
    }

    private void FireDueTimers()
    {
        while (true)
        {
            List<ManualTimer> dueTimers;
            lock (this._sync)
            {
                dueTimers = this._timers
                    .Where(timer => timer.IsDue(this._utcNow))
                    .ToList();
                foreach (var timer in dueTimers)
                {
                    timer.MarkFired(this._utcNow);
                }
            }

            if (dueTimers.Count == 0)
            {
                return;
            }

            foreach (var timer in dueTimers)
            {
                timer.Invoke();
            }
        }
    }

    private void ChangeTimer(
        ManualTimer timer,
        TimeSpan dueTime,
        TimeSpan period)
    {
        ValidateTimeout(dueTime, nameof(dueTime));
        ValidateTimeout(period, nameof(period));

        lock (this._sync)
        {
            if (timer.IsDisposed)
            {
                return;
            }

            timer.DueAt = dueTime == Timeout.InfiniteTimeSpan
                ? null
                : this._utcNow + dueTime;
            timer.Period = period;
            this._timers.Add(timer);
        }
    }

    private void RemoveTimer(ManualTimer timer)
    {
        lock (this._sync)
        {
            this._timers.Remove(timer);
        }
    }

    private static void ValidateTimeout(TimeSpan value, string parameterName)
    {
        if (value < TimeSpan.Zero && value != Timeout.InfiniteTimeSpan)
        {
            throw new ArgumentOutOfRangeException(parameterName);
        }
    }

    private sealed class ManualTimer(
        ManualTimeProvider provider,
        TimerCallback callback,
        object? state) : ITimer
    {
        public DateTimeOffset? DueAt { get; set; }
        public TimeSpan Period { get; set; } = Timeout.InfiniteTimeSpan;
        public bool IsDisposed { get; private set; }

        public bool Change(TimeSpan dueTime, TimeSpan period)
        {
            provider.ChangeTimer(this, dueTime, period);
            return !this.IsDisposed;
        }

        public void Dispose()
        {
            if (this.IsDisposed)
            {
                return;
            }

            this.IsDisposed = true;
            this.DueAt = null;
            provider.RemoveTimer(this);
        }

        public ValueTask DisposeAsync()
        {
            this.Dispose();
            return ValueTask.CompletedTask;
        }

        public bool IsDue(DateTimeOffset utcNow)
        {
            return !this.IsDisposed && this.DueAt <= utcNow;
        }

        public void MarkFired(DateTimeOffset utcNow)
        {
            if (this.Period == Timeout.InfiniteTimeSpan || this.Period == TimeSpan.Zero)
            {
                this.DueAt = null;
                return;
            }

            this.DueAt = utcNow + this.Period;
        }

        public void Invoke()
        {
            if (!this.IsDisposed)
            {
                callback(state);
            }
        }
    }
}
