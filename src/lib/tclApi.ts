import type { Passage, PassagesApi } from './types';

const PASSAGES_DATASET = 'tcl_sytral.tclpassagearret';

/** Ligne brute renvoyée par le service rdata de data.grandlyon.com. */
interface RawPassage {
  id?: string | number;
  ligne?: string;
  direction?: string;
  delaipassage?: string;
  type?: string;
  heurepassage?: string;
}

export class TclApiError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = 'TclApiError';
  }
}

/** « 2026-10-25 14:03:00 » (heure de Lyon) -> Date. */
function parseDeparture(value: string): Date | null {
  const date = new Date(value.trim().replace(' ', 'T'));
  return Number.isNaN(date.getTime()) ? null : date;
}

/** Convertit la réponse JSON du service en passages, en ignorant les lignes incomplètes. */
export function parsePassages(body: unknown): Passage[] {
  const values = (body as { values?: unknown })?.values;
  if (!Array.isArray(values)) {
    throw new TclApiError('Réponse inattendue du service data.grandlyon.com');
  }
  const passages: Passage[] = [];
  for (const raw of values as RawPassage[]) {
    const departure = raw.heurepassage ? parseDeparture(raw.heurepassage) : null;
    if (raw.id == null || !raw.ligne || !departure) continue;
    passages.push({
      stopId: String(raw.id),
      line: raw.ligne,
      direction: raw.direction ?? '',
      departure,
      delayLabel: raw.delaipassage ?? '',
      realtime: raw.type === 'E',
    });
  }
  return passages.sort((a, b) => a.departure.getTime() - b.departure.getTime());
}

/** Accès aux prochains passages TCL via le relais qui détient les identifiants. */
export function createTclApi(baseUrl: string, fetchFn: typeof fetch = fetch): PassagesApi {
  const root = baseUrl.replace(/\/+$/, '');
  return {
    demo: false,
    async getPassages(stopId) {
      const params = new URLSearchParams({ field: 'id', value: stopId, maxfeatures: '100', start: '1' });
      const response = await fetchFn(`${root}/${PASSAGES_DATASET}/all.json?${params}`, {
        headers: { Accept: 'application/json' },
      });
      if (response.status === 401 || response.status === 403) {
        throw new TclApiError('Accès refusé par data.grandlyon.com : vérifier les identifiants et l’accès au jeu de données', response.status);
      }
      if (!response.ok) {
        throw new TclApiError(`Erreur ${response.status} du service data.grandlyon.com`, response.status);
      }
      return parsePassages(await response.json());
    },
  };
}
