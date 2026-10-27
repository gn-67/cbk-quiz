import type { LeaderboardEntry, Phase } from '../../../../shared/protocol';

interface Props {
  entries: LeaderboardEntry[];
  phase: Phase;
}

export default function LeaderboardPanel({ entries, phase }: Props) {
  const top = entries.slice(0, 10);
  const final = phase === 'podium' || phase === 'ended';
  const winner = final ? top.find((e) => e.rank === 1) ?? top[0] : undefined;

  return (
    <section className="adm-panel" aria-labelledby="adm-lb-h">
      <div className="adm-panel-h">
        <h2 id="adm-lb-h">{final ? 'Final standings' : 'Leaderboard'}</h2>
        <span className="adm-hint">top 10</span>
      </div>
      {winner && winner.score > 0 && (
        <div className="adm-winner" role="status">
          <small>Winner</small>
          🏆 Winner: {winner.name} — {winner.score.toLocaleString()} pts
        </div>
      )}
      {top.length === 0 ? (
        <div className="adm-empty">Scores appear after the first question.</div>
      ) : (
        <div className="adm-lb">
          {top.map((e) => (
            <div className={`adm-lb-row${e.rank <= 3 && e.score > 0 ? ` r${e.rank}` : ''}`} key={e.playerId}>
              <span className="adm-rank">{e.rank}</span>
              <span className="adm-lbname" title={e.name}>
                {e.name}
              </span>
              <span className="adm-lbscore">{e.score.toLocaleString()}</span>
              <span className={`adm-gain${e.lastGain > 0 ? '' : ' zero'}`}>
                {e.lastGain > 0 ? `+${e.lastGain}` : '—'}
              </span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
