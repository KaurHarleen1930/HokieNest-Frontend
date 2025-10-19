import { supabase } from "./supabase";

const API_BASE_URL =
  `${import.meta.env.VITE_API_URL ?? 'http://localhost:4000'}/api/v1`;

interface ListingFilters {
  minPrice?: number;
  maxPrice?: number;
  beds?: number;
  baths?: number;
  intlFriendly?: boolean;
}

export interface Listing {
  id: string;
  title: string;
  price: number;
  address: string;
  beds: number;
  baths: number;
  intlFriendly: boolean;
  imageUrl: string;
  description?: string;
  amenities?: string[];
  contactEmail?: string;
  contactPhone?: string;
  latitude?: number;
  longitude?: number;
  //map features
  name?: string;              // Alternative to title
  rent_min?: number;          // Alternative to price
  min_rent?: number;          // Another alternative
  unit_beds?: number;         // Alternative to beds
  unit_baths?: number;        // Alternative to baths
  thumbnail_url?: string;     // Alternative to imageUrl
  // Distance information
  distanceFromCampus?: number;
  nearestCampus?: {
    name: string;
    lat: number;
    lng: number;
    id: string;
  };
  allCampusDistances?: Array<{
    campus: {
      name: string;
      lat: number;
      lng: number;
      id: string;
    };
    distance: number;
    distanceText: string;
  }>;
}

export interface User {
  id: string;
  email: string;
  name: string;
  role: 'student' | 'staff' | 'admin';
  suspended?: boolean;
}

export interface PropertyMarker {
  id: string;
  name: string;
  address: string;
  city: string;
  state: string;
  latitude: number;
  longitude: number;
  thumbnail_url?: string;
  property_type: string;
  rent_min: number;
  beds_available: number[];
  total_units: number;
  baths: number;
}

export interface ReferenceLocation {
  id: string;
  name: string;
  type: 'university' | 'transit' | 'employer';
  latitude: number;
  longitude: number;
  address?: string;
}

export interface NearbyLocation {
  name: string;
  type: string;
  address?: string;
  latitude: number;
  longitude: number;
  distance_miles: number;
  walking_time_minutes: number;
  driving_time_minutes: number;
}

export const rentCastAPI = {
  /**
   * Get rental estimate for an address
   * API key is protected on backend - never exposed to frontend
   */
  async getRentalEstimate(address: string): Promise<any> {
    return apiRequest(`/rentcast/rental-estimate?address=${encodeURIComponent(address)}`, {
      method: 'GET',
    });
  },

  /**
   * Get market data for a zip code
   */
  async getMarketData(zipCode: string): Promise<any> {
    return apiRequest(`/rentcast/market-data?zipCode=${zipCode}`, {
      method: 'GET',
    });
  },

  /**
   * Get rental estimates for multiple addresses (batch)
   */
  async getBatchRentalEstimates(addresses: string[]): Promise<any> {
    return apiRequest('/rentcast/batch-rental-estimates', {
      method: 'POST',
      body: JSON.stringify({ addresses }),
    });
  },
};

