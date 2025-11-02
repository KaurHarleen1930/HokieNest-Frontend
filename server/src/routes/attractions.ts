// server/src/routes/attractions.ts - Updated to use property_distances as fallback
import { Router, Request, Response } from 'express';
import { supabase } from '../lib/supabase';

const router = Router();

/**
 * GET /api/v1/attractions/nearby/:propertyId
 * Get nearby attractions for a property using reference locations as fallback
 */
router.get('/nearby/:propertyId', async (req: Request, res: Response) => {
  try {
    const { propertyId } = req.params;
    const { maxDistance = '5000' } = req.query; // maxDistance in miles

    console.log(`📍 Fetching attractions for property: ${propertyId}`);

    // Try to get from property_attractions table first
    const { data: propertyAttractions, error: paError } = await supabase
      .from('property_attractions')
      .select(`
        *,
        attraction:attractions(*)
      `)
      .eq('property_id', propertyId)
      .lte('distance_miles', parseFloat(maxDistance as string) / 1000); // Convert meters to miles

    if (!paError && propertyAttractions && propertyAttractions.length > 0) {
      const results = propertyAttractions.map(item => ({
        ...item.attraction,
        distance_miles: item.distance_miles,
        walking_time_minutes: item.walking_time_minutes,
        driving_time_minutes: item.driving_time_minutes
      }));

      return res.json({
        success: true,
        propertyId,
        count: results.length,
        data: results,
        source: 'property_attractions'
      });
    }

    // Fallback: Use property_distances with reference_locations
    console.log('📍 Using property_distances as fallback...');
    
    const { data: distances, error: distError } = await supabase
      .from('property_distances')
      .select(`
        distance_miles,
        walking_time_minutes,
        driving_time_minutes,
        apartment_reference_locations (
          id,
          name,
          address,
          latitude,
          longitude,
          type
        )
      `)
      .eq('property_id', propertyId)
      .lte('distance_miles', parseFloat(maxDistance as string) / 1000)
      .order('distance_miles');

    if (distError) {
      console.error('Error fetching distances:', distError);
      throw distError;
    }

    // Map reference locations to attraction format
    const attractions = (distances || [])
      .filter(d => d.apartment_reference_locations)
      .map((d, index) => {
        const loc = d.apartment_reference_locations as any;
        
        // Determine category based on type
        let category = 'attraction';
        if (loc.type === 'transit' || loc.type === 'metro') {
          return null; // Filter out transit for attractions
        } else if (loc.type === 'restaurant' || loc.name.toLowerCase().includes('restaurant')) {
          category = 'restaurant';
        } else if (loc.type === 'bar' || loc.name.toLowerCase().includes('bar')) {
          category = 'bar';
        } else if (loc.type === 'cafe' || loc.name.toLowerCase().includes('cafe') || loc.name.toLowerCase().includes('coffee')) {
          category = 'cafe';
        }

        return {
          id: loc.id || `ref-${index}`,
          name: loc.name,
          address: loc.address,
          latitude: loc.latitude,
          longitude: loc.longitude,
          category: category,
          distance_miles: d.distance_miles,
          walking_time_minutes: d.walking_time_minutes,
          driving_time_minutes: d.driving_time_minutes,
          is_active: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };
      })
      .filter(Boolean); // Remove nulls

    res.json({
      success: true,
      propertyId,
      count: attractions.length,
      data: attractions,
      source: 'property_distances'
    });

  } catch (error: any) {
    console.error('Error fetching nearby attractions:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message,
      propertyId: req.params.propertyId
    });
  }
});

export default router;