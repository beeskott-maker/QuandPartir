import { currentPosition, distanceMeters, estimateWalkSeconds, formatDistance, LOCATE_TIMEOUT_MS, nearestStop } from './geo';

// Bellecour et Perrache, environ 1,2 km.
const bellecour = { lat: 45.7578, lon: 4.832 };
const perrache = { lat: 45.7485, lon: 4.8255 };

it('calcule une distance à vol d’oiseau', () => {
  expect(distanceMeters(bellecour, perrache)).toBeGreaterThan(1100);
  expect(distanceMeters(bellecour, perrache)).toBeLessThan(1300);
  expect(distanceMeters(bellecour, bellecour)).toBe(0);
});

it('trouve l’arrêt le plus proche, en ignorant ceux sans coordonnées', () => {
  const stops = [
    { name: 'Sans coordonnées', ids: ['0'] },
    { name: 'Perrache', ids: ['1'], ...perrache },
    { name: 'Bellecour', ids: ['2'], ...bellecour },
  ];
  const result = nearestStop(stops, { lat: 45.757, lon: 4.8315 });
  expect(result?.stop.name).toBe('Bellecour');
  expect(result?.distance).toBeLessThan(150);
  expect(nearestStop([stops[0]], bellecour)).toBeNull();
});

it('formate une distance', () => {
  expect(formatDistance(83)).toBe('80 m');
  expect(formatDistance(1234)).toBe('1,2 km');
});

describe('currentPosition', () => {
  afterEach(() => {
    vi.useRealTimers();
    Reflect.deleteProperty(navigator, 'geolocation');
  });

  it('abandonne si le navigateur ne répond jamais', async () => {
    vi.useFakeTimers();
    Object.defineProperty(navigator, 'geolocation', { value: { getCurrentPosition: vi.fn() }, configurable: true });
    const result = currentPosition();
    vi.advanceTimersByTime(LOCATE_TIMEOUT_MS);
    await expect(result).rejects.toThrow('Position introuvable');
  });
});

it('estime la marche à 4,5 km/h avec 30 % de détours, plus 3 min de marge', () => {
  expect(estimateWalkSeconds(1000)).toBeCloseTo(1040 + 180);
});
