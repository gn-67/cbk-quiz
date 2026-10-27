import type { LeaderboardEntry, SessionPublicState } from '../../../../shared/protocol';
import Confetti from './Confetti';
import { formatScore, safeArray } from './util';

const EMOJI = ['🏆', '🥈', '🥉'];

function Step({ entry, place }: { entry: LeaderboardEntry | undefined; place: 1 | 2 | 3 }) {
  return (
    <div className={`pd-col p${place}`}>
      {entry ? (
        <>
          <div className="pd-emoji">{EMOJI[place - 1]}</div>
          <div className="pd-name">{entry.name || 'Player'}</div>
          <div className="pd-score">{formatScore(entry.score)} pts</div>
          <div className="pd-block">{entry.rank || place}</div>
        </>
      ) : (
        <div className="pd-block" style={{ opacity: 0.25 }}>{place}</div>
      )}
    </div>
  );
}

export default function PodiumScreen({ state }: { state: SessionPublicState }) {
  const lb = safeArray(state.leaderboard);
  const rest = lb.slice(3, 10);
  return (
    <div className="pd">
      {lb.length > 0 && <Confetti />}
      <div className="pd-head">
        <h1>Final Results</h1>
        <p>{state.questionSetName}</p>
      </div>
      {lb.length === 0 ? (
        <div className="pd-empty">No players this time</div>
      ) : (
        <>
          <div className="pd-stage">
            <Step entry={lb[1]} place={2} />
            <Step entry={lb[0]} place={1} />
            <Step entry={lb[2]} place={3} />
          </div>
          {rest.length > 0 && (
            <div className="pd-rest">
              {rest.map((r, i) => (
                <div key={r.playerId || i} style={{ animationDelay: `${1.2 + i * 0.08}s` }}>
                  <span>#{r.rank || i + 4}</span>
                  <span className="name">{r.name || 'Player'}</span>
                  <span className="score">{formatScore(r.score)}</span>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
