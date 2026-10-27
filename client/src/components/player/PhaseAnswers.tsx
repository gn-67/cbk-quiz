import type { ChoiceIndex, PlayerState } from '../../../../shared/protocol';
import { ANSWER_COLORS } from '../../../../shared/protocol';
import { useCountdown } from '../../lib/clock';
import AnswerGrid from './AnswerGrid';
import ShapeIcon from './ShapeIcon';
import TimeBar from './TimeBar';

interface Props {
  state: PlayerState;
  /** Optimistic local pick (before the server echoes myAnswer). */
  pendingChoice: ChoiceIndex | null;
  onPick: (choice: ChoiceIndex) => void;
}

export default function PhaseAnswers({ state, pendingChoice, onPick }: Props) {
  const remaining = useCountdown(state.phaseEndsAt);
  const q = state.question;
  const limitMs = (q?.timeLimitSec ?? 0) * 1000;
  const fraction = limitMs > 0 ? remaining / limitMs : 0;
  const seconds = Math.ceil(remaining / 1000);
  const timeUp = state.phaseEndsAt !== null && remaining <= 0;

  const selected: ChoiceIndex | null = state.myAnswer ? state.myAnswer.choice : pendingChoice;
  const answered = selected !== null;

  const choices = q?.choices ?? (['', '', '', ''] as const);

  return (
    <section className="pl-answers">
      <div className="pl-timer-row">
        <div className={`pl-timer ${seconds <= 5 && !answered ? 'pl-timer--urgent' : ''}`} aria-live="off">
          {seconds}
        </div>
        <div className="pl-timer-row__q">{q ? q.text : 'Loading question…'}</div>
      </div>
      <TimeBar fraction={fraction} />

      {answered ? (
        <div
          className="pl-locked pop"
          style={{ background: ANSWER_COLORS[selected], color: '#fff' }}
          role="status"
          aria-live="polite"
        >
          <ShapeIcon index={selected} size={34} />
          <div>
            <div className="pl-locked__title">Answer locked in!</div>
            <div className="pl-locked__sub">Waiting for others…</div>
          </div>
        </div>
      ) : timeUp ? (
        <div className="pl-locked pl-locked--timeup pop" role="status" aria-live="polite">
          <div>
            <div className="pl-locked__title">Time's up!</div>
            <div className="pl-locked__sub">Hang tight for the answer</div>
          </div>
        </div>
      ) : (
        <div className="pl-tap-hint">Tap your answer</div>
      )}

      <AnswerGrid choices={choices} selected={selected} locked={answered || timeUp || !q} onPick={onPick} />
    </section>
  );
}
