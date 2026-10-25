/** Choix de l'utilisateur retenus dans le navigateur (ligne, arrêt, temps de trajet). */

const PREFIX = 'quandpartir.';

export function readPreference(key: string): string {
  try {
    return localStorage.getItem(PREFIX + key) ?? '';
  } catch {
    return '';
  }
}

export function savePreference(key: string, value: string): void {
  try {
    localStorage.setItem(PREFIX + key, value);
  } catch {
    // Stockage indisponible (navigation privée…) : le choix ne sera pas retenu.
  }
}
