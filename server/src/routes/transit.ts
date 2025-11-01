// server/src/routes/transit.ts
// Transit API Routes - Supabase Version

import { Router, Request, Response } from 'express';
import { supabase } from '../lib/supabase';
import { fetchWMATAStations, fetchWMATALines, fetchWMATARealTime } from '../services/wmataService';

const router = Router();

/**
 * GET /api/transit/stations
 * Get all transit stations with optional filtering
 */
router.get('/stations', async (req: Request, res: Response) => {
  try {
    const { 
      type,
      lat, 
      lng, 
      radius = '2',
      lines
    } = req.query;

    let query = supabase
      .from('transit_stations')
      .select('*')
      .eq('is_active', true);

    if (type) {
      query = query.eq('station_type', type);
    }

    const { data: stations, error } = await query;

    if (error) {
      throw error;
    }

    let results = stations || [];

    // Filter by lines if specified
    if (lines && typeof lines === 'string') {
      const lineArray = lines.split(',').map(l => l.toLowerCase());
      results = results.filter(station => {
        if (!station.lines) return false;
        const stationLines = Array.isArray(station.lines) ? station.lines : [];
        return stationLines.some((line: string) => lineArray.includes(line.toLowerCase()));
      });
    }

    // Calculate distance if lat/lng provided
    if (lat && lng) {
      const userLat = parseFloat(lat as string);
      const userLng = parseFloat(lng as string);
      const maxRadius = parseFloat(radius as string);

      results = results
        .map(station => {
          const distance = calculateDistance(
            userLat,
            userLng,
            parseFloat(station.latitude),
            parseFloat(station.longitude)
          );
          return { ...station, distance_miles: distance.toFixed(2) };
        })
        .filter(s => parseFloat(s.distance_miles) <= maxRadius)
        .sort((a, b) => parseFloat(a.distance_miles) - parseFloat(b.distance_miles));
    }

    res.json({
      success: true,
      count: results.length,
      data: results
    });
  } catch (error: any) {
    console.error('Error fetching transit stations:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/transit/nearby/:propertyId
 * Get nearby transit stations for a specific property
 */
router.get('/nearby/:propertyId', async (req: Request, res: Response) => {
  try {
    const { propertyId } = req.params;
    const { maxDistance = '1', type } = req.query;

    let query = supabase
      .from('property_transit_stations')
      .select(`
        *,
        transit_station:transit_stations(*)
      `)
      .eq('property_id', propertyId)
      .lte('distance_miles', parseFloat(maxDistance as string));

    const { data, error } = await query;

    if (error) {
      throw error;
    }

    let results = data?.map(item => ({
      ...item.transit_station,
      distance_miles: item.distance_miles,
      walking_time_minutes: item.walking_time_minutes,
      driving_time_minutes: item.driving_time_minutes
    })) || [];

    if (type) {
      results = results.filter(s => s.station_type === type);
    }

    results = results
      .filter(s => s.is_active)
      .sort((a, b) => a.distance_miles - b.distance_miles);

    res.json({
      success: true,
      propertyId,
      count: results.length,
      data: results
    });
  } catch (error: any) {
    console.error('Error fetching nearby transit:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/transit/lines
 * Get all metro lines with their routes
 */
router.get('/lines', async (req: Request, res: Response) => {
  try {
    const { data, error } = await supabase
      .from('transit_routes')
      .select('*')
      .eq('is_active', true)
      .eq('route_type', 'metro_line')
      .order('route_name');

    if (error) {
      throw error;
    }

    res.json({
      success: true,
      count: data?.length || 0,
      data: data || []
    });
  } catch (error: any) {
    console.error('Error fetching metro lines:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/transit/realtime/:stationCode
 * Get real-time train predictions for a station
 */
router.get('/realtime/:stationCode', async (req: Request, res: Response) => {
  try {
    const { stationCode } = req.params;

    // Fetch real-time data from WMATA API
    const predictions = await fetchWMATARealTime(stationCode);

    res.json({
      success: true,
      stationCode,
      data: predictions
    });
  } catch (error: any) {
    console.error('Error fetching real-time transit data:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/transit/commute
 * Calculate commute time from property to destination
 */
router.get('/commute', async (req: Request, res: Response) => {
  try {
    const { fromLat, fromLng, toLat, toLng } = req.query;

    if (!fromLat || !fromLng || !toLat || !toLng) {
      return res.status(400).json({
        success: false,
        error: 'Origin and destination coordinates required'
      });
    }

    const userFromLat = parseFloat(fromLat as string);
    const userFromLng = parseFloat(fromLng as string);
    const userToLat = parseFloat(toLat as string);
    const userToLng = parseFloat(toLng as string);

    // Find nearest transit stations to origin and destination
    const { data: allStations } = await supabase
      .from('transit_stations')
      .select('*')
      .eq('station_type', 'metro')
      .eq('is_active', true);

    if (!allStations || allStations.length === 0) {
      throw new Error('No transit stations found');
    }

    // Calculate distances to all stations
    const stationsWithDistance = allStations.map(station => ({
      ...station,
      distanceFromOrigin: calculateDistance(
        userFromLat,
        userFromLng,
        parseFloat(station.latitude),
        parseFloat(station.longitude)
      ),
      distanceFromDest: calculateDistance(
        userToLat,
        userToLng,
        parseFloat(station.latitude),
        parseFloat(station.longitude)
      )
    }));

    // Find nearest stations
    const originStation = stationsWithDistance.reduce((nearest, station) => 
      station.distanceFromOrigin < nearest.distanceFromOrigin ? station : nearest
    );

    const destStation = stationsWithDistance.reduce((nearest, station) => 
      station.distanceFromDest < nearest.distanceFromDest ? station : nearest
    );

    // Calculate total commute time
    const walkToStation = Math.ceil(originStation.distanceFromOrigin * 20);
    const walkFromStation = Math.ceil(destStation.distanceFromDest * 20);
    const estimatedTransitTime = 30; // Simplified - could query WMATA for actual time

    const totalCommute = walkToStation + estimatedTransitTime + walkFromStation;

    res.json({
      success: true,
      data: {
        originStation: {
          name: originStation.name,
          code: originStation.wmata_station_code,
          walkingDistance: originStation.distanceFromOrigin.toFixed(2),
          walkingTime: walkToStation
        },
        destinationStation: {
          name: destStation.name,
          code: destStation.wmata_station_code,
          walkingDistance: destStation.distanceFromDest.toFixed(2),
          walkingTime: walkFromStation
        },
        transitTime: estimatedTransitTime,
        totalCommuteTime: totalCommute
      }
    });
  } catch (error: any) {
    console.error('Error calculating commute:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/transit/sync
 * Admin endpoint to sync transit data from WMATA API
 */
router.post('/sync', async (req: Request, res: Response) => {
  try {
    // Fetch all stations from WMATA API
    const wmataStations = await fetchWMATAStations();
    const syncedStations = [];

    for (const station of wmataStations) {
      const stationData = {
        wmata_station_code: station.Code,
        name: station.Name,
        address: `${station.Address.Street}, ${station.Address.City}`,
        latitude: station.Lat,
        longitude: station.Lon,
        station_type: 'metro',
        lines: station.LineCode ? [station.LineCode] : [],
        has_parking: station.StationTogether1 !== '',
        is_accessible: true
      };

      const { data, error } = await supabase
        .from('transit_stations')
        .upsert(stationData, { 
          onConflict: 'wmata_station_code',
          ignoreDuplicates: false 
        })
        .select();

      if (!error && data) {
        syncedStations.push(data[0].id);
      }
    }

    // Sync metro lines
    const wmataLines = await fetchWMATALines();
    for (const line of wmataLines) {
      await supabase
        .from('transit_routes')
        .upsert({
          wmata_route_id: line.LineCode,
          route_name: line.DisplayName,
          route_type: 'metro_line',
          line_color: line.LineCode.toLowerCase()
        }, { 
          onConflict: 'wmata_route_id',
          ignoreDuplicates: false 
        });
    }

    res.json({
      success: true,
      message: `Synced ${syncedStations.length} transit stations`,
      syncedCount: syncedStations.length
    });
  } catch (error: any) {
    console.error('Error syncing transit data:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/transit/link-properties
 * Link all existing properties to nearby transit stations
 */
router.post('/link-properties', async (req: Request, res: Response) => {
  try {
    console.log('🔗 Linking properties to transit stations...');
    
    // Get all active properties with coordinates
    const { data: properties, error: propError } = await supabase
      .from('apartment_properties_listings')
      .select('id, name, latitude, longitude')
      .eq('is_active', true)
      .not('latitude', 'is', null)
      .not('longitude', 'is', null);

    if (propError) throw propError;
    
    // Get all active transit stations
    const { data: stations, error: stationError } = await supabase
      .from('transit_stations')
      .select('id, name, latitude, longitude, station_type')
      .eq('is_active', true);

    if (stationError) throw stationError;

    const maxDistance = 2; // miles (transit is usually closer than attractions)
    const links = [];

    // Calculate distances and create links
    for (const property of properties || []) {
      for (const station of stations || []) {
        const distance = calculateDistance(
          parseFloat(property.latitude),
          parseFloat(property.longitude),
          parseFloat(station.latitude),
          parseFloat(station.longitude)
        );

        if (distance <= maxDistance) {
          links.push({
            property_id: property.id,
            transit_station_id: station.id,
            distance_miles: parseFloat(distance.toFixed(2)),
            walking_time_minutes: Math.ceil(distance * 20), // ~3 mph walking
            driving_time_minutes: Math.ceil(distance * 2.4) // ~25 mph city driving
          });
        }
      }
    }

    // Insert links
    if (links.length > 0) {
      const { error: linkError } = await supabase
        .from('property_transit_stations')
        .upsert(links, {
          onConflict: 'property_id,transit_station_id',
          ignoreDuplicates: false
        });

      if (linkError) throw linkError;
    }

    res.json({
      success: true,
      message: `Linked ${properties?.length || 0} properties to ${links.length} nearby transit stations`,
      propertiesProcessed: properties?.length || 0,
      linksCreated: links.length
    });
  } catch (error: any) {
    console.error('Error linking properties to transit:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Helper function: Calculate distance between two coordinates
 */
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 3959; // Earth's radius in miles
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRad(degrees: number): number {
  return degrees * (Math.PI / 180);
}

export default router;