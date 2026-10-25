import { useEffect, useState } from 'react';
import { formatCountdown, formatTime, nextPassage } from '../lib/countdown';
import { lineLabel } from '../lib/lines';
import type { Passage } from '../lib/types';

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
  let detail: string;
  if (next) detail = `Prochain ${lineLabel(next.line)} direction ${next.direction} à ${formatTime(next.departure)}`;
  else if (!line) detail = 'Choisis une ligne ci-dessous.';
  else if (!hasStop) detail = `Choisis un arrêt du ${lineLabel(line)} ci-dessous.`;
  else if (passages.length && walkMinutes) detail = `Aucun ${service} atteignable avec ${walkMinutes} min de trajet.`;
  else detail = `Aucun ${service} annoncé à cet arrêt.`;

  return (
    <section className="widget" aria-live="polite" aria-label="Prochain départ">
      <p className="widget-label">Partir dans</p>
      <p className="widget-countdown">
        {next ? `${formatCountdown(next.departure.getTime() - walkMs - now.getTime())} minutes` : '–'}
      </p>
      <p className="widget-detail">{detail}</p>
    </section>
  );
}
