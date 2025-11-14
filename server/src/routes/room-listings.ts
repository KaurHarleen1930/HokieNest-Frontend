// server/src/routes/room-listings.ts
// Routes for individual room/unit listings (separate from property listings)
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

// Validation schema for creating a room listing
const createRoomListingSchema = z.object({
  listing_type: z.enum(['private_room', 'shared_room', 'whole_unit']),
  title: z.string().min(1, 'Title is required'),
  description: z.string().optional(),
  address: z.string().min(1, 'Address is required'),
  city: z.string().min(1, 'City is required'),
  state: z.string().min(2, 'State is required').max(2, 'State must be 2 characters'),
  zip_code: z.string().optional(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  property_id: z.string().uuid().optional().nullable(), // Optional - if set, links to existing property
  beds: z.number().min(0).default(1),
  baths: z.number().min(0).default(1.0),
  square_feet: z.number().optional(),
  rent_amount: z.number().min(0, 'Rent amount is required'),
  security_deposit: z.number().optional(),
  application_fee: z.number().optional(),
  availability_status: z.string().default('available'),
  move_in_date: z.string().optional(),
  lease_term_months: z.number().optional(),
  furnished: z.boolean().optional(),
  pet_friendly: z.boolean().optional(),
  utilities_included: z.boolean().optional(),
  parking_available: z.boolean().optional(),
  intl_friendly: z.boolean().default(false),
  photos: z.array(z.string().url()).optional(),
  amenities: z.array(z.string()).optional(),
  house_rules: z.string().optional(),
  preferred_gender: z.enum(['male', 'female', 'any']).optional(),
  preferred_age_range: z.string().optional(),
  website_url: z.string().url().optional(),
});

// Get all room listings with filters
router.get('/', async (req, res, next) => {
  try {
    const { listing_type, city, state, minRent, maxRent, beds, pet_friendly } = req.query;

    let query = supabase
      .from('room_listings')
      .select('*')
      .eq('is_active', true);

    if (listing_type) {
      query = query.eq('listing_type', listing_type);
    }
    if (city) {
      query = query.eq('city', city);
    }
    if (state) {
      query = query.eq('state', state);
    }
    if (minRent) {
      query = query.gte('rent_amount', Number(minRent));
    }
    if (maxRent) {
      query = query.lte('rent_amount', Number(maxRent));
    }
    if (beds) {
      query = query.eq('beds', Number(beds));
    }
    if (pet_friendly === 'true') {
      query = query.eq('pet_friendly', true);
    }

    const { data: listings, error } = await query.order('created_at', { ascending: false });

    if (error) throw error;

    // Format listings
    const formattedListings = (listings || []).map(listing => ({
      id: listing.id,
      listing_type: listing.listing_type,
      title: listing.title,
      description: listing.description,
      address: listing.address,
      city: listing.city,
      state: listing.state,
      zip_code: listing.zip_code,
      latitude: listing.latitude,
      longitude: listing.longitude,
      property_id: listing.property_id,
      beds: listing.beds,
      baths: listing.baths,
      square_feet: listing.square_feet,
      rent_amount: listing.rent_amount,
      security_deposit: listing.security_deposit,
      application_fee: listing.application_fee,
      availability_status: listing.availability_status,
      move_in_date: listing.move_in_date,
      lease_term_months: listing.lease_term_months,
      furnished: listing.furnished,
      pet_friendly: listing.pet_friendly,
      utilities_included: listing.utilities_included,
      parking_available: listing.parking_available,
      intl_friendly: listing.intl_friendly,
      photos: parseJSONField(listing.photos) || [],
      amenities: parseJSONField(listing.amenities) || [],
      thumbnail_url: listing.thumbnail_url,
      house_rules: listing.house_rules,
      preferred_gender: listing.preferred_gender,
      preferred_age_range: listing.preferred_age_range,
      website_url: listing.website_url,
      created_by: listing.created_by,
      created_at: listing.created_at,
      updated_at: listing.updated_at,
    }));

    res.json(formattedListings);
  } catch (error) {
    next(error);
  }
});

// Get a specific room listing by ID
router.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;

    const { data: listing, error } = await supabase
      .from('room_listings')
      .select('*')
      .eq('id', id)
      .eq('is_active', true)
      .single();

    if (error || !listing) {
      return res.status(404).json({ message: 'Room listing not found' });
    }

    // If linked to a property, get property details
    let property = null;
    if (listing.property_id) {
      const { data: prop } = await supabase
        .from('apartment_properties_listings')
        .select('*')
        .eq('id', listing.property_id)
        .single();
      property = prop;
    }

    // Calculate distance info
    let distanceInfo = null;
    if (listing.latitude && listing.longitude) {
      const nearestCampus = calculateNearestCampus(listing.latitude, listing.longitude);
      const allDistances = calculateAllCampusDistances(listing.latitude, listing.longitude);
      distanceInfo = {
        nearest: nearestCampus,
        all: allDistances
      };
    }

    const formattedListing = {
      ...listing,
      photos: parseJSONField(listing.photos) || [],
      amenities: parseJSONField(listing.amenities) || [],
      property: property,
      distanceFromCampus: distanceInfo?.nearest.distance || null,
      nearestCampus: distanceInfo?.nearest.campus || null,
      allCampusDistances: distanceInfo?.all || null
    };

    res.json(formattedListing);
  } catch (error) {
    next(error);
  }
});

