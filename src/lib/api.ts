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
}

export interface User {
  id: string;
  email: string;
  name: string;
  role: 'student' | 'staff' | 'admin';
  suspended?: boolean;
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
