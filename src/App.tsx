import { Accordion, Badge, BannerSlim, Flex, SelectList, Text } from 'gestalt';
import { useEffect, useMemo, useRef, useState } from 'react';
import { DepartureWidget } from './components/DepartureWidget';
import { LabeledIconButton } from './components/LabeledIconButton';
import { MinuteStepper } from './components/MinuteStepper';
import { otherDirection } from './lib/directions';
import { currentPosition, formatDistance, nearestStop } from './lib/geo';
import { groupLines } from './lib/lines';
import { readPreference, savePreference } from './lib/preferences';
import { orderStops } from './lib/stopOrder';
import type { Passage, PassagesApi, Stop } from './lib/types';

const REFRESH_MS = 30_000;
const MAX_WALK_MINUTES = 30;
const NO_PASSAGES: Passage[] = [];
const NO_STOPS: Stop[] = [];
/** Icône ⇄ (flèche vers la droite au-dessus, vers la gauche dessous), grille 24 × 24 de Gestalt. */
const SWAP_ARROWS_PATH = 'M2 6h14V3l5 4-5 4V8H2zM22 18H8v3l-5-4 5-4v3h14z';

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
  // Passages de la ligne, avec la ligne à laquelle ils appartiennent : juste après un
  // changement de ligne, ceux de l'ancienne ne doivent servir à rien.
  const [lineData, setLineData] = useState<{ line: string; passages: Passage[] }>({ line: '', passages: [] });
  const [direction, setDirection] = useState(() => readPreference('direction'));
  const [stops, setStops] = useState<Stop[]>([]);
  // Ligne dont les arrêts sont chargés : tant qu'ils ne le sont pas, rien ne « manque ».
  const [stopsLine, setStopsLine] = useState('');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [stopName, setStopName] = useState(() => readPreference('arret'));
  const [walkMinutes, setWalkMinutes] = useState(readWalkMinutes);
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
      (result) => {
        if (cancelled) return;
        setStops(result);
        setStopsLine(lineChosen);
      },
      (e) => !cancelled && setError(message(e)),
    );
    return () => {
      cancelled = true;
    };
  }, [api, lineChosen]);

  // Un seul appel par actualisation : les passages de toute la ligne, dont on tire
  // l'arrêt, les directions et l'ordre des arrêts. Rien n'est demandé tant que la
  // page est masquée (onglet en arrière-plan, téléphone verrouillé).
  useEffect(() => {
    if (!lineChosen) return;
    let cancelled = false;
    let timer: ReturnType<typeof setInterval> | undefined;
    const load = async () => {
      try {
        const result = await api.getLinePassages(lineChosen);
        if (!cancelled) setLineData({ line: lineChosen, passages: result });
      } catch {
        // Appel refusé ou limite atteinte : on garde les derniers passages, sans
        // message ; le compte à rebours continue sur leurs heures de passage.
      }
    };
    const start = () => {
      if (timer) return;
      load();
      timer = setInterval(load, REFRESH_MS);
    };
    const pause = () => {
      clearInterval(timer);
      timer = undefined;
    };
    const onVisibilityChange = () => (document.hidden ? pause() : start());
    if (!document.hidden) start();
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      cancelled = true;
      pause();
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [api, lineChosen]);

  const linePassages = lineData.line === lineChosen ? lineData.passages : NO_PASSAGES;
  const lineStops = stopsLine === lineChosen ? stops : NO_STOPS;

  // Directions (terminus) annoncées sur la ligne, et arrêts dans l'ordre du parcours.
  const directions = useMemo(
    () => [...new Set(linePassages.map((p) => p.direction).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'fr')),
    [linePassages],
  );
  const orderedStops = useMemo(() => orderStops(lineStops, linePassages, direction), [lineStops, linePassages, direction]);

  // Une direction retenue reste proposée même si aucun passage ne l'annonce en ce moment.
  const directionOptions = direction && !directions.includes(direction) ? [direction, ...directions] : directions;

  // Une direction est toujours choisie : à défaut, la première annoncée sur la ligne.
  useEffect(() => {
    if (lineChosen && !direction && directions.length) chooseDirection(directions[0]);
  }, [lineChosen, direction, directions]);

  const stop = lineStops.find((s) => s.name === stopName);

  // Réglages incomplets (une fois les données chargées) : ligne ou arrêt à choisir.
  const settingsMissing = lines.length > 0 && (!lineChosen || (stopsLine === lineChosen && !stop));
  // Dépliés d'office quand il manque une valeur ; ils restent ouverts une fois complétés.
  useEffect(() => {
    if (settingsMissing) setSettingsOpen(true);
  }, [settingsMissing]);
  const shownPassages = useMemo(
    () =>
      stop
        ? linePassages
            .filter((p) => stop.ids.includes(p.stopId) && (!direction || p.direction === direction))
            .sort((a, b) => a.departure.getTime() - b.departure.getTime())
        : [],
    [linePassages, stop, direction],
  );

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

  const canLocate = lineStops.some((s) => s.lat != null && s.lon != null);

  // Ligne affichée, lue après une attente (la géolocalisation peut prendre plusieurs secondes).
  const currentLine = useRef(lineChosen);
  useEffect(() => {
    currentLine.current = lineChosen;
  }, [lineChosen]);

  /**
   * Sélectionne l'arrêt le plus proche. Lancée automatiquement au chargement,
   * un échec (localisation refusée…) est silencieux : l'arrêt retenu reste choisi.
   * Si la ligne a changé entre-temps, la position reçue est ignorée.
   */
  const chooseNearest = async ({ auto = false } = {}) => {
    const line = lineChosen;
    const candidates = lineStops;
    setLocating(true);
    try {
      const position = await currentPosition();
      if (currentLine.current !== line) return;
      const found = nearestStop(candidates, position);
      if (found) {
        chooseStop(found.stop.name);
        setNearby({ name: found.stop.name, distance: found.distance });
      }
      setError(null);
    } catch (e) {
      if (!auto) setError(message(e));
    } finally {
      setLocating(false);
    }
  };

  // Au chargement, avec la ligne retenue, on cherche l'arrêt le plus proche une seule fois.
  const autoLocate = useRef(Boolean(readPreference('ligne')));
  useEffect(() => {
    if (!autoLocate.current || !lineChosen || !canLocate) return;
    autoLocate.current = false;
    chooseNearest({ auto: true });
    // chooseNearest lit les arrêts de ce rendu : c'est voulu, ils viennent d'arriver.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lineChosen, canLocate]);

  return (
    <main className="page">
      <DepartureWidget
        line={lineChosen}
        direction={direction}
        hasStop={Boolean(stop)}
        passages={shownPassages}
        walkMinutes={walkMinutes}
      />
      <div className="fields">
        <Flex direction="column" gap={6}>
          {api.demo && (
            <Flex>
              <Badge text="Mode démo : passages fictifs" type="warning" />
            </Flex>
          )}

          <Accordion.Expandable
            id="reglages"
            borderStyle="sm"
            accessibilityExpandLabel="Déplier les réglages"
            accessibilityCollapseLabel="Replier les réglages"
            expandedIndex={settingsOpen || settingsMissing ? 0 : null}
            onExpandedChange={(index) => setSettingsOpen(index === 0)}
            items={[
              {
                title: 'Réglages',
                children: (
                  <div className="settings">
                    <div className="settings-group">
                      <div className="settings-fields">
                      <Flex direction="column" gap={6}>
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

                        <div className="with-action">
                          <Flex alignItems="end" gap={2}>
                            <Flex.Item flex="grow" minWidth={0}>
                              <SelectList
                                id="direction"
                                label="Direction"
                                size="lg"
                                placeholder={
                                  !lineChosen
                                    ? 'Choisir d’abord une ligne'
                                    : directions.length
                                      ? 'Choisir une direction'
                                      : 'Aucune direction annoncée'
                                }
                                value={direction || null}
                                onChange={({ value }) => chooseDirection(value)}
                                disabled={!directionOptions.length}
                              >
                                {directionOptions.map((d) => (
                                  <SelectList.Option key={d} label={d} value={d} />
                                ))}
                              </SelectList>
                            </Flex.Item>
                            <LabeledIconButton
                              label="Inverser"
                              accessibilityLabel="Basculer sur l’autre direction"
                              dangerouslySetSvgPath={{ __path: SWAP_ARROWS_PATH }}
                              bgColor="lightGray"
                              iconColor="darkGray"
                              size="lg"
                              onClick={() => chooseDirection(otherDirection(directions, direction))}
                              disabled={directions.length < 2}
                            />
                          </Flex>
                        </div>
                      </Flex>
                      </div>
                    </div>

                    <div className="settings-group">
                      <div className="settings-fields">
                      <Flex direction="column" gap={6}>
                        <Flex direction="column" gap={2}>
                          <div className="with-action">
                            <Flex alignItems="end" gap={2}>
                              <Flex.Item flex="grow" minWidth={0}>
                                <SelectList
                                  id="stop"
                                  label="Arrêt"
                                  size="lg"
                                  placeholder={
                                    !lineChosen ? 'Choisir d’abord une ligne' : lineStops.length ? 'Choisir un arrêt' : 'Chargement des arrêts…'
                                  }
                                  value={stop ? stopName : null}
                                  onChange={({ value }) => chooseStop(value)}
                                  disabled={!lineStops.length}
                                >
                                  {orderedStops.map((s) => (
                                    <SelectList.Option key={s.name} label={s.name} value={s.name} />
                                  ))}
                                </SelectList>
                              </Flex.Item>
                              {canLocate && (
                                <LabeledIconButton
                                  label="Me localiser"
                                  accessibilityLabel={locating ? 'Localisation…' : 'Arrêt le plus proche'}
                                  icon="location"
                                  bgColor="lightGray"
                                  iconColor="darkGray"
                                  size="lg"
                                  onClick={() => chooseNearest()}
                                  disabled={locating}
                                />
                              )}
                            </Flex>
                          </div>
                          {nearby && nearby.name === stopName && (
                            <Text color="subtle" size="200">
                              Arrêt le plus proche de toi, à {formatDistance(nearby.distance)} à vol d’oiseau.
                            </Text>
                          )}
                        </Flex>

                        <Flex direction="column" gap={4}>
                          <Text id="walk-label" size="200">
                            Temps pour rejoindre l’arrêt
                          </Text>
                          <MinuteStepper labelId="walk-label" value={walkMinutes} min={0} max={MAX_WALK_MINUTES} onChange={chooseWalk} />
                        </Flex>
                      </Flex>
                      </div>
                    </div>
                  </div>
                ),
              },
            ]}
          />

          {error && (
            <div role="alert">
              <BannerSlim type="error" iconAccessibilityLabel="Erreur" message={error} />
            </div>
          )}
        </Flex>
      </div>
    </main>
  );
}
