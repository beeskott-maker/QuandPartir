import { useEffect, useState, type ReactNode } from 'react';
import { formatCountdown, nextPassage } from '../lib/countdown';
import { lineLabel, lineMode, type LineMode } from '../lib/lines';
import type { Passage } from '../lib/types';

/** Icône de chaque mode (Material Icons « directions_bus », « tram », « subway », grille 24 × 24). */
const BUS_ICON_PATH =
  'M4 16c0 .88.39 1.67 1 2.22V20c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h8v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1.78c.61-.55 1-1.34 1-2.22V6c0-3.5-3.58-4-8-4s-8 .5-8 4v10zm3.5 1c-.83 0-1.5-.67-1.5-1.5S6.67 14 7.5 14s1.5.67 1.5 1.5S8.33 17 7.5 17zm9 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm1.5-6H6V6h12v5z';
const TRAM_ICON_PATH =
  'M19 16.94V8.5c0-2.79-2.61-3.4-6.01-3.49l.76-1.51H17V2H7v1.5h4.75l-.76 1.52C7.86 5.11 5 5.73 5 8.5v8.44c0 1.45 1.19 2.66 2.59 2.97L6 21.5v.5h2.23l2-2H14l2 2h2v-.5L16.5 20h-.08c1.69 0 2.58-1.37 2.58-3.06zm-7 1.56c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm5-4.5H7V9h10v5z';
const METRO_ICON_PATH =
  'M17.8 2.8C16 2.09 13.86 2 12 2c-1.86 0-4 .09-5.8.8C3.53 3.84 2 6.05 2 8.86V22h20V8.86c0-2.81-1.53-5.02-4.2-6.06zm.2 13.08c0 1.45-1.18 2.62-2.63 2.62l1.13 1.12V20H15l-1.5-1.5h-2.83L9.17 20H7.5v-.38l1.12-1.12C7.18 18.5 6 17.32 6 15.88V9c0-2.63 3-3 6-3 3.32 0 6 .38 6 3v6.88zm-8.62-.38c.76 0 1.38-.62 1.38-1.38s-.62-1.38-1.38-1.38S8 13.36 8 14.12s.62 1.38 1.38 1.38zm5.24 0c.76 0 1.38-.62 1.38-1.38s-.62-1.38-1.38-1.38-1.38.62-1.38 1.38.62 1.38 1.38 1.38zM8 8h8v3.5H8z';
/** Le funiculaire, rangé avec le métro sur les plans TCL, en prend l'icône. */
const MODE_ICON_PATHS: Record<LineMode, string> = {
  bus: BUS_ICON_PATH,
  tram: TRAM_ICON_PATH,
  métro: METRO_ICON_PATH,
  funiculaire: METRO_ICON_PATH,
};

/** Temps de fermer chez soi et de descendre : compté dans le compte à rebours, jamais affiché. */
const LEAVE_HOME_MS = 2 * 60_000;

/** « 11h23 » */
function formatHour(date: Date): string {
  return `${date.getHours()}h${String(date.getMinutes()).padStart(2, '0')}`;
}

/** Piéton en marche (Material Icons « directions_walk », grille 24 × 24). */
const WALK_ICON_PATH =
  'M13.5 5.5c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zM9.8 8.9 7 23h2.1l1.8-8 2.1 2v6h2v-7.5l-2.1-2 .6-3C14.8 12 16.8 13 19 13v-2c-1.9 0-3.5-1-4.3-2.4l-1-1.6c-.4-.6-1-1-1.7-1-.3 0-.5.1-.8.1L6 8.3V13h2V9.6l1.8-.7';

/** Heure courante, rafraîchie chaque seconde pour le compte à rebours. */
function useNow(): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);
  return now;
}

interface Props {
  /** Ligne choisie, vide tant qu'aucune ne l'est. */
  line: string;
  /** Direction choisie, vide pour toutes. */
  direction: string;
  /** Aucun arrêt choisi : le widget invite à en choisir un. */
  hasStop: boolean;
  /** Nom de l'arrêt choisi. */
  stopName: string;
  passages: Passage[];
  /** Temps pour rejoindre l'arrêt, retranché du compte à rebours. */
  walkMinutes: number;
}

/** Compte à rebours avant de partir pour attraper le prochain passage à l'arrêt choisi. */
export function DepartureWidget({ line, direction, hasStop, stopName, passages, walkMinutes }: Props) {
  const now = useNow();
  // Avance nécessaire avant le passage : la marche, plus le temps de quitter chez soi.
  const walkMs = walkMinutes * 60_000 + LEAVE_HOME_MS;
  const next = nextPassage(passages, now, walkMs);

  const service = direction ? `${lineLabel(line)} direction ${direction}` : lineLabel(line);
  let detail: ReactNode;
  if (next) {
    // « 3 min à pied → T1 arrêt Saint-André à 11h23 » ; sans trajet à faire, juste le passage.
    detail = (
      <>
        {walkMinutes > 0 && (
          <span className="widget-trip-part">
            <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
              <path d={WALK_ICON_PATH} />
            </svg>
            {walkMinutes} min à pied →
          </span>
        )}{' '}
        <span className="widget-trip-part">
          <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
            <path d={MODE_ICON_PATHS[lineMode(next.line)]} />
          </svg>
          {next.line} arrêt {stopName} à {formatHour(next.departure)}
        </span>
      </>
    );
  } else if (!line) detail = 'Choisis une ligne ci-dessous.';
  else if (!hasStop) detail = `Choisis un arrêt du ${lineLabel(line)} ci-dessous.`;
  else if (passages.length && walkMinutes) detail = `Aucun ${service} atteignable avec ${walkMinutes} min de trajet.`;
  else if (passages.length) detail = `Aucun ${service} atteignable à temps.`;
  else detail = `Aucun ${service} annoncé à cet arrêt.`;

  return (
    <section className="widget" aria-live="polite" aria-label="Prochain départ">
      <p className="widget-label">Partir dans</p>
      <p className="widget-countdown">
        {next ? `${formatCountdown(next.departure.getTime() - walkMs - now.getTime())} min` : '–'}
      </p>
      <p className="widget-detail">{detail}</p>
    </section>
  );
}
