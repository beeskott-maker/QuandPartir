import { Badge, BannerSlim, Button, Flex, SelectList, Text } from 'gestalt';
import { useEffect, useState } from 'react';
import { DepartureWidget } from './components/DepartureWidget';
import { MinuteStepper } from './components/MinuteStepper';
import { currentPosition, formatDistance, nearestStop } from './lib/geo';
import { groupLines } from './lib/lines';
import { readPreference, savePreference } from './lib/preferences';
import type { Passage, PassagesApi, Stop } from './lib/types';

const REFRESH_MS = 30_000;
const MAX_WALK_MINUTES = 30;

function message(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

function readWalkMinutes(): number {
  const minutes = Number(readPreference('trajet'));
  return Number.isInteger(minutes) && minutes >= 0 && minutes <= MAX_WALK_MINUTES ? minutes : 0;
}

export function App({ api }: { api: PassagesApi }) {
  const [lines, setLines] = useState<string[]>([]);
  const [line, setLine] = useState(() => readPreference('ligne'));
  const [directions, setDirections] = useState<string[]>([]);
  const [direction, setDirection] = useState(() => readPreference('direction'));
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

  useEffect(() => {
    setDirections([]);
    if (!lineChosen) return;
    let cancelled = false;
    api.getDirections(lineChosen).then(
      (result) => !cancelled && setDirections(result),
      (e) => !cancelled && setError(message(e)),
    );
    return () => {
      cancelled = true;
    };
  }, [api, lineChosen]);

  // Une direction retenue reste proposée même si aucun passage ne l'annonce en ce moment.
  const directionOptions = direction && !directions.includes(direction) ? [direction, ...directions] : directions;

  const stop = stops.find((s) => s.name === stopName);
  const shownPassages = direction ? passages.filter((p) => p.direction === direction) : passages;

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
    // La direction et l'arrêt dépendent de la ligne : on les redemande.
    chooseDirection('');
    chooseStop('');
  };

  const chooseDirection = (value: string) => {
    setDirection(value);
    savePreference('direction', value);
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
      <DepartureWidget
        line={lineChosen}
        direction={direction}
        hasStop={Boolean(stop)}
        passages={shownPassages}
        walkMinutes={walkMinutes}
      />
      <Flex direction="column" gap={6}>
        {api.demo && (
          <Flex>
            <Badge text="Mode démo : passages fictifs" type="warning" />
          </Flex>
        )}

        <SelectList
          id="line"
          label="Ligne"
          size="lg"
          placeholder={lines.length ? 'Choisir une ligne' : 'Chargement des lignes…'}
          value={lineChosen || null}
          onChange={({ value }) => chooseLine(value)}
          disabled={!lines.length}
        >
          {groupLines(lines).map((group) => (
            <SelectList.Group key={group.label} label={group.label}>
              {group.lines.map((l) => (
                <SelectList.Option key={l} label={l} value={l} />
              ))}
            </SelectList.Group>
          ))}
        </SelectList>

        <SelectList
          id="direction"
          label="Direction"
          size="lg"
          value={direction}
          onChange={({ value }) => chooseDirection(value)}
          disabled={!lineChosen}
        >
          <SelectList.Option label={lineChosen ? 'Toutes les directions' : 'Choisir d’abord une ligne'} value="" />
          {directionOptions.map((d) => (
            <SelectList.Option key={d} label={d} value={d} />
          ))}
        </SelectList>

        <Flex direction="column" gap={2}>
          <SelectList
            id="stop"
            label="Arrêt"
            size="lg"
            placeholder={
              !lineChosen ? 'Choisir d’abord une ligne' : stops.length ? 'Choisir un arrêt' : 'Chargement des arrêts…'
            }
            value={stop ? stopName : null}
            onChange={({ value }) => chooseStop(value)}
            disabled={!stops.length}
          >
            {stops.map((s) => (
              <SelectList.Option key={s.name} label={s.name} value={s.name} />
            ))}
          </SelectList>
          {canLocate && (
            <Button
              text={locating ? 'Localisation…' : 'Arrêt le plus proche'}
              iconStart="location"
              size="lg"
              fullWidth
              onClick={chooseNearest}
              disabled={locating}
            />
          )}
          {nearby && nearby.name === stopName && (
            <Text color="subtle" size="200">
              Arrêt le plus proche de toi, à {formatDistance(nearby.distance)} à vol d’oiseau.
            </Text>
          )}
        </Flex>

        <Flex direction="column" gap={2}>
          <Text id="walk-label" size="100">
            Temps pour rejoindre l’arrêt
          </Text>
          <MinuteStepper labelId="walk-label" value={walkMinutes} min={0} max={MAX_WALK_MINUTES} onChange={chooseWalk} />
        </Flex>

        {error && (
          <div role="alert">
            <BannerSlim type="error" iconAccessibilityLabel="Erreur" message={error} />
          </div>
        )}
      </Flex>
    </main>
  );
}
