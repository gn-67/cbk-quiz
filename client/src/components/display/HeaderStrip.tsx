import type { SessionPublicState } from '../../../../shared/protocol';

/** Tiny persistent strip shown during game phases. */
export default function HeaderStrip({ state }: { state: SessionPublicState }) {
  const players = Number.isFinite(state.playerCount) ? state.playerCount : (state.players?.length ?? 0);
  return (
    <div className="dp-strip">
      <div>
        CBC Quiz<span className="dot">·</span>code <b>{state.code}</b>
        <span className="dot">·</span>
        {players} {players === 1 ? 'player' : 'players'}
      </div>
      <div className="strip-set">{state.questionSetName}</div>
    </div>
  );
}
