import { useEffect, useState } from 'react';
import { DEFAULT_LINE } from './lib/lines';
import type { Passage, PassagesApi, Stop } from './lib/types';

const REFRESH_MS = 30_000;
const STORAGE_KEY = 'quandpartir.arret';

function formatTime(date: Date): string {
  return date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}

function message(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

function readSavedStop(): string {
  try {
    return localStorage.getItem(STORAGE_KEY) ?? '';
  } catch {
    return '';
  }
}

function saveStop(name: string): void {
  try {
    localStorage.setItem(STORAGE_KEY, name);
  } catch {
    // Stockage indisponible (navigation privée…) : le choix ne sera pas retenu.
  }
}

export function App({ api }: { api: PassagesApi }) {
  const [line] = useState(DEFAULT_LINE);
  const [stops, setStops] = useState<Stop[]>([]);
  const [stopName, setStopName] = useState(readSavedStop);
  const [passages, setPassages] = useState<Passage[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    api.getStops(line).then(
      (result) => !cancelled && setStops(result),
      (e) => !cancelled && setError(message(e)),
    );
    return () => {
      cancelled = true;
    };
  }, [api, line]);

  const stop = stops.find((s) => s.name === stopName);

  useEffect(() => {
    if (!stop) return;
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        const result = await api.getPassages(stop.ids, line);
        if (!cancelled) {
          setPassages(result);
          setError(null);
        }
      } catch (e) {
        if (!cancelled) setError(message(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    setPassages([]);
    load();
    const timer = setInterval(load, REFRESH_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [api, stop, line]);

  const choose = (name: string) => {
    setStopName(name);
    saveStop(name);
  };

  return (
    <main className="page">
      <h1>QuandPartir</h1>
      <p>Ligne {line}</p>
      {api.demo && <p className="badge">Mode démo : passages fictifs</p>}
      <div className="form">
        <label htmlFor="stop">Arrêt</label>
        <select id="stop" value={stop ? stopName : ''} onChange={(e) => choose(e.target.value)} disabled={!stops.length}>
          <option value="" disabled>
            {stops.length ? 'Choisir un arrêt' : 'Chargement des arrêts…'}
          </option>
          {stops.map((s) => (
            <option key={s.name} value={s.name}>
              {s.name}
            </option>
          ))}
        </select>
      </div>
      {error && <p role="alert">{error}</p>}
      {stop && !error && !loading && passages.length === 0 && <p>Aucun passage annoncé.</p>}
      <ul className="passages">
        {passages.map((p) => (
          <li key={`${p.stopId}-${p.direction}-${p.departure.getTime()}`}>
            <strong>{p.line}</strong> → {p.direction} : {p.delayLabel || formatTime(p.departure)}
            {!p.realtime && <span className="theoretical"> (théorique)</span>}
          </li>
        ))}
      </ul>
    </main>
  );
}
