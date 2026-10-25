import { createDemoApi } from './demoApi';
import { createTclApi } from './tclApi';
import type { PassagesApi } from './types';

/** Relais par défaut : celui du serveur de dev (voir vite.config.ts). */
const DEFAULT_RELAY_URL = '/api/grandlyon';

/**
 * Données réelles si un relais est disponible (identifiants dans .env.local,
 * ou VITE_TCL_API_URL vers un relais déployé), sinon mode démo.
 */
export function createDefaultApi(): PassagesApi {
  const relayUrl = import.meta.env.VITE_TCL_API_URL;
  if (relayUrl) return createTclApi(relayUrl);
  if (import.meta.env.DEV && import.meta.env.VITE_TCL_RELAY_CONFIGURED) {
    return createTclApi(DEFAULT_RELAY_URL);
  }
  return createDemoApi();
}
