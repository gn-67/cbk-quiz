import { useMemo } from 'react';

const PIECES = ['🎉', '✨', '🏆', '⭐', '🎊', '💫'];

interface Props {
  count?: number;
}

/** Light CSS-only confetti: a handful of floating emoji, generated once per mount. */
export default function Confetti({ count = 18 }: Props) {
  const items = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => ({
        id: i,
        emoji: PIECES[i % PIECES.length],
        left: Math.round((i / count) * 100 + (Math.random() * 8 - 4)),
        delay: Math.random() * 2.5,
        duration: 3 + Math.random() * 2.5,
        size: 18 + Math.round(Math.random() * 16),
      })),
    [count],
  );
  return (
    <div className="pl-confetti" aria-hidden="true">
      {items.map((p) => (
        <span
          key={p.id}
          className="pl-confetti__piece"
          style={{
            left: `${p.left}%`,
            animationDelay: `${p.delay}s`,
            animationDuration: `${p.duration}s`,
            fontSize: p.size,
          }}
        >
          {p.emoji}
        </span>
      ))}
    </div>
  );
}
