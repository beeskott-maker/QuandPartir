import type { Passage, PassagesApi } from './types';

const DEMO_DIRECTIONS = ['Direction A', 'Direction B'];

/** Passages fictifs, recalculés à chaque appel pour rester « à venir ». */
export function createDemoApi(now: () => Date = () => new Date()): PassagesApi {
  return {
    demo: true,
    async getPassages(stopId, line) {
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
