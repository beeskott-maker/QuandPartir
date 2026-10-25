import { createDemoApi } from './demoApi';

it('renvoie des passages à venir de la ligne demandée, à chaque arrêt et dans les deux sens', async () => {
  const now = new Date('2026-10-25T14:00:00');
  const api = createDemoApi(() => now);
  const passages = await api.getLinePassages('T1');
  expect(passages.every((p) => p.line === 'T1' && p.departure > now)).toBe(true);
  const stopIds = (await api.getStops('T1')).flatMap((s) => s.ids);
  expect(new Set(passages.map((p) => p.stopId))).toEqual(new Set(stopIds));
  expect(new Set(passages.map((p) => p.direction))).toEqual(new Set(['Direction A', 'Direction B']));
  const times = passages.map((p) => p.departure.getTime());
  expect(times).toEqual([...times].sort((a, b) => a - b));
});
