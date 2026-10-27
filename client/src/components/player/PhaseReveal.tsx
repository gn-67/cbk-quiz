import type { PlayerState } from '../../../../shared/protocol';
import { ANSWER_COLORS } from '../../../../shared/protocol';
import ShapeIcon from './ShapeIcon';

interface Props {
  state: PlayerState;
}

export default function PhaseReveal({ state }: Props) {
  const q = state.question;
  const correctIndex = q?.correctIndex ?? null;
  const correctText = correctIndex !== null && q ? q.choices[correctIndex] : null;
  const my = state.myAnswer;

  let tone: 'correct' | 'wrong' | 'none' | 'pending';
  if (!my) tone = 'none';
  else if (my.correct === true) tone = 'correct';
  else if (my.correct === false) tone = 'wrong';
  else tone = 'pending';

  const points = my?.pointsEarned ?? state.lastGain ?? 0;

  return (
    <section className={`pl-center pl-reveal pl-reveal--${tone}`}>
      {tone === 'correct' && (
        <>
          <div className="pl-reveal__emoji pop" aria-hidden="true">🎯</div>
          <h1 className="pl-reveal__title pop">Correct!</h1>
          <div className="pl-points pop" style={{ animationDelay: '.1s' }}>+{points}</div>
          {state.streak >= 2 && (
            <div className="pl-streak fade-up" style={{ animationDelay: '.2s' }}>
              🔥 {state.streak} in a row
            </div>
          )}
        </>
      )}
      {tone === 'wrong' && (
        <>
          <div className="pl-reveal__emoji pop" aria-hidden="true">😬</div>
          <h1 className="pl-reveal__title pop">Wrong</h1>
          <CorrectAnswer index={correctIndex} text={correctText} />
        </>
      )}
      {tone === 'none' && (
        <>
          <div className="pl-reveal__emoji pop" aria-hidden="true">🐢</div>
          <h1 className="pl-reveal__title pop">Too slow!</h1>
          <CorrectAnswer index={correctIndex} text={correctText} />
        </>
      )}
      {tone === 'pending' && (
        <>
          <h1 className="pl-reveal__title pop">Revealing…</h1>
          <CorrectAnswer index={correctIndex} text={correctText} />
        </>
      )}

      <div className="pl-score-line fade-up" style={{ animationDelay: '.3s' }}>
        Total score <strong>{state.score.toLocaleString()}</strong>
      </div>
    </section>
  );
}

function CorrectAnswer({ index, text }: { index: number | null; text: string | null }) {
  if (index === null || text === null) return null;
  return (
    <div className="pl-correct-card fade-up" style={{ animationDelay: '.1s' }}>
      <div className="pl-correct-card__label">The answer was</div>
      <div className="pl-correct-card__chip" style={{ background: ANSWER_COLORS[index] ?? 'var(--surface-2)' }}>
        <ShapeIcon index={index} size={26} />
        <span>{text}</span>
      </div>
    </div>
  );
}
