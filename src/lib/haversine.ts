/**
 * Haversine Distance Calculation & GPS Location Evaluation
 */

import { LocationStatus } from '../types';

/**
 * Calculates the great-circle distance between two points on the Earth's surface
 * using the Haversine formula.
 * @returns Distance in meters
 */
export function calculateHaversineDistanceMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const EARTH_RADIUS_METERS = 6371000; // Earth's mean radius in meters

  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);

  const radLat1 = toRadians(lat1);
  const radLat2 = toRadians(lat2);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.sin(dLon / 2) * Math.sin(dLon / 2) * Math.cos(radLat1) * Math.cos(radLat2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  const distance = EARTH_RADIUS_METERS * c;
  return Math.round(distance * 10) / 10; // Round to 1 decimal place
}

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

/**
 * Evaluates the visit location status based on distance, allowed radius, and GPS accuracy threshold
 */
export function evaluateLocationStatus(
  distanceMeters: number | null | undefined,
  allowedRadiusMeters: number,
  accuracyMeters: number | null | undefined,
  accuracyThresholdMeters: number = 30
): LocationStatus {
  if (distanceMeters === null || distanceMeters === undefined || isNaN(distanceMeters)) {
    return 'GPS_UNAVAILABLE';
  }

  if (accuracyMeters !== null && accuracyMeters !== undefined && accuracyMeters > accuracyThresholdMeters) {
    return 'LOW_ACCURACY';
  }

  if (distanceMeters <= allowedRadiusMeters) {
    return 'WITHIN_RADIUS';
  }

  return 'OUTSIDE_RADIUS';
}
