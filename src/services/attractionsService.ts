// src/services/attractionsService.ts
// Frontend API service for attractions - TypeScript Version

import axios, { AxiosResponse } from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000/api/v1';

// Type Definitions
export interface Attraction {
  id: string;
  google_place_id?: string;
  name: string;
  address?: string;
  latitude: number;
  longitude: number;
  category: 'restaurant' | 'bar' | 'attraction';
  subcategory?: string;
  rating?: number;
  price_level?: number;
  phone_number?: string;
  website_url?: string;
  photo_url?: string;
  business_hours?: Record<string, any>;
  is_active: boolean;
  distance_miles?: string;
  walking_time_minutes?: number;
  driving_time_minutes?: number;
  created_at: string;
  updated_at: string;
}

export interface AttractionCategory {
  name: string;
  subcategories: Array<{
    name: string;
    count: number;
  }>;
}

export interface AttractionsResponse {
  success: boolean;
  count: number;
  data: Attraction[];
}

export interface CategoriesResponse {
  success: boolean;
  data: AttractionCategory[];
}

export interface SyncResponse {
  success: boolean;
  message: string;
  syncedCount: number;
}

export interface AttractionFilters {
  category?: 'restaurant' | 'bar' | 'attraction';
  lat?: number;
  lng?: number;
  radius?: number;
  minRating?: number;
  priceLevel?: number;
  limit?: number;
}

/**
 * Fetch attractions with filters
 */
export async function fetchAttractions(filters: AttractionFilters = {}): Promise<AttractionsResponse> {
  try {
    const response: AxiosResponse<AttractionsResponse> = await axios.get(
      `${API_BASE_URL}/attractions`,
      { params: filters }
    );
    return response.data;
  } catch (error) {
    console.error('Error fetching attractions:', error);
    throw error;
  }
}

/**
 * Fetch nearby attractions for a property
 */
export async function fetchNearbyAttractions(
  propertyId: string,
  params: { category?: string; maxDistance?: number } = {}
): Promise<AttractionsResponse & { propertyId: string }> {
  try {
    const response: AxiosResponse<AttractionsResponse & { propertyId: string }> = await axios.get(
      `${API_BASE_URL}/attractions/nearby/${propertyId}`,
      { params }
    );
    return response.data;
  } catch (error) {
    console.error('Error fetching nearby attractions:', error);
    throw error;
  }
}

/**
 * Fetch attraction categories
 */
export async function fetchAttractionCategories(): Promise<CategoriesResponse> {
  try {
    const response: AxiosResponse<CategoriesResponse> = await axios.get(
      `${API_BASE_URL}/attractions/categories`
    );
    return response.data;
  } catch (error) {
    console.error('Error fetching categories:', error);
    throw error;
  }
}

/**
 * Sync attractions from Google Places (admin only)
 */
export async function syncAttractions(
  lat: number,
  lng: number,
  radius: number = 5000,
  types: string[] = ['restaurant', 'bar', 'tourist_attraction', 'cafe', 'night_club']
): Promise<SyncResponse> {
  try {
    const response: AxiosResponse<SyncResponse> = await axios.post(
      `${API_BASE_URL}/attractions/sync`,
      { lat, lng, radius, types }
    );
    return response.data;
  } catch (error) {
    console.error('Error syncing attractions:', error);
    throw error;
  }
}
