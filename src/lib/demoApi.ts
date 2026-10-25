import { distanceMeters, estimateWalkSeconds } from './geo';
import type { Passage, PassagesApi, Stop } from './types';

const DEMO_DIRECTIONS = ['Direction A', 'Direction B'];
const DEMO_STOPS: Stop[] = [
  { name: 'Arrêt A', ids: ['1', '2'], lat: 45.7578, lon: 4.832 },
  { name: 'Arrêt B', ids: ['3', '4'], lat: 45.7485, lon: 4.8255 },
  { name: 'Arrêt C', ids: ['5', '6'], lat: 45.7606, lon: 4.8594 },
];
// Parcours fictif : Arrêt B -> Arrêt C -> Arrêt A vers « Direction A », l'inverse vers « Direction B ».
const DEMO_ROUTES = [
  { direction: DEMO_DIRECTIONS[0], ids: ['3', '5', '1'] },
  { direction: DEMO_DIRECTIONS[1], ids: ['2', '6', '4'] },
];

/** Passages fictifs, recalculés à chaque appel pour rester « à venir ». */
export function createDemoApi(now: () => Date = () => new Date()): PassagesApi {
  return {
    demo: true,
    async getLines() {
      return ['T1', 'C3', 'A', 'T2'];
    },
    async getLinePassages(line) {
      const start = now().getTime();
      const passages: Passage[] = [];
      DEMO_ROUTES.forEach(({ direction, ids }, r) => {
        // Trois courses par sens, toutes les 7 minutes ; 2 minutes entre deux arrêts.
        for (let k = 0; k < 3; k++) {
          ids.forEach((stopId, i) => {
            const minutes = 1 + r * 3 + k * 7 + i * 2;
            passages.push({
              stopId,
              line,
              direction,
              departure: new Date(start + minutes * 60_000),
              delayLabel: minutes <= 1 ? 'Proche' : `${minutes} min`,
              realtime: k === 0,
              course: `demo-${r}-${k}`,
            });
          });
        }
      });
      return passages.sort((a, b) => a.departure.getTime() - b.departure.getTime());
    },
    async getStops() {
      return DEMO_STOPS;
    },
    async getWalkSeconds(from, to) {
      return estimateWalkSeconds(distanceMeters(from, to));
    },
  };
}
