// server/src/routes/transit.ts
import { Router, Request, Response } from 'express';
import { supabase } from '../lib/supabase';
import { authenticateToken as protect, requireAdmin as admin } from '../middleware/auth';
import {
  fetchWMATARealTime, 
  calculateCommuteTime 
} from '../services/wmataService';

const router = Router();

/**
 * GET /api/v1/transit/nearby/:propertyId
 * (This route remains unchanged)
 */
router.get('/nearby/:propertyId', async (req: Request, res: Response) => {
  try {
    const { propertyId } = req.params;
    const { maxDistance = '2' } = req.query; 

    console.log(`🚇 Fetching transit for property: ${propertyId} within ${maxDistance} miles`);

    const { data: propertyTransitStations, error: ptsError } = await supabase
      .from('property_transit_stations')
      .select(`
        *,
        transit_station:transit_stations(*)
      `)
      .eq('property_id', propertyId)
      .lte('distance_miles', parseFloat(maxDistance as string));

    if (ptsError) throw ptsError;

    if (!propertyTransitStations || propertyTransitStations.length === 0) {
      return res.json({
        success: true,
        propertyId,
        count: 0,
        data: [],
        source: 'property_transit_stations'
      });
    }

    const results = propertyTransitStations.map(item => {
      const station = item.transit_station;
      if (!station) return null;

      return {
        ...station,
        distance_miles: item.distance_miles,
        walking_time_minutes: item.walking_time_minutes,
        driving_time_minutes: item.driving_time_minutes,
      };
    }).filter(Boolean); 

    res.json({
      success: true,
      propertyId,
      count: results.length,
      data: results,
      source: 'property_transit_stations'
    });

  } catch (error: any) {
    console.error('Error fetching nearby transit:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message,
      propertyId: req.params.propertyId 
    });
  }
});

/**
 * ========================================================
 * NEW ROUTE: GET /api/v1/transit/stations/all
 * ========================================================
 * Get all transit stations (metro and bus) for the global overlay
 */
router.get('/stations/all', async (req: Request, res: Response) => {
  try {
    console.log('🚇 Fetching ALL transit stations for overlay');

    const { data, error } = await supabase
      .from('transit_stations')
      .select('*')
      .eq('is_active', true);

    if (error) throw error;

    res.json({
      success: true,
      count: data.length,
      data: data
    });

  } catch (error: any) {
    console.error('Error fetching all transit stations:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/v1/transit/stations
 * Optional query params:
 *  - type: 'metro' | 'bus_stop'
 */
router.get('/stations', async (req: Request, res: Response) => {
  try {
    const { type } = req.query;

    if (type && type !== 'metro' && type !== 'bus_stop') {
      return res.status(400).json({
        success: false,
        error: "Invalid 'type' parameter. Expected 'metro' or 'bus_stop'.",
      });
    }

    let query = supabase
      .from('transit_stations')
      .select('*')
      .eq('is_active', true)
      .order('name');

    if (type) {
      query = query.eq('station_type', type);
    }

    const { data, error } = await query;

    if (error) {
      throw error;
    }

    res.json({
      success: true,
      count: data?.length ?? 0,
      data: data ?? [],
    });
  } catch (error: any) {
    console.error('Error fetching transit stations:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});


/**
 * GET /api/v1/transit/lines
 * (This route remains unchanged)
 */
router.get('/lines', async (req: Request, res: Response) => {
  try {
    console.log('🚇 Fetching all transit lines...');

    const { data, error } = await supabase
      .from('transit_routes')
      .select('*')
      .eq('is_active', true)
      .order('route_name');

    if (error) throw error;

    res.json({
      success: true,
      count: data.length,
      data: data
    });

  } catch (error: any) {
    console.error('Error fetching transit lines:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/v1/transit/realtime/:stationCode
 * (This route remains unchanged)
 */
router.get('/realtime/:stationCode', async (req: Request, res: Response) => {
  try {
    const { stationCode } = req.params;
    console.log(`🚇 Fetching real-time predictions for station: ${stationCode}`);

    const predictions = await fetchWMATARealTime(stationCode);

    res.json({
      success: true,
      data: predictions
    });

  } catch (error: any) {
    console.error('Error fetching real-time predictions:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * ========================================================
 * FIXED ROUTE: GET /api/v1/transit/commute
 * ========================================================
 * Calculate commute time between two lat/lng points
 */
router.get('/commute', async (req: Request, res: Response) => {
  try {
    const { fromLat, fromLng, toLat, toLng } = req.query;

    if (!fromLat || !fromLng || !toLat || !toLng) {
      return res.status(400).json({ success: false, error: 'Missing required lat/lng parameters' });
    }

    console.log(`🚇 Calculating commute from [${fromLat}, ${fromLng}] to [${toLat}, ${toLng}]`);

    // 1. Find nearest station to 'from' (property)
    const { data: fromStation, error: fromError } = await supabase.rpc(
      'find_nearest_station',
      { lat: parseFloat(fromLat as string), lng: parseFloat(fromLng as string) }
    );
    if (fromError || !fromStation || fromStation.length === 0) {
      throw new Error(`Could not find nearest 'from' station: ${fromError?.message || 'No station found'}`);
    }
    const fromStationCode = fromStation[0].wmata_station_code;
    console.log(`🚇 'From' station found: ${fromStation[0].station_name} (${fromStationCode})`);

    // 2. Find nearest station to 'to' (campus)
    const { data: toStation, error: toError } = await supabase.rpc(
      'find_nearest_station',
      { lat: parseFloat(toLat as string), lng: parseFloat(toLng as string) }
    );
    if (toError || !toStation || toStation.length === 0) {
      throw new Error(`Could not find nearest 'to' station: ${toError?.message || 'No station found'}`);
    }
    const toStationCode = toStation[0].wmata_station_code;
    console.log(`🚇 'To' station found: ${toStation[0].station_name} (${toStationCode})`);

    // 3. Calculate commute time between the two stations
    const commuteData = await calculateCommuteTime(fromStationCode, toStationCode);

    res.json({
      success: true,
      data: {
        fromStation: fromStation[0],
        toStation: toStation[0],
        commute: commuteData
      }
    });

  } catch (error: any) {
    console.error('Error calculating commute:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/v1/transit/sync
 * [ADMIN ONLY] Sync metro stations and routes from WMATA API to our DB
 *
 * FIX: This route has been commented out because the functions 
 * 'syncMetroStations' and 'syncMetroRoutes' do not exist in your
 * server/src/services/wmataService.ts file.
 *
 * To re-enable, you must first implement those functions.
 */
/*
router.post('/sync', protect, admin, async (req: Request, res: Response) => {
  try {
    console.log('🚇 [ADMIN] Starting transit data sync...');

    // These functions are NOT defined in wmataService.ts
    // const [stationsResult, routesResult] = await Promise.all([
    //   syncMetroStations(),
    //   syncMetroRoutes()
    // ]);

    const message = `Sync functionality is currently disabled.`;
    console.log(`⚠️ [ADMIN] ${message}`);

    res.json({
      success: true,
      message,
    });

  } catch (error: any) {
    console.error('Error syncing transit data:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});
*/

export default router;