import type { Passage, PassagesApi, Stop } from './types';

const DEMO_DIRECTIONS = ['Direction A', 'Direction B'];
const DEMO_STOPS: Stop[] = [
  { name: 'Arrêt A', ids: ['1', '2'], lat: 45.7578, lon: 4.832 },
  { name: 'Arrêt B', ids: ['3', '4'], lat: 45.7485, lon: 4.8255 },
  { name: 'Arrêt C', ids: ['5', '6'], lat: 45.7606, lon: 4.8594 },
];

/** Passages fictifs, recalculés à chaque appel pour rester « à venir ». */
export function createDemoApi(now: () => Date = () => new Date()): PassagesApi {
  return {
    demo: true,
    async getLines() {
      return ['T1', 'C3', 'A', 'T2'];
    },
    async getLinePassages(line) {
      // Parcours fictif : Arrêt B -> Arrêt C -> Arrêt A vers « Direction A », l'inverse vers « Direction B ».
      const start = now().getTime();
      const route = [
        { direction: DEMO_DIRECTIONS[0], ids: ['3', '5', '1'] },
        { direction: DEMO_DIRECTIONS[1], ids: ['2', '6', '4'] },
      ];
      return route.flatMap(({ direction, ids }, r) =>
        ids.map((stopId, i) => ({
          stopId,
          line,
          direction,
          departure: new Date(start + (2 + r + i * 2) * 60_000),
          delayLabel: '',
          realtime: true,
          course: `demo-${r}`,
        })),
      );
    },
    async getStops() {
      return DEMO_STOPS;
    },
    async getPassages(stopIds, line) {
      const stopId = stopIds[0];
      const start = now().getTime();
      const passages: Passage[] = [];
      DEMO_DIRECTIONS.forEach((direction, dirIndex) => {
        for (let k = 0; k < 3; k++) {
          const minutes = 1 + dirIndex * 3 + k * 7;
          passages.push({
            stopId,
            line,
            direction,
            departure: new Date(start + minutes * 60_000),
            delayLabel: minutes <= 1 ? 'Proche' : `${minutes} min`,
            realtime: k === 0,
          });
        }
      });
      return passages.sort((a, b) => a.departure.getTime() - b.departure.getTime());
    },
  };
}
