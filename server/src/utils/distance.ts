// Distance calculation utilities

// VT Campus locations (DC area)
export const VT_CAMPUSES = [
  { 
    name: 'VT Innovation Campus (Alexandria)', 
    lat: 38.8051, 
    lng: -77.0470,
    id: 'innovation'
  },
  { 
    name: 'VT Arlington Research Center', 
    lat: 38.8816, 
    lng: -77.1025,
    id: 'arlington'
  },
  { 
    name: 'VT Falls Church Campus', 
    lat: 38.8842, 
    lng: -77.1714,
    id: 'falls_church'
  }
];

/**
 * Calculate distance between two points using Haversine formula
 * @param lat1 Latitude of first point
 * @param lng1 Longitude of first point
 * @param lat2 Latitude of second point
 * @param lng2 Longitude of second point
 * @returns Distance in miles
 */
export function calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 3959; // Earth's radius in miles
  const dLat = toRadians(lat2 - lat1);
  const dLng = toRadians(lng2 - lng1);
  
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;
  
  return Math.round(distance * 10) / 10; // Round to 1 decimal place
}

/**
 * Convert degrees to radians
 */
function toRadians(degrees: number): number {
  return degrees * (Math.PI / 180);
}

/**
 * Calculate distance from a property to the nearest VT campus
 * @param propertyLat Property latitude
 * @param propertyLng Property longitude
 * @returns Object with nearest campus info and distance
 */
export function calculateNearestCampus(propertyLat: number, propertyLng: number) {
  let nearestCampus = VT_CAMPUSES[0];
  let minDistance = calculateDistance(propertyLat, propertyLng, nearestCampus.lat, nearestCampus.lng);

  for (const campus of VT_CAMPUSES) {
    const distance = calculateDistance(propertyLat, propertyLng, campus.lat, campus.lng);
    if (distance < minDistance) {
      minDistance = distance;
      nearestCampus = campus;
    }
  }

  return {
    campus: nearestCampus,
    distance: minDistance,
    distanceText: `${minDistance} miles`
  };
}

/**
 * Calculate distances to all VT campuses
 * @param propertyLat Property latitude
 * @param propertyLng Property longitude
 * @returns Array of campus distances
 */
export function calculateAllCampusDistances(propertyLat: number, propertyLng: number) {
  return VT_CAMPUSES.map(campus => ({
    campus,
    distance: calculateDistance(propertyLat, propertyLng, campus.lat, campus.lng),
    distanceText: `${calculateDistance(propertyLat, propertyLng, campus.lat, campus.lng)} miles`
  })).sort((a, b) => a.distance - b.distance);
}

/**
 * Estimate driving time based on distance
 * @param distance Distance in miles
 * @returns Estimated driving time in minutes
 */
export function estimateDrivingTime(distance: number): number {
  // Assume average speed of 25 mph in urban areas
  const averageSpeed = 25;
  return Math.round((distance / averageSpeed) * 60);
}

/**
 * Estimate walking time based on distance
 * @param distance Distance in miles
 * @returns Estimated walking time in minutes
 */
export function estimateWalkingTime(distance: number): number {
  // Assume average walking speed of 3 mph
  const walkingSpeed = 3;
  return Math.round((distance / walkingSpeed) * 60);
}
