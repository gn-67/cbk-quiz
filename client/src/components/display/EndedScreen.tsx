import type { SessionPublicState } from '../../../../shared/protocol';
import { safeArray } from './util';

export default function EndedScreen({ state }: { state: SessionPublicState }) {
  const winner = safeArray(state.leaderboard)[0];
  return (
    <div className="ended">
      <h1>Thanks for playing! 🎉</h1>
      {winner && (winner.score ?? 0) > 0 && (
        <div className="winner">
          Winner: <b>{winner.name}</b>
        </div>
      )}
      <div className="code">
        CBK · Claude Builder Club · code <b>{state.code}</b>
      </div>
    </div>
  );
}
