import type { Passage } from './types';

/**
 * Prochain passage qu'on peut encore attraper en partant maintenant, compte tenu
 * du temps de trajet jusqu'à l'arrêt (les passages sont triés par heure).
 */
export function nextPassage(passages: Passage[], now: Date, walkMs = 0): Passage | null {
  return passages.find((p) => p.departure.getTime() - walkMs > now.getTime()) ?? null;
}

/** Temps restant en « m:ss », par exemple « 3:10 ». */
export function formatCountdown(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

/** Heure de passage à la seconde, comme le compte à rebours : « 13:03:10 ». */
export function formatTime(date: Date): string {
  return date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}
