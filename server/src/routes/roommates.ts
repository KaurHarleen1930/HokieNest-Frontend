import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { roommateMatchingService, DEFAULT_MATCHING_WEIGHTS, MatchingWeights } from '../services/matching';

const router = Router();

// Validation schemas
const findMatchesSchema = z.object({
  limit: z.number().int().min(1).max(50).optional().default(20),
});

const updateWeightsSchema = z.object({
  budget: z.number().int().min(0).max(100).optional(),
  sleepSchedule: z.number().int().min(0).max(100).optional(),
  cleanliness: z.number().int().min(0).max(100).optional(),
  socialVibe: z.number().int().min(0).max(100).optional(),
  moveInDate: z.number().int().min(0).max(100).optional(),
  leaseLength: z.number().int().min(0).max(100).optional(),
  distance: z.number().int().min(0).max(100).optional(),
  quietHours: z.number().int().min(0).max(100).optional(),
  chores: z.number().int().min(0).max(100).optional(),
  guests: z.number().int().min(0).max(100).optional(),
  workFromHome: z.number().int().min(0).max(100).optional(),
  pets: z.number().int().min(0).max(100).optional(),
  smoking: z.number().int().min(0).max(100).optional(),
});

// Get roommate matches for authenticated user
router.get('/matches', authenticateToken as any, async (req: any, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const validatedQuery = findMatchesSchema.parse({
      limit: req.query.limit ? parseInt(req.query.limit as string) : undefined,
    });

    console.log(`Finding roommate matches for user ${userId} with limit ${validatedQuery.limit}`);

    const matches = await roommateMatchingService.findMatches(userId.toString(), validatedQuery.limit);

    res.json({
      matches,
      total: matches.length,
      weights: roommateMatchingService.getWeights(),
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        message: 'Validation error',
        errors: error.errors,
      });
    }
    console.error('Error finding roommate matches:', error);
    next(error);
  }
});

// Get current matching weights
router.get('/weights', authenticateToken as any, async (req: any, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const weights = roommateMatchingService.getWeights();
    
    res.json({
      weights,
      total: Object.values(weights).reduce((sum, weight) => sum + weight, 0),
    });
  } catch (error) {
    console.error('Error getting matching weights:', error);
    next(error);
  }
});

// Update matching weights (admin only)
router.put('/weights', authenticateToken as any, async (req: any, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    // Check if user is admin
    const { data: user, error: userError } = await require('../lib/supabase').supabase
      .from('users')
      .select('is_admin')
      .eq('user_id', userId)
      .single();

    if (userError || !user?.is_admin) {
      return res.status(403).json({ message: 'Admin access required' });
    }

    const validatedData = updateWeightsSchema.parse(req.body);

    // Update weights
    roommateMatchingService.updateWeights(validatedData);

    const newWeights = roommateMatchingService.getWeights();

    res.json({
      message: 'Matching weights updated successfully',
      weights: newWeights,
      total: Object.values(newWeights).reduce((sum, weight) => sum + weight, 0),
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        message: 'Validation error',
        errors: error.errors,
      });
    }
    console.error('Error updating matching weights:', error);
    next(error);
  }
});

// Reset matching weights to default (admin only)
router.post('/weights/reset', authenticateToken as any, async (req: any, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    // Check if user is admin
    const { data: user, error: userError } = await require('../lib/supabase').supabase
      .from('users')
      .select('is_admin')
      .eq('user_id', userId)
      .single();

    if (userError || !user?.is_admin) {
      return res.status(403).json({ message: 'Admin access required' });
    }

    // Reset to default weights
    roommateMatchingService.updateWeights(DEFAULT_MATCHING_WEIGHTS);

    res.json({
      message: 'Matching weights reset to default',
      weights: roommateMatchingService.getWeights(),
    });
  } catch (error) {
    console.error('Error resetting matching weights:', error);
    next(error);
  }
});

// Get roommate profile by ID
router.get('/profile/:id', authenticateToken as any, async (req: any, res: Response, next: NextFunction) => {
  try {
    const currentUserId = req.user?.id;
    const targetUserId = req.params.id;

    if (!currentUserId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    if (currentUserId.toString() === targetUserId) {
      return res.status(400).json({ message: 'Cannot view own profile' });
    }

    // Get target user's profile
    const profile = await roommateMatchingService['getUserProfile'](targetUserId);
    
    if (!profile) {
      return res.status(404).json({ message: 'Profile not found' });
    }

    // Get current user's profile to calculate compatibility
    const currentUserProfile = await roommateMatchingService['getUserProfile'](currentUserId.toString());
    
    if (currentUserProfile) {
      profile.compatibilityScore = roommateMatchingService['calculateCompatibilityScore'](currentUserProfile, profile);
    }

    res.json({ profile });
  } catch (error) {
    console.error('Error getting roommate profile:', error);
    next(error);
  }
});

// Get matching statistics (admin only)
router.get('/stats', authenticateToken as any, async (req: any, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    // Check if user is admin
    const { data: user, error: userError } = await require('../lib/supabase').supabase
      .from('users')
      .select('is_admin')
      .eq('user_id', userId)
      .single();

    if (userError || !user?.is_admin) {
      return res.status(403).json({ message: 'Admin access required' });
    }

    // Get basic statistics
    const { data: totalUsers } = await require('../lib/supabase').supabase
      .from('users')
      .select('user_id', { count: 'exact' });

    const { data: usersWithHousing } = await require('../lib/supabase').supabase
      .from('housing_preferences')
      .select('user_id', { count: 'exact' });

    const { data: usersWithLifestyle } = await require('../lib/supabase').supabase
      .from('lifestyle_preferences')
      .select('user_id', { count: 'exact' });

    const { data: completeProfiles } = await require('../lib/supabase').supabase
      .from('users')
      .select(`
        user_id,
        housing_preferences!inner(*),
        lifestyle_preferences!inner(*)
      `, { count: 'exact' });

    res.json({
      totalUsers: totalUsers?.length || 0,
      usersWithHousing: usersWithHousing?.length || 0,
      usersWithLifestyle: usersWithLifestyle?.length || 0,
      completeProfiles: completeProfiles?.length || 0,
      weights: roommateMatchingService.getWeights(),
    });
  } catch (error) {
    console.error('Error getting matching statistics:', error);
    next(error);
  }
});

export { router as roommatesRoutes };