export const mapAPI = {
  /**
   * Get all properties as map markers
   */
  async getMapMarkers(filters?: {
    city?: string;
    min_rent?: number;
    max_rent?: number;
    beds?: number;
    property_type?: string;
  }): Promise<PropertyMarker[]> {
    const params = new URLSearchParams();
    if (filters?.city) params.append('city', filters.city);
    if (filters?.min_rent) params.append('min_rent', filters.min_rent.toString());
    if (filters?.max_rent) params.append('max_rent', filters.max_rent.toString());
    if (filters?.beds) params.append('beds', filters.beds.toString());
    if (filters?.property_type) params.append('property_type', filters.property_type);

    const url = `${API_BASE_URL}/map/markers?${params}`;
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch map markers: ${response.statusText}`);
    }
    return response.json();
  },

  /**
   * Get reference locations (universities, metro, employers)
   */
  async getReferenceLocations(type?: string): Promise<ReferenceLocation[]> {
    const params = type ? `?location_type=${type}` : '';
    const url = `${API_BASE_URL}/map/reference-locations${params}`;
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error('Failed to fetch reference locations');
    }
    return response.json();
  },

  /**
   * Get property with distances to nearby locations
   */
  async getPropertyWithDistances(propertyId: string): Promise<any> {
    const response = await fetch(`${API_BASE_URL}/map/properties/${propertyId}`);
    if (!response.ok) throw new Error('Failed to fetch property details');
    return response.json();
  },

  /**
   * Get properties within map bounds
   */
  async getPropertiesInBounds(bounds: {
    southwest_lat: number;
    southwest_lng: number;
    northeast_lat: number;
    northeast_lng: number;
  }): Promise<PropertyMarker[]> {
    const response = await fetch(`${API_BASE_URL}/map/properties-in-bounds`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(bounds),
    });
    if (!response.ok) throw new Error('Failed to fetch properties in bounds');
    return response.json();
  },

  /**
   * Get properties near a point
   */
  async getNearbyProperties(
    latitude: number,
    longitude: number,
    radiusMiles: number = 5.0,
    limit: number = 20
  ): Promise<PropertyMarker[]> {
    const params = new URLSearchParams({
      latitude: latitude.toString(),
      longitude: longitude.toString(),
      radius_miles: radiusMiles.toString(),
      limit: limit.toString(),
    });

    const response = await fetch(`${API_BASE_URL}/map/nearby-properties?${params}`);
    if (!response.ok) throw new Error('Failed to fetch nearby properties');
    return response.json();
  },
};

class APIError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = 'APIError';
  }
}

async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const token = localStorage.getItem('auth_token');

  const url = `${API_BASE_URL}${endpoint}`;
  console.log('🔍 API Request:', url);

  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(token && { Authorization: `Bearer ${token}` }),
        ...options.headers,
      },
    });

    console.log('📡 API Response:', response.status, response.statusText);

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      console.error('❌ API Error:', response.status, error);
      throw new APIError(response.status, error.message || 'Request failed');
    }

    const data = await response.json();
    console.log('✅ API Success:', data);
    return data;
  } catch (error) {
    console.error('🚨 Network Error:', error);
    throw error;
  }
}

// Listings API
export const listingsAPI = {
  getAll: async (filters?: ListingFilters): Promise<Listing[]> => {
    // Build query parameters for backend API
    const params = new URLSearchParams();
    if (filters?.minPrice !== undefined) params.append('minPrice', filters.minPrice.toString());
    if (filters?.maxPrice !== undefined) params.append('maxPrice', filters.maxPrice.toString());
    if (filters?.beds !== undefined) params.append('beds', filters.beds.toString());
    if (filters?.baths !== undefined) params.append('baths', filters.baths.toString());
    if (filters?.intlFriendly !== undefined) params.append('intlFriendly', filters.intlFriendly.toString());

    const queryString = params.toString();
    const endpoint = `/listings${queryString ? `?${queryString}` : ''}`;

    return apiRequest<Listing[]>(endpoint);
  },

  getById: async (id: string): Promise<Listing> => {
    return apiRequest<Listing>(`/listings/${id}`);
  },
};


// Users API (Admin)
export const usersAPI = {
  getAll: (): Promise<User[]> => {
    return apiRequest<User[]>('/admin/users');
  },

  suspend: (userId: string): Promise<{ success: boolean }> => {
    return apiRequest<{ success: boolean }>(`/admin/users/${userId}/suspend`, {
      method: 'POST',
    });
  },
};




// Roommate Matching API
export const roommatesAPI = {
  // Find roommate matches for current user
  findMatches: async (limit: number = 20): Promise<{
    matches: any[];
    total: number;
    weights: any;
  }> => {
    const params = new URLSearchParams();
    if (limit !== 20) params.append('limit', limit.toString());
    
    const queryString = params.toString();
    const endpoint = `/roommates/matches${queryString ? `?${queryString}` : ''}`;
    
    return apiRequest(endpoint);
  },

  // Get matching weights
  getWeights: async (): Promise<{
    weights: any;
    total: number;
  }> => {
    return apiRequest('/roommates/weights');
  },

  // Update matching weights (admin only)
  updateWeights: async (weights: Partial<{
    budget: number;
    sleepSchedule: number;
    cleanliness: number;
    socialVibe: number;
    moveInDate: number;
    leaseLength: number;
    distance: number;
    quietHours: number;
    chores: number;
    guests: number;
    workFromHome: number;
    pets: number;
    smoking: number;
  }>): Promise<{
    message: string;
    weights: any;
    total: number;
  }> => {
    return apiRequest('/roommates/weights', {
      method: 'PUT',
      body: JSON.stringify(weights),
    });
  },

  // Reset weights to default (admin only)
  resetWeights: async (): Promise<{
    message: string;
    weights: any;
  }> => {
    return apiRequest('/roommates/weights/reset', {
      method: 'POST',
    });
  },

  // Get specific roommate profile
  getProfile: async (userId: string): Promise<{
    profile: any;
  }> => {
    return apiRequest(`/roommates/profile/${userId}`);
  },

  // Get matching statistics (admin only)
  getStats: async (): Promise<{
    totalUsers: number;
    usersWithHousing: number;
    usersWithLifestyle: number;
    completeProfiles: number;
    weights: any;
  }> => {
    return apiRequest('/roommates/stats');
  },
};

// Roommate Preferences API
export const preferencesAPI = {
  // Get user preferences (housing + lifestyle)
  getPreferences: async (): Promise<{
    profile: any;
    housing: any;
    lifestyle: any;
  }> => {
    return apiRequest<{
      profile: any;
      housing: any;
      lifestyle: any;
    }>('/preferences/profile');
  },

  // Save housing preferences
  saveHousing: async (preferences: {
    budgetRange: [number, number];
    moveInDate: string;
    leaseLength: string[];
    maxDistance: string;
    quietHoursStart: string;
    quietHoursEnd: string;
  }): Promise<{ success: boolean }> => {
    // Convert month format (YYYY-MM) to full date (YYYY-MM-DD)
    const moveInDate = preferences.moveInDate
      ? `${preferences.moveInDate}-01`
      : '';

    return apiRequest<{ success: boolean }>('/preferences/housing', {
      method: 'POST',
      body: JSON.stringify({
        budget_min: preferences.budgetRange[0],
        budget_max: preferences.budgetRange[1],
        move_in_date: moveInDate,
        lease_length: preferences.leaseLength,
        max_distance: preferences.maxDistance,
        quiet_hours_start: preferences.quietHoursStart,
        quiet_hours_end: preferences.quietHoursEnd,
      }),
    });
  },

  // Save lifestyle preferences
  saveLifestyle: async (preferences: {
    cleanlinessLevel: number;
    socialVibe: string;
    sleepSchedule: string;
    hasPets: string[];
    choresPreference: string;
    guestsFrequency: string;
    workFromHomeDays: number;
    comfortableWithPets: boolean;
    petAllergies: string[];
    smokingPolicy: string[];
  }): Promise<{ success: boolean }> => {
    // Simple mappings
    const noise_tolerance =
      preferences.socialVibe.includes('Quiet') ? 'quiet' :
        preferences.socialVibe.includes('Balanced') ? 'moderate' : 'loud';

    const sleep_schedule =
      preferences.sleepSchedule === 'Early bird' ? 'early' :
        preferences.sleepSchedule === 'Night owl' ? 'late' : 'flexible';

    return apiRequest<{ success: boolean }>('/preferences/lifestyle', {
      method: 'POST',
      body: JSON.stringify({
        cleanliness_level: preferences.cleanlinessLevel,
        noise_tolerance,
        sleep_schedule,
        cooking_habits: 'sometimes',
        diet: 'none',
        pets: preferences.hasPets.length ? 'has_pets' : 'no_pets',
        sharing_items: 'sometimes',
        chores_preference: preferences.choresPreference,
        guests_frequency: preferences.guestsFrequency,
        work_from_home_days: preferences.workFromHomeDays,
        comfortable_with_pets: preferences.comfortableWithPets,
        pet_allergies: preferences.petAllergies,
        smoking_policy: preferences.smokingPolicy,
      }),
    });
  },

  // Delete all preferences
  deletePreferences: async (): Promise<{ success: boolean }> => {
    return apiRequest<{ success: boolean }>('/preferences/delete', {
      method: 'DELETE',
    });
  },

  // Save housing priorities
  saveHousingPriorities: async (priorities: {
    budget: number;
    commute: number;
    safety: number;
    roommates: number;
  }): Promise<{ success: boolean }> => {
    return apiRequest<{ success: boolean }>('/preferences/housing-priorities', {
      method: 'POST',
      body: JSON.stringify(priorities),
    });
  },
};

// Priority Weights API
export const priorityWeightsAPI = {
  // Save user priority weights
  saveWeights: async (weights: {
    budget: number;
    location: number;
    lifestyle: number;
    pets: number;
    timing: number;
    work: number;
  }): Promise<{ message: string; weights: any }> => {
    return apiRequest<{ message: string; weights: any }>('/priority-weights/save', {
      method: 'POST',
      body: JSON.stringify(weights),
    });
  },

  // Get user priority weights
  getWeights: async (): Promise<{ weights: any; isDefault: boolean; lastUpdated?: string }> => {
    return apiRequest<{ weights: any; isDefault: boolean; lastUpdated?: string }>('/priority-weights/get', {
      method: 'GET',
    });
  },

  // Get priority-based matches
  getMatches: async (limit: number = 20): Promise<{ matches: any[]; total: number; message: string }> => {
    return apiRequest<{ matches: any[]; total: number; message: string }>(`/priority-weights/matches?limit=${limit}`, {
      method: 'GET',
    });
  },
};
