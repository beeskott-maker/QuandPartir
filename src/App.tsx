import { useEffect, useState, type FormEvent } from 'react';
import type { Passage, PassagesApi } from './lib/types';

const REFRESH_MS = 30_000;

function formatTime(date: Date): string {
  return date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}

export function App({ api }: { api: PassagesApi }) {
  const [draft, setDraft] = useState('');
  const [stopId, setStopId] = useState('');
  const [passages, setPassages] = useState<Passage[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!stopId) return;
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        const result = await api.getPassages(stopId);
        if (!cancelled) {
          setPassages(result);
          setError(null);
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    const timer = setInterval(load, REFRESH_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [api, stopId]);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    setStopId(draft.trim());
  };

  return (
    <main className="page">
      <h1>QuandPartir</h1>
      {api.demo && <p className="badge">Mode démo : passages fictifs</p>}
      <form onSubmit={submit} className="form">
        <label htmlFor="stop">Code de l’arrêt TCL</label>
        <input id="stop" value={draft} onChange={(e) => setDraft(e.target.value)} inputMode="numeric" />
        <button type="submit" disabled={!draft.trim()}>
          Voir les passages
        </button>
      </form>
      {error && <p role="alert">{error}</p>}
      {stopId && !error && !loading && passages.length === 0 && <p>Aucun passage annoncé.</p>}
      <ul className="passages">
        {passages.map((p) => (
          <li key={`${p.line}-${p.direction}-${p.departure.getTime()}`}>
            <strong>{p.line}</strong> → {p.direction} : {p.delayLabel || formatTime(p.departure)}
            {!p.realtime && <span className="theoretical"> (théorique)</span>}
          </li>
        ))}
      </ul>
    </main>
  );
}
