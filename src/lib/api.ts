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

  //map features

  name?: string;              // Alternative to title
  latitude?: number;          // For map positioning
  longitude?: number;         // For map positioning
  rent_min?: number;          // Alternative to price
  min_rent?: number;          // Another alternative
  unit_beds?: number;         // Alternative to beds
  unit_baths?: number;        // Alternative to baths
  thumbnail_url?: string;     // Alternative to imageUrl
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

    const response = await fetch(`${API_BASE_URL}/map/markers?${params}`);
    if (!response.ok) throw new Error('Failed to fetch map markers');
    return response.json();
  },

  /**
   * Get reference locations (universities, metro, employers)
   */
  async getReferenceLocations(type?: string): Promise<ReferenceLocation[]> {
    const params = type ? `?location_type=${type}` : '';
    const response = await fetch(`${API_BASE_URL}/map/reference-locations${params}`);
    if (!response.ok) throw new Error('Failed to fetch reference locations');
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

// src/lib/api.ts
export type MapMarker = {
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
};

export async function fetchMapMarkers(): Promise<MapMarker[]> {
  const res = await fetch('http://localhost:4000/api/v1/map/markers', { credentials: 'include' });
  if (!res.ok) throw new Error('Failed to fetch markers');
  return res.json();
}

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
    let q = supabase
      .from("apartment_properties_listings")
      .select("*")
      .eq("is_active", true);

    if (filters?.minPrice !== undefined) q = q.gte("price", filters.minPrice);
    if (filters?.maxPrice !== undefined) q = q.lte("price", filters.maxPrice);
    if (filters?.beds !== undefined)     q = q.eq("beds",  filters.beds);
    if (filters?.baths !== undefined)    q = q.eq("baths", filters.baths);
    if (filters?.intlFriendly === true)  q = q.eq("intl_friendly", true);

    const { data, error } = await q;
    if (error) throw error;

    return (data ?? []).map((row: any): Listing => ({
      id: row.id,
      title: row.name ?? "Property",
      price: Number(row.price ?? 0),
      address: row.address ?? "",
      beds: Number(row.beds ?? 0),
      baths: Number(row.baths ?? 0),
      intlFriendly: Boolean(row.intl_friendly ?? false),
      imageUrl:
        row.thumbnail_url ??
        (Array.isArray(row.photos) ? row.photos[0] : "") ??
        "",
      description: row.description ?? undefined,
      amenities: Array.isArray(row.amenities) ? row.amenities : undefined,
      contactEmail: row.email ?? undefined,
      contactPhone: row.phone_number ?? undefined,
    }));
  },

  getById: async (id: string): Promise<Listing> => {
    const { data, error } = await supabase
      .from("apartment_properties_listings")
      .select("*")
      .eq("id", id)
      .single();

    if (error) throw error;
    const row: any = data;

    return {
      id: row.id,
      title: row.name ?? "Property",
      price: Number(row.price ?? 0),
      address: row.address ?? "",
      beds: Number(row.beds ?? 0),
      baths: Number(row.baths ?? 0),
      intlFriendly: Boolean(row.intl_friendly ?? false),
      imageUrl:
        row.thumbnail_url ??
        (Array.isArray(row.photos) ? row.photos[0] : "") ??
        "",
      description: row.description ?? undefined,
      amenities: Array.isArray(row.amenities) ? row.amenities : undefined,
      contactEmail: row.email ?? undefined,
      contactPhone: row.phone_number ?? undefined,
    };
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
};
