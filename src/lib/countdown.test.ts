import { formatCountdown, nextPassage } from './countdown';
import type { Passage } from './types';

const at = (time: string): Passage => ({
  stopId: '1',
  line: 'T1',
  direction: 'Part-Dieu',
  departure: new Date(`2026-10-25T${time}`),
  delayLabel: '',
  realtime: true,
});

it('formate le temps restant en minutes et secondes', () => {
  expect(formatCountdown(190_000)).toBe('3:10');
  expect(formatCountdown(65_400)).toBe('1:05');
  expect(formatCountdown(-5_000)).toBe('0:00');
});

it('ignore les passages déjà partis', () => {
  const passages = [at('13:00:00'), at('13:03:00'), at('13:10:00')];
  expect(nextPassage(passages, new Date('2026-10-25T13:01:00'))).toBe(passages[1]);
  expect(nextPassage(passages, new Date('2026-10-25T13:20:00'))).toBeNull();
});

it('ignore les passages qu’on n’a plus le temps d’attraper', () => {
  const passages = [at('13:03:00'), at('13:10:00')];
  // À 13:00 avec 5 min de trajet, le tram de 13:03 est manqué.
  expect(nextPassage(passages, new Date('2026-10-25T13:00:00'), 5 * 60_000)).toBe(passages[1]);
});
