// server/src/routes/listings.ts - UPDATED VERSION
import { Router } from 'express';
import { z } from 'zod';
import { supabase } from '../lib/supabase';
import { calculateNearestCampus, calculateAllCampusDistances } from '../utils/distance';
import { authenticateToken, AuthRequest } from '../middleware/auth';

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

const createListingSchema = z.object({
  name: z.string().min(1, 'Property name is required'),
  address: z.string().min(1, 'Address is required'),
  city: z.string().min(1, 'City is required'),
  state: z.string().min(2, 'State is required').max(2, 'State must be 2 characters'),
  zip_code: z.string().optional(),
  description: z.string().optional(),
  latitude: z.union([z.number(), z.null()]).optional().transform(val => val === null ? undefined : val),
  longitude: z.union([z.number(), z.null()]).optional().transform(val => val === null ? undefined : val),
  website_url: z.string().url().optional(),
  intl_friendly: z.boolean().default(false),
  photos: z.array(z.string().url()).optional(),
  amenities: z.array(z.string()).optional(),
  thumbnail_url: z.string().url().optional().nullable(),
  year_built: z.union([z.number(), z.null()]).optional().transform(val => val === null ? undefined : val),
  total_units: z.number().optional(),
  listing_type: z.enum(['whole_apartment', 'private_room', 'shared_room']).optional(),
  pet_friendly: z.boolean().optional(),
  utilities_included: z.boolean().optional(),
  lease_term_months: z.union([z.number(), z.null()]).optional().transform(val => val === null ? undefined : val),
  move_in_date: z.string().optional(),
  parking_available: z.boolean().optional(),
  furnished: z.boolean().optional(),
  security_deposit: z.union([z.number(), z.null()]).optional().transform(val => val === null ? undefined : val),
  application_fee: z.union([z.number(), z.null()]).optional().transform(val => val === null ? undefined : val),
  // Unit information (at least one unit required)
  units: z.array(z.object({
    beds: z.number().min(0),
    baths: z.number().min(0),
    rent_min: z.union([z.number().min(0), z.null()]).optional().transform(val => val === null ? undefined : val),
    rent_max: z.union([z.number().min(0), z.null()]).optional().transform(val => val === null ? undefined : val),
    availability_status: z.string().default('available'),
    square_feet: z.union([z.number(), z.null()]).optional().transform(val => val === null ? undefined : val),
    unit_number: z.string().optional(),
  })).min(1, 'At least one unit is required'),
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

    // Fetch properties with error handling
    let properties: any[] = [];
    try {
      const { data: propertiesData, error: propertiesError } = await supabase
        .from('apartment_properties_listings')
        .select('*')
        .eq('is_active', true)
        .order(orderColumn, { ascending });

      if (propertiesError) {
        console.error('Error fetching properties:', propertiesError);
        // If it's a schema error (column doesn't exist), try without ordering
        if (propertiesError.message?.includes('column') || propertiesError.message?.includes('does not exist')) {
          console.warn('Schema error with ordering, trying without order:', propertiesError.message);
          const { data: propertiesDataNoOrder, error: propertiesErrorNoOrder } = await supabase
            .from('apartment_properties_listings')
            .select('*')
            .eq('is_active', true);

          if (propertiesErrorNoOrder) {
            throw propertiesErrorNoOrder;
          }
          properties = propertiesDataNoOrder || [];
        } else {
          throw propertiesError;
        }
      } else {
        properties = propertiesData || [];
      }
    } catch (fetchError) {
      console.error('Error in properties fetch:', fetchError);
      throw fetchError;
    }

    // Handle empty properties array
    if (!properties || properties.length === 0) {
      return res.json([]);
    }

    // Filter to only show user-posted listings (VT Community listings)
    // These are listings that have owner metadata in description: [OWNER_ID:userId]
    // OR have a created_by column set
    const userPostedListings = properties.filter(property => {
      // Check if description contains owner metadata
      const hasOwnerMetadata = property.description &&
        /\[OWNER_ID:[^\]]+\]/.test(property.description);

      // Check if created_by column exists and is set
      const hasCreatedBy = property.created_by !== null && property.created_by !== undefined;

      return hasOwnerMetadata || hasCreatedBy;
    });

    if (userPostedListings.length === 0) {
      return res.json([]);
    }

    // Get property IDs for user-posted listings only
    const propertyIds = userPostedListings.map(p => p.id);

    // Get apartment units for these properties
    // Handle case where propertyIds is empty or units don't exist
    let units: any[] = [];
    if (propertyIds.length > 0) {
      const { data: unitsData, error: unitsError } = await supabase
        .from('apartment_units')
        .select('*')
        .in('property_id', propertyIds);

      // Don't fail if units table doesn't exist or query fails
      // Properties can exist without units
      if (unitsError) {
        console.warn('Error fetching units (non-critical):', unitsError.message);
        // Continue with empty units array
      } else {
        units = unitsData || [];
      }
    }

    // Group units by property
    const unitsByProperty = new Map();
    (units || []).forEach(unit => {
      if (!unitsByProperty.has(unit.property_id)) {
        unitsByProperty.set(unit.property_id, []);
      }
      unitsByProperty.get(unit.property_id).push(unit);
    });

    // Create listings with unit data (only for user-posted listings)
    const listings = userPostedListings.map(property => {
      const propertyUnits = unitsByProperty.get(property.id) || [];

      // Parse photos JSON string - THIS IS THE KEY FIX
      let photosArray = parseJSONField(property.photos) || [];

      // If photos not in database columns, try to extract from description metadata
      if (photosArray.length === 0 && property.description) {
        // Look for "Photos: url1, url2, url3" pattern in description
        const photosMatch = property.description.match(/Photos:\s*([^\n]+)/i);
        if (photosMatch && photosMatch[1]) {
          photosArray = photosMatch[1].split(',').map((url: string) => url.trim()).filter((url: string) => url.length > 0);
        }
      }

      const amenitiesData = parseJSONField(property.amenities) || {};

      // Calculate price range from units (handle empty units gracefully)
      const prices = propertyUnits.length > 0
        ? propertyUnits.map((u: any) => [u.rent_min || 0, u.rent_max || 0]).flat().filter((p: any) => p > 0)
        : [];
      const minPrice = prices.length > 0 ? Math.min(...prices) : 0;
      const maxPrice = prices.length > 0 ? Math.max(...prices) : 0;

      // Calculate beds/baths range (handle empty units gracefully)
      const beds = propertyUnits.length > 0
        ? propertyUnits.map((u: any) => u.beds || 0).filter((b: any) => b > 0)
        : [];
      const baths = propertyUnits.length > 0
        ? propertyUnits.map((u: any) => u.baths || 0).filter((b: any) => b > 0)
        : [];
      const maxBeds = beds.length > 0 ? Math.max(...beds) : 0;
      const maxBaths = baths.length > 0 ? Math.max(...baths) : 0;

      // Count available units (handle empty units gracefully)
      const availableUnits = propertyUnits.length > 0
        ? propertyUnits.filter((u: any) => {
          const status = String(u.availability_status || '').toLowerCase();
          return status.includes('available') || status === 'vacant' || status === 'ready';
        })
        : [];

      // Calculate distance to nearest campus if coordinates available
      let distanceInfo = null;
      if (property.latitude && property.longitude) {
        try {
          const nearestCampus = calculateNearestCampus(property.latitude, property.longitude);
          const allDistances = calculateAllCampusDistances(property.latitude, property.longitude);
          distanceInfo = {
            nearest: nearestCampus,
            all: allDistances
          };
        } catch (distanceError) {
          // Don't fail if distance calculation fails - just skip it
          console.warn('Error calculating distance (non-critical):', distanceError);
        }
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
        // Clean description by removing owner metadata for display
        description: (property.description || `Apartment complex in ${property.city}, ${property.state}`)
          .replace(/\[OWNER_ID:[^\]]+\]\n?/g, '').trim() || `Apartment complex in ${property.city}, ${property.state}`,
        // Keep raw description for ownership checks (contains [OWNER_ID:userId] metadata)
        _rawDescription: property.description || '',
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
    console.error('Error in GET /listings:', error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        message: 'Invalid filters',
        errors: error.errors,
      });
    }
    // Return 500 with error details for debugging
    return res.status(500).json({
      message: 'Internal server error',
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    });
  }
});

