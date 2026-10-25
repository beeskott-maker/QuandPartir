import { createDemoApi } from './demoApi';

it('renvoie des passages à venir de la ligne demandée, triés', async () => {
  const now = new Date('2026-10-25T14:00:00');
  const passages = await createDemoApi(() => now).getPassages(['42'], 'T1');
  expect(passages.length).toBeGreaterThan(0);
  expect(passages.every((p) => p.stopId === '42' && p.line === 'T1' && p.departure > now)).toBe(true);
  const times = passages.map((p) => p.departure.getTime());
  expect(times).toEqual([...times].sort((a, b) => a - b));
});
