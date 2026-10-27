import type { PlayerState } from '../../../../shared/protocol';

interface Props {
  state: PlayerState;
  gold: boolean;
}

export function medalFor(rank: number | null): string {
  if (rank === 1) return '🏆';
  if (rank === 2) return '🥈';
  if (rank === 3) return '🥉';
  return '';
}

export default function PhaseLeaderboard({ state, gold }: Props) {
  const rank = state.rank;
  const rankText = rank === null ? '—' : `#${rank}`;

  if (gold) {
    return (
      <section className="pl-center pl-gold">
        <div className="pl-gold__medal pop" aria-hidden="true">{medalFor(rank) || '🏅'}</div>
        <h1 className="pl-gold__rank pop">{rankText}</h1>
        <div className="pl-gold__title fade-up">You're in the top 3!</div>
        <div className="pl-gold__score fade-up" style={{ animationDelay: '.15s' }}>
          {state.score.toLocaleString()} pts
          {state.lastGain > 0 && <span className="pl-gold__gain"> (+{state.lastGain})</span>}
        </div>
        <div className="pl-gold__sub fade-up" style={{ animationDelay: '.25s' }}>
          {rank === 1 ? 'Everyone is chasing you.' : 'Hold the line — the gold is close.'}
        </div>
      </section>
    );
  }

  const encouragement = state.lastGain > 0 ? 'Climbing! 📈' : 'Keep going! 💪';

  return (
    <section className="pl-center pl-rank">
      <div className="pl-kicker">Your rank</div>
      <h1 className="pl-rank__big pop">
        {rankText}
        <span className="pl-rank__of"> of {state.totalPlayers}</span>
      </h1>
      <div className="pl-score-line fade-up">
        Score <strong>{state.score.toLocaleString()}</strong>
        {state.lastGain > 0 && <span className="pl-gain"> +{state.lastGain}</span>}
      </div>
      {state.streak >= 2 && <div className="pl-streak fade-up">🔥 {state.streak} streak</div>}
      <p className="pl-encourage fade-up" style={{ animationDelay: '.2s' }}>{encouragement}</p>
    </section>
  );
}
