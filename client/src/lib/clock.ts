import { useEffect, useState } from 'react';

let offsetMs = 0; // serverNow - clientNow

/** Call whenever a state payload with serverNow arrives so countdowns use server time. */
export function syncClock(serverNow: number) {
  offsetMs = serverNow - Date.now();
}

export function serverNow(): number {
  return Date.now() + offsetMs;
}

/** Milliseconds remaining until a server timestamp (>= 0). Re-renders ~10x/sec. */
export function useCountdown(endsAt: number | null): number {
  const [remaining, setRemaining] = useState(() => (endsAt ? Math.max(0, endsAt - serverNow()) : 0));
  useEffect(() => {
    if (!endsAt) {
      setRemaining(0);
      return;
    }
    const tick = () => setRemaining(Math.max(0, endsAt - serverNow()));
    tick();
    const id = setInterval(tick, 100);
    return () => clearInterval(id);
  }, [endsAt]);
  return remaining;
}
