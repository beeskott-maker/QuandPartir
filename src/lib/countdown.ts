import type { Passage } from './types';

/** Prochain passage encore à venir (les passages sont triés par heure). */
export function nextPassage(passages: Passage[], now: Date): Passage | null {
  return passages.find((p) => p.departure.getTime() > now.getTime()) ?? null;
}

/** Temps restant en « m:ss », par exemple « 3:10 ». */
export function formatCountdown(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

export function formatTime(date: Date): string {
  return date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}
