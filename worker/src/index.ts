/**
 * Relais vers le service rdata de data.grandlyon.com : Grand Lyon n'est jamais
 * interrogé que sur les passages d'une seule ligne (T1 par défaut), jamais sur
 * tout le réseau. L'authentification vient des secrets du Worker.
 *
 * GET /tcl_sytral.tclpassagearret/all.json?ligne=T1    -> passages de la ligne
 * GET /tcl_sytral.tclpassagearret/all.json?ligne=T1&field=id&value=<arrêt>
 *                                                      -> passages de la ligne à cet arrêt
 */

export interface Env {
  GRANDLYON_USER: string;
  GRANDLYON_PASSWORD: string;
  /** Origines autorisées, séparées par des virgules. */
  ALLOWED_ORIGINS: string;
  /** Pour les tests : autre serveur que data.grandlyon.com. */
  GRANDLYON_BASE_URL?: string;
}

export const DEFAULT_LINE = 'T1';
/** Code de ligne TCL : T1, C22, A, F1… */
const LINE_PATTERN = /^[A-Z0-9]{1,6}$/;
const UPSTREAM = 'https://data.grandlyon.com/fr/datapusher/ws/rdata';
const PASSAGES_PATH = '/tcl_sytral.tclpassagearret/all.json';
const MAX_FEATURES = 5000;
const CACHE_TTL_MS = 20_000;

interface Row {
  id?: string | number;
  ligne?: string;
  [key: string]: unknown;
}

/** Passages par ligne, en mémoire par instance (l'API Cache ne marche pas sur workers.dev). */
const cache = new Map<string, { expires: number; rows: Row[] }>();

export function clearCache(): void {
  cache.clear();
}

function corsHeaders(origin: string | null, env: Env): Record<string, string> {
  const allowed = env.ALLOWED_ORIGINS.split(',').map((o) => o.trim());
  if (!origin || !allowed.includes(origin)) return {};
  return { 'Access-Control-Allow-Origin': origin, Vary: 'Origin' };
}

function json(body: unknown, status: number, headers: Record<string, string>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...headers },
  });
}

function error(message: string, status: number, headers: Record<string, string>): Response {
  return json({ error: message }, status, headers);
}

class UpstreamError extends Error {
  constructor(readonly status: number) {
    super(`Erreur ${status} de data.grandlyon.com`);
  }
}

async function fetchLineRows(line: string, env: Env): Promise<Row[]> {
  const cached = cache.get(line);
  if (cached && cached.expires > Date.now()) return cached.rows;
  const query = new URLSearchParams({ field: 'ligne', value: line, maxfeatures: String(MAX_FEATURES), start: '1' });
  const upstream = await fetch(`${env.GRANDLYON_BASE_URL ?? UPSTREAM}${PASSAGES_PATH}?${query}`, {
    headers: {
      Accept: 'application/json',
      Authorization: `Basic ${btoa(`${env.GRANDLYON_USER}:${env.GRANDLYON_PASSWORD}`)}`,
    },
  });
  if (!upstream.ok) throw new UpstreamError(upstream.status);
  const body = (await upstream.json()) as { values?: Row[] };
  // Filtre de sécurité, au cas où le service ignorerait le filtre demandé.
  const rows = (body.values ?? []).filter((row) => row.ligne === line);
  cache.set(line, { expires: Date.now() + CACHE_TTL_MS, rows });
  return rows;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const origin = request.headers.get('Origin');
    const cors = corsHeaders(origin, env);
    // Un navigateur d'un autre site est refusé ; les appels sans Origin (curl) passent.
    if (origin && !cors['Access-Control-Allow-Origin']) return error('Origine non autorisée', 403, {});
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: { ...cors, 'Access-Control-Allow-Methods': 'GET', 'Access-Control-Max-Age': '86400' },
      });
    }
    if (request.method !== 'GET') return error('Méthode non autorisée', 405, cors);

    const url = new URL(request.url);
    if (url.pathname !== PASSAGES_PATH) return error('Jeu de données inconnu', 404, cors);
    const line = (url.searchParams.get('ligne') ?? DEFAULT_LINE).toUpperCase();
    if (!LINE_PATTERN.test(line)) return error('Ligne invalide', 400, cors);
    if (!env.GRANDLYON_USER || !env.GRANDLYON_PASSWORD) {
      return error('Identifiants data.grandlyon.com non configurés', 500, cors);
    }

    let rows: Row[];
    try {
      rows = await fetchLineRows(line, env);
    } catch (e) {
      // On relaie 401/403 tels quels pour que l'appli explique un accès refusé.
      if (e instanceof UpstreamError) {
        return error(e.message, e.status === 401 || e.status === 403 ? e.status : 502, cors);
      }
      return error('data.grandlyon.com injoignable', 502, cors);
    }

    const stop = url.searchParams.get('field') === 'id' ? url.searchParams.get('value') : null;
    const values = stop ? rows.filter((row) => String(row.id) === stop) : rows;
    return json({ ligne: line, nb_results: values.length, values }, 200, cors);
  },
};
