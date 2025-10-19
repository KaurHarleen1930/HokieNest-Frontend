import { Router, Request, Response, NextFunction } from 'express';
import { supabase } from '../lib/supabase';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { z } from 'zod';

const router = Router();

// Validation schema for priority weights
const priorityWeightsSchema = z.object({
    budget: z.number().min(0).max(100),
    location: z.number().min(0).max(100),
    lifestyle: z.number().min(0).max(100),
    pets: z.number().min(0).max(100),
    timing: z.number().min(0).max(100),
    work: z.number().min(0).max(100),
}).refine((data) => {
    const total = Object.values(data).reduce((sum, weight) => sum + weight, 0);
    return Math.abs(total - 100) < 0.1; // Allow small floating point differences
}, {
    message: "Priority weights must sum to 100%"
});

// Save user priority weights
router.post('/save', authenticateToken as any, async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
        const currentUserId = req.user?.id;
        if (!currentUserId) {
            return res.status(401).json({ message: 'Unauthorized' });
        }

        const weights = priorityWeightsSchema.parse(req.body);

        // Check if user already has priority weights
        const { data: existingWeights } = await supabase
            .from('user_priority_weights')
            .select('id')
            .eq('user_id', currentUserId)
            .single();

        let result;
        if (existingWeights) {
            // Update existing weights
            result = await supabase
                .from('user_priority_weights')
                .update({
                    budget_weight: weights.budget,
                    location_weight: weights.location,
                    lifestyle_weight: weights.lifestyle,
                    pets_weight: weights.pets,
                    timing_weight: weights.timing,
                    work_weight: weights.work,
                    updated_at: new Date().toISOString()
                })
                .eq('user_id', currentUserId)
                .select()
                .single();
        } else {
            // Insert new weights
            result = await supabase
                .from('user_priority_weights')
                .insert({
                    user_id: currentUserId,
                    budget_weight: weights.budget,
                    location_weight: weights.location,
                    lifestyle_weight: weights.lifestyle,
                    pets_weight: weights.pets,
                    timing_weight: weights.timing,
                    work_weight: weights.work,
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString()
                })
                .select()
                .single();
        }

        if (result.error) {
            throw result.error;
        }

        res.json({
            message: 'Priority weights saved successfully',
            weights: {
                budget: result.data.budget_weight,
                location: result.data.location_weight,
                lifestyle: result.data.lifestyle_weight,
                pets: result.data.pets_weight,
                timing: result.data.timing_weight,
                work: result.data.work_weight
            }
        });
    } catch (error) {
        if (error instanceof z.ZodError) {
            return res.status(400).json({
                message: 'Validation error',
                errors: error.errors
            });
        }
        console.error('Error saving priority weights:', error);
        next(error);
    }
});

// Get user priority weights
router.get('/get', authenticateToken as any, async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
        const currentUserId = req.user?.id;
        if (!currentUserId) {
            return res.status(401).json({ message: 'Unauthorized' });
        }

        const { data: weights, error } = await supabase
            .from('user_priority_weights')
            .select('*')
            .eq('user_id', currentUserId)
            .single();

        if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
            throw error;
        }

        if (!weights) {
            // Return equal weights if user hasn't set any
            const defaultWeights = {
                budget: 16.67,    // Equal weight (100% / 6 factors)
                location: 16.67,  // Equal weight
                lifestyle: 16.67, // Equal weight
                pets: 16.67,      // Equal weight
                timing: 16.66,    // Slightly lower to make total exactly 100%
                work: 16.66       // Slightly lower to make total exactly 100%
            };
            return res.json({ weights: defaultWeights, isDefault: true });
        }

        res.json({
            weights: {
                budget: weights.budget_weight,
                location: weights.location_weight,
                lifestyle: weights.lifestyle_weight,
                pets: weights.pets_weight,
                timing: weights.timing_weight,
                work: weights.work_weight
            },
            isDefault: false,
            lastUpdated: weights.updated_at
        });
    } catch (error) {
        console.error('Error getting priority weights:', error);
        next(error);
    }
});

// Get priority-based roommate matches
router.get('/matches', authenticateToken as any, async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
        const currentUserId = req.user?.id;
        if (!currentUserId) {
            return res.status(401).json({ message: 'Unauthorized' });
        }

        const limit = parseInt(req.query.limit as string) || 20;

        // Import the priority matching service
        const { priorityBasedMatchingService } = await import('../services/priority-matching');

        const matches = await priorityBasedMatchingService.findMatches(currentUserId, limit);

        res.json({
            matches,
            total: matches.length,
            message: 'Priority-based matches found successfully'
        });
    } catch (error) {
        console.error('Error getting priority-based matches:', error);
        next(error);
    }
});

export { router as priorityWeightsRoutes };
