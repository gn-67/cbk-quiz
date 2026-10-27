import { QRCodeSVG } from 'qrcode.react';
import type { SessionPublicState } from '../../../../shared/protocol';
import { joinHost, safeArray } from './util';

const MAX_CHIPS = 60;

function hashIdx(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h) % 6;
}

export default function LobbyScreen({ state }: { state: SessionPublicState }) {
  const players = safeArray(state.players);
  const count = Number.isFinite(state.playerCount) ? state.playerCount : players.length;
  const shown = players.slice(-MAX_CHIPS);
  const hidden = players.length - shown.length;
  const host = joinHost(state.joinUrl);
  const code = state.code ?? '';

  return (
    <div className="lobby">
      <div className="lobby-left">
        {state.joinUrl ? (
          <div className="qr-card">
            <QRCodeSVG value={state.joinUrl} size={512} level="M" marginSize={0} />
          </div>
        ) : null}
        {host && (
          <div className="lobby-host">
            <span>Join at </span>
            {host}
          </div>
        )}
        <div className="lobby-codelabel">Game code</div>
        <div className="lobby-code">{code}</div>
        <div className="lobby-hint">
          Scan or go to <b>{host || 'the join page'}</b> and enter code <b>{code}</b>
        </div>
      </div>

      <div className="lobby-right">
        <div className="lobby-title">
          <h1>CBC Quiz</h1>
          <span>Claude Builder Club</span>
        </div>
        <div className="lobby-count">
          Players: <span className="num" key={count}>{count}</span>
        </div>
        <div className="lobby-chips">
          {shown.length === 0 ? (
            <div className="lobby-empty">No players yet. Be the first to join!</div>
          ) : (
            <>
              {hidden > 0 && <span className="chip more">+{hidden} more</span>}
              {shown.map((p) => (
                <span key={p.id} className={`chip c${hashIdx(p.id || p.name || '')}${p.connected === false ? ' off' : ''}`}>
                  {p.name || 'Player'}
                </span>
              ))}
            </>
          )}
        </div>
        <div className="lobby-foot">Waiting for the host to start…</div>
      </div>
    </div>
  );
}
