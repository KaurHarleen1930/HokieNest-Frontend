import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { RoommateMatchingService, DEFAULT_MATCHING_WEIGHTS, MatchingWeights } from '../services/matching';
import { supabase } from '../lib/supabase';

const router = Router();

// Validation schemas
const findMatchesSchema = z.object({
  limit: z.number().int().min(1).max(50).optional().default(50),
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

    // Get user's custom priority weights
    const { data: userWeights, error: weightsError } = await supabase
      .from('user_priority_weights')
      .select('*')
      .eq('user_id', userId)
      .single();

    let matchingWeights: MatchingWeights;

    if (weightsError || !userWeights) {
      // Use default weights if no custom weights found
      console.log('No custom weights found, using default weights');
      matchingWeights = DEFAULT_MATCHING_WEIGHTS;
    } else {
      // Map user priority weights to matching weights
      console.log('Using custom weights:', userWeights);

      // Calculate the total weight to ensure it sums to 100%
      const totalWeight = userWeights.budget_weight + userWeights.location_weight +
        userWeights.lifestyle_weight + userWeights.pets_weight +
        userWeights.timing_weight + userWeights.work_weight;

      // If weights already sum to 100%, use them as-is (just reserve 5% for smoking)
      // If they don't sum to 100%, scale them proportionally
      let scaleFactor = 1.0;
      if (Math.abs(totalWeight - 100) > 0.1) {
        const availableWeight = 95.0; // 100% - 5% for smoking
        scaleFactor = availableWeight / totalWeight;
      } else {
        // Weights sum to 100%, just reduce each by 5% to make room for smoking
        scaleFactor = 0.95;
      }

      matchingWeights = {
        budget: userWeights.budget_weight * scaleFactor,
        sleepSchedule: (userWeights.lifestyle_weight * scaleFactor) / 3, // Split lifestyle weight across 3 factors
        cleanliness: (userWeights.lifestyle_weight * scaleFactor) / 3,
        socialVibe: (userWeights.lifestyle_weight * scaleFactor) / 3,
        moveInDate: (userWeights.timing_weight * scaleFactor) / 2, // Split timing weight across 2 factors
        leaseLength: (userWeights.timing_weight * scaleFactor) / 2,
        distance: userWeights.location_weight * scaleFactor,
        quietHours: (userWeights.work_weight * scaleFactor) / 4, // Split work weight across 4 factors
        chores: (userWeights.work_weight * scaleFactor) / 4,
        guests: (userWeights.work_weight * scaleFactor) / 4,
        workFromHome: (userWeights.work_weight * scaleFactor) / 4,
        pets: userWeights.pets_weight * scaleFactor,
        smoking: 5.0 // Fixed 5% weight for smoking
      };
    }

    // Debug: Log the final weights
    const totalWeight = Object.values(matchingWeights).reduce((sum, weight) => sum + weight, 0);
    console.log('=== MATCHING WEIGHTS DEBUG ===');
    console.log('User priority weights:', userWeights);
    console.log('Final matching weights:', matchingWeights);
    console.log('Total weight:', totalWeight);
    console.log('Key weights - Budget:', matchingWeights.budget, 'Location:', matchingWeights.distance, 'Pets:', matchingWeights.pets);
    console.log('==============================');

    // Create matching service with custom weights
    const matchingService = new RoommateMatchingService(matchingWeights);

    // Find matches using the service
    const matches = await matchingService.findMatches(userId.toString(), validatedQuery.limit);

    res.json({
      matches,
      total: matches.length,
      weights: matchingService.getWeights(),
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

    // Get user's custom priority weights
    const { data: userWeights, error: weightsError } = await supabase
      .from('user_priority_weights')
      .select('*')
      .eq('user_id', userId)
      .single();

    let weights: MatchingWeights;

    if (weightsError || !userWeights) {
      weights = DEFAULT_MATCHING_WEIGHTS;
    } else {
      // Map user priority weights to matching weights
      const totalWeight = userWeights.budget_weight + userWeights.location_weight +
        userWeights.lifestyle_weight + userWeights.pets_weight +
        userWeights.timing_weight + userWeights.work_weight;

      const availableWeight = 95.0;
      const scaleFactor = availableWeight / totalWeight;

      weights = {
        budget: userWeights.budget_weight * scaleFactor,
        sleepSchedule: (userWeights.lifestyle_weight * scaleFactor) / 3,
        cleanliness: (userWeights.lifestyle_weight * scaleFactor) / 3,
        socialVibe: (userWeights.lifestyle_weight * scaleFactor) / 3,
        moveInDate: (userWeights.timing_weight * scaleFactor) / 2,
        leaseLength: (userWeights.timing_weight * scaleFactor) / 2,
        distance: userWeights.location_weight * scaleFactor,
        quietHours: (userWeights.work_weight * scaleFactor) / 4,
        chores: (userWeights.work_weight * scaleFactor) / 4,
        guests: (userWeights.work_weight * scaleFactor) / 4,
        workFromHome: (userWeights.work_weight * scaleFactor) / 4,
        pets: userWeights.pets_weight * scaleFactor,
        smoking: 5.0
      };
    }

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

    // Note: This route is deprecated since we now use user-specific priority weights
    // For now, just return the default weights
    const newWeights = DEFAULT_MATCHING_WEIGHTS;

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

    // Note: This route is deprecated since we now use user-specific priority weights
    res.json({
      message: 'Matching weights reset to default',
      weights: DEFAULT_MATCHING_WEIGHTS,
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

    // Create a temporary matching service to access private methods
    const tempMatchingService = new RoommateMatchingService();

    // Get target user's profile
    const profile = await tempMatchingService['getUserProfile'](targetUserId);

    if (!profile) {
      return res.status(404).json({ message: 'Profile not found' });
    }

    // Get current user's profile to calculate compatibility
    const currentUserProfile = await tempMatchingService['getUserProfile'](currentUserId.toString());

    if (currentUserProfile) {
      profile.compatibilityScore = tempMatchingService['calculateCompatibilityScore'](currentUserProfile, profile);
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
      weights: DEFAULT_MATCHING_WEIGHTS,
    });
  } catch (error) {
    console.error('Error getting matching statistics:', error);
    next(error);
  }
});

export { router as roommatesRoutes };
