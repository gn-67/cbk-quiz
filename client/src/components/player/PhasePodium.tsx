import type { PlayerState } from '../../../../shared/protocol';
import Confetti from './Confetti';
import { medalFor } from './PhaseLeaderboard';

interface Props {
  state: PlayerState;
  gold: boolean;
}

export default function PhasePodium({ state, gold }: Props) {
  const rank = state.rank;
  const rankText = rank === null ? '—' : `#${rank}`;
  const top = state.leaderboard.slice(0, 3);

  return (
    <section className={`pl-center pl-podium ${gold ? 'pl-gold' : ''}`}>
      {gold && <Confetti />}
      {gold ? (
        <>
          <div className="pl-gold__medal pop" aria-hidden="true">{medalFor(rank) || '🏅'}</div>
          <h1 className="pl-gold__rank pop">Final: {rankText}</h1>
          <div className="pl-gold__title fade-up">You made the podium!</div>
        </>
      ) : (
        <>
          <div className="pl-kicker">Final results</div>
          <h1 className="pl-rank__big pop">
            {rankText}
            <span className="pl-rank__of"> of {state.totalPlayers}</span>
          </h1>
        </>
      )}
      <div className="pl-score-line fade-up">
        Final score <strong>{state.score.toLocaleString()}</strong>
      </div>

      <ol className="pl-top3 fade-up" style={{ animationDelay: '.2s' }} aria-label="Top 3 players">
        {top.length === 0 && <li className="pl-top3__empty">No scores yet</li>}
        {top.map((e) => (
          <li
            key={e.playerId}
            className={`pl-top3__row ${e.playerId === state.playerId ? 'pl-top3__row--me' : ''}`}
          >
            <span className="pl-top3__medal" aria-hidden="true">{medalFor(e.rank) || `#${e.rank}`}</span>
            <span className="pl-top3__name">
              {e.name}
              {e.playerId === state.playerId && <span className="pl-top3__you"> (you)</span>}
            </span>
            <span className="pl-top3__score">{e.score.toLocaleString()}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}
