// server/src/routes/attractions.ts
// Attractions API Routes - Supabase Version

import { Router, Request, Response } from 'express';
import { supabase } from '../lib/supabase';
import { fetchGooglePlaces } from '../services/googlePlacesService';

const router = Router();

/**
 * GET /api/attractions
 * Fetch attractions with optional filtering
 * Query params: category, lat, lng, radius, limit
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const { 
      category, 
      lat, 
      lng, 
      radius = '2',
      limit = '50',
      minRating = '0',
      priceLevel
    } = req.query;

    let query = supabase
      .from('attractions')
      .select('*')
      .eq('is_active', true);

    if (category) {
      query = query.eq('category', category);
    }

    if (minRating && parseFloat(minRating as string) > 0) {
      query = query.gte('rating', parseFloat(minRating as string));
    }

    if (priceLevel) {
      query = query.eq('price_level', parseInt(priceLevel as string));
    }

    query = query.limit(parseInt(limit as string));

    const { data: attractions, error } = await query;

    if (error) {
      throw error;
    }

    // Calculate distance if lat/lng provided
    let results = attractions || [];
    if (lat && lng) {
      const userLat = parseFloat(lat as string);
      const userLng = parseFloat(lng as string);
      const maxRadius = parseFloat(radius as string);

      results = attractions
        ?.map(attraction => {
          const distance = calculateDistance(
            userLat,
            userLng,
            parseFloat(attraction.latitude),
            parseFloat(attraction.longitude)
          );
          return { ...attraction, distance_miles: distance.toFixed(2) };
        })
        .filter(a => parseFloat(a.distance_miles) <= maxRadius)
        .sort((a, b) => parseFloat(a.distance_miles) - parseFloat(b.distance_miles)) || [];
    }

    res.json({
      success: true,
      count: results.length,
      data: results
    });
  } catch (error: any) {
    console.error('Error fetching attractions:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/attractions/nearby/:propertyId
 * Get all nearby attractions for a specific property
 */
