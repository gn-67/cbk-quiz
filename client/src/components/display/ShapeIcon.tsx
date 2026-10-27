import { ANSWER_SHAPES } from '../../../../shared/protocol';

export type Shape = (typeof ANSWER_SHAPES)[number];

/** Kahoot-style answer shape, drawn inline so it scales crisply at any size. */
export default function ShapeIcon({ shape, className = 'shape' }: { shape: Shape | number; className?: string }) {
  const s: Shape = typeof shape === 'number' ? (ANSWER_SHAPES[shape] ?? 'square') : shape;
  let path: JSX.Element;
  switch (s) {
    case 'triangle':
      path = <polygon points="50,8 94,88 6,88" />;
      break;
    case 'diamond':
      path = <polygon points="50,4 96,50 50,96 4,50" />;
      break;
    case 'circle':
      path = <circle cx="50" cy="50" r="44" />;
      break;
    case 'square':
    default:
      path = <rect x="8" y="8" width="84" height="84" rx="8" />;
      break;
  }
  return (
    <svg className={className} viewBox="0 0 100 100" aria-hidden="true" focusable="false" fill="#fff">
      {path}
    </svg>
  );
}
