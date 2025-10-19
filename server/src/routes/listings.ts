// server/src/routes/listings.ts - UPDATED VERSION
import { Router } from 'express';
import { z } from 'zod';
import { supabase } from '../lib/supabase';
import { calculateNearestCampus, calculateAllCampusDistances } from '../utils/distance';

const router = Router();

// Helper function to parse JSON fields safely
function parseJSONField(field: any): any {
  if (!field) return null;
  if (typeof field === 'object') return field;
  try {
    return JSON.parse(field);
  } catch {
    return null;
  }
}

// Validation schemas
const listingFiltersSchema = z.object({
  minPrice: z.string().transform(Number).optional(),
  maxPrice: z.string().transform(Number).optional(),
  beds: z.string().transform(Number).optional(),
  baths: z.string().transform(Number).optional(),
  intlFriendly: z.string().transform(val => val === 'true').optional(),
  sortBy: z.enum(['newest', 'oldest', 'price-low', 'price-high', 'name-a', 'name-z']).optional(),
});

// Get all listings with filters
router.get('/', async (req, res, next) => {
  try {
    const filters = listingFiltersSchema.parse(req.query);

    // Determine sort order
    let orderColumn = 'created_at';
    let ascending = false;

    if (filters.sortBy) {
      switch (filters.sortBy) {
        case 'newest':
          orderColumn = 'created_at';
          ascending = false;
          break;
        case 'oldest':
          orderColumn = 'created_at';
          ascending = true;
          break;
        case 'price-low':
        case 'price-high':
          // We'll sort by price after fetching since we calculate it from units
          orderColumn = 'created_at';
          ascending = false;
          break;
        case 'name-a':
          orderColumn = 'name';
          ascending = true;
          break;
        case 'name-z':
          orderColumn = 'name';
          ascending = false;
          break;
      }
    }

    const { data: properties, error: propertiesError } = await supabase
      .from('apartment_properties_listings')
      .select('*')
      .eq('is_active', true)
      .order(orderColumn, { ascending });

    if (propertiesError) throw propertiesError;

    if (!properties || properties.length === 0) {
      return res.json([]);
    }

    // Get property IDs
    const propertyIds = properties.map(p => p.id);

    // Get apartment units for these properties
    const { data: units, error: unitsError } = await supabase
      .from('apartment_units')
      .select('*')
      .in('property_id', propertyIds);

    if (unitsError) {
      throw unitsError;
    }

    // Group units by property
    const unitsByProperty = new Map();
    (units || []).forEach(unit => {
      if (!unitsByProperty.has(unit.property_id)) {
        unitsByProperty.set(unit.property_id, []);
      }
      unitsByProperty.get(unit.property_id).push(unit);
    });

    // Create listings with unit data
    const listings = properties.map(property => {
      const propertyUnits = unitsByProperty.get(property.id) || [];

      // Parse photos JSON string - THIS IS THE KEY FIX
      const photosArray = parseJSONField(property.photos) || [];
      const amenitiesData = parseJSONField(property.amenities) || {};

      // Calculate price range from units
      const prices = propertyUnits.map((u: any) => [u.rent_min, u.rent_max]).flat().filter((p: any) => p > 0);
      const minPrice = prices.length > 0 ? Math.min(...prices) : 0;
      const maxPrice = prices.length > 0 ? Math.max(...prices) : 0;

      // Calculate beds/baths range
      const beds = propertyUnits.map((u: any) => u.beds).filter((b: any) => b > 0);
      const baths = propertyUnits.map((u: any) => u.baths).filter((b: any) => b > 0);
      const maxBeds = beds.length > 0 ? Math.max(...beds) : 0;
      const maxBaths = baths.length > 0 ? Math.max(...baths) : 0;

      // Count available units
      const availableUnits = propertyUnits.filter((u: any) => {
        const status = String(u.availability_status || '').toLowerCase();
        return status.includes('available') || status === 'vacant' || status === 'ready';
      });

      // Calculate distance to nearest campus if coordinates available
      let distanceInfo = null;
      if (property.latitude && property.longitude) {
        const nearestCampus = calculateNearestCampus(property.latitude, property.longitude);
        const allDistances = calculateAllCampusDistances(property.latitude, property.longitude);
        distanceInfo = {
          nearest: nearestCampus,
          all: allDistances
        };
      }

      return {
        id: property.id,
        title: property.name || 'Apartment Complex',
        price: minPrice,
        address: property.address || '',
        beds: maxBeds,
        baths: maxBaths,
        intlFriendly: property.intl_friendly || false,
        // Use thumbnail_url first, then first photo from array
        imageUrl: property.thumbnail_url || (photosArray.length > 0 ? photosArray[0] : null),
        photos: photosArray, // Include all photos
        description: property.description || `Apartment complex in ${property.city}, ${property.state}`,
        amenities: Array.isArray(amenitiesData) ? amenitiesData : Object.keys(amenitiesData),
        contactEmail: property.email || undefined,
        contactPhone: property.phone_number || undefined,
        createdAt: property.created_at,
        updatedAt: property.updated_at,
        latitude: property.latitude || null,
        longitude: property.longitude || null,
        city: property.city || '',
        state: property.state || '',
        // Additional data for filtering
        _units: propertyUnits,
        _availableUnits: availableUnits,
        _priceRange: { min: minPrice, max: maxPrice },
        _unitCount: propertyUnits.length,
        _availableUnitCount: availableUnits.length,
        // Distance information
        distanceFromCampus: distanceInfo?.nearest.distance || null,
        nearestCampus: distanceInfo?.nearest.campus || null,
        allCampusDistances: distanceInfo?.all || null
      };
    });

    // Apply filters
    let filteredListings = listings;

    if (filters.minPrice !== undefined) {
      filteredListings = filteredListings.filter(l => l._priceRange.max >= filters.minPrice!);
    }
    if (filters.maxPrice !== undefined) {
      filteredListings = filteredListings.filter(l => l._priceRange.min <= filters.maxPrice!);
    }
    if (filters.beds !== undefined) {
      filteredListings = filteredListings.filter(l => l.beds >= filters.beds!);
    }
    if (filters.baths !== undefined) {
      filteredListings = filteredListings.filter(l => l.baths >= filters.baths!);
    }
    if (filters.intlFriendly !== undefined) {
      filteredListings = filteredListings.filter(l => l.intlFriendly === filters.intlFriendly);
    }

    // Apply price sorting if needed
    if (filters.sortBy === 'price-low') {
      filteredListings.sort((a, b) => a._priceRange.min - b._priceRange.min);
    } else if (filters.sortBy === 'price-high') {
      filteredListings.sort((a, b) => b._priceRange.min - a._priceRange.min);
    }

    res.json(filteredListings);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        message: 'Invalid filters',
        errors: error.errors,
      });
    }
    next(error);
  }
});

