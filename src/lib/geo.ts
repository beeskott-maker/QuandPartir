import type { Position, Stop } from './types';

export type { Position };

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

/** Marche à 4,5 km/h, et des rues 30 % plus longues que la ligne droite. */
const WALK_METERS_PER_SECOND = 4500 / 3600;
const DETOUR_FACTOR = 1.3;

/** Durée de marche estimée (s) d'après la distance à vol d'oiseau, faute d'itinéraire. */
export function estimateWalkSeconds(meters: number): number {
  return (meters * DETOUR_FACTOR) / WALK_METERS_PER_SECOND;
}

const NOT_FOUND = 'Position introuvable pour le moment. Vérifie que la localisation est activée, puis réessaie.';

/**
 * Position actuelle de l'appareil (demande l'autorisation au premier appel).
 * Par défaut, la précision du Wi-Fi et des antennes : elle répond vite, même en
 * intérieur, et suffit pour trouver un arrêt. `precise` demande le GPS, plus lent,
 * pour affiner le temps de marche. Certains navigateurs ne rappellent jamais
 * (autorisation laissée en suspens) : un délai garantit une réponse.
 */
export function currentPosition({ precise = false } = {}): Promise<Position> {
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
      { enableHighAccuracy: precise, timeout: 10_000, maximumAge: precise ? 0 : 60_000 },
    );
  });
}
