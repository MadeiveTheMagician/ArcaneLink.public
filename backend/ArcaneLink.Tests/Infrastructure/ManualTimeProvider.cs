namespace ArcaneLink.Tests.Infrastructure;

internal sealed class ManualTimeProvider(DateTimeOffset initialUtcNow) : TimeProvider
{
    private readonly object _sync = new();
    private readonly HashSet<ManualTimer> _timers = [];
    private DateTimeOffset _utcNow = initialUtcNow;

    public override long TimestampFrequency => TimeSpan.TicksPerSecond;

    public override DateTimeOffset GetUtcNow()
    {
        lock (_sync)
        {
            return _utcNow;
        }
    }

    public override long GetTimestamp()
    {
        lock (_sync)
        {
            return _utcNow.UtcDateTime.Ticks;
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

        lock (_sync)
        {
            _utcNow += amount;
        }

        FireDueTimers();
    }

    public void SetUtcNow(DateTimeOffset value)
    {
        lock (_sync)
        {
            _utcNow = value;
        }
    }

    private void FireDueTimers()
    {
        while (true)
        {
            List<ManualTimer> dueTimers;
            lock (_sync)
            {
                dueTimers = _timers
                    .Where(timer => timer.IsDue(_utcNow))
                    .ToList();
                foreach (var timer in dueTimers)
                {
                    timer.MarkFired(_utcNow);
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

        lock (_sync)
        {
            if (timer.IsDisposed)
            {
                return;
            }

            timer.DueAt = dueTime == Timeout.InfiniteTimeSpan
                ? null
                : _utcNow + dueTime;
            timer.Period = period;
            _timers.Add(timer);
        }
    }

    private void RemoveTimer(ManualTimer timer)
    {
        lock (_sync)
        {
            _timers.Remove(timer);
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
            return !IsDisposed;
        }

        public void Dispose()
        {
            if (IsDisposed)
            {
                return;
            }

            IsDisposed = true;
            DueAt = null;
            provider.RemoveTimer(this);
        }

        public ValueTask DisposeAsync()
        {
            Dispose();
            return ValueTask.CompletedTask;
        }

        public bool IsDue(DateTimeOffset utcNow)
        {
            return !IsDisposed && DueAt <= utcNow;
        }

        public void MarkFired(DateTimeOffset utcNow)
        {
            if (Period == Timeout.InfiniteTimeSpan || Period == TimeSpan.Zero)
            {
                DueAt = null;
                return;
            }

            DueAt = utcNow + Period;
        }

        public void Invoke()
        {
            if (!IsDisposed)
            {
                callback(state);
            }
        }
    }
}
