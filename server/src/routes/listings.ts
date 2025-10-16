import { Router } from 'express';
import { z } from 'zod';
import { supabase } from '../lib/supabase';

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

    // Get apartment properties from Supabase
    const { data: properties, error: propertiesError } = await supabase
      .from('apartment_properties_listings')
      .select('*')
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    if (propertiesError) {
      throw propertiesError;
    }

    if (!properties || properties.length === 0) {
      return res.json([]);
    }

    // Get property IDs
    const propertyIds = properties.map(p => p.id);

    // Get apartment units for these properties
    const { data: units, error: unitsError } = await supabase
      .from('apartment_units')
      .select('*')
      .in('property_id', propertyIds)
      .eq('availability_status', 'available');

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

    // Create listings with unit data
    const listings = properties.map(property => {
      const propertyUnits = unitsByProperty.get(property.id) || [];

      // Calculate price range from units
      const prices = propertyUnits.map(u => [u.rent_min, u.rent_max]).flat().filter(p => p > 0);
      const minPrice = prices.length > 0 ? Math.min(...prices) : 0;
      const maxPrice = prices.length > 0 ? Math.max(...prices) : 0;

      // Calculate beds/baths range
      const beds = propertyUnits.map(u => u.beds).filter(b => b > 0);
      const baths = propertyUnits.map(u => u.baths).filter(b => b > 0);
      const maxBeds = beds.length > 0 ? Math.max(...beds) : 0;
      const maxBaths = baths.length > 0 ? Math.max(...baths) : 0;

      return {
        id: property.id,
        title: property.name || 'Apartment Complex',
        price: minPrice, // Use minimum price for display
        address: property.address || '',
        beds: maxBeds,
        baths: maxBaths,
        intlFriendly: property.intl_friendly || false,
        imageUrl: property.thumbnail_url || (Array.isArray(property.photos) ? property.photos[0] : '') || '',
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
        _priceRange: { min: minPrice, max: maxPrice },
        _unitCount: propertyUnits.length
      };
    });

    // Apply filters
    let filteredListings = listings;

    if (filters.minPrice !== undefined) {
      filteredListings = filteredListings.filter(l => l._priceRange.max >= filters.minPrice);
    }
    if (filters.maxPrice !== undefined) {
      filteredListings = filteredListings.filter(l => l._priceRange.min <= filters.maxPrice);
    }
    if (filters.beds !== undefined) {
      filteredListings = filteredListings.filter(l => l.beds >= filters.beds);
    }
    if (filters.baths !== undefined) {
      filteredListings = filteredListings.filter(l => l.baths >= filters.baths);
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

    // Get apartment units for this property
    const { data: units, error: unitsError } = await supabase
      .from('apartment_units')
      .select('*')
      .eq('property_id', id)
      .eq('availability_status', 'available');

    if (unitsError) {
      throw unitsError;
    }

    // Calculate aggregated data
    const propertyUnits = units || [];
    const prices = propertyUnits.map(u => [u.rent_min, u.rent_max]).flat().filter(p => p > 0);
    const minPrice = prices.length > 0 ? Math.min(...prices) : 0;
    const maxPrice = prices.length > 0 ? Math.max(...prices) : 0;

    const beds = propertyUnits.map(u => u.beds).filter(b => b > 0);
    const baths = propertyUnits.map(u => u.baths).filter(b => b > 0);
    const maxBeds = beds.length > 0 ? Math.max(...beds) : 0;
    const maxBaths = baths.length > 0 ? Math.max(...baths) : 0;

    const formattedListing = {
      id: property.id,
      title: property.name || 'Apartment Complex',
      price: minPrice,
      address: property.address || '',
      beds: maxBeds,
      baths: maxBaths,
      intlFriendly: property.intl_friendly || false,
      imageUrl: property.thumbnail_url || (Array.isArray(property.photos) ? property.photos[0] : '') || '',
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
      _priceRange: { min: minPrice, max: maxPrice },
      _unitCount: propertyUnits.length
    };

    res.json(formattedListing);
  } catch (error) {
    next(error);
  }
});

export { router as listingRoutes };