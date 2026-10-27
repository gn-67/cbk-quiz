import type { PlayerState } from '../../../../shared/protocol';
import { QUESTION_PREVIEW_MS } from '../../../../shared/protocol';
import { useCountdown } from '../../lib/clock';
import TimeBar from './TimeBar';

interface Props {
  state: PlayerState;
}

export default function PhaseQuestion({ state }: Props) {
  const remaining = useCountdown(state.phaseEndsAt);
  const fraction = state.phaseEndsAt ? remaining / QUESTION_PREVIEW_MS : 0;
  const text = state.question?.text ?? 'Get ready…';

  return (
    <section className="pl-center pl-question-phase">
      <div className="pl-kicker">Get ready…</div>
      <h1 className="pl-question-big pop">{text}</h1>
      <div className="pl-question-phase__bar">
        <TimeBar fraction={fraction} urgentBelow={0} />
      </div>
      <p className="pl-sub-dim">Answers coming up</p>
    </section>
  );
}
