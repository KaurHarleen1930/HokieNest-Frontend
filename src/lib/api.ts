import { supabase } from "./supabase";
import { fetchAttractions, Attraction, AttractionFilters, fetchNearbyAttractions } from '@/services/attractionsService';
import { fetchNearbyTransit, fetchTransitStations, StationFilters, TransitStation } from '@/services/transitService';
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

// Use with your existing apiRequest pattern
export const attractionsAPI = {
  getAll: async (filters?: AttractionFilters): Promise<Attraction[]> => {
    const response = await fetchAttractions(filters);
    return response.data;
  },
  
  getNearby: async (propertyId: string) => {
    const response = await fetchNearbyAttractions(propertyId);
    return response.data;
  }
};

export const transitAPI = {
  getStations: async (filters?: StationFilters): Promise<TransitStation[]> => {
    const response = await fetchTransitStations(filters);
    return response.data;
  },
  
  getNearby: async (propertyId: string) => {
    const response = await fetchNearbyTransit(propertyId);
    return response.data;
  }
};

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
    const sep = params ? '&' : '?';
    const url = `${API_BASE_URL}/map/reference-locations${params}${sep}ts=${Date.now()}`;
    const response = await fetch(url, { cache: 'no-store' });
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
    // CHANGE: Don't set Content-Type for FormData (browser sets it automatically with boundary)
    const isFormData = options.body instanceof FormData;

    const response = await fetch(url, {
      ...options,
      headers: {
        // Only set Content-Type for JSON requests, not FormData
        ...(!isFormData && { 'Content-Type': 'application/json' }),
        ...(token && { Authorization: `Bearer ${token}` }),
        ...options.headers,
      },
    });

    console.log('📡 API Response:', response.status, response.statusText);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('❌ API Error:', response.status, errorData);
      // CHANGE: Backend sends { error: "message" } so we need to access errorData.error
      const errorMessage = errorData.error || errorData.message || 'Request failed';
      const error = new APIError(response.status, errorMessage);
      // Attach full error data for better error handling
      (error as any).response = { status: response.status, data: errorData };
      throw error;
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

  create: async (listingData: {
    name: string;
    address: string;
    city: string;
    state: string;
    zip_code?: string;
    description?: string;
    latitude?: number;
    longitude?: number;
    website_url?: string;
    intl_friendly?: boolean;
    photos?: string[];
    amenities?: string[];
    thumbnail_url?: string;
    year_built?: number;
    total_units?: number;
    listing_type?: 'whole_apartment' | 'private_room' | 'shared_room';
    pet_friendly?: boolean;
    utilities_included?: boolean;
    lease_term_months?: number;
    move_in_date?: string;
    parking_available?: boolean;
    furnished?: boolean;
    security_deposit?: number;
    application_fee?: number;
    units: Array<{
      beds: number;
      baths: number;
      rent_min?: number;
      rent_max?: number;
      availability_status?: string;
      square_feet?: number;
      unit_number?: string;
    }>;
  }): Promise<{ message: string; listing: Listing }> => {
    return apiRequest<{ message: string; listing: Listing }>('/listings', {
      method: 'POST',
      body: JSON.stringify(listingData),
    });
  },

  uploadPhoto: async (file: File): Promise<{ url: string; success: boolean }> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = async () => {
        try {
          const base64Data = (reader.result as string).split(',')[1];
          const result = await apiRequest<{ url: string; success: boolean; message?: string }>('/listings/upload-photo', {
            method: 'POST',
            body: JSON.stringify({
              fileData: base64Data,
              fileName: file.name,
              fileType: file.type,
            }),
          });
          resolve({ url: result.url, success: result.success });
        } catch (error) {
          reject(error);
        }
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  },

  delete: async (id: string): Promise<{ message: string }> => {
    return apiRequest<{ message: string }>(`/listings/${id}`, {
      method: 'DELETE',
    });
  },

  update: async (id: string, listingData: {
    name: string;
    address: string;
    city: string;
    state: string;
    zip_code?: string;
    description?: string;
    latitude?: number;
    longitude?: number;
    website_url?: string;
    intl_friendly?: boolean;
    photos?: string[];
    amenities?: string[];
    thumbnail_url?: string;
    year_built?: number;
    total_units?: number;
    listing_type?: 'whole_apartment' | 'private_room' | 'shared_room';
    pet_friendly?: boolean;
    utilities_included?: boolean;
    lease_term_months?: number;
    move_in_date?: string;
    parking_available?: boolean;
    furnished?: boolean;
    security_deposit?: number;
    application_fee?: number;
    units: Array<{
      beds: number;
      baths: number;
      rent_min?: number;
      rent_max?: number;
      availability_status?: string;
      square_feet?: number;
      unit_number?: string;
    }>;
  }): Promise<{ message: string; listing: Listing }> => {
    return apiRequest<{ message: string; listing: Listing }>(`/listings/${id}`, {
      method: 'PUT',
      body: JSON.stringify(listingData),
    });
  },
};

