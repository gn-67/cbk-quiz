import { QUESTION_PREVIEW_MS } from '../../../../shared/protocol';
import type { SessionPublicState } from '../../../../shared/protocol';
import { useCountdown } from '../../lib/clock';
import { clamp01, fitClass, questionNumber } from './util';

export default function QuestionScreen({ state }: { state: SessionPublicState }) {
  const remaining = useCountdown(state.phaseEndsAt);
  const pct = state.phaseEndsAt ? clamp01(remaining / QUESTION_PREVIEW_MS) * 100 : 0;
  const text = state.question?.text ?? '';
  const n = questionNumber(state);
  return (
    <div className="qs">
      <div className="qs-num">
        Question {n || '?'} of {state.totalQuestions || '?'}
      </div>
      <div key={state.question?.index ?? -1} className={`qs-text ${fitClass(text)}`}>
        {text || 'Get ready…'}
      </div>
      <div className="qs-sub">Get ready — answers coming up!</div>
      <div className="qs-bar">
        <i style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