// Create a new room listing (requires authentication)
router.post('/', authenticateToken, async (req: AuthRequest, res, next) => {
  try {
    const listingData = createRoomListingSchema.parse(req.body);
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    // Prepare room listing data
    const roomListingData: any = {
      listing_type: listingData.listing_type,
      title: listingData.title,
      description: listingData.description || null,
      address: listingData.address,
      city: listingData.city,
      state: listingData.state.toUpperCase(),
      zip_code: listingData.zip_code || null,
      latitude: listingData.latitude || null,
      longitude: listingData.longitude || null,
      property_id: listingData.property_id || null,
      beds: listingData.beds,
      baths: listingData.baths,
      square_feet: listingData.square_feet || null,
      rent_amount: listingData.rent_amount,
      security_deposit: listingData.security_deposit || null,
      application_fee: listingData.application_fee || null,
      availability_status: listingData.availability_status,
      move_in_date: listingData.move_in_date || null,
      lease_term_months: listingData.lease_term_months || null,
      furnished: listingData.furnished || false,
      pet_friendly: listingData.pet_friendly || false,
      utilities_included: listingData.utilities_included || false,
      parking_available: listingData.parking_available || false,
      intl_friendly: listingData.intl_friendly,
      photos: listingData.photos && listingData.photos.length > 0 ? JSON.stringify(listingData.photos) : null,
      amenities: listingData.amenities && listingData.amenities.length > 0 ? JSON.stringify(listingData.amenities) : null,
      thumbnail_url: listingData.photos && listingData.photos.length > 0 ? listingData.photos[0] : null,
      house_rules: listingData.house_rules || null,
      preferred_gender: listingData.preferred_gender || null,
      preferred_age_range: listingData.preferred_age_range || null,
      website_url: listingData.website_url || null,
      is_active: true,
    };

    // Handle created_by column gracefully
    let listing;
    let listingError;
    
    let currentData = { ...roomListingData };
    
    // Try with created_by first
    const dataWithCreatedBy = { ...currentData, created_by: userId };
    const { data: dataWith, error: errorWith } = await supabase
      .from('room_listings')
      .insert(dataWithCreatedBy)
      .select()
      .single();

    if (errorWith) {
      const errorMsg = errorWith.message.toLowerCase();
      const isColumnError = errorMsg.includes('schema cache') ||
                            (errorMsg.includes('column') && errorMsg.includes('does not exist')) ||
                            errorMsg.includes('could not find');
      
      if (isColumnError && errorMsg.includes('created_by')) {
        // Retry without created_by
        const { data: dataWithout, error: errorWithout } = await supabase
          .from('room_listings')
          .insert(currentData)
          .select()
          .single();
        listing = dataWithout;
        listingError = errorWithout;
      } else {
        listing = dataWith;
        listingError = errorWith;
      }
    } else {
      listing = dataWith;
      listingError = null;
    }

    if (listingError) {
      // Handle duplicate error
      if (listingError.message.includes('duplicate key') || 
          listingError.message.includes('unique constraint') ||
          listingError.message.includes('ux_room_listings_title_address')) {
        
        let existingListing = null;
        try {
          const { data: existing } = await supabase
            .from('room_listings')
            .select('id, title, address, created_by')
            .eq('title', listingData.title)
            .eq('address', listingData.address)
            .eq('is_active', true)
            .single();
          existingListing = existing;
        } catch (e) {
          // Ignore
        }
        
        return res.status(409).json({
          message: 'A room listing with this title and address already exists',
          error: 'Duplicate listing detected.',
          suggestion: 'Please use a different title or address, or update the existing listing if it belongs to you.',
          existingListingId: existingListing?.id || null,
          isOwner: existingListing?.created_by === userId || false
        });
      }
      
      return res.status(400).json({
        message: 'Failed to create room listing',
        error: listingError.message
      });
    }

    res.status(201).json({
      message: 'Room listing created successfully',
      listing: {
        ...listing,
        photos: parseJSONField(listing.photos) || [],
        amenities: parseJSONField(listing.amenities) || []
      }
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

export default router;


