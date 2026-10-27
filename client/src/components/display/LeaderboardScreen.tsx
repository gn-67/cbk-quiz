import type { SessionPublicState } from '../../../../shared/protocol';
import { formatScore, questionNumber, safeArray } from './util';

export default function LeaderboardScreen({ state }: { state: SessionPublicState }) {
  const rows = safeArray(state.leaderboard).slice(0, 5);
  const n = questionNumber(state);
  const players = state.playerCount ?? safeArray(state.players).length;
  return (
    <div className="lb">
      <div className="lb-head">
        <h1>Leaderboard</h1>
        <p>{n ? `after question ${n} of ${state.totalQuestions || '?'}` : ''}</p>
      </div>
      <div className="lb-rows">
        {rows.length === 0 ? (
          <div className="lb-empty">No scores yet</div>
        ) : (
          rows.map((r, i) => {
            const rank = r.rank || i + 1;
            const cls = rank <= 3 && (r.score ?? 0) > 0 ? ` r${rank}` : '';
            return (
              <div key={r.playerId || i} className={`lb-row${cls}`} style={{ animationDelay: `${(rows.length - 1 - i) * 140}ms` }}>
                <span className="rank">{rank}</span>
                <span className="name">{r.name || 'Player'}</span>
                <span className={`gain${r.lastGain > 0 ? '' : ' none'}`}>+{formatScore(r.lastGain)}</span>
                <span className="score">{formatScore(r.score)}</span>
              </div>
            );
          })
        )}
      </div>
      <div className="lb-foot">
        {players} {players === 1 ? 'player' : 'players'}
      </div>
    </div>
  );
}
