import { Pause, Play, RotateCcw, Waves } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { getTimerSocket } from "../../lib/timer-socket.ts";

interface RestTimerProps {
  defaultSeconds?: number;
}

function formatSeconds(seconds: number) {
  const mm = String(Math.floor(seconds / 60)).padStart(2, "0");
  const ss = String(seconds % 60).padStart(2, "0");
  return `${mm}:${ss}`;
}

export function RestTimer({ defaultSeconds = 90 }: RestTimerProps) {
  const [duration, setDuration] = useState(defaultSeconds);
  const [remaining, setRemaining] = useState(defaultSeconds);
  const [isRunning, setIsRunning] = useState(false);
  const [useSocketSync, setUseSocketSync] = useState(false);

  const intervalRef = useRef<number | null>(null);
  const socketRef = useRef(getTimerSocket());

  const progress = useMemo(() => {
    if (duration <= 0) {
      return 0;
    }
    return Math.max(0, Math.min(100, (remaining / duration) * 100));
  }, [duration, remaining]);

  useEffect(() => {
    if (!useSocketSync) {
      return;
    }

    const socket = socketRef.current;

    const onTick = (payload: { remaining: number }) => {
      setRemaining(payload.remaining);
      setIsRunning(payload.remaining > 0);
    };

    const onDone = () => {
      setIsRunning(false);
      setRemaining(0);
    };

    socket.connect();
    socket.on("timer:tick", onTick);
    socket.on("timer:done", onDone);

    return () => {
      socket.off("timer:tick", onTick);
      socket.off("timer:done", onDone);
      socket.emit("timer:stop");
      socket.disconnect();
    };
  }, [useSocketSync]);

  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        window.clearInterval(intervalRef.current);
      }
    };
  }, []);

  const startLocalTimer = () => {
    if (intervalRef.current) {
      window.clearInterval(intervalRef.current);
    }

    setIsRunning(true);
    intervalRef.current = window.setInterval(() => {
      setRemaining((current) => {
        if (current <= 1) {
          if (intervalRef.current) {
            window.clearInterval(intervalRef.current);
            intervalRef.current = null;
          }
          setIsRunning(false);
          return 0;
        }
        return current - 1;
      });
    }, 1000);
  };

  const handleStart = () => {
    if (useSocketSync && socketRef.current.connected) {
      setIsRunning(true);
      socketRef.current.emit("timer:start", { seconds: remaining });
      return;
    }

    startLocalTimer();
  };

  const handlePause = () => {
    if (useSocketSync && socketRef.current.connected) {
      socketRef.current.emit("timer:stop");
    }

    if (intervalRef.current) {
      window.clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    setIsRunning(false);
  };

  const handleReset = () => {
    handlePause();
    setRemaining(duration);
  };

  return (
    <div className="space-y-4 rounded-2xl border border-[var(--border)] bg-[var(--surface-solid)] p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
          Rest Countdown
        </p>
        <label className="flex items-center gap-2 text-xs text-[var(--muted)]">
          <input
            type="checkbox"
            checked={useSocketSync}
            onChange={(event) => setUseSocketSync(event.target.checked)}
          />
          Socket sync
        </label>
      </div>

      <div className="rounded-xl bg-[var(--surface)] p-3">
        <div className="mb-2 flex items-center justify-between text-xs text-[var(--muted)]">
          <span>Remaining</span>
          <span>{Math.round(progress)}%</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-black/10 dark:bg-white/10">
          <div
            className="h-full rounded-full bg-[var(--accent-alt)] transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      <div className="flex items-center justify-between">
        <p className="font-mono text-3xl font-semibold text-[var(--text)]">
          {formatSeconds(remaining)}
        </p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="rounded-lg border border-[var(--border)] p-2 text-[var(--text)]"
            onClick={isRunning ? handlePause : handleStart}
            aria-label={isRunning ? "Pause timer" : "Start timer"}
          >
            {isRunning ? <Pause size={16} /> : <Play size={16} />}
          </button>
          <button
            type="button"
            className="rounded-lg border border-[var(--border)] p-2 text-[var(--text)]"
            onClick={handleReset}
            aria-label="Reset timer"
          >
            <RotateCcw size={16} />
          </button>
        </div>
      </div>

      <label className="flex items-center gap-2 text-sm text-[var(--muted)]">
        <Waves size={16} />
        Rest seconds
        <input
          type="number"
          value={duration}
          min={15}
          max={360}
          onChange={(event) => {
            const next = Number(event.target.value);
            setDuration(next);
            if (!isRunning) {
              setRemaining(next);
            }
          }}
          className="ml-auto w-24 rounded-lg border border-[var(--border)] bg-transparent px-2 py-1 text-right"
        />
      </label>
    </div>
  );
}
