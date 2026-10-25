import { orderStops } from './stopOrder';
import type { Passage, Stop } from './types';

// Ligne fictive : Perrache (1/2) -> Bellecour (3/4) -> Cordeliers (5/6) -> Hôtel de Ville (7/8).
const stops: Stop[] = [
  { name: 'Bellecour', ids: ['3', '4'] },
  { name: 'Cordeliers', ids: ['5', '6'] },
  { name: 'Hôtel de Ville', ids: ['7', '8'] },
  { name: 'Musée', ids: ['9'] },
  { name: 'Perrache', ids: ['1', '2'] },
];

const passage = (course: string, stopId: string, time: string, direction: string): Passage => ({
  stopId,
  line: 'T1',
  direction,
  departure: new Date(`2026-10-25T${time}`),
  delayLabel: '',
  realtime: true,
  course,
});

const north = 'Hôtel de Ville';
const south = 'Perrache';
const passages = [
  // Course qui vient de partir de Perrache : couvre tout le trajet nord.
  passage('n1', '1', '13:00:00', north),
  passage('n1', '3', '13:02:00', north),
  passage('n1', '5', '13:04:00', north),
  passage('n1', '7', '13:06:00', north),
  // Course déjà avancée : seulement les derniers arrêts.
  passage('n0', '5', '12:59:00', north),
  passage('n0', '7', '13:01:00', north),
  // Une course vers le sud, partielle.
  passage('s1', '6', '13:01:00', south),
  passage('s1', '4', '13:03:00', south),
  passage('s1', '2', '13:05:00', south),
];

const names = (list: Stop[]) => list.map((s) => s.name);

it('range les arrêts dans l’ordre du parcours vers la direction choisie', () => {
  expect(names(orderStops(stops, passages, north))).toEqual([
    'Perrache',
    'Bellecour',
    'Cordeliers',
    'Hôtel de Ville',
    'Musée',
  ]);
  // Vers le sud, Hôtel de Ville n'est plus annoncé : l'autre sens le replace en tête.
  expect(names(orderStops(stops, passages, south))).toEqual([
    'Hôtel de Ville',
    'Cordeliers',
    'Bellecour',
    'Perrache',
    'Musée',
  ]);
});

it('sans direction, suit celle qui couvre le plus d’arrêts', () => {
  expect(names(orderStops(stops, passages, ''))[0]).toBe('Perrache');
});

it('complète la séquence avec les arrêts des autres courses', () => {
  const partial = [
    passage('a', '3', '13:00:00', north),
    passage('a', '5', '13:02:00', north),
    passage('b', '5', '13:03:00', north),
    passage('b', '7', '13:05:00', north),
  ];
  expect(names(orderStops(stops, partial, north)).slice(0, 3)).toEqual(['Bellecour', 'Cordeliers', 'Hôtel de Ville']);
});

it('garde l’ordre alphabétique sans course annoncée', () => {
  expect(names(orderStops(stops, [], ''))).toEqual(names(stops));
});

it('place le terminus de départ grâce aux courses de l’autre sens', () => {
  // Vers le nord, la seule course annoncée a déjà quitté Perrache.
  const started = [
    passage('n', '3', '13:00:00', north),
    passage('n', '5', '13:02:00', north),
    passage('n', '7', '13:04:00', north),
    passage('s', '6', '13:01:00', south),
    passage('s', '4', '13:03:00', south),
    passage('s', '2', '13:05:00', south),
  ];
  expect(names(orderStops(stops, started, north))).toEqual([
    'Perrache',
    'Bellecour',
    'Cordeliers',
    'Hôtel de Ville',
    'Musée',
  ]);
});