// Get listing by ID
router.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;

    // Get property from Supabase
    // Note: Don't filter by is_active here - owners should be able to view their inactive listings
    const { data: property, error: propertyError } = await supabase
      .from('apartment_properties_listings')
      .select('*')
      .eq('id', id)
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

// Create a new listing (requires authentication)
router.post('/', authenticateToken, async (req: AuthRequest, res, next) => {
  try {
    const listingData = createListingSchema.parse(req.body);
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    // Build comprehensive description with ALL data (avoids ALL schema issues)
    const descriptionParts: string[] = [];

    if (listingData.description) {
      descriptionParts.push(listingData.description);
    }

    // Add ALL metadata to description (safe, no schema issues)
    const metadata: string[] = [];
    if (listingData.zip_code) metadata.push(`ZIP: ${listingData.zip_code}`);
    if (listingData.listing_type) metadata.push(`Type: ${listingData.listing_type.replace('_', ' ')}`);
    if (listingData.year_built) metadata.push(`Year Built: ${listingData.year_built}`);
    if (listingData.total_units) metadata.push(`Total Units: ${listingData.total_units}`);
    if (listingData.intl_friendly) metadata.push('International Student Friendly');
    if (listingData.pet_friendly) metadata.push('Pet Friendly');
    if (listingData.utilities_included) metadata.push('Utilities Included');
    if (listingData.lease_term_months) metadata.push(`Lease Term: ${listingData.lease_term_months} months`);
    if (listingData.move_in_date) metadata.push(`Move-in Date: ${listingData.move_in_date}`);
    if (listingData.parking_available) metadata.push('Parking Available');
    if (listingData.furnished) metadata.push('Furnished');
    if (listingData.security_deposit) metadata.push(`Security Deposit: $${listingData.security_deposit}`);
    if (listingData.application_fee) metadata.push(`Application Fee: $${listingData.application_fee}`);
    if (listingData.website_url) metadata.push(`Website: ${listingData.website_url}`);
    if (listingData.amenities && listingData.amenities.length > 0) {
      metadata.push(`Amenities: ${listingData.amenities.join(', ')}`);
    }
    if (listingData.photos && listingData.photos.length > 0) {
      metadata.push(`Photos: ${listingData.photos.join(', ')}`);
    }

    if (metadata.length > 0) {
      descriptionParts.push('\n\nAdditional Information:');
      descriptionParts.push(metadata.join('\n'));
    }

    // ABSOLUTE MINIMAL insert - only columns that MUST exist
    // Everything else goes in description to avoid schema errors
    const propertyData: any = {
      name: listingData.name,
      address: listingData.address,
      city: listingData.city,
      state: listingData.state.toUpperCase(),
      zip_code: listingData.zip_code || '', // Required by DB, use empty string if not provided
      is_active: true,
    };

    // Try to add photos and thumbnail_url if columns exist
    // These are optional, so we'll try to add them but won't fail if columns don't exist
    if (listingData.photos && listingData.photos.length > 0) {
      try {
        // Try to store photos as JSON array
        propertyData.photos = JSON.stringify(listingData.photos);
        // Set thumbnail_url to first photo
        if (listingData.photos[0]) {
          propertyData.thumbnail_url = listingData.photos[0];
        }
      } catch (photoError) {
        console.warn('Could not add photos to propertyData (non-critical):', photoError);
        // Continue without photos in direct columns - they'll be in description
      }
    } else if (listingData.thumbnail_url) {
      try {
        propertyData.thumbnail_url = listingData.thumbnail_url;
      } catch (thumbnailError) {
        console.warn('Could not add thumbnail_url (non-critical):', thumbnailError);
      }
    }

    // Store owner ID in description metadata (for messaging feature)
    // Format: [OWNER_ID:userId] at the start of description
    const ownerMetadata = `[OWNER_ID:${userId}]\n`;

    // Add description with all the data (always include description, even if empty)
    const baseDescription = descriptionParts.length > 0
      ? descriptionParts.join('')
      : 'No description provided.';

    propertyData.description = ownerMetadata + baseDescription;

    // Simple insert - if this fails, it's a real error (not a schema issue)
    // We'll try with photos/thumbnail first, and if it fails due to missing columns, retry without them
    let property: any = null;
    let propertyError: any = null;

    const { data: propertyWithPhotos, error: errorWithPhotos } = await supabase
      .from('apartment_properties_listings')
      .insert(propertyData)
      .select()
      .single();

    // If error is due to missing photos/thumbnail columns, retry without them
    if (errorWithPhotos && (errorWithPhotos.message?.includes('photos') || errorWithPhotos.message?.includes('thumbnail_url') || errorWithPhotos.message?.includes('does not exist'))) {
      console.log('⚠️ Photos/thumbnail columns not found, retrying without them');
      const propertyDataWithoutPhotos = { ...propertyData };
      delete propertyDataWithoutPhotos.photos;
      delete propertyDataWithoutPhotos.thumbnail_url;

      const { data: propertyWithoutPhotos, error: errorWithoutPhotos } = await supabase
        .from('apartment_properties_listings')
        .insert(propertyDataWithoutPhotos)
        .select()
        .single();

      property = propertyWithoutPhotos;
      propertyError = errorWithoutPhotos;
    } else {
      property = propertyWithPhotos;
      propertyError = errorWithPhotos;
    }

    if (propertyError) {
      console.error('Error creating property:', propertyError);

      // Note: Duplicate constraint should be removed from database
      // If constraint still exists, it will throw an error here
      // Run migration: remove_duplicate_constraint.sql to drop the constraint

      // Temporarily allow the error to pass through until constraint is removed
      // After removing constraint, this error won't occur

      return res.status(400).json({
        message: 'Failed to create property listing',
        error: propertyError.message
      });
    }

    // If photos weren't stored in columns, they're still in the description metadata
    // The GET endpoint will parse them from description if needed

    // Insert units for this property - MINIMAL insert (only required fields)
    // Store unit metadata (square_feet, unit_number) in property description since those columns may not exist
    const unitsMetadata: string[] = [];
    listingData.units.forEach((unit, index) => {
      const unitInfo: string[] = [];
      if (unit.square_feet) {
        unitInfo.push(`${unit.square_feet} sq ft`);
      }
      if (unit.unit_number) {
        unitInfo.push(`Unit #${unit.unit_number}`);
      }
      if (unitInfo.length > 0) {
        unitsMetadata.push(`Unit ${index + 1}: ${unitInfo.join(', ')}`);
      }
    });

    // Update property description with unit metadata if we have any
    if (unitsMetadata.length > 0) {
      const currentDescription = property.description || '';
      const updatedDescription = currentDescription + '\n\nUnit Details:\n' + unitsMetadata.join('\n');

      // Try to update the property with this additional info (non-critical if it fails)
      try {
        const { error: updateError } = await supabase
          .from('apartment_properties_listings')
          .update({ description: updatedDescription })
          .eq('id', property.id);

        if (!updateError) {
          property.description = updatedDescription;
        }
      } catch (e) {
        // Ignore - description update is non-critical
        console.log('Could not update description with unit metadata (non-critical):', e);
      }
    }

    // Only include fields that definitely exist in the schema
    const unitsData = listingData.units.map(unit => {
      // Start with absolute minimum required fields
      const unitData: any = {
        property_id: property.id,
        beds: unit.beds || 0,
        baths: unit.baths || 0,
      };

      // Only add optional fields if they're provided (don't add null values)
      // This avoids schema errors for columns that don't exist
      if (unit.rent_min !== undefined && unit.rent_min !== null && unit.rent_min > 0) {
        unitData.rent_min = unit.rent_min;
      }
      if (unit.rent_max !== undefined && unit.rent_max !== null && unit.rent_max > 0) {
        unitData.rent_max = unit.rent_max;
      }
      if (unit.availability_status) {
        unitData.availability_status = unit.availability_status;
      }
      // DO NOT add: square_feet, unit_number - these columns may not exist
      // We stored this info in property description above

      return unitData;
    });

    // Try to insert units - if it fails, we'll handle it gracefully
    let units: any[] = [];
    let unitsError: any = null;

    try {
      const result = await supabase
        .from('apartment_units')
        .insert(unitsData)
        .select();

      units = result.data || [];
      unitsError = result.error;
    } catch (error: any) {
      unitsError = error;
    }

    // If units insertion fails, log it but don't fail the entire request
    // The property is already created, so we can still return success
    // Users can add units later or we can retry
    if (unitsError) {
      console.error('Error creating units (non-critical):', unitsError);
      console.log('Property created successfully, but units failed to insert.');
      console.log('Units data:', JSON.stringify(unitsData, null, 2));
      // Don't delete the property - it's already created
      // Just log the error and continue with empty units array
      units = [];
    }

    // Return the created listing in the same format as GET endpoints
    const photosArray = listingData.photos || [];
    const amenitiesData = listingData.amenities || [];

    // Calculate price range from units (use original data if units insert failed)
    const unitsToUse = units.length > 0 ? units : listingData.units;
    const prices = unitsToUse.map((u: any) => {
      const rentMin = u.rent_min || u.rentMin || 0;
      const rentMax = u.rent_max || u.rentMax || 0;
      return [rentMin, rentMax];
    }).flat().filter((p: any) => p > 0);
    const minPrice = prices.length > 0 ? Math.min(...prices) : 0;
    const maxPrice = prices.length > 0 ? Math.max(...prices) : 0;

    // Calculate beds/baths range
    const beds = unitsToUse.map((u: any) => u.beds || 0).filter((b: any) => b > 0);
    const baths = unitsToUse.map((u: any) => u.baths || 0).filter((b: any) => b > 0);
    const maxBeds = beds.length > 0 ? Math.max(...beds) : 0;
    const maxBaths = baths.length > 0 ? Math.max(...baths) : 0;

    // Count available units
    const availableUnits = unitsToUse.filter((u: any) => {
      const status = String(u.availability_status || u.availabilityStatus || '').toLowerCase();
      return status.includes('available') || status === 'vacant' || status === 'ready';
    });

    // Calculate distance info if coordinates available
    let distanceInfo = null;
    if (property.latitude && property.longitude) {
      const nearestCampus = calculateNearestCampus(property.latitude, property.longitude);
      const allDistances = calculateAllCampusDistances(property.latitude, property.longitude);
      distanceInfo = {
        nearest: nearestCampus,
        all: allDistances
      };
    }

    // Format units for response (use original data if DB insert failed)
    const formattedUnits = unitsToUse.map((u: any) => ({
      id: u.id || null,
      beds: u.beds || 0,
      baths: u.baths || 0,
      rent_min: u.rent_min || u.rentMin || null,
      rent_max: u.rent_max || u.rentMax || null,
      availability_status: u.availability_status || u.availabilityStatus || 'available',
      square_feet: u.square_feet || u.squareFeet || null,
      unit_number: u.unit_number || u.unitNumber || null,
      photos: u.photos || [],
    }));

    const formattedListing = {
      id: property.id,
      title: property.name,
      price: minPrice,
      address: property.address,
      beds: maxBeds,
      baths: maxBaths,
      intlFriendly: listingData.intl_friendly || false,
      imageUrl: property.thumbnail_url || (photosArray.length > 0 ? photosArray[0] : null),
      photos: photosArray,
      description: property.description || `Apartment complex in ${property.city}, ${property.state}`,
      amenities: amenitiesData,
      createdAt: property.created_at,
      updatedAt: property.updated_at,
      latitude: property.latitude || null,
      longitude: property.longitude || null,
      city: property.city || '',
      state: property.state || '',
      _units: formattedUnits,
      _availableUnits: availableUnits,
      _priceRange: { min: minPrice, max: maxPrice },
      _unitCount: formattedUnits.length,
      _availableUnitCount: availableUnits.length,
      distanceFromCampus: distanceInfo?.nearest.distance || null,
      nearestCampus: distanceInfo?.nearest.campus || null,
      allCampusDistances: distanceInfo?.all || null
    };

    res.status(201).json({
      message: 'Listing created successfully',
      listing: formattedListing
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        message: 'Validation error',
        errors: error.errors,
      });
    }
    next(error);
  }
});

