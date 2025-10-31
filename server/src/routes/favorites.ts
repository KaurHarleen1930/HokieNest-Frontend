import { Router, Response, NextFunction } from 'express';
import { supabase } from '../lib/supabase';
import { authenticateToken } from '../middleware/auth';

interface AuthRequest extends Request {
    user?: { id: number };
}

const router = Router();

// Schema provided: apartment_favorites(user_id INT, property_id UUID)
const USER_COL = 'user_id';
const LISTING_COL = 'property_id';

// Get current user's saved properties
router.get('/', authenticateToken as any, async (req: any, res: Response, next: NextFunction) => {
    try {
        const userId = req.user?.id;
        if (!userId) return res.status(401).json({ message: 'Unauthorized' });

        // Fetch current user's favorites
        const { data: favorites, error } = await supabase
            .from('apartment_favorites')
            .select('*')
            .eq(USER_COL, userId)
            .order('created_at', { ascending: false });

        if (error) throw error;

        const listingIds = (favorites || []).map((f: any) => f[LISTING_COL]).filter(Boolean);
        if (listingIds.length === 0) return res.json({ favorites: [] });

        const { data: listings, error: listingsError } = await supabase
            .from('apartment_properties_listings')
            .select('*')
            .in('id', listingIds);

        if (listingsError) throw listingsError;

        // Map to lightweight cards expected by frontend
        const results = (listings || []).map((property: any) => {
            const amenitiesData = typeof property.amenities === 'string' ? JSON.parse(property.amenities || '{}') : property.amenities || {};
            const photosArray = Array.isArray(property.photos) ? property.photos : (typeof property.photos === 'string' ? JSON.parse(property.photos || '[]') : []);
            return {
                id: property.id,
                title: property.name || 'Apartment Complex',
                price: Number(property.min_rent) || 0,
                address: property.address || '',
                beds: Number(property.beds) || 0,
                baths: Number(property.baths) || 0,
                intlFriendly: property.intl_friendly || false,
                imageUrl: property.thumbnail_url || (photosArray.length > 0 ? photosArray[0] : null),
                photos: photosArray,
                description: property.description || undefined,
                amenities: Array.isArray(amenitiesData) ? amenitiesData : Object.keys(amenitiesData || {}),
                createdAt: property.created_at,
                updatedAt: property.updated_at,
                city: property.city || '',
                state: property.state || ''
            };
        });

        res.json({ favorites: results });
    } catch (error) {
        next(error);
    }
});

// Save a property
router.post('/:listingId', authenticateToken as any, async (req: any, res: Response, next: NextFunction) => {
    try {
        const userId = req.user?.id;
        const { listingId } = req.params;
        if (!userId) return res.status(401).json({ message: 'Unauthorized' });
        if (!listingId) return res.status(400).json({ message: 'Missing listingId' });

        const payload: any = { [USER_COL]: userId, [LISTING_COL]: listingId };
        const { error } = await supabase
            .from('apartment_favorites')
            .upsert(payload, { onConflict: `${USER_COL},${LISTING_COL}` });
        if (error) throw error;

        res.json({ success: true, message: 'Saved property' });
    } catch (error) {
        next(error);
    }
});

// Unsave a property
router.delete('/:listingId', authenticateToken as any, async (req: any, res: Response, next: NextFunction) => {
    try {
        const userId = req.user?.id;
        const { listingId } = req.params;
        if (!userId) return res.status(401).json({ message: 'Unauthorized' });
        if (!listingId) return res.status(400).json({ message: 'Missing listingId' });

        const { error } = await supabase
            .from('apartment_favorites')
            .delete()
            .eq(USER_COL, userId)
            .eq(LISTING_COL, listingId);
        if (error) throw error;

        res.json({ success: true, message: 'Removed from saved' });
    } catch (error) {
        next(error);
    }
});

export default router;


