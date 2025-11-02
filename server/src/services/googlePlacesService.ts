// server/src/services/googlePlacesService.ts
// Updated for Google Places API (New)

import axios from 'axios';

const GOOGLE_API_KEY = process.env.GOOGLE_PLACES_API_KEY;
const PLACES_API_URL = 'https://places.googleapis.com/v1/places:searchNearby';

interface PlaceResult {
  id: string;
  displayName: {
    text: string;
    languageCode: string;
  };
  formattedAddress: string;
  location: {
    latitude: number;
    longitude: number;
  };
  rating?: number;
  userRatingCount?: number;
  priceLevel?: string;
  types: string[];
  primaryType?: string;
  websiteUri?: string;
  regularOpeningHours?: {
    openNow: boolean;
  };
}

export interface GooglePlacesFilters {
  lat: number;
  lng: number;
  radius?: number; // meters (max 50000)
  types?: string[]; // e.g., ['restaurant', 'bar', 'cafe']
  keyword?: string;
  minRating?: number;
}

export async function fetchGooglePlaces(filters: GooglePlacesFilters) {
  if (!GOOGLE_API_KEY) {
    throw new Error('Google Places API key not configured');
  }

  const {
    lat,
    lng,
    radius = 5000,
    types = ['restaurant', 'bar', 'cafe'],
    minRating = 3.5
  } = filters;

  try {
    console.log('🔍 Fetching places from Google Places API (New)...');
    console.log('Location:', { lat, lng, radius });
    console.log('Types:', types);

    const response = await axios.post(
      PLACES_API_URL,
      {
        includedTypes: types,
        maxResultCount: 20,
        locationRestriction: {
          circle: {
            center: {
              latitude: lat,
              longitude: lng
            },
            radius: radius
          }
        }
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': GOOGLE_API_KEY,
          'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.location,places.rating,places.userRatingCount,places.priceLevel,places.types,places.primaryType,places.websiteUri,places.regularOpeningHours'
        }
      }
    );

    const places = response.data.places || [];
    console.log(`✅ Found ${places.length} places from Google`);

    // Transform to our format
    const transformedPlaces = places
      .filter((place: PlaceResult) => {
        // Filter by minimum rating
        if (place.rating && place.rating >= minRating) {
          return true;
        }
        return !place.rating; // Include places without ratings
      })
      .map((place: PlaceResult) => ({
        google_place_id: place.id,
        name: place.displayName?.text || 'Unknown',
        address: place.formattedAddress || '',
        latitude: place.location.latitude.toString(),
        longitude: place.location.longitude.toString(),
        category: mapGoogleTypeToCategory(place.primaryType || place.types[0]),
        rating: place.rating || null,
        price_level: mapPriceLevel(place.priceLevel),
        website_url: place.websiteUri || null,
        is_open_now: place.regularOpeningHours?.openNow || null,
        types: place.types || [],
        is_active: true
      }));

    return transformedPlaces;
  } catch (error: any) {
    console.error('❌ Google Places API error:', error.response?.data || error.message);
    throw new Error(`Google Places API error: ${error.response?.data?.error?.message || error.message}`);
  }
}

/**
 * Map Google's primary type to our category system
 */
function mapGoogleTypeToCategory(googleType: string): string {
  const categoryMap: Record<string, string> = {
    'restaurant': 'restaurant',
    'bar': 'bar',
    'cafe': 'cafe',
    'night_club': 'nightclub',
    'bakery': 'cafe',
    'meal_takeaway': 'restaurant',
    'meal_delivery': 'restaurant',
    'food': 'restaurant',
    'coffee_shop': 'cafe'
  };

  return categoryMap[googleType.toLowerCase()] || 'restaurant';
}

/**
 * Map Google's price level to our system
 */
function mapPriceLevel(priceLevel?: string): number | null {
  if (!priceLevel) return null;
  
  const priceLevelMap: Record<string, number> = {
    'PRICE_LEVEL_FREE': 0,
    'PRICE_LEVEL_INEXPENSIVE': 1,
    'PRICE_LEVEL_MODERATE': 2,
    'PRICE_LEVEL_EXPENSIVE': 3,
    'PRICE_LEVEL_VERY_EXPENSIVE': 4
  };

  return priceLevelMap[priceLevel] || null;
}

/**
 * Get place details by ID (for additional info)
 */
export async function fetchPlaceDetails(placeId: string) {
  if (!GOOGLE_API_KEY) {
    throw new Error('Google Places API key not configured');
  }

  try {
    const response = await axios.get(
      `https://places.googleapis.com/v1/places/${placeId}`,
      {
        headers: {
          'X-Goog-Api-Key': GOOGLE_API_KEY,
          'X-Goog-FieldMask': 'id,displayName,formattedAddress,location,rating,userRatingCount,priceLevel,types,primaryType,websiteUri,regularOpeningHours,photos'
        }
      }
    );

    return response.data;
  } catch (error: any) {
    console.error('Error fetching place details:', error.response?.data || error.message);
    throw error;
  }
}