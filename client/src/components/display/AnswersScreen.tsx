import type { SessionPublicState } from '../../../../shared/protocol';
import ChoiceTile from './ChoiceTile';
import Timer from './Timer';
import { clamp01, fitClass } from './util';

export default function AnswersScreen({ state }: { state: SessionPublicState }) {
  const q = state.question;
  const choices = q?.choices ?? ['', '', '', ''];
  const answered = state.answeredCount ?? 0;
  const total = state.connectedCount ?? state.playerCount ?? 0;
  const pct = total > 0 ? clamp01(answered / total) * 100 : 0;
  return (
    <div className="as">
      <div className={`as-q ${fitClass(q?.text, 'question') === 'fit-xl' ? 'fit-l' : 'fit-m'}`}>{q?.text ?? ''}</div>
      <div className="as-mid">
        <div className="spacer" />
        <Timer endsAt={state.phaseEndsAt} totalSec={q?.timeLimitSec ?? 0} />
        <div className="answered">
          <div className="lbl">Answered</div>
          <div className="val">
            {answered} <span>/ {total}</span>
          </div>
          <div className="bar">
            <i style={{ width: `${pct}%` }} />
          </div>
        </div>
      </div>
      <div className="tiles" key={q?.index ?? -1}>
        {[0, 1, 2, 3].map((i) => (
          <ChoiceTile key={i} index={i} text={choices[i] ?? ''} delayMs={i * 120} />
        ))}
      </div>
    </div>
  );
}
