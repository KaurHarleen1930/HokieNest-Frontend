import { Router } from 'express';
import { z } from 'zod';
import { PrismaClient } from '@prisma/client';

const router = Router();
const prisma = new PrismaClient();

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

    const where: any = {};

    if (filters.minPrice !== undefined) {
      where.price = { ...where.price, gte: filters.minPrice };
    }
    
    if (filters.maxPrice !== undefined) {
      where.price = { ...where.price, lte: filters.maxPrice };
    }

    if (filters.beds !== undefined) {
      where.beds = filters.beds;
    }

    if (filters.baths !== undefined) {
      where.baths = filters.baths;
    }

    if (filters.intlFriendly !== undefined) {
      where.intlFriendly = filters.intlFriendly;
    }

    const listings = await prisma.listing.findMany({
      where,
      orderBy: {
        createdAt: 'desc',
      },
    });

    // Parse amenities JSON strings
    const formattedListings = listings.map(listing => ({
      ...listing,
      amenities: listing.amenities ? JSON.parse(listing.amenities) : [],
    }));

    res.json(formattedListings);
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

    const listing = await prisma.listing.findUnique({
      where: { id },
    });

    if (!listing) {
      return res.status(404).json({ message: 'Listing not found' });
    }

    // Parse amenities JSON string
    const formattedListing = {
      ...listing,
      amenities: listing.amenities ? JSON.parse(listing.amenities) : [],
    };

    res.json(formattedListing);
  } catch (error) {
    next(error);
  }
});

export { router as listingRoutes };