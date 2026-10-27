import type { CSSProperties } from 'react';
import { ANSWER_COLORS } from '../../../../shared/protocol';
import ShapeIcon from './ShapeIcon';
import { fitClass } from './util';

export type TileStatus = 'neutral' | 'correct' | 'wrong';

interface Props {
  index: number;
  text: string;
  status?: TileStatus;
  /** Stagger delay in ms for the pop-in animation. */
  delayMs?: number;
}

export default function ChoiceTile({ index, text, status = 'neutral', delayMs = 0 }: Props) {
  const color = ANSWER_COLORS[index] ?? ANSWER_COLORS[3];
  const style = { '--tile-color': color, animationDelay: `${delayMs}ms` } as CSSProperties;
  const label = text && text.trim() ? text : `Option ${index + 1}`;
  return (
    <div className={`tile ${status}`} style={style}>
      <ShapeIcon shape={index} />
      <span className={`tile-text ${fitClass(label, 'choice')}`}>{label}</span>
      {status === 'correct' && (
        <span className="tile-check" aria-label="Correct">
          ✓
        </span>
      )}
    </div>
  );
}