// Room Listings API
export const roomListingsAPI = {
  // Get all room listings
  getAll: async (filters?: {
    listing_type?: 'private_room' | 'shared_room' | 'whole_unit';
    city?: string;
    state?: string;
    minRent?: number;
    maxRent?: number;
    beds?: number;
    pet_friendly?: boolean;
  }): Promise<any[]> => {
    const params = new URLSearchParams();
    if (filters?.listing_type) params.append('listing_type', filters.listing_type);
    if (filters?.city) params.append('city', filters.city);
    if (filters?.state) params.append('state', filters.state);
    if (filters?.minRent) params.append('minRent', filters.minRent.toString());
    if (filters?.maxRent) params.append('maxRent', filters.maxRent.toString());
    if (filters?.beds) params.append('beds', filters.beds.toString());
    if (filters?.pet_friendly) params.append('pet_friendly', 'true');

    const queryString = params.toString();
    const endpoint = `/room-listings${queryString ? `?${queryString}` : ''}`;
    return apiRequest<any[]>(endpoint);
  },

  // Get room listing by ID
  getById: async (id: string): Promise<any> => {
    return apiRequest<any>(`/room-listings/${id}`);
  },

  // Create a room listing
  create: async (listingData: {
    listing_type: 'private_room' | 'shared_room' | 'whole_unit';
    title: string;
    description?: string;
    address: string;
    city: string;
    state: string;
    zip_code?: string;
    latitude?: number;
    longitude?: number;
    property_id?: string | null;
    beds: number;
    baths: number;
    square_feet?: number;
    rent_amount: number;
    security_deposit?: number;
    application_fee?: number;
    availability_status?: string;
    move_in_date?: string;
    lease_term_months?: number;
    furnished?: boolean;
    pet_friendly?: boolean;
    utilities_included?: boolean;
    parking_available?: boolean;
    intl_friendly?: boolean;
    photos?: string[];
    amenities?: string[];
    house_rules?: string;
    preferred_gender?: 'male' | 'female' | 'any';
    preferred_age_range?: string;
    website_url?: string;
  }): Promise<{ message: string; listing: any }> => {
    return apiRequest<{ message: string; listing: any }>('/room-listings', {
      method: 'POST',
      body: JSON.stringify(listingData),
    });
  },
};

