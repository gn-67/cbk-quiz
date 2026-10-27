import type { ChoiceIndex } from '../../../../shared/protocol';
import { ANSWER_SHAPES } from '../../../../shared/protocol';

type Shape = (typeof ANSWER_SHAPES)[number];

interface Props {
  index: ChoiceIndex | number;
  size?: number;
  className?: string;
}

/** Kahoot-style shape glyph for a choice index: triangle, diamond, circle, square. */
export default function ShapeIcon({ index, size = 28, className }: Props) {
  const shape: Shape = ANSWER_SHAPES[index] ?? 'circle';
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      focusable="false"
    >
      {shape === 'triangle' && <polygon points="12,2.5 22.5,21 1.5,21" />}
      {shape === 'diamond' && <polygon points="12,1.5 22.5,12 12,22.5 1.5,12" />}
      {shape === 'circle' && <circle cx="12" cy="12" r="10.5" />}
      {shape === 'square' && <rect x="2.5" y="2.5" width="19" height="19" rx="2.5" />}
    </svg>
  );
}
