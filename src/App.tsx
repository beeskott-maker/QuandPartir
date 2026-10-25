import { useEffect, useState } from 'react';
import { DepartureWidget } from './components/DepartureWidget';
import { currentPosition, formatDistance, nearestStop } from './lib/geo';
import { readPreference, savePreference } from './lib/preferences';
import type { Passage, PassagesApi, Stop } from './lib/types';

const REFRESH_MS = 30_000;
const WALK_OPTIONS = Array.from({ length: 31 }, (_, minutes) => minutes);

function message(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

function readWalkMinutes(): number {
  const minutes = Number(readPreference('trajet'));
  return WALK_OPTIONS.includes(minutes) ? minutes : 0;
}

export function App({ api }: { api: PassagesApi }) {
  const [lines, setLines] = useState<string[]>([]);
  const [line, setLine] = useState(() => readPreference('ligne'));
  const [stops, setStops] = useState<Stop[]>([]);
  const [stopName, setStopName] = useState(() => readPreference('arret'));
  const [walkMinutes, setWalkMinutes] = useState(readWalkMinutes);
  const [passages, setPassages] = useState<Passage[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [locating, setLocating] = useState(false);
  const [nearby, setNearby] = useState<{ name: string; distance: number } | null>(null);

  useEffect(() => {
    let cancelled = false;
    api.getLines().then(
      (result) => !cancelled && setLines(result),
      (e) => !cancelled && setError(message(e)),
    );
    return () => {
      cancelled = true;
    };
  }, [api]);

  // Une ligne retenue qui n'est plus proposée ne compte pas : le choix reste obligatoire.
  const lineChosen = lines.includes(line) ? line : '';

  useEffect(() => {
    setStops([]);
    if (!lineChosen) return;
    let cancelled = false;
    api.getStops(lineChosen).then(
      (result) => !cancelled && setStops(result),
      (e) => !cancelled && setError(message(e)),
    );
    return () => {
      cancelled = true;
    };
  }, [api, lineChosen]);

  const stop = stops.find((s) => s.name === stopName);

  useEffect(() => {
    setPassages([]);
    if (!stop || !lineChosen) return;
    let cancelled = false;
    const load = async () => {
      try {
        const result = await api.getPassages(stop.ids, lineChosen);
        if (!cancelled) {
          setPassages(result);
          setError(null);
        }
      } catch (e) {
        if (!cancelled) setError(message(e));
      }
    };
    load();
    const timer = setInterval(load, REFRESH_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [api, stop, lineChosen]);

  const chooseLine = (value: string) => {
    setLine(value);
    savePreference('ligne', value);
    // L'arrêt dépend de la ligne : on le redemande.
    chooseStop('');
  };

  const chooseStop = (name: string) => {
    setStopName(name);
    savePreference('arret', name);
    setNearby(null);
  };

  const chooseWalk = (minutes: number) => {
    setWalkMinutes(minutes);
    savePreference('trajet', String(minutes));
  };

  const canLocate = stops.some((s) => s.lat != null && s.lon != null);

  const chooseNearest = async () => {
    setLocating(true);
    try {
      const found = nearestStop(stops, await currentPosition());
      if (found) {
        chooseStop(found.stop.name);
        setNearby({ name: found.stop.name, distance: found.distance });
      }
      setError(null);
    } catch (e) {
      setError(message(e));
    } finally {
      setLocating(false);
    }
  };

  return (
    <main className="page">
      <DepartureWidget line={lineChosen} hasStop={Boolean(stop)} passages={passages} walkMinutes={walkMinutes} />
      {api.demo && <p className="badge">Mode démo : passages fictifs</p>}
      <div className="form">
        <label htmlFor="line">Ligne</label>
        <select
          id="line"
          required
          value={lineChosen}
          onChange={(e) => chooseLine(e.target.value)}
          disabled={!lines.length}
        >
          <option value="" disabled>
            {lines.length ? 'Choisir une ligne' : 'Chargement des lignes…'}
          </option>
          {lines.map((l) => (
            <option key={l} value={l}>
              {l}
            </option>
          ))}
        </select>

        <label htmlFor="stop">Arrêt</label>
        <select
          id="stop"
          required
          value={stop ? stopName : ''}
          onChange={(e) => chooseStop(e.target.value)}
          disabled={!stops.length}
        >
          <option value="" disabled>
            {!lineChosen ? 'Choisir d’abord une ligne' : stops.length ? 'Choisir un arrêt' : 'Chargement des arrêts…'}
          </option>
          {stops.map((s) => (
            <option key={s.name} value={s.name}>
              {s.name}
            </option>
          ))}
        </select>
        {canLocate && (
          <button type="button" onClick={chooseNearest} disabled={locating}>
            {locating ? 'Localisation…' : 'Arrêt le plus proche'}
          </button>
        )}
        {nearby && nearby.name === stopName && (
          <p className="nearby">
            Arrêt le plus proche de toi, à {formatDistance(nearby.distance)} à vol d’oiseau.
          </p>
        )}

        <label htmlFor="walk">Temps pour rejoindre l’arrêt</label>
        <select id="walk" value={walkMinutes} onChange={(e) => chooseWalk(Number(e.target.value))}>
          {WALK_OPTIONS.map((minutes) => (
            <option key={minutes} value={minutes}>
              {minutes === 0 ? 'Aucun (déjà à l’arrêt)' : `${minutes} min`}
            </option>
          ))}
        </select>
      </div>
      {error && <p role="alert">{error}</p>}
    </main>
  );
}
