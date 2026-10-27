import type { PlayerState } from '../../../../shared/protocol';

interface Props {
  state: PlayerState;
  onLeave: () => void;
}

export default function PhaseEnded({ state, onLeave }: Props) {
  return (
    <section className="pl-center pl-ended">
      <div className="pl-reveal__emoji pop" aria-hidden="true">👋</div>
      <h1 className="pl-reveal__title pop">Thanks for playing!</h1>
      <div className="pl-score-line fade-up">
        Final score <strong>{state.score.toLocaleString()}</strong>
        {state.rank !== null && (
          <span className="pl-gain"> · #{state.rank} of {state.totalPlayers}</span>
        )}
      </div>
      <p className="pl-sub-dim fade-up">Played as <strong>{state.name}</strong></p>
      <button type="button" className="btn pl-big-btn fade-up" style={{ animationDelay: '.2s' }} onClick={onLeave}>
        Join another game
      </button>
    </section>
  );
}
