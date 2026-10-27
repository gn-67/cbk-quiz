import { useCountdown } from '../../lib/clock';
import { clamp01 } from './util';

const R = 45;
const C = 2 * Math.PI * R;

/** Circular countdown ring with big seconds; pulses red at <= 5s. */
export default function Timer({ endsAt, totalSec }: { endsAt: number | null; totalSec: number }) {
  const remaining = useCountdown(endsAt);
  const secs = Math.ceil(remaining / 1000);
  const total = totalSec > 0 ? totalSec * 1000 : 1;
  const frac = clamp01(remaining / total);
  const urgent = endsAt != null && secs <= 5;
  return (
    <div className={`timer${urgent ? ' urgent' : ''}`}>
      <svg viewBox="0 0 100 100" aria-hidden="true">
        <circle className="track" cx="50" cy="50" r={R} />
        <circle className="arc" cx="50" cy="50" r={R} strokeDasharray={C} strokeDashoffset={C * (1 - frac)} />
      </svg>
      <div className="timer-num" key={urgent ? secs : 'n'}>{endsAt == null ? '–' : secs}</div>
    </div>
  );
}
