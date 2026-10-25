import { useEffect, useState, type ReactNode } from 'react';
import { formatCountdown, formatTime, nextPassage } from '../lib/countdown';
import { lineLabel } from '../lib/lines';
import type { Passage } from '../lib/types';

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
  passages: Passage[];
  /** Temps pour rejoindre l'arrêt, retranché du compte à rebours. */
  walkMinutes: number;
}

/** Compte à rebours avant de partir pour attraper le prochain passage à l'arrêt choisi. */
export function DepartureWidget({ line, direction, hasStop, passages, walkMinutes }: Props) {
  const now = useNow();
  const walkMs = walkMinutes * 60_000;
  const next = nextPassage(passages, now, walkMs);

  const service = direction ? `${lineLabel(line)} direction ${direction}` : lineLabel(line);
  let detail: ReactNode;
  if (next) {
    // Retour à la ligne entre la ligne et la direction ; l'espace garde un texte lisible d'un bloc.
    detail = (
      <>
        Prochain {lineLabel(next.line)} direction{' '}
        <br />
        {next.direction} à {formatTime(next.departure)}
      </>
    );
  } else if (!line) detail = 'Choisis une ligne ci-dessous.';
  else if (!hasStop) detail = `Choisis un arrêt du ${lineLabel(line)} ci-dessous.`;
  else if (passages.length && walkMinutes) detail = `Aucun ${service} atteignable avec ${walkMinutes} min de trajet.`;
  else detail = `Aucun ${service} annoncé à cet arrêt.`;

  return (
    <section className="widget" aria-live="polite" aria-label="Prochain départ">
      <p className="widget-label">Partir dans</p>
      <p className="widget-countdown">
        {next ? `${formatCountdown(next.departure.getTime() - walkMs - now.getTime())} min` : '–'}
      </p>
      {next && walkMinutes > 0 && (
        <p className="widget-walk">
          <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
            <path d={WALK_ICON_PATH} />
          </svg>
          <span>{walkMinutes} min à pied</span>
        </p>
      )}
      <p className="widget-detail">{detail}</p>
    </section>
  );
}
