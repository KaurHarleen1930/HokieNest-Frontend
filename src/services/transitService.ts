// src/services/transitService.ts
// Frontend API service for transit - TypeScript Version

import axios, { AxiosResponse } from 'axios';

const API_BASE_URL = (import.meta.env.VITE_API_URL || 'http://localhost:4000') + '/api/v1';;

// Type Definitions
export interface TransitStation {
  id: string;
  wmata_station_code?: string;
  name: string;
  address?: string;
  latitude: number;
  longitude: number;
  station_type: 'metro' | 'bus_stop';
  lines?: string[];
  entrance_locations?: Record<string, any>;
  has_parking: boolean;
  has_bike_rack: boolean;
  is_accessible: boolean;
  is_active: boolean;
  distance_miles?: string;
  walking_time_minutes?: number;
  driving_time_minutes?: number;
  created_at: string;
  updated_at: string;
}

export interface MetroLine {
  id: string;
  wmata_route_id: string;
  route_name: string;
  route_type: 'metro_line' | 'bus_route';
  line_color: string;
  route_path?: Record<string, any>;
  is_active: boolean;
  created_at: string;
}

export interface TrainPrediction {
  Car: string;
  Destination: string;
  DestinationCode: string;
  DestinationName: string;
  Group: string;
  Line: string;
  LocationCode: string;
  LocationName: string;
  Min: string;
}

export interface CommuteInfo {
  originStation: {
    name: string;
    code?: string;
    walkingDistance: string;
    walkingTime: number;
  };
  destinationStation: {
    name: string;
    code?: string;
    walkingDistance: string;
    walkingTime: number;
  };
  transitTime: number;
  totalCommuteTime: number;
}

export interface StationsResponse {
  success: boolean;
  count: number;
  data: TransitStation[];
}

export interface NearbyTransitResponse {
  success: boolean;
  propertyId: string;
  count: number;
  data: TransitStation[];
}

export interface LinesResponse {
  success: boolean;
  count: number;
  data: MetroLine[];
}

export interface RealTimeResponse {
  success: boolean;
  stationCode: string;
  data: TrainPrediction[];
}

export interface CommuteResponse {
  success: boolean;
  data: CommuteInfo;
}

export interface SyncResponse {
  success: boolean;
  message: string;
  syncedCount: number;
}

export interface StationFilters {
  type?: 'metro' | 'bus_stop';
  lat?: number;
  lng?: number;
  radius?: number;
  lines?: string;
}

export interface AllStationsResponse {
  success: boolean;
  count: number;
  data: TransitStation[];
}

// Add this new type for the /commute response
export interface CommuteRouteResponse {
  success: boolean;
  data: {
    fromStation: {
      wmata_station_code: string;
      station_name: string;
      station_lat: number;
      station_lng: number;
    };
    toStation: {
      wmata_station_code: string;
      station_name: string;
      station_lat: number;
      station_lng: number;
    };
    commute: {
      travelTime: number;
      fare: {
        peak: number;
        offPeak: number;
        senior: number;
      };
      distance: number;
    };
  };
}

/**
 * Fetch all transit stations
 */
export async function fetchTransitStations(filters: StationFilters = {}): Promise<StationsResponse> {
  try {
    const response: AxiosResponse<StationsResponse> = await axios.get(
      `${API_BASE_URL}/transit/stations`,
      { params: filters }
    );
    return response.data;
  } catch (error) {
    console.error('Error fetching transit stations:', error);
    throw error;
  }
}

/**
 * Fetch nearby transit for a property
 */
export async function fetchNearbyTransit(
  propertyId: string,
  params: { maxDistance?: number; type?: 'metro' | 'bus_stop' } = {}
): Promise<NearbyTransitResponse> {
  try {
    const response: AxiosResponse<NearbyTransitResponse> = await axios.get(
      `${API_BASE_URL}/transit/nearby/${propertyId}`,
      { params }
    );
    return response.data;
  } catch (error) {
    console.error('Error fetching nearby transit:', error);
    throw error;
  }
}

/**
 * Fetch metro lines
 */
export async function fetchMetroLines(): Promise<LinesResponse> {
  try {
    const response: AxiosResponse<LinesResponse> = await axios.get(
      `${API_BASE_URL}/transit/lines`
    );
    return response.data;
  } catch (error) {
    console.error('Error fetching metro lines:', error);
    throw error;
  }
}

/**
 * Fetch real-time train predictions
 */
export async function fetchRealTimePredictions(stationCode: string): Promise<RealTimeResponse> {
  try {
    const response: AxiosResponse<RealTimeResponse> = await axios.get(
      `${API_BASE_URL}/transit/realtime/${stationCode}`
    );
    return response.data;
  } catch (error) {
    console.error('Error fetching real-time data:', error);
    throw error;
  }
}
/**
 * ========================================================
 * NEW FUNCTION: Fetch ALL transit stations
 * ========================================================
 */
export async function fetchAllTransitStations(): Promise<AllStationsResponse> {
  try {
    const response: AxiosResponse<AllStationsResponse> = await axios.get(
      `${API_BASE_URL}/transit/stations/all`
    );
    return response.data;
  } catch (error) {
    console.error('Error fetching all transit stations:', error);
    throw error;
  }
}

/**
 * ========================================================
 * NEW FUNCTION: Fetch commute route
 * ========================================================
 */
export async function fetchCommuteRoute(
  fromLat: number,
  fromLng: number,
  toLat: number,
  toLng: number
): Promise<CommuteRouteResponse> {
  try {
    const response: AxiosResponse<CommuteRouteResponse> = await axios.get(
      `${API_BASE_URL}/transit/commute`,
      {
        params: { fromLat, fromLng, toLat, toLng }
      }
    );
    return response.data;
  } catch (error) {
    console.error('Error calculating commute route:', error);
    throw error;
  }
}
/**
 * Calculate commute time
 */
export async function calculateCommute(
  fromLat: number,
  fromLng: number,
  toLat: number,
  toLng: number
): Promise<CommuteResponse> {
  try {
    const response: AxiosResponse<CommuteResponse> = await axios.get(
      `${API_BASE_URL}/transit/commute`,
      {
        params: { fromLat, fromLng, toLat, toLng }
      }
    );
    return response.data;
  } catch (error) {
    console.error('Error calculating commute:', error);
    throw error;
  }
}

/**
 * Sync transit data from WMATA (admin only)
 */
export async function syncTransitData(): Promise<SyncResponse> {
  try {
    const response: AxiosResponse<SyncResponse> = await axios.post(
      `${API_BASE_URL}/transit/sync`
    );
    return response.data;
  } catch (error) {
    console.error('Error syncing transit data:', error);
    throw error;
  }
}
