import { Router } from 'express';
import { z } from 'zod';
import { rentCastService } from '../services/rentcast';
import { authenticateToken } from '../middleware/auth';

const router = Router();

// Validation schemas
const addressSchema = z.object({
  address: z.string().min(1, 'Address is required'),
});

const zipCodeSchema = z.object({
  zipCode: z.string().regex(/^\d{5}$/, 'Valid 5-digit zip code required'),
});

/**
 * Get rental estimate for an address
 * This endpoint is protected - API key never exposed to frontend
 */
router.get('/rental-estimate', authenticateToken as any, async (req: any, res, next) => {
  try {
    const { address } = addressSchema.parse(req.query);

    // First try to get cached data
    let estimate = await rentCastService.getCachedRentalEstimate(address);
    
    if (!estimate) {
      // No cached data or data is stale, fetch from RentCast API
      estimate = await rentCastService.getRentalEstimate(address);
      
      if (estimate) {
        // Cache the result for future use
        await rentCastService.cacheRentalEstimate(address, estimate);
      }
    }

    if (!estimate) {
      return res.status(404).json({
        message: 'Unable to get rental estimate for this address',
        address,
      });
    }

    res.json({
      success: true,
      data: estimate,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        message: 'Validation error',
        errors: error.errors,
      });
    }
    console.error('Rental estimate error:', error);
    next(error);
  }
});

/**
 * Get market data for a zip code
 */
router.get('/market-data', authenticateToken as any, async (req: any, res, next) => {
  try {
    const { zipCode } = zipCodeSchema.parse(req.query);

    const marketData = await rentCastService.getMarketData(zipCode);

    if (!marketData) {
      return res.status(404).json({
        message: 'Unable to get market data for this zip code',
        zipCode,
      });
    }

    res.json({
      success: true,
      data: marketData,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        message: 'Validation error',
        errors: error.errors,
      });
    }
    console.error('Market data error:', error);
    next(error);
  }
});

/**
 * Batch get rental estimates for multiple addresses
 * Useful for property listings page
 */
router.post('/batch-rental-estimates', authenticateToken as any, async (req: any, res, next) => {
  try {
    const { addresses } = z.object({
      addresses: z.array(z.string()).min(1).max(50), // Limit to 50 addresses per request
    }).parse(req.body);

    const results = await Promise.all(
      addresses.map(async (address) => {
        try {
          let estimate = await rentCastService.getCachedRentalEstimate(address);
          
          if (!estimate) {
            estimate = await rentCastService.getRentalEstimate(address);
            if (estimate) {
              await rentCastService.cacheRentalEstimate(address, estimate);
            }
          }
          
          return {
            address,
            estimate,
            success: !!estimate,
          };
        } catch (error) {
          console.error(`Error getting estimate for ${address}:`, error);
          return {
            address,
            estimate: null,
            success: false,
            error: 'Failed to get estimate',
          };
        }
      })
    );

    res.json({
      success: true,
      data: results,
      total: results.length,
      successful: results.filter(r => r.success).length,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        message: 'Validation error',
        errors: error.errors,
      });
    }
    console.error('Batch rental estimates error:', error);
    next(error);
  }
});

export default router;
