// server/src/services/wmataService.ts
// WMATA API Integration (Washington DC Metro) - TypeScript Version

import axios, { AxiosInstance, AxiosResponse } from 'axios';

const WMATA_API_KEY = process.env.WMATA_API_KEY;
const WMATA_BASE_URL = 'https://api.wmata.com';

// Create axios instance with default headers
const wmataClient: AxiosInstance = axios.create({
  baseURL: WMATA_BASE_URL,
  headers: {
    'api_key': WMATA_API_KEY || ''
  }
});

// Type Definitions
interface StationAddress {
  Street: string;
  City: string;
  State: string;
  Zip: string;
}

interface WMATAStation {
  Code: string;
  Name: string;
  Lat: number;
  Lon: number;
  LineCode: string;
  StationTogether1: string;
  StationTogether2: string;
  Address: StationAddress;
}

interface WMATALine {
  LineCode: string;
  DisplayName: string;
  StartStationCode: string;
  EndStationCode: string;
  InternalDestination1: string;
  InternalDestination2: string;
}

interface TrainPrediction {
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

interface StationInfo {
  Code: string;
  Name: string;
  Lat: number;
  Lon: number;
  Address: StationAddress;
}

interface ParkingInfo {
  Code: string;
  Notes: string;
  AllDayParking: {
    TotalCount: number;
    Notes: string;
  };
  ShortTermParking: {
    TotalCount: number;
    Notes: string;
  };
}

interface RailFare {
  PeakTime: number;
  OffPeakTime: number;
  SeniorDisabled: number;
}

interface StationToStationInfo {
  SourceStation: string;
  DestinationStation: string;
  CompositeMiles: number;
  RailTime: number;
  RailFare: RailFare;
}

interface BusStop {
  StopID: string;
  Name: string;
  Lon: number;
  Lat: number;
  Routes: string[];
}

interface BusPosition {
  VehicleID: string;
  Lat: number;
  Lon: number;
  DateTime: string;
  Deviation: number;
  RouteID: string;
  DirectionText: string;
  TripID: string;
}

interface ElevatorIncident {
  UnitName: string;
  UnitType: string;
  StationCode: string;
  StationName: string;
  LocationDescription: string;
  SymptomDescription: string;
  DateOutOfServ: string;
  EstimatedReturnToService: string;
}

/**
 * Fetch all metro stations
 */
export async function fetchWMATAStations(): Promise<WMATAStation[]> {
  try {
    const response: AxiosResponse<{ Stations: WMATAStation[] }> = 
      await wmataClient.get('/Rail.svc/json/jStations');
    return response.data.Stations || [];
  } catch (error) {
    console.error('Error fetching WMATA stations:', error);
    throw error;
  }
}

/**
 * Fetch all metro lines
 */
export async function fetchWMATALines(): Promise<WMATALine[]> {
  try {
    const response: AxiosResponse<{ Lines: WMATALine[] }> = 
      await wmataClient.get('/Rail.svc/json/jLines');
    return response.data.Lines || [];
  } catch (error) {
    console.error('Error fetching WMATA lines:', error);
    throw error;
  }
}

/**
 * Fetch real-time train predictions for a station
 */
export async function fetchWMATARealTime(stationCode: string): Promise<TrainPrediction[]> {
  try {
    const response: AxiosResponse<{ Trains: TrainPrediction[] }> = 
      await wmataClient.get(`/StationPrediction.svc/json/GetPrediction/${stationCode}`);
    return response.data.Trains || [];
  } catch (error) {
    console.error('Error fetching real-time data:', error);
    throw error;
  }
}

/**
 * Fetch station information by code
 */
export async function fetchStationInfo(stationCode: string): Promise<StationInfo> {
  try {
    const response: AxiosResponse<StationInfo> = 
      await wmataClient.get('/Rail.svc/json/jStationInfo', {
        params: { StationCode: stationCode }
      });
    return response.data;
  } catch (error) {
    console.error('Error fetching station info:', error);
    throw error;
  }
}

/**
 * Fetch parking information for a station
 */
export async function fetchStationParking(stationCode: string): Promise<ParkingInfo[]> {
  try {
    const response: AxiosResponse<{ StationsParking: ParkingInfo[] }> = 
      await wmataClient.get('/Rail.svc/json/jStationParking', {
        params: { StationCode: stationCode }
      });
    return response.data.StationsParking || [];
  } catch (error) {
    console.error('Error fetching parking info:', error);
    throw error;
  }
}

/**
 * Fetch path between two stations
 */
export async function fetchStationToStationPath(
  fromStationCode: string,
  toStationCode: string
): Promise<StationToStationInfo[]> {
  try {
    const response: AxiosResponse<{ StationToStationInfos: StationToStationInfo[] }> = 
      await wmataClient.get('/Rail.svc/json/jSrcStationToDstStationInfo', {
        params: {
          FromStationCode: fromStationCode,
          ToStationCode: toStationCode
        }
      });
    return response.data.StationToStationInfos || [];
  } catch (error) {
    console.error('Error fetching station path:', error);
    throw error;
  }
}

/**
 * Fetch bus routes near a location
 */
export async function fetchBusStopsNearby(
  lat: number,
  lng: number,
  radius: number = 1000
): Promise<BusStop[]> {
  try {
    const response: AxiosResponse<{ Stops: BusStop[] }> = 
      await wmataClient.get('/Bus.svc/json/jStops', {
        params: {
          Lat: lat,
          Lon: lng,
          Radius: radius
        }
      });
    return response.data.Stops || [];
  } catch (error) {
    console.error('Error fetching bus stops:', error);
    throw error;
  }
}

/**
 * Fetch bus positions on a route
 */
export async function fetchBusPositions(routeId: string): Promise<BusPosition[]> {
  try {
    const response: AxiosResponse<{ BusPositions: BusPosition[] }> = 
      await wmataClient.get('/Bus.svc/json/jBusPositions', {
        params: { RouteID: routeId }
      });
    return response.data.BusPositions || [];
  } catch (error) {
    console.error('Error fetching bus positions:', error);
    throw error;
  }
}

/**
 * Fetch elevator and escalator outages
 */
export async function fetchElevatorOutages(): Promise<ElevatorIncident[]> {
  try {
    const response: AxiosResponse<{ ElevatorIncidents: ElevatorIncident[] }> = 
      await wmataClient.get('/Incidents.svc/json/ElevatorIncidents');
    return response.data.ElevatorIncidents || [];
  } catch (error) {
    console.error('Error fetching elevator outages:', error);
    throw error;
  }
}

/**
 * Calculate travel time between two stations
 */
export async function calculateCommuteTime(
  fromStationCode: string,
  toStationCode: string
): Promise<{
  travelTime: number;
  fare: {
    peak: number;
    offPeak: number;
    senior: number;
  };
  distance: number;
}> {
  try {
    const pathInfo = await fetchStationToStationPath(fromStationCode, toStationCode);
    
    if (pathInfo.length === 0) {
      throw new Error('No path found between stations');
    }

    const route = pathInfo[0];
    return {
      travelTime: route.RailTime || 0,
      fare: {
        peak: route.RailFare?.PeakTime || 0,
        offPeak: route.RailFare?.OffPeakTime || 0,
        senior: route.RailFare?.SeniorDisabled || 0
      },
      distance: route.CompositeMiles || 0
    };
  } catch (error) {
    console.error('Error calculating commute time:', error);
    throw error;
  }
}

// Export types
export type {
  WMATAStation,
  WMATALine,
  TrainPrediction,
  StationInfo,
  ParkingInfo,
  StationToStationInfo,
  BusStop,
  BusPosition,
  ElevatorIncident,
  StationAddress,
  RailFare
};
