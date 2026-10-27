import type { PlayerState } from '../../../../shared/protocol';

interface Props {
  state: PlayerState;
}

export default function PhaseLobby({ state }: Props) {
  return (
    <section className="pl-center pl-lobby">
      <div className="pl-kicker fade-up">You're in!</div>
      <div className="pl-name-card pop" key={state.name}>
        <div className="pl-name-label">Your name is</div>
        <div className="pl-name">{state.name}</div>
      </div>
      <p className="pl-sub fade-up" style={{ animationDelay: '.15s' }}>
        Look at the big screen
        <span className="pl-bounce" aria-hidden="true"> ☝️</span>
      </p>
      <p className="pl-wink fade-up" style={{ animationDelay: '.25s' }}>
        Change name? Nope — names are random. Own it.
      </p>
      <div className="pl-lobby__meta fade-up" style={{ animationDelay: '.3s' }}>
        <div className="pl-pill">
          <strong>{state.totalPlayers}</strong> {state.totalPlayers === 1 ? 'player' : 'players'} in
        </div>
      </div>
    </section>
  );
}
