import { memo } from 'react';
import type { ChoiceIndex } from '../../../../shared/protocol';
import ShapeIcon from './ShapeIcon';

interface Props {
  choices: readonly [string, string, string, string] | readonly string[];
  /** The choice the player picked (locked), if any. */
  selected: ChoiceIndex | null;
  /** When true no choice can be tapped (answered, time up, or not in answers phase). */
  locked: boolean;
  /** Present during reveal: highlights the right answer and fades the rest. */
  correctIndex?: ChoiceIndex | null;
  onPick?: (choice: ChoiceIndex) => void;
}

const INDICES: ChoiceIndex[] = [0, 1, 2, 3];

/** 2x2 grid of big colored answer buttons with shape glyphs. */
function AnswerGrid({ choices, selected, locked, correctIndex = null, onPick }: Props) {
  const hasSelection = selected !== null;
  const revealing = correctIndex !== null && correctIndex !== undefined;

  return (
    <div className="pl-grid" role="group" aria-label="Answers">
      {INDICES.map((i) => {
        const text = choices[i] ?? '';
        const isPicked = selected === i;
        const isCorrect = revealing && correctIndex === i;
        let mod = '';
        if (revealing) {
          mod = isCorrect ? 'pl-ans--correct' : isPicked ? 'pl-ans--wrong' : 'pl-ans--dim';
        } else if (hasSelection) {
          mod = isPicked ? 'pl-ans--picked' : 'pl-ans--dim';
        } else if (locked) {
          mod = 'pl-ans--dim';
        }
        return (
          <button
            key={i}
            type="button"
            className={`pl-ans pl-ans-${i} ${mod}`}
            disabled={locked || hasSelection}
            aria-label={`Answer ${i + 1}: ${text}`}
            aria-pressed={isPicked}
            onClick={() => onPick?.(i)}
          >
            <ShapeIcon index={i} size={30} className="pl-ans__icon" />
            <span className="pl-ans__text">{text}</span>
            {isPicked && !revealing && <span className="pl-ans__check" aria-hidden="true">✓</span>}
            {isCorrect && <span className="pl-ans__check" aria-hidden="true">✓</span>}
          </button>
        );
      })}
    </div>
  );
}

export default memo(AnswerGrid);
