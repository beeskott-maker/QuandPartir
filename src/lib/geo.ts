import type { Stop } from './types';

export interface Position {
  lat: number;
  lon: number;
}

const EARTH_RADIUS_M = 6_371_000;

/** Distance à vol d'oiseau en mètres (formule de haversine). */
export function distanceMeters(a: Position, b: Position): number {
  const rad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLon = rad(b.lon - a.lon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(h));
}

/** Arrêt le plus proche d'une position, parmi ceux dont on connaît les coordonnées. */
export function nearestStop(stops: Stop[], position: Position): { stop: Stop; distance: number } | null {
  let best: { stop: Stop; distance: number } | null = null;
  for (const stop of stops) {
    if (stop.lat == null || stop.lon == null) continue;
    const distance = distanceMeters(position, { lat: stop.lat, lon: stop.lon });
    if (!best || distance < best.distance) best = { stop, distance };
  }
  return best;
}

/** « 80 m », « 1,2 km » */
export function formatDistance(meters: number): string {
  if (meters < 1000) return `${Math.round(meters / 10) * 10} m`;
  return `${(meters / 1000).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} km`;
}

/** Délai au-delà duquel on abandonne, même si le navigateur ne répond jamais. */
export const LOCATE_TIMEOUT_MS = 15_000;

const NOT_FOUND = 'Position introuvable pour le moment. Vérifie que la localisation est activée, puis réessaie.';

/**
 * Position actuelle de l'appareil (demande l'autorisation au premier appel).
 * La précision du Wi-Fi et des antennes suffit pour trouver un arrêt, et elle
 * répond plus vite que le GPS en intérieur. Certains navigateurs ne rappellent
 * jamais (autorisation laissée en suspens) : un délai garantit une réponse.
 */
export function currentPosition(): Promise<Position> {
  return new Promise((resolve, reject) => {
    if (!('geolocation' in navigator)) {
      reject(new Error('La géolocalisation n’est pas disponible sur cet appareil.'));
      return;
    }
    const watchdog = setTimeout(() => reject(new Error(NOT_FOUND)), LOCATE_TIMEOUT_MS);
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        clearTimeout(watchdog);
        resolve({ lat: coords.latitude, lon: coords.longitude });
      },
      (e) => {
        clearTimeout(watchdog);
        reject(
          new Error(
            e.code === e.PERMISSION_DENIED
              ? 'Localisation refusée : autorise-la dans le navigateur pour trouver l’arrêt le plus proche.'
              : NOT_FOUND,
          ),
        );
      },
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 60_000 },
    );
  });
}