// Favorites API
export const favoritesAPI = {
  // Get current user's saved properties
  getAll: async (): Promise<{ favorites: Listing[] }> => {
    return apiRequest<{ favorites: Listing[] }>(`/favorites`, { method: 'GET' });
  },

  // Save a property
  save: async (listingId: string): Promise<{ success: boolean; message: string }> => {
    return apiRequest<{ success: boolean; message: string }>(`/favorites/${listingId}`, {
      method: 'POST',
    });
  },

  // Remove a saved property
  remove: async (listingId: string): Promise<{ success: boolean; message: string }> => {
    return apiRequest<{ success: boolean; message: string }>(`/favorites/${listingId}`, {
      method: 'DELETE',
    });
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

  // Get housing priorities
  getHousingPriorities: async (): Promise<{
    priorities: { budget: number; commute: number; safety: number; roommates: number };
    isDefault: boolean;
    lastUpdated?: string;
  }> => {
    return apiRequest('/preferences/housing-priorities');
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

// Chatbot API
export const chatbotAPI = {
  // Send message to chatbot
  sendMessage: async (message: string, sessionId?: string, currentPage?: string): Promise<{
    success: boolean;
    data: {
      response: string;
      sources?: string[];
      suggestions?: string[];
      confidence: number;
      cost: number;
      tokens: number;
    };
    timestamp: string;
  }> => {
    return apiRequest('/chatbot/chat', {
      method: 'POST',
      body: JSON.stringify({
        message,
        sessionId,
        currentPage,
      }),
    });
  },

  // Send public message (no auth required)
  sendPublicMessage: async (message: string, sessionId?: string, currentPage?: string): Promise<{
    success: boolean;
    data: {
      response: string;
      sources?: string[];
      suggestions?: string[];
      confidence: number;
      cost: number;
      tokens: number;
    };
    timestamp: string;
  }> => {
    return apiRequest('/chatbot/chat/public', {
      method: 'POST',
      body: JSON.stringify({
        message,
        sessionId,
        currentPage,
      }),
    });
  },

  // Get FAQ items
  getFAQ: async (category?: string, limit?: number): Promise<{
    success: boolean;
    data: any[];
    count: number;
  }> => {
    const params = new URLSearchParams();
    if (category) params.append('category', category);
    if (limit) params.append('limit', limit.toString());

    return apiRequest(`/chatbot/faq?${params.toString()}`);
  },

  // Health check
  getHealth: async (): Promise<{
    success: boolean;
    message: string;
    timestamp: string;
  }> => {
    return apiRequest('/chatbot/health');
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

// Connections API
export const connectionsAPI = {
  // Send connection request
  sendRequest: async (recipientId: number, message?: string): Promise<{ success: boolean; connection: any; message: string }> => {
    return apiRequest<{ success: boolean; connection: any; message: string }>('/connections/request', {
      method: 'POST',
      body: JSON.stringify({ recipient_id: recipientId, message }),
    });
  },

  // Get all connections
  getConnections: async (status?: string): Promise<{ success: boolean; connections: any[] }> => {
    const params = status ? `?status=${status}` : '';
    return apiRequest<{ success: boolean; connections: any[] }>(`/connections${params}`);
  },

  // Get pending requests
  getPendingRequests: async (): Promise<{ success: boolean; connections: any[] }> => {
    return apiRequest<{ success: boolean; connections: any[] }>('/connections/pending');
  },

  // Accept connection
  acceptConnection: async (connectionId: string): Promise<{ success: boolean; connection: any; conversation: any; message: string }> => {
    return apiRequest<{ success: boolean; connection: any; conversation: any; message: string }>(`/connections/${connectionId}/accept`, {
      method: 'PUT',
    });
  },

  // Reject connection
  rejectConnection: async (connectionId: string): Promise<{ success: boolean; connection: any; message: string }> => {
    return apiRequest<{ success: boolean; connection: any; message: string }>(`/connections/${connectionId}/reject`, {
      method: 'PUT',
    });
  },

  // Remove connection
  removeConnection: async (connectionId: string): Promise<{ success: boolean; message: string }> => {
    return apiRequest<{ success: boolean; message: string }>(`/connections/${connectionId}`, {
      method: 'DELETE',
    });
  },

  // Check if users are connected
  checkConnection: async (userId: number): Promise<{ success: boolean; areConnected: boolean }> => {
    return apiRequest<{ success: boolean; areConnected: boolean }>(`/connections/check/${userId}`);
  },

  // Get connection between users
  getConnectionBetween: async (userId: number): Promise<{ success: boolean; connection: any }> => {
    return apiRequest<{ success: boolean; connection: any }>(`/connections/between/${userId}`);
  },
};

// Chat API
export const chatAPI = {
  // Get conversations
  getConversations: async (): Promise<{ success: boolean; conversations: any[] }> => {
    return apiRequest<{ success: boolean; conversations: any[] }>('/chat/conversations');
  },

  // Get messages
  getMessages: async (conversationId: string, page: number = 1, limit: number = 20): Promise<{ success: boolean; messages: any[]; hasMore: boolean }> => {
    return apiRequest<{ success: boolean; messages: any[]; hasMore: boolean }>(`/chat/conversations/${conversationId}/messages?page=${page}&limit=${limit}`);
  },

  // Send message
  sendMessage: async (conversationId: string, messageText: string, messageType: 'text' | 'file' | 'image' | 'document' = 'text', fileUrl?: string, fileName?: string, fileSize?: number): Promise<{ success: boolean; message: any }> => {
    return apiRequest<{ success: boolean; message: any }>(`/chat/conversations/${conversationId}/messages`, {
      method: 'POST',
      body: JSON.stringify({
        message_text: messageText,
        message_type: messageType,
        file_url: fileUrl,
        file_name: fileName,
        file_size: fileSize,
      }),
    });
  },

  // Edit message
  editMessage: async (messageId: string, messageText: string): Promise<{ success: boolean; message: any }> => {
    return apiRequest<{ success: boolean; message: any }>(`/chat/messages/${messageId}`, {
      method: 'PUT',
      body: JSON.stringify({ message_text: messageText }),
    });
  },

  // Delete message
  deleteMessage: async (messageId: string): Promise<{ success: boolean; message: string }> => {
    return apiRequest<{ success: boolean; message: string }>(`/chat/messages/${messageId}`, {
      method: 'DELETE',
    });
  },

  // Mark message as read
  markMessageAsRead: async (messageId: string): Promise<{ success: boolean; message: string }> => {
    return apiRequest<{ success: boolean; message: string }>(`/chat/messages/${messageId}/read`, {
      method: 'POST',
    });
  },

  // Mark conversation as read
  markConversationAsRead: async (conversationId: string): Promise<{ success: boolean; message: string }> => {
    return apiRequest<{ success: boolean; message: string }>(`/chat/conversations/${conversationId}/read`, {
      method: 'POST',
    });
  },

  // Create conversation for property inquiry
  createPropertyInquiry: async (propertyOwnerId: string, propertyId: string, propertyName: string): Promise<{ success: boolean; conversation: any }> => {
    return apiRequest<{ success: boolean; conversation: any }>('/chat/property-inquiry', {
      method: 'POST',
      body: JSON.stringify({
        property_owner_id: propertyOwnerId,
        property_id: propertyId,
        property_name: propertyName,
      }),
    });
  },

  // Update typing indicator
  updateTyping: async (conversationId: string, isTyping: boolean): Promise<{ success: boolean; message: string }> => {
    return apiRequest<{ success: boolean; message: string }>(`/chat/conversations/${conversationId}/typing`, {
      method: 'POST',
      body: JSON.stringify({ is_typing: isTyping }),
    });
  },

  // Get typing indicators
  getTypingIndicators: async (conversationId: string): Promise<{ success: boolean; indicators: any[] }> => {
    return apiRequest<{ success: boolean; indicators: any[] }>(`/chat/conversations/${conversationId}/typing`);
  },

  // Upload file
  uploadFile: async (file: File): Promise<{ success: boolean; url: string; size: number }> => {
    // CHANGE: Convert file to base64 and send as JSON
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = async () => {
        try {
          // Extract base64 data (remove data:...;base64, prefix)
          const base64String = (reader.result as string).split(',')[1];

          const response = await apiRequest<{ success: boolean; url: string; size: number }>('/chat/upload', {
            method: 'POST',
            body: JSON.stringify({
              fileData: base64String,
              fileName: file.name,
              fileType: file.type,
              fileSize: file.size
            }),
          });

          resolve(response);
        } catch (error) {
          reject(error);
        }
      };

      reader.onerror = () => {
        reject(new Error('Failed to read file'));
      };

      reader.readAsDataURL(file);
    });
  },
};

// Notifications API
export const notificationsAPI = {
  // Get notifications
  getNotifications: async (page: number = 1, limit: number = 20, unreadOnly: boolean = false): Promise<{ success: boolean; notifications: any[]; hasMore: boolean; total: number }> => {
    const params = new URLSearchParams({
      page: page.toString(),
      limit: limit.toString(),
      ...(unreadOnly && { unread_only: 'true' }),
    });
    return apiRequest<{ success: boolean; notifications: any[]; hasMore: boolean; total: number }>(`/notifications?${params}`);
  },

  // Mark notification as read
  markAsRead: async (notificationId: string): Promise<{ success: boolean; message: string }> => {
    return apiRequest<{ success: boolean; message: string }>(`/notifications/${notificationId}/read`, {
      method: 'PUT',
    });
  },

  // Mark all as read
  markAllAsRead: async (): Promise<{ success: boolean; message: string }> => {
    return apiRequest<{ success: boolean; message: string }>(`/notifications/read-all`, {
      method: 'PUT',
    });
  },

  // Delete notification - PERMANENTLY removes from database
  // CHANGE: This sends a DELETE request to remove the notification row from the notifications table
  deleteNotification: async (notificationId: string): Promise<{ success: boolean; message: string }> => {
    return apiRequest<{ success: boolean; message: string }>(`/notifications/${notificationId}`, {
      method: 'DELETE',
    });
  },

  // Delete all notifications - PERMANENTLY removes ALL from database
  // CHANGE: This sends a DELETE request to remove ALL notification rows from the notifications table
  deleteAllNotifications: async (): Promise<{ success: boolean; message: string }> => {
    return apiRequest<{ success: boolean; message: string }>(`/notifications/clear-all`, {
      method: 'DELETE',
    });
  },

  // Get preferences
  getPreferences: async (): Promise<{ success: boolean; preferences: any }> => {
    return apiRequest<{ success: boolean; preferences: any }>(`/notifications/preferences`);
  },

  // Update preferences
  updatePreferences: async (preferences: any): Promise<{ success: boolean; preferences: any; message: string }> => {
    return apiRequest<{ success: boolean; preferences: any; message: string }>(`/notifications/preferences`, {
      method: 'PUT',
      body: JSON.stringify(preferences),
    });
  },

  // Get unread count
  getUnreadCount: async (): Promise<{ success: boolean; unreadCount: number }> => {
    return apiRequest<{ success: boolean; unreadCount: number }>(`/notifications/unread-count`);
  },

  // Send an email (generic)
  sendEmail: async (
    to: string,
    subject: string,
    body: string,
    html?: string
  ): Promise<{ success: boolean; message: string }> => {
    return apiRequest<{ success: boolean; message: string }>(`/notifications/send-email`, {
      method: 'POST',
      body: JSON.stringify({ to, subject, body, html }),
    });
  },
};

// Status API
export const statusAPI = {
  // Set online
  setOnline: async (): Promise<{ success: boolean; status: any; message: string }> => {
    return apiRequest<{ success: boolean; status: any; message: string }>('/status/online', {
      method: 'POST',
    });
  },

  // Set offline
  setOffline: async (): Promise<{ success: boolean; status: any; message: string }> => {
    return apiRequest<{ success: boolean; status: any; message: string }>('/status/offline', {
      method: 'POST',
    });
  },

  // Get user status
  getUserStatus: async (userId: number): Promise<{ success: boolean; status: any }> => {
    return apiRequest<{ success: boolean; status: any }>(`/status/${userId}`);
  },

  // Get online users
  getOnlineUsers: async (): Promise<{ success: boolean; users: any[] }> => {
    return apiRequest<{ success: boolean; users: any[] }>('/status/online');
  },

  // Get current user status
  getMyStatus: async (): Promise<{ success: boolean; status: any }> => {
    return apiRequest<{ success: boolean; status: any }>('/status/me');
  },
};
