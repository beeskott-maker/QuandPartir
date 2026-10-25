import type { Passage, PassagesApi, Stop } from './types';

const PASSAGES_DATASET = 'tcl_sytral.tclpassagearret';
/** Trajet à pied calculé par l'IGN, via le relais. */
const ROUTE_PATH = 'itineraire';

/** Ligne brute renvoyée par le service rdata de data.grandlyon.com. */
interface RawPassage {
  id?: string | number;
  ligne?: string;
  direction?: string;
  delaipassage?: string;
  type?: string;
  heurepassage?: string;
  coursetheorique?: string;
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
      course: raw.coursetheorique,
    });
  }
  return passages.sort((a, b) => a.departure.getTime() - b.departure.getTime());
}

/**
 * Accès aux prochains passages TCL via le relais qui détient les identifiants.
 * La liste des arrêts est un fichier statique généré au déploiement (scripts/fetch-stops.mjs).
 */
export function createTclApi(baseUrl: string, stopsUrl: string, fetchFn: typeof fetch = fetch): PassagesApi {
  const root = baseUrl.replace(/\/+$/, '');
  // Fichier lu une seule fois : il contient les lignes et leurs arrêts.
  let stopsFile: Promise<Record<string, Stop[]>> | null = null;
  const loadStops = () => {
    stopsFile ??= fetchFn(stopsUrl).then(async (response) => {
      if (!response.ok) throw new TclApiError('Liste des lignes et arrêts indisponible', response.status);
      const body = (await response.json()) as { lines?: Record<string, Stop[]> };
      return body.lines ?? {};
    });
    stopsFile.catch(() => (stopsFile = null));
    return stopsFile;
  };
  // Le relais n'interroge Grand Lyon que sur la ligne demandée.
  const fetchPassages = async (line: string) => {
    const params = new URLSearchParams({ ligne: line });
    const response = await fetchFn(`${root}/${PASSAGES_DATASET}/all.json?${params}`, {
      headers: { Accept: 'application/json' },
    });
    if (response.status === 401 || response.status === 403) {
      throw new TclApiError('Accès refusé par data.grandlyon.com : vérifier les identifiants et l’accès au jeu de données', response.status);
    }
    if (!response.ok) {
      throw new TclApiError(`Erreur ${response.status} du service data.grandlyon.com`, response.status);
    }
    return parsePassages(await response.json()).filter((p) => p.line === line);
  };
  return {
    demo: false,
    async getLines() {
      return Object.keys(await loadStops()).sort((a, b) => a.localeCompare(b, 'fr', { numeric: true }));
    },
    async getStops(line) {
      return (await loadStops())[line] ?? [];
    },
    async getLinePassages(line) {
      return fetchPassages(line);
    },
    async getWalkSeconds(from, to) {
      const params = new URLSearchParams({ start: `${from.lon},${from.lat}`, end: `${to.lon},${to.lat}` });
      const response = await fetchFn(`${root}/${ROUTE_PATH}?${params}`, { headers: { Accept: 'application/json' } });
      if (!response.ok) throw new TclApiError(`Erreur ${response.status} du calcul d’itinéraire`, response.status);
      const duration = Number(((await response.json()) as { duration?: unknown }).duration);
      if (!Number.isFinite(duration)) throw new TclApiError('Réponse inattendue du calcul d’itinéraire');
      return duration;
    },
  };
}