// Upload photo for listing
router.post('/upload-photo', authenticateToken, async (req: AuthRequest, res, next) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    const { fileData, fileName, fileType } = req.body;

    if (!fileData || !fileName) {
      return res.status(400).json({ error: 'File data and name are required' });
    }

    // Validate file type (images only)
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];
    if (fileType && !allowedTypes.includes(fileType)) {
      return res.status(400).json({ error: 'Only image files are allowed' });
    }

    // Convert base64 to buffer
    const base64Data = fileData.replace(/^data:image\/\w+;base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');

    // Validate file size (10MB limit)
    if (buffer.length > 10 * 1024 * 1024) {
      return res.status(400).json({ error: 'File size exceeds 10MB limit' });
    }

    // Upload to Supabase Storage
    const timestamp = Date.now();
    const sanitizedFileName = fileName.replace(/[^a-zA-Z0-9.-]/g, '_');
    const filePath = `listing-photos/${userId}/${timestamp}-${sanitizedFileName}`;
    const bucketName = 'listing-photos';

    // Try to create bucket if it doesn't exist (will fail silently if it exists)
    try {
      const { data: buckets } = await supabase.storage.listBuckets();
      const bucketExists = buckets?.some(b => b.name === bucketName);

      if (!bucketExists) {
        const { error: createError } = await supabase.storage.createBucket(bucketName, {
          public: true,
          fileSizeLimit: 10485760, // 10MB
          allowedMimeTypes: ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif']
        });

        if (createError && !createError.message.includes('already exists')) {
          console.error('Error creating bucket:', createError);
          // Continue anyway - might be a permissions issue
        }
      }
    } catch (bucketCheckError) {
      console.warn('Could not check/create bucket, proceeding with upload:', bucketCheckError);
      // Continue with upload attempt
    }

    const { data, error } = await supabase.storage
      .from(bucketName)
      .upload(filePath, buffer, {
        contentType: fileType || 'image/jpeg',
        upsert: false
      });

    if (error) {
      console.error('Supabase storage error:', error);

      // Provide helpful error message if bucket doesn't exist
      if (error.message.includes('Bucket not found') || error.message.includes('does not exist')) {
        return res.status(500).json({
          error: `Storage bucket '${bucketName}' not found. Please create it in Supabase Dashboard: Storage > New Bucket > Name: ${bucketName}, Public: true`
        });
      }

      return res.status(500).json({ error: `Failed to upload file: ${error.message}` });
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from('listing-photos')
      .getPublicUrl(filePath);

    res.json({
      success: true,
      url: urlData.publicUrl,
      message: 'Photo uploaded successfully'
    });
  } catch (error: any) {
    console.error('Error uploading photo:', error);
    next(error);
  }
});

