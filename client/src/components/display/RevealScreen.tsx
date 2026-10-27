import type { CSSProperties } from 'react';
import { ANSWER_COLORS } from '../../../../shared/protocol';
import type { SessionPublicState } from '../../../../shared/protocol';
import ChoiceTile from './ChoiceTile';
import ShapeIcon from './ShapeIcon';
import { questionNumber } from './util';

export default function RevealScreen({ state }: { state: SessionPublicState }) {
  const q = state.question;
  const choices = q?.choices ?? ['', '', '', ''];
  const correct = state.reveal?.correctIndex ?? q?.correctIndex;
  const rawCounts = state.reveal?.counts;
  const counts = [0, 1, 2, 3].map((i) => {
    const v = Array.isArray(rawCounts) ? rawCounts[i] : 0;
    return Number.isFinite(v) ? Math.max(0, v as number) : 0;
  });
  const max = Math.max(1, ...counts);
  const totalAnswered = state.reveal?.totalAnswered ?? counts.reduce((a, b) => a + b, 0);
  const correctText = correct != null ? choices[correct] || `Option ${correct + 1}` : '—';
  const n = questionNumber(state);

  return (
    <div className="rv">
      <div className="rv-head">
        <h1>{n ? `Question ${n}` : 'Answer'}</h1>
        <div className="rv-correct">
          Correct answer: <b>{correctText}</b>
        </div>
      </div>
      <div className="tiles">
        {[0, 1, 2, 3].map((i) => (
          <ChoiceTile
            key={i}
            index={i}
            text={choices[i] ?? ''}
            status={correct == null ? 'neutral' : i === correct ? 'correct' : 'wrong'}
            delayMs={0}
          />
        ))}
      </div>
      <div className="rv-chart">
        {counts.map((c, i) => {
          const win = i === correct;
          const pct = (c / max) * 100;
          return (
            <div key={i} className={`rv-row${win ? ' win' : correct != null ? ' dim' : ''}`}>
              <ShapeIcon shape={i} />
              <div className="rv-bar-wrap">
                <div
                  className="rv-bar"
                  style={{ width: `${pct}%`, '--bar-color': ANSWER_COLORS[i], animationDelay: `${i * 90}ms` } as CSSProperties}
                />
              </div>
              <div className="rv-count">
                {c}
                {i === 3 && <small>/ {totalAnswered}</small>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
