/**
 * Relais vers le service rdata de data.grandlyon.com : ajoute l'authentification
 * (secrets du Worker) et n'expose que les jeux de données utiles à l'appli.
 * Même chemin que l'API d'origine : /<jeu>/all.json?field=...&value=...
 */

export interface Env {
  GRANDLYON_USER: string;
  GRANDLYON_PASSWORD: string;
  /** Origines autorisées, séparées par des virgules. */
  ALLOWED_ORIGINS: string;
  /** Pour les tests : autre serveur que data.grandlyon.com. */
  GRANDLYON_BASE_URL?: string;
}

const UPSTREAM = 'https://data.grandlyon.com/fr/datapusher/ws/rdata';
const DATASETS = new Set(['tcl_sytral.tclpassagearret', 'tcl_sytral.tclarret']);
const PARAMS = ['field', 'value', 'maxfeatures', 'start'];
const MAX_FEATURES = 5000;
const CACHE_TTL_MS = 20_000;

/** Cache en mémoire, par instance du Worker (l'API Cache ne marche pas sur workers.dev). */
const cache = new Map<string, { expires: number; status: number; body: string }>();

function corsHeaders(origin: string | null, env: Env): Record<string, string> {
  const allowed = env.ALLOWED_ORIGINS.split(',').map((o) => o.trim());
  if (!origin || !allowed.includes(origin)) return {};
  return { 'Access-Control-Allow-Origin': origin, Vary: 'Origin' };
}

function json(body: string, status: number, headers: Record<string, string>): Response {
  return new Response(body, {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...headers },
  });
}

function error(message: string, status: number, headers: Record<string, string>): Response {
  return json(JSON.stringify({ error: message }), status, headers);
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
    const match = url.pathname.match(/^\/([\w.]+)\/all\.json$/);
    if (!match || !DATASETS.has(match[1])) return error('Jeu de données inconnu', 404, cors);

    const query = new URLSearchParams();
    for (const name of PARAMS) {
      const value = url.searchParams.get(name);
      if (value) query.set(name, value);
    }
    const max = Number(query.get('maxfeatures') ?? MAX_FEATURES);
    query.set('maxfeatures', String(Math.min(Number.isFinite(max) && max > 0 ? max : MAX_FEATURES, MAX_FEATURES)));
    if (!query.has('start')) query.set('start', '1');

    const upstreamUrl = `${env.GRANDLYON_BASE_URL ?? UPSTREAM}/${match[1]}/all.json?${query}`;
    const cached = cache.get(upstreamUrl);
    if (cached && cached.expires > Date.now()) return json(cached.body, cached.status, cors);

    if (!env.GRANDLYON_USER || !env.GRANDLYON_PASSWORD) {
      return error('Identifiants data.grandlyon.com non configurés', 500, cors);
    }
    let upstream: Response;
    try {
      upstream = await fetch(upstreamUrl, {
        headers: {
          Accept: 'application/json',
          Authorization: `Basic ${btoa(`${env.GRANDLYON_USER}:${env.GRANDLYON_PASSWORD}`)}`,
        },
      });
    } catch {
      return error('data.grandlyon.com injoignable', 502, cors);
    }
    const body = await upstream.text();
    if (!upstream.ok) {
      // On relaie 401/403 tels quels pour que l'appli explique un accès refusé.
      const status = upstream.status === 401 || upstream.status === 403 ? upstream.status : 502;
      return error(`Erreur ${upstream.status} de data.grandlyon.com`, status, cors);
    }
    cache.set(upstreamUrl, { expires: Date.now() + CACHE_TTL_MS, status: upstream.status, body });
    return json(body, upstream.status, cors);
  },
};
