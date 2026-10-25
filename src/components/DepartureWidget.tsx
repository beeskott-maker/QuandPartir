import { useEffect, useState } from 'react';
import { formatCountdown, formatTime, nextPassage } from '../lib/countdown';
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
  line: string;
  /** Aucun arrêt choisi : le widget invite à en choisir un. */
  hasStop: boolean;
  passages: Passage[];
}

/** Compte à rebours avant le prochain passage de la ligne à l'arrêt choisi. */
export function DepartureWidget({ line, hasStop, passages }: Props) {
  const now = useNow();
  const next = nextPassage(passages, now);

  return (
    <section className="widget" aria-live="polite" aria-label="Prochain départ">
      <p className="widget-label">Partir dans</p>
      <p className="widget-countdown">
        {next ? `${formatCountdown(next.departure.getTime() - now.getTime())} minutes` : '–'}
      </p>
      <p className="widget-detail">
        {next
          ? `Prochain ${next.line} direction ${next.direction} à ${formatTime(next.departure)}`
          : hasStop
            ? `Aucun ${line} annoncé à cet arrêt.`
            : `Choisis un arrêt du ${line} ci-dessous.`}
      </p>
    </section>
  );
}
