import { Router } from 'express';
import { z } from 'zod';
import { supabase } from '../lib/supabase';
import { calculateNearestCampus, calculateAllCampusDistances } from '../utils/distance';

// Generate placeholder image based on property data
function generatePlaceholderImage(property: any): string {
  const baseUrl = 'https://images.unsplash.com/photo-';
  const propertyId = property.id || 'default';
  const city = property.city || 'apartment';
  const state = property.state || 'va';
  
  // Use property ID to generate consistent but unique images
  const seed = propertyId.slice(-6); // Use last 6 characters of ID as seed
  const width = 800;
  const height = 600;
  
  // Different image categories based on property characteristics
  const categories = [
    '1484154218962-a197022b5858', // Modern apartment
    '1560448204-e17f4183e44f',    // Apartment building
    '1545324418-cc1a3fa10c05',    // Apartment complex
    '1570129477492-45afcdf9a2f1', // Apartment exterior
    '156401379977-0e6fd653f5f2'   // Apartment interior
  ];
  
  // Select category based on property ID hash
  const categoryIndex = parseInt(seed, 16) % categories.length;
  const category = categories[categoryIndex];
  
  return `${baseUrl}${category}?w=${width}&h=${height}&fit=crop&q=80&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D`;
}

const router = Router();

// Validation schemas
const listingFiltersSchema = z.object({
  minPrice: z.string().transform(Number).optional(),
  maxPrice: z.string().transform(Number).optional(),
  beds: z.string().transform(Number).optional(),
  baths: z.string().transform(Number).optional(),
  intlFriendly: z.string().transform(val => val === 'true').optional(),
});

// Get all listings with filters
router.get('/', async (req, res, next) => {
  try {
    const filters = listingFiltersSchema.parse(req.query);

    const { data: properties, error: propertiesError } = await supabase
      .from('apartment_properties_listings')
      .select('*')
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    if (!properties || properties.length === 0) {
      return res.json([]);
    }

    // Get property IDs
    const propertyIds = properties.map(p => p.id);

    // Get apartment units for these properties (include all units, not just available)
    const { data: units, error: unitsError } = await supabase
      .from('apartment_units')
      .select('*')
      .in('property_id', propertyIds);

    if (unitsError) {
      throw unitsError;
    }

    // Group units by property and create listings
    const unitsByProperty = new Map();
    (units || []).forEach(unit => {
      if (!unitsByProperty.has(unit.property_id)) {
        unitsByProperty.set(unit.property_id, []);
      }
      unitsByProperty.get(unit.property_id).push(unit);
    });

    // Create listings with unit data - include ALL properties
    const listings = properties.map(property => {
      const propertyUnits = unitsByProperty.get(property.id) || [];

      // Calculate price range from units (include all units for display)
      const prices = propertyUnits.map((u: any) => [u.rent_min, u.rent_max]).flat().filter((p: any) => p > 0);
      const minPrice = prices.length > 0 ? Math.min(...prices) : 0;
      const maxPrice = prices.length > 0 ? Math.max(...prices) : 0;

      // Calculate beds/baths range (include all units for display)
      const beds = propertyUnits.map((u: any) => u.beds).filter((b: any) => b > 0);
      const baths = propertyUnits.map((u: any) => u.baths).filter((b: any) => b > 0);
      const maxBeds = beds.length > 0 ? Math.max(...beds) : 0;
      const maxBaths = baths.length > 0 ? Math.max(...baths) : 0;

      // Count available units separately
      const availableUnits = propertyUnits.filter((u: any) => u.availability_status === 'available');

      // Calculate distance to nearest VT campus if coordinates are available
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
        price: minPrice, // Use minimum price for display
        address: property.address || '',
        beds: maxBeds,
        baths: maxBaths,
        intlFriendly: property.intl_friendly || false,
        imageUrl: property.thumbnail_url || (Array.isArray(property.photos) && property.photos.length > 0 ? property.photos[0] : null),
        description: property.description || `Apartment complex in ${property.city}, ${property.state}`,
        amenities: Array.isArray(property.amenities) ? property.amenities : (typeof property.amenities === 'object' ? Object.keys(property.amenities) : []),
        contactEmail: property.email || undefined,
        contactPhone: property.phone_number || undefined,
        createdAt: property.created_at,
        updatedAt: property.updated_at,
        // Include coordinates for map
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

    // Get apartment units for this property (include all units)
    const { data: units, error: unitsError } = await supabase
      .from('apartment_units')
      .select('*')
      .eq('property_id', id);

    if (unitsError) {
      throw unitsError;
    }

    // Calculate aggregated data
    const propertyUnits = units || [];
    const prices = propertyUnits.map((u: any) => [u.rent_min, u.rent_max]).flat().filter((p: any) => p > 0);
    const minPrice = prices.length > 0 ? Math.min(...prices) : 0;
    const maxPrice = prices.length > 0 ? Math.max(...prices) : 0;

    const beds = propertyUnits.map((u: any) => u.beds).filter((b: any) => b > 0);
    const baths = propertyUnits.map((u: any) => u.baths).filter((b: any) => b > 0);
    const maxBeds = beds.length > 0 ? Math.max(...beds) : 0;
    const maxBaths = baths.length > 0 ? Math.max(...baths) : 0;

    // Count available units separately
    const availableUnits = propertyUnits.filter((u: any) => u.availability_status === 'available');

    // Calculate distance to nearest VT campus if coordinates are available
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
      imageUrl: property.thumbnail_url || (Array.isArray(property.photos) && property.photos.length > 0 ? property.photos[0] : null),
      description: property.description || `Apartment complex in ${property.city}, ${property.state}`,
      amenities: Array.isArray(property.amenities) ? property.amenities : (typeof property.amenities === 'object' ? Object.keys(property.amenities) : []),
      contactEmail: property.email || undefined,
      contactPhone: property.phone_number || undefined,
      createdAt: property.created_at,
      updatedAt: property.updated_at,
      latitude: property.latitude || null,
      longitude: property.longitude || null,
      city: property.city || '',
      state: property.state || '',
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