router.get('/nearby/:propertyId', async (req: Request, res: Response) => {
  try {
    const { propertyId } = req.params;
    const { category, maxDistance = '2' } = req.query;

    let query = supabase
      .from('property_attractions')
      .select(`
        *,
        attraction:attractions(*)
      `)
      .eq('property_id', propertyId)
      .lte('distance_miles', parseFloat(maxDistance as string));

    const { data, error } = await query;

    if (error) {
      throw error;
    }

    // Filter and format results
    let results = data?.map(item => ({
      ...item.attraction,
      distance_miles: item.distance_miles,
      walking_time_minutes: item.walking_time_minutes,
      driving_time_minutes: item.driving_time_minutes
    })) || [];

    if (category) {
      results = results.filter(a => a.category === category);
    }

    results = results
      .filter(a => a.is_active)
      .sort((a, b) => a.distance_miles - b.distance_miles);

    res.json({
      success: true,
      propertyId,
      count: results.length,
      data: results
    });
  } catch (error: any) {
    console.error('Error fetching nearby attractions:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/attractions/categories
 * Get available categories and subcategories
 */
router.get('/categories', async (req: Request, res: Response) => {
  try {
    const { data, error } = await supabase
      .from('attractions')
      .select('category, subcategory')
      .eq('is_active', true);

    if (error) {
      throw error;
    }

    // Group by category
    const categories: Record<string, any> = {};
    data?.forEach(row => {
      if (!categories[row.category]) {
        categories[row.category] = {
          name: row.category,
          subcategories: []
        };
      }
      if (row.subcategory && !categories[row.category].subcategories.includes(row.subcategory)) {
        categories[row.category].subcategories.push(row.subcategory);
      }
    });

    res.json({
      success: true,
      data: Object.values(categories)
    });
  } catch (error: any) {
    console.error('Error fetching categories:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/attractions/sync
 * Admin endpoint to sync attractions from Google Places API
 * 
 * Request body:
 * {
 *   "lat": 38.8048,
 *   "lng": -77.0469,
 *   "radius": 5000,
 *   "types": ["restaurant", "bar", "cafe", "night_club"]
 * }
 */
router.post('/sync', async (req: Request, res: Response) => {
  try {
    const { lat, lng, radius, types } = req.body;

    console.log('🔄 Starting attraction sync...');
    console.log('📍 Request body:', { lat, lng, radius, types });

    // Validate required fields
    if (!lat || !lng) {
      return res.status(400).json({
        success: false,
        error: 'lat and lng are required'
      });
    }

    // Fetch from Google Places using NEW API format
    console.log('📡 Calling Google Places API (New)...');
    const places = await fetchGooglePlaces({
      lat: parseFloat(lat),
      lng: parseFloat(lng),
      radius: radius || 5000,
      types: types || ['restaurant', 'bar', 'cafe']
    });

    console.log(`✅ Received ${places.length} places from Google`);
    
    if (places.length === 0) {
      return res.json({
        success: true,
        message: 'No places found in this area',
        syncedCount: 0,
        debug: {
          searchLocation: { lat, lng },
          searchRadius: radius || 5000,
          searchTypes: types || ['restaurant', 'bar', 'cafe']
        }
      });
    }

    const syncedAttractions = [];
    const errors = [];

    // Insert each place into database
    for (const place of places) {
      try {
        console.log(`💾 Upserting: ${place.name}`);
        
        const { data, error } = await supabase
          .from('attractions')
          .upsert(place, {
            onConflict: 'google_place_id',
            ignoreDuplicates: false
          })
          .select();

        if (error) {
          console.error(`❌ Error upserting ${place.name}:`, error);
          errors.push({ place: place.name, error: error.message });
        } else if (data && data.length > 0) {
          console.log(`✅ Synced: ${place.name}`);
          syncedAttractions.push(data[0].id);
        }
      } catch (error: any) {
        console.error(`❌ Exception upserting ${place.name}:`, error);
        errors.push({ place: place.name, error: error.message });
      }
    }

    console.log(`🎉 Sync complete: ${syncedAttractions.length}/${places.length} successful`);

    res.json({
      success: true,
      message: `Synced ${syncedAttractions.length} attractions`,
      syncedCount: syncedAttractions.length,
      totalFetched: places.length,
      errors: errors.length > 0 ? errors : undefined,
      debug: {
        searchLocation: { lat, lng },
        searchRadius: radius || 5000,
        searchTypes: types || ['restaurant', 'bar', 'cafe']
      }
    });
  } catch (error: any) {
    console.error('❌ Sync error:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

/**
 * POST /api/attractions/link-properties
 * Link all existing properties to nearby attractions
 */
router.post('/link-properties', async (req: Request, res: Response) => {
  try {
    console.log('🔗 Linking properties to attractions...');
    
    // Get all active properties with coordinates
    const { data: properties, error: propError } = await supabase
      .from('apartment_properties_listings')
      .select('id, name, latitude, longitude')
      .eq('is_active', true)
      .not('latitude', 'is', null)
      .not('longitude', 'is', null);

    if (propError) throw propError;
    
    // Get all active attractions
    const { data: attractions, error: attrError } = await supabase
      .from('attractions')
      .select('id, latitude, longitude, category')
      .eq('is_active', true);

    if (attrError) throw attrError;

    const maxDistance = 3; // miles
    const links = [];

    // Calculate distances and create links
    for (const property of properties || []) {
      for (const attraction of attractions || []) {
        const distance = calculateDistance(
          parseFloat(property.latitude),
          parseFloat(property.longitude),
          parseFloat(attraction.latitude),
          parseFloat(attraction.longitude)
        );

        if (distance <= maxDistance) {
          links.push({
            property_id: property.id,
            attraction_id: attraction.id,
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
        .from('property_attractions')
        .upsert(links, {
          onConflict: 'property_id,attraction_id',
          ignoreDuplicates: false
        });

      if (linkError) throw linkError;
    }

    res.json({
      success: true,
      message: `Linked ${properties?.length || 0} properties to ${links.length} nearby attractions`,
      propertiesProcessed: properties?.length || 0,
      linksCreated: links.length
    });
  } catch (error: any) {
    console.error('Error linking properties:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Helper: Calculate distance between two coordinates
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