// Delete a listing (requires authentication and ownership)
router.delete('/:id', authenticateToken, async (req: AuthRequest, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;

    console.log('🗑️ DELETE request received:', { id, userId });

    if (!userId) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    if (!id) {
      return res.status(400).json({ message: 'Listing ID is required' });
    }

    // Fetch the property to check ownership
    // Note: created_by column may not exist, so we'll handle it gracefully
    console.log('🔍 Fetching property with ID:', id);

    let property: any = null;
    let propertyError: any = null;

    // Try to select with created_by first, but handle if column doesn't exist
    const { data: propertyWithCreatedBy, error: errorWithCreatedBy } = await supabase
      .from('apartment_properties_listings')
      .select('id, description, created_by')
      .eq('id', id)
      .single();

    // Check if error is due to missing created_by column
    if (errorWithCreatedBy && (errorWithCreatedBy.message?.includes('created_by') || errorWithCreatedBy.message?.includes('does not exist'))) {
      console.log('⚠️ created_by column not found, fetching without it');
      // Try again without created_by
      const { data: propertyWithoutCreatedBy, error: errorWithoutCreatedBy } = await supabase
        .from('apartment_properties_listings')
        .select('id, description')
        .eq('id', id)
        .single();

      property = propertyWithoutCreatedBy;
      propertyError = errorWithoutCreatedBy;
    } else {
      property = propertyWithCreatedBy;
      propertyError = errorWithCreatedBy;
    }

    console.log('📊 Property query result:', {
      hasProperty: !!property,
      propertyError: propertyError?.message,
      propertyId: property?.id,
      hasCreatedBy: property?.created_by !== undefined
    });

    if (propertyError) {
      console.error('❌ Property fetch error:', propertyError);
      // Check if it's a "not found" error
      if (propertyError.code === 'PGRST116' || propertyError.message?.includes('No rows')) {
        return res.status(404).json({
          message: 'Listing not found',
          error: propertyError.message,
          code: propertyError.code
        });
      }
      return res.status(500).json({
        message: 'Failed to fetch listing',
        error: propertyError.message
      });
    }

    if (!property) {
      console.log('❌ Property not found for ID:', id);
      return res.status(404).json({ message: 'Listing not found' });
    }

    // Check ownership - either via created_by column or owner metadata in description
    let isOwner = false;

    console.log('🔍 Checking ownership:', {
      userId,
      propertyId: id,
      hasCreatedBy: !!property.created_by,
      createdBy: property.created_by,
      hasDescription: !!property.description,
      descriptionPreview: property.description?.substring(0, 100)
    });

    // Check created_by column if it exists
    if (property.created_by && property.created_by.toString() === userId.toString()) {
      isOwner = true;
      console.log('✅ Ownership confirmed via created_by column');
    }

    // Check owner metadata in description: [OWNER_ID:userId]
    if (!isOwner && property.description) {
      const ownerIdMatch = property.description.match(/\[OWNER_ID:([^\]]+)\]/);
      if (ownerIdMatch) {
        console.log('🔍 Found owner metadata:', ownerIdMatch[1], 'vs userId:', userId);
        if (ownerIdMatch[1] === userId.toString()) {
          isOwner = true;
          console.log('✅ Ownership confirmed via description metadata');
        }
      }
    }

    if (!isOwner) {
      console.log('❌ Ownership check failed');
      return res.status(403).json({
        message: 'You can only delete your own listings',
        error: 'Ownership verification failed'
      });
    }

    console.log('✅ Ownership verified, proceeding with deletion');

    // Delete associated units first (if they exist)
    try {
      const { error: unitsError } = await supabase
        .from('apartment_units')
        .delete()
        .eq('property_id', id);

      // Log but don't fail if units don't exist
      if (unitsError && !unitsError.message.includes('does not exist')) {
        console.warn('Error deleting units (non-critical):', unitsError);
      }
    } catch (unitsDeleteError) {
      console.warn('Error deleting units (non-critical):', unitsDeleteError);
    }

    // Delete the property
    const { error: deleteError } = await supabase
      .from('apartment_properties_listings')
      .delete()
      .eq('id', id);

    if (deleteError) {
      console.error('Error deleting listing:', deleteError);
      return res.status(500).json({ message: 'Failed to delete listing', error: deleteError.message });
    }

    res.json({ message: 'Listing deleted successfully' });
  } catch (error) {
    console.error('Error in DELETE /listings/:id:', error);
    next(error);
  }
});

