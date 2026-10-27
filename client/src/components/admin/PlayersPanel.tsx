import { useState } from 'react';
import type { PlayerPublic } from '../../../../shared/protocol';
import { adminCall } from '../../lib/admin';
import { useToast } from './Toasts';
import { useAdmin } from './AdminContext';
import ConfirmButton from './ConfirmButton';

interface Props {
  code: string;
  players: PlayerPublic[];
  connectedCount: number;
  canKick: boolean;
}

export default function PlayersPanel({ code, players, connectedCount, canKick }: Props) {
  const toast = useToast();
  const { reportError } = useAdmin();
  const [query, setQuery] = useState('');
  const [kicking, setKicking] = useState<string | null>(null);

  const q = query.trim().toLowerCase();
  const filtered = q ? players.filter((p) => p.name.toLowerCase().includes(q)) : players;

  async function kick(p: PlayerPublic) {
    setKicking(p.id);
    try {
      await adminCall('admin:kick', { code, playerId: p.id });
      toast.success(`Kicked ${p.name}`);
    } catch (err) {
      reportError(err, `Kick ${p.name} failed`);
    } finally {
      setKicking(null);
    }
  }

  return (
    <section className="adm-panel" aria-labelledby="adm-pl-h">
      <div className="adm-panel-h">
        <h2 id="adm-pl-h">
          Players
          <span className="adm-count adm-num">
            {connectedCount}/{players.length}
          </span>
        </h2>
        <span className="adm-hint">connected / total</span>
      </div>
      {players.length > 6 && (
        <input
          type="search"
          placeholder="Search players…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Search players"
        />
      )}
      {players.length === 0 ? (
        <div className="adm-empty">No players yet. Share the code or join link.</div>
      ) : filtered.length === 0 ? (
        <div className="adm-empty">No player matches “{query}”.</div>
      ) : (
        <div className="adm-scroll">
          {filtered.map((p) => (
            <div className="adm-player" key={p.id}>
              <span className={`adm-dot sm${p.connected ? ' on' : ''}`} title={p.connected ? 'Connected' : 'Disconnected'} />
              <span className={`adm-pname${p.connected ? '' : ' off'}`} title={p.name}>
                {p.name}
              </span>
              <span className="adm-pscore">{p.score.toLocaleString()}</span>
              {canKick && (
                <ConfirmButton
                  label="Kick"
                  confirmLabel="Kick"
                  className="btn ghost sm"
                  confirmClassName="btn danger sm"
                  pending={kicking === p.id}
                  onConfirm={() => kick(p)}
                />
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
