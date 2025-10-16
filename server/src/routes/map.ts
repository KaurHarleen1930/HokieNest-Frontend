// server/src/routes/map.ts
// Map API routes for Express.js backend

import { Router, Request, Response } from 'express';
import { supabase } from '../lib/supabase';
import { z } from 'zod';

const router = Router();

// ============================================================================
// VALIDATION SCHEMAS
// ============================================================================

const MapMarkersQuerySchema = z.object({
  city: z.string().optional(),
  min_rent: z.string().transform(Number).optional(),
  max_rent: z.string().transform(Number).optional(),
  beds: z.string().transform(Number).optional(),
  property_type: z.string().optional(),
});

const MapBoundsSchema = z.object({
  southwest_lat: z.number(),
  southwest_lng: z.number(),
  northeast_lat: z.number(),
  northeast_lng: z.number(),
});

const NearbyPropertiesQuerySchema = z.object({
  latitude: z.string().transform(Number),
  longitude: z.string().transform(Number),
  radius_miles: z.string().transform(Number).default('5'),
  limit: z.string().transform(Number).default('20'),
});

// ============================================================================
// INTERFACES
// ============================================================================

interface PropertyMarker {
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

interface ReferenceLocation {
  id: string;
  name: string;
  type: string;
  latitude: number;
  longitude: number;
  address?: string;
}

interface NearbyLocation {
  name: string;
  type: string;
  address?: string;
  latitude: number;
  longitude: number;
  distance_miles: number;
  walking_time_minutes: number;
  driving_time_minutes: number;
}

// ============================================================================
// ROUTES
// ============================================================================

/**
 * GET /api/v1/map/markers
 * Get all properties as map markers with filtering
 */
router.get('/markers', async (req: Request, res: Response) => {
  try {
    const filters = MapMarkersQuerySchema.parse(req.query);

    // Base query - get active properties with coordinates
    let query = supabase
      .from('apartment_properties_listings')
      .select('id, name, address, city, state, latitude, longitude, thumbnail_url, property_type, total_units')
      .eq('is_active', true)
      .not('latitude', 'is', null)
      .not('longitude', 'is', null);

    // Apply filters
    if (filters.city) {
      query = query.eq('city', filters.city);
    }
    if (filters.property_type) {
      query = query.eq('property_type', filters.property_type);
    }

    const { data: properties, error: propertiesError } = await query;

    if (propertiesError) {
      throw propertiesError;
    }

    if (!properties) {
      return res.json([]);
    }

    // Enrich properties with unit data
    const markers: PropertyMarker[] = [];

    for (const prop of properties) {
      const { data: units, error: unitsError } = await supabase
        .from('apartment_units')
        .select('beds, baths, rent_min')
        .eq('property_id', prop.id);

      if (unitsError || !units || units.length === 0) {
        continue;
      }

      // Extract unique bedroom options
      const bedsAvailable = [...new Set(units.map(u => u.beds))].sort((a, b) => a - b);

      // Find minimum rent
      const rents = units.map(u => u.rent_min).filter(r => r != null);
      const rentMin = rents.length > 0 ? Math.min(...rents) : 0;

      // Calculate average baths
      const bathsVals = units.map(u => u.baths).filter(b => b != null);
      const bathsAvg = bathsVals.length > 0 
        ? bathsVals.reduce((a, b) => a + b, 0) / bathsVals.length 
        : 1.0;

      // Apply rent filters
      if (filters.min_rent && rentMin < filters.min_rent) {
        continue;
      }
      if (filters.max_rent && rentMin > filters.max_rent) {
        continue;
      }

      // Apply bedroom filter
      if (filters.beds !== undefined && !bedsAvailable.includes(filters.beds)) {
        continue;
      }

      markers.push({
        id: prop.id,
        name: prop.name,
        address: prop.address,
        city: prop.city,
        state: prop.state,
        latitude: prop.latitude,
        longitude: prop.longitude,
        thumbnail_url: prop.thumbnail_url,
        property_type: prop.property_type,
        rent_min: rentMin,
        beds_available: bedsAvailable,
        total_units: prop.total_units,
        baths: Math.round(bathsAvg * 10) / 10,
      });
    }

    res.json(markers);
  } catch (error) {
    console.error('Error fetching map markers:', error);
    res.status(500).json({ 
      message: 'Error fetching map markers',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/v1/map/reference-locations
 * Get reference locations (universities, metro stations, employers)
 */
router.get('/reference-locations', async (req: Request, res: Response) => {
  try {
    const { location_type } = req.query;

    let query = supabase
      .from('apartment_reference_locations')
      .select('id, name, type, latitude, longitude, address')
      .eq('is_active', true);

    if (location_type && typeof location_type === 'string') {
      query = query.eq('type', location_type);
    }

    const { data, error } = await query;

    if (error) {
      throw error;
    }

    res.json(data || []);
  } catch (error) {
    console.error('Error fetching reference locations:', error);
    res.status(500).json({ 
      message: 'Error fetching reference locations',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/v1/map/properties/:id
 * Get detailed property info with nearby locations and distances
 */
router.get('/properties/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // Get property
    const { data: property, error: propError } = await supabase
      .from('apartment_properties_listings')
      .select('*')
      .eq('id', id)
      .single();

    if (propError || !property) {
      return res.status(404).json({ message: 'Property not found' });
    }

    // Get units
    const { data: units, error: unitsError } = await supabase
      .from('apartment_units')
      .select('*')
      .eq('property_id', id);

    if (unitsError) {
      throw unitsError;
    }

    // Get nearby locations with distances
    const { data: distances, error: distancesError } = await supabase
      .from('property_distances')
      .select(`
        distance_miles,
        walking_time_minutes,
        driving_time_minutes,
        apartment_reference_locations (
          name,
          type,
          address,
          latitude,
          longitude
        )
      `)
      .eq('property_id', id)
      .order('distance_miles')
      .limit(10);

    if (distancesError) {
      throw distancesError;
    }

    // Format nearby locations
    const nearbyLocations: NearbyLocation[] = (distances || [])
      .filter(d => d.apartment_reference_locations)
      .map(d => {
        const loc = d.apartment_reference_locations as any;
        return {
          name: loc.name,
          type: loc.type,
          address: loc.address,
          latitude: loc.latitude,
          longitude: loc.longitude,
          distance_miles: d.distance_miles,
          walking_time_minutes: d.walking_time_minutes,
          driving_time_minutes: d.driving_time_minutes,
        };
      });

    res.json({
      ...property,
      units: units || [],
      nearby_locations: nearbyLocations,
    });
  } catch (error) {
    console.error('Error fetching property details:', error);
    res.status(500).json({ 
      message: 'Error fetching property details',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/v1/map/properties-in-bounds
 * Get properties within map viewport boundaries
 */
router.post('/properties-in-bounds', async (req: Request, res: Response) => {
  try {
    const bounds = MapBoundsSchema.parse(req.body);

    const { data: properties, error: propertiesError } = await supabase
      .from('apartment_properties_listings')
      .select('id, name, address, city, state, latitude, longitude, thumbnail_url, property_type, total_units')
      .eq('is_active', true)
      .gte('latitude', bounds.southwest_lat)
      .lte('latitude', bounds.northeast_lat)
      .gte('longitude', bounds.southwest_lng)
      .lte('longitude', bounds.northeast_lng);

    if (propertiesError) {
      throw propertiesError;
    }

    if (!properties) {
      return res.json([]);
    }

    // Enrich with unit data (same as markers endpoint)
    const markers: PropertyMarker[] = [];

    for (const prop of properties) {
      const { data: units } = await supabase
        .from('apartment_units')
        .select('beds, baths, rent_min')
        .eq('property_id', prop.id);

      if (!units || units.length === 0) continue;

      const bedsAvailable = [...new Set(units.map(u => u.beds))].sort((a, b) => a - b);
      const rents = units.map(u => u.rent_min).filter(r => r != null);
      const rentMin = rents.length > 0 ? Math.min(...rents) : 0;
      const bathsVals = units.map(u => u.baths).filter(b => b != null);
      const bathsAvg = bathsVals.length > 0 
        ? bathsVals.reduce((a, b) => a + b, 0) / bathsVals.length 
        : 1.0;

      markers.push({
        id: prop.id,
        name: prop.name,
        address: prop.address,
        city: prop.city,
        state: prop.state,
        latitude: prop.latitude,
        longitude: prop.longitude,
        thumbnail_url: prop.thumbnail_url,
        property_type: prop.property_type,
        rent_min: rentMin,
        beds_available: bedsAvailable,
        total_units: prop.total_units,
        baths: Math.round(bathsAvg * 10) / 10,
      });
    }

    res.json(markers);
  } catch (error) {
    console.error('Error fetching properties in bounds:', error);
    res.status(500).json({ 
      message: 'Error fetching properties in bounds',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/v1/map/nearby-properties
 * Get properties near a specific point
 */
router.get('/nearby-properties', async (req: Request, res: Response) => {
  try {
    const params = NearbyPropertiesQuerySchema.parse(req.query);

    // Rough approximation for bounding box (1 degree ≈ 69 miles)
    const latDelta = params.radius_miles / 69.0;
    const lngDelta = params.radius_miles / (69.0 * Math.abs(Math.cos(params.latitude * Math.PI / 180)));

    const { data: properties, error } = await supabase
      .from('apartment_properties_listings')
      .select('id, name, address, city, state, latitude, longitude, thumbnail_url, property_type, total_units')
      .eq('is_active', true)
      .gte('latitude', params.latitude - latDelta)
      .lte('latitude', params.latitude + latDelta)
      .gte('longitude', params.longitude - lngDelta)
      .lte('longitude', params.longitude + lngDelta)
      .limit(params.limit);

    if (error) {
      throw error;
    }

    res.json(properties || []);
  } catch (error) {
    console.error('Error fetching nearby properties:', error);
    res.status(500).json({ 
      message: 'Error fetching nearby properties',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export { router as mapRoutes };