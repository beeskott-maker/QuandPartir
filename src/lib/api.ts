import { createDemoApi } from './demoApi';
import { createTclApi } from './tclApi';
import type { PassagesApi } from './types';

/** Relais Cloudflare Worker (dossier worker/), seul à détenir les identifiants. */
const DEFAULT_RELAY_URL = 'https://api.quandpartir.workers.dev';

/** VITE_TCL_API_URL=demo lance l'appli sur des passages fictifs. */
export function createDefaultApi(): PassagesApi {
  const relayUrl = import.meta.env.VITE_TCL_API_URL || DEFAULT_RELAY_URL;
  return relayUrl === 'demo' ? createDemoApi() : createTclApi(relayUrl);
}
