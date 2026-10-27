import { useMemo } from 'react';
import type { CSSProperties } from 'react';

const COLORS = ['#ffd200', '#ffb700', '#d97757', '#f2a68b', '#3ddc84', '#1368ce', '#e21b3c', '#ffffff'];

/** Lightweight CSS-only confetti: ~40 absolutely positioned particles falling on a loop. */
export default function Confetti({ count = 40 }: { count?: number }) {
  const pieces = useMemo(() => {
    const arr: CSSProperties[] = [];
    for (let i = 0; i < count; i++) {
      // Deterministic pseudo-random so re-renders don't reshuffle.
      const r = (n: number) => {
        const x = Math.sin(i * 9301 + n * 49297) * 233280;
        return x - Math.floor(x);
      };
      arr.push({
        '--x': `${(r(1) * 100).toFixed(2)}%`,
        '--size': `${(0.8 + r(2) * 1.4).toFixed(2)}vmin`,
        '--color': COLORS[Math.floor(r(3) * COLORS.length)],
        '--dur': `${(5 + r(4) * 5).toFixed(2)}s`,
        '--delay': `${(-r(5) * 10).toFixed(2)}s`,
        '--drift': `${((r(6) - 0.5) * 30).toFixed(1)}vw`,
      } as CSSProperties);
    }
    return arr;
  }, [count]);

  return (
    <div className="confetti" aria-hidden="true">
      {pieces.map((style, i) => (
        <i key={i} style={style} />
      ))}
    </div>
  );
}