// Update a listing (requires authentication and ownership)
router.put('/:id', authenticateToken, async (req: AuthRequest, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;
    const listingData = createListingSchema.parse(req.body);

    console.log('✏️ UPDATE request received:', { id, userId });

    if (!userId) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    if (!id) {
      return res.status(400).json({ message: 'Listing ID is required' });
    }

    // Fetch the property to check ownership
    console.log('🔍 Fetching property with ID for update:', id);

    let property: any = null;
    let propertyError: any = null;

    // Try to select with created_by first, but handle if column doesn't exist
    const { data: propertyWithCreatedBy, error: errorWithCreatedBy } = await supabase
      .from('apartment_properties_listings')
      .select('id, description, created_by')
      .eq('id', id)
      .single();

    // Check if error is due to missing created_by column
    if (errorWithCreatedBy && (errorWithCreatedBy.message?.includes('created_by') || errorWithCreatedBy.message?.includes('does not exist'))) {
      console.log('⚠️ created_by column not found, fetching without it');
      // Try again without created_by
      const { data: propertyWithoutCreatedBy, error: errorWithoutCreatedBy } = await supabase
        .from('apartment_properties_listings')
        .select('id, description')
        .eq('id', id)
        .single();

      property = propertyWithoutCreatedBy;
      propertyError = errorWithoutCreatedBy;
    } else {
      property = propertyWithCreatedBy;
      propertyError = errorWithCreatedBy;
    }

    if (propertyError) {
      console.error('❌ Property fetch error:', propertyError);
      if (propertyError.code === 'PGRST116' || propertyError.message?.includes('No rows')) {
        return res.status(404).json({
          message: 'Listing not found',
          error: propertyError.message,
          code: propertyError.code
        });
      }
      return res.status(500).json({
        message: 'Failed to fetch listing',
        error: propertyError.message
      });
    }

    if (!property) {
      console.log('❌ Property not found for ID:', id);
      return res.status(404).json({ message: 'Listing not found' });
    }

    // Check ownership - either via created_by column or owner metadata in description
    let isOwner = false;

    console.log('🔍 Checking ownership for update:', {
      userId,
      propertyId: id,
      hasCreatedBy: property?.created_by !== undefined,
      createdBy: property?.created_by,
      hasDescription: !!property?.description,
      descriptionPreview: property?.description?.substring(0, 100)
    });

    // Check created_by column if it exists
    if (property.created_by && property.created_by.toString() === userId.toString()) {
      isOwner = true;
      console.log('✅ Ownership confirmed via created_by column');
    }

    // Check owner metadata in description: [OWNER_ID:userId]
    if (!isOwner && property.description) {
      const ownerIdMatch = property.description.match(/\[OWNER_ID:([^\]]+)\]/);
      if (ownerIdMatch) {
        console.log('🔍 Found owner metadata:', ownerIdMatch[1], 'vs userId:', userId);
        if (ownerIdMatch[1] === userId.toString()) {
          isOwner = true;
          console.log('✅ Ownership confirmed via description metadata');
        }
      }
    }

    if (!isOwner) {
      console.log('❌ Ownership check failed for update');
      return res.status(403).json({
        message: 'You can only update your own listings',
        error: 'Ownership verification failed'
      });
    }

    console.log('✅ Ownership verified, proceeding with update');

    // Build updated property data (same structure as create)
    const descriptionParts: string[] = [];

    if (listingData.description) {
      descriptionParts.push(listingData.description);
    }

    // Add ALL metadata to description (safe, no schema issues)
    const metadata: string[] = [];
    if (listingData.zip_code) metadata.push(`ZIP: ${listingData.zip_code}`);
    if (listingData.listing_type) metadata.push(`Type: ${listingData.listing_type.replace('_', ' ')}`);
    if (listingData.year_built) metadata.push(`Year Built: ${listingData.year_built}`);
    if (listingData.total_units) metadata.push(`Total Units: ${listingData.total_units}`);
    if (listingData.intl_friendly) metadata.push('International Student Friendly');
    if (listingData.pet_friendly) metadata.push('Pet Friendly');
    if (listingData.utilities_included) metadata.push('Utilities Included');
    if (listingData.lease_term_months) metadata.push(`Lease Term: ${listingData.lease_term_months} months`);
    if (listingData.move_in_date) metadata.push(`Move-in Date: ${listingData.move_in_date}`);
    if (listingData.parking_available) metadata.push('Parking Available');
    if (listingData.furnished) metadata.push('Furnished');
    if (listingData.security_deposit) metadata.push(`Security Deposit: $${listingData.security_deposit}`);
    if (listingData.application_fee) metadata.push(`Application Fee: $${listingData.application_fee}`);
    if (listingData.website_url) metadata.push(`Website: ${listingData.website_url}`);
    if (listingData.amenities && listingData.amenities.length > 0) {
      metadata.push(`Amenities: ${listingData.amenities.join(', ')}`);
    }
    if (listingData.photos && listingData.photos.length > 0) {
      metadata.push(`Photos: ${listingData.photos.join(', ')}`);
    }

    if (metadata.length > 0) {
      descriptionParts.push('\n\nAdditional Information:');
      descriptionParts.push(metadata.join('\n'));
    }

    // Build update data
    const updateData: any = {
      name: listingData.name,
      address: listingData.address,
      city: listingData.city,
      state: listingData.state.toUpperCase(),
      zip_code: listingData.zip_code || '',
    };

    // Try to add photos and thumbnail_url if columns exist
    if (listingData.photos && listingData.photos.length > 0) {
      try {
        updateData.photos = JSON.stringify(listingData.photos);
        if (listingData.photos[0]) {
          updateData.thumbnail_url = listingData.photos[0];
        }
      } catch (photoError) {
        console.warn('Could not add photos to updateData (non-critical):', photoError);
      }
    } else if (listingData.thumbnail_url) {
      try {
        updateData.thumbnail_url = listingData.thumbnail_url;
      } catch (thumbnailError) {
        console.warn('Could not add thumbnail_url (non-critical):', thumbnailError);
      }
    }

    // Preserve owner metadata in description
    const ownerMetadata = `[OWNER_ID:${userId}]\n`;
    const baseDescription = descriptionParts.length > 0
      ? descriptionParts.join('')
      : 'No description provided.';

    updateData.description = ownerMetadata + baseDescription;

    // Try to update with photos/thumbnail first, fallback if columns don't exist
    let updatedProperty: any = null;
    let updateError: any = null;

    const { data: propertyWithPhotos, error: errorWithPhotos } = await supabase
      .from('apartment_properties_listings')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    // If error is due to missing photos/thumbnail columns, retry without them
    if (errorWithPhotos && (errorWithPhotos.message?.includes('photos') || errorWithPhotos.message?.includes('thumbnail_url') || errorWithPhotos.message?.includes('does not exist'))) {
      console.log('⚠️ Photos/thumbnail columns not found, retrying without them');
      const updateDataWithoutPhotos = { ...updateData };
      delete updateDataWithoutPhotos.photos;
      delete updateDataWithoutPhotos.thumbnail_url;

      const { data: propertyWithoutPhotos, error: errorWithoutPhotos } = await supabase
        .from('apartment_properties_listings')
        .update(updateDataWithoutPhotos)
        .eq('id', id)
        .select()
        .single();

      updatedProperty = propertyWithoutPhotos;
      updateError = errorWithoutPhotos;
    } else {
      updatedProperty = propertyWithPhotos;
      updateError = errorWithPhotos;
    }

    if (updateError) {
      console.error('Error updating property:', updateError);
      return res.status(400).json({
        message: 'Failed to update property listing',
        error: updateError.message
      });
    }

    // Update units - delete existing units and insert new ones
    try {
      // Delete existing units
      const { error: deleteUnitsError } = await supabase
        .from('apartment_units')
        .delete()
        .eq('property_id', id);

      if (deleteUnitsError && !deleteUnitsError.message?.includes('does not exist')) {
        console.warn('Error deleting units (non-critical):', deleteUnitsError);
      }

      // Insert new units
      if (listingData.units && listingData.units.length > 0) {
        const unitsToInsert = listingData.units.map((unit: any) => ({
          property_id: id,
          beds: unit.beds,
          baths: unit.baths,
          rent_min: unit.rent_min || null,
          rent_max: unit.rent_max || null,
          availability_status: unit.availability_status || 'available',
        }));

        const { error: insertUnitsError } = await supabase
          .from('apartment_units')
          .insert(unitsToInsert);

        if (insertUnitsError && !insertUnitsError.message?.includes('does not exist')) {
          console.warn('Error inserting units (non-critical):', insertUnitsError);
        }
      }
    } catch (unitsError) {
      console.warn('Error updating units (non-critical):', unitsError);
    }

    res.json({
      message: 'Listing updated successfully',
      listing: updatedProperty
    });
  } catch (error) {
    console.error('Error in PUT /listings/:id:', error);
    if (error instanceof z.ZodError) {
      console.error('Validation errors:', error.errors);
      return res.status(400).json({
        message: 'Invalid listing data',
        errors: error.errors,
        details: error.errors.map(e => ({
          path: e.path.join('.'),
          message: e.message,
          code: e.code
        }))
      });
    }
    next(error);
  }
});

export { router as listingRoutes };