// Get listing by ID
router.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;

    // Get property from Supabase
    const { data: property, error: propertyError } = await supabase
      .from('apartment_properties_listings')
      .select('*')
      .eq('id', id)
      .eq('is_active', true)
      .single();

    if (propertyError || !property) {
      return res.status(404).json({ message: 'Listing not found' });
    }

    // Get apartment units for this property
    const { data: units, error: unitsError } = await supabase
      .from('apartment_units')
      .select('*')
      .eq('property_id', id);

    if (unitsError) {
      throw unitsError;
    }

    // Parse JSON fields
    const photosArray = parseJSONField(property.photos) || [];
    const amenitiesData = parseJSONField(property.amenities) || {};

    // Parse unit photos
    const parsedUnits = (units || []).map(unit => ({
      ...unit,
      photos: parseJSONField(unit.photos) || []
    }));

    // Calculate aggregated data
    const propertyUnits = parsedUnits;
    const prices = propertyUnits.map((u: any) => [u.rent_min, u.rent_max]).flat().filter((p: any) => p > 0);
    const minPrice = prices.length > 0 ? Math.min(...prices) : 0;
    const maxPrice = prices.length > 0 ? Math.max(...prices) : 0;

    const beds = propertyUnits.map((u: any) => u.beds).filter((b: any) => b > 0);
    const baths = propertyUnits.map((u: any) => u.baths).filter((b: any) => b > 0);
    const maxBeds = beds.length > 0 ? Math.max(...beds) : 0;
    const maxBaths = baths.length > 0 ? Math.max(...baths) : 0;

    // Count available units
    const availableUnits = propertyUnits.filter((u: any) => {
      const status = String(u.availability_status || '').toLowerCase();
      return status.includes('available') || status === 'vacant' || status === 'ready';
    });

    // Calculate distance info
    let distanceInfo = null;
    if (property.latitude && property.longitude) {
      const nearestCampus = calculateNearestCampus(property.latitude, property.longitude);
      const allDistances = calculateAllCampusDistances(property.latitude, property.longitude);
      distanceInfo = {
        nearest: nearestCampus,
        all: allDistances
      };
    }

    const formattedListing = {
      id: property.id,
      title: property.name || 'Apartment Complex',
      price: minPrice,
      address: property.address || '',
      beds: maxBeds,
      baths: maxBaths,
      intlFriendly: property.intl_friendly || false,
      imageUrl: property.thumbnail_url || (photosArray.length > 0 ? photosArray[0] : null),
      photos: photosArray,
      description: property.description || `Apartment complex in ${property.city}, ${property.state}`,
      amenities: Array.isArray(amenitiesData) ? amenitiesData : Object.keys(amenitiesData),
      contactEmail: property.email || undefined,
      contactPhone: property.phone_number || undefined,
      createdAt: property.created_at,
      updatedAt: property.updated_at,
      latitude: property.latitude || null,
      longitude: property.longitude || null,
      city: property.city || '',
      state: property.state || '',
      website_url: property.website_url || null,
      year_built: property.year_built || null,
      total_units: property.total_units || null,
      _units: propertyUnits,
      _availableUnits: availableUnits,
      _priceRange: { min: minPrice, max: maxPrice },
      _unitCount: propertyUnits.length,
      _availableUnitCount: availableUnits.length,
      // Distance information
      distanceFromCampus: distanceInfo?.nearest.distance || null,
      nearestCampus: distanceInfo?.nearest.campus || null,
      allCampusDistances: distanceInfo?.all || null
    };

    res.json(formattedListing);
  } catch (error) {
    next(error);
  }
});

export { router as listingRoutes };