import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { supabase } from '../lib/supabase';
import { authenticateToken, AuthRequest } from '../middleware/auth';


const router = Router();

// Validation schemas
const userProfileSchema = z.object({
  gender: z.enum(['male', 'female', 'nonbinary', 'other']).optional().or(z.literal('')),
  age: z
    .preprocess(
      (val) => (val === '' || val === null ? undefined : Number(val)),
      z.number().int().min(1).max(120).optional()
    ),
  major: z.string().optional().or(z.literal('')),
  housing_status: z.enum([
    'SEARCHING',
    'HAVE_HOUSING',
    'SEEKING_ROOMMATE',
    'NOT_SEARCHING'
  ]).optional(),
});


const housingPreferencesSchema = z.object({
  budget_min: z.number().int().min(0),
  budget_max: z.number().int().min(0),
  move_in_date: z.string().min(1, 'Move-in date is required'),
  move_out_date: z.string().optional().or(z.literal('')).or(z.null()),
  lease_length: z.array(z.string()).optional().default([]),
  max_distance: z.string().optional().default(''),
  quiet_hours_start: z.string().optional().default('22:00'),
  quiet_hours_end: z.string().optional().default('07:00'),
});

const lifestylePreferencesSchema = z.object({
  cleanliness_level: z.number().int().min(1).max(5),
  noise_tolerance: z.enum(['quiet', 'moderate', 'loud']),
  sleep_schedule: z.enum(['early', 'late', 'flexible']),
  cooking_habits: z.enum(['often', 'sometimes', 'rarely']),
  diet: z.enum(['vegan', 'vegetarian', 'none']),
  pets: z.enum(['has_pets', 'no_pets', 'allergic']),
  sharing_items: z.enum(['yes', 'sometimes', 'no']),
  chores_preference: z.string().optional().default(''),
  guests_frequency: z.string().optional().default(''),
  work_from_home_days: z.number().int().min(0).max(7).optional().default(3),
  comfortable_with_pets: z.boolean().optional().default(false),
  pet_allergies: z.array(z.string()).optional().default([]),
  smoking_policy: z.array(z.string()).optional().default([]),
});

const housingPrioritiesSchema = z.object({
  budget: z.number().int().min(0).max(100),
  commute: z.number().int().min(0).max(100),
  safety: z.number().int().min(0).max(100),
  roommates: z.number().int().min(0).max(100),
}).refine((data) => {
  const total = data.budget + data.commute + data.safety + data.roommates;
  return total === 100;
}, {
  message: "Priority percentages must total exactly 100%",
  path: ["budget"]
});

// Update user profile (gender, age, major)
router.put('/profile', authenticateToken as any, async (req: any, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const validatedData = userProfileSchema.parse(req.body);

    const { error, data } = await supabase
      .from('users')
      .update({
        gender: validatedData.gender,
        age: validatedData.age,
        major: validatedData.major,
        housing_status: validatedData.housing_status ?? null, // ✅ add this
      })
      .eq('user_id', userId)
      .select('gender, age, major, housing_status');

    if (error) {
      console.error('Error updating user profile:', error);
      return res.status(500).json({ message: 'Failed to update profile' });
    }

    res.json({
      message: 'Profile updated successfully',
      profile: data[0],
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

// Upsert housing preferences
router.post('/housing', authenticateToken as any, async (req: any, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    console.log('Housing preferences request body:', req.body);
    const validatedData = housingPreferencesSchema.parse(req.body);
    console.log('Validated housing data:', validatedData);

    // Check if housing preferences already exist
    const { data: existing, error: checkError } = await supabase
      .from('housing_preferences')
      .select('user_id')
      .eq('user_id', userId)
      .maybeSingle();

    if (checkError) {
      console.error('Error checking existing housing preferences:', checkError);
      return res.status(500).json({ message: 'Failed to check existing preferences' });
    }

    if (existing) {
      // Update existing preferences
      const { error } = await supabase
        .from('housing_preferences')
        .update({
          budget_min: validatedData.budget_min,
          budget_max: validatedData.budget_max,
          move_in_date: validatedData.move_in_date,
          move_out_date: validatedData.move_out_date || null,
          lease_length: validatedData.lease_length,
          max_distance: validatedData.max_distance,
          quiet_hours_start: validatedData.quiet_hours_start,
          quiet_hours_end: validatedData.quiet_hours_end,
        })
        .eq('user_id', userId);

      if (error) {
        console.error('Error updating housing preferences:', error);
        return res.status(500).json({ message: 'Failed to update housing preferences' });
      }
    } else {
      // Create new preferences
      const { error } = await supabase
        .from('housing_preferences')
        .insert({
          user_id: userId,
          budget_min: validatedData.budget_min,
          budget_max: validatedData.budget_max,
          move_in_date: validatedData.move_in_date,
          move_out_date: validatedData.move_out_date || null,
          lease_length: validatedData.lease_length,
          max_distance: validatedData.max_distance,
          quiet_hours_start: validatedData.quiet_hours_start,
          quiet_hours_end: validatedData.quiet_hours_end,
        });

      if (error) {
        console.error('Error creating housing preferences:', error);
        return res.status(500).json({ message: 'Failed to create housing preferences' });
      }
    }

    res.json({ message: 'Housing preferences saved successfully' });
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error('Housing preferences validation error:', error.errors);
      return res.status(400).json({
        message: 'Validation error',
        errors: error.errors,
      });
    }
    console.error('Housing preferences error:', error);
    next(error);
  }
});

// Upsert lifestyle preferences
router.post('/lifestyle', authenticateToken as any, async (req: any, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const validatedData = lifestylePreferencesSchema.parse(req.body);

    // Check if lifestyle preferences already exist
    const { data: existing, error: checkError } = await supabase
      .from('lifestyle_preferences')
      .select('user_id')
      .eq('user_id', userId)
      .maybeSingle();

    if (checkError) {
      console.error('Error checking existing lifestyle preferences:', checkError);
      return res.status(500).json({ message: 'Failed to check existing preferences' });
    }

    if (existing) {
      // Update existing preferences
      const { error } = await supabase
        .from('lifestyle_preferences')
        .update({
          cleanliness_level: validatedData.cleanliness_level,
          noise_tolerance: validatedData.noise_tolerance,
          sleep_schedule: validatedData.sleep_schedule,
          cooking_habits: validatedData.cooking_habits,
          diet: validatedData.diet,
          pets: validatedData.pets,
          sharing_items: validatedData.sharing_items,
          chores_preference: validatedData.chores_preference,
          guests_frequency: validatedData.guests_frequency,
          work_from_home_days: validatedData.work_from_home_days,
          comfortable_with_pets: validatedData.comfortable_with_pets,
          pet_allergies: validatedData.pet_allergies,
          smoking_policy: validatedData.smoking_policy,
        })
        .eq('user_id', userId);

      if (error) {
        console.error('Error updating lifestyle preferences:', error);
        return res.status(500).json({ message: 'Failed to update lifestyle preferences' });
      }
    } else {
      // Create new preferences
      const { error } = await supabase
        .from('lifestyle_preferences')
        .insert({
          user_id: userId,
          cleanliness_level: validatedData.cleanliness_level,
          noise_tolerance: validatedData.noise_tolerance,
          sleep_schedule: validatedData.sleep_schedule,
          cooking_habits: validatedData.cooking_habits,
          diet: validatedData.diet,
          pets: validatedData.pets,
          sharing_items: validatedData.sharing_items,
          chores_preference: validatedData.chores_preference,
          guests_frequency: validatedData.guests_frequency,
          work_from_home_days: validatedData.work_from_home_days,
          comfortable_with_pets: validatedData.comfortable_with_pets,
          pet_allergies: validatedData.pet_allergies,
          smoking_policy: validatedData.smoking_policy,
        });

      if (error) {
        console.error('Error creating lifestyle preferences:', error);
        return res.status(500).json({ message: 'Failed to create lifestyle preferences' });
      }
    }

    res.json({ message: 'Lifestyle preferences saved successfully' });
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

// Get user preferences (for editing)
router.get('/profile', authenticateToken as any, async (req: any, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    // Get user profile
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('gender, age, major, housing_status')
      .eq('user_id', userId)
      .single();

    if (userError) {
      console.error('Error fetching user profile:', userError);
      return res.status(500).json({ message: 'Failed to fetch profile' });
    }

    // Get housing preferences
    const { data: housing, error: housingError } = await supabase
      .from('housing_preferences')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (housingError && housingError.code !== 'PGRST116') {
      console.error('Error fetching housing preferences:', housingError);
      return res.status(500).json({ message: 'Failed to fetch housing preferences' });
    }

    // Get lifestyle preferences
    const { data: lifestyle, error: lifestyleError } = await supabase
      .from('lifestyle_preferences')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (lifestyleError && lifestyleError.code !== 'PGRST116') {
      console.error('Error fetching lifestyle preferences:', lifestyleError);
      return res.status(500).json({ message: 'Failed to fetch lifestyle preferences' });
    }

    // Get housing priorities
    const { data: priorities, error: prioritiesError } = await supabase
      .from('housing_priorities')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (prioritiesError && prioritiesError.code !== 'PGRST116') {
      console.error('Error fetching housing priorities:', prioritiesError);
      return res.status(500).json({ message: 'Failed to fetch housing priorities' });
    }

    res.json({
      profile: user,
      housing: housing || null,
      lifestyle: lifestyle || null,
      priorities: priorities ? priorities.preferences : null,
    });
  } catch (error) {
    next(error);
  }
});

// Delete all user preferences
router.delete('/delete', authenticateToken as any, async (req: any, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    // Delete housing preferences
    const { error: housingError } = await supabase
      .from('housing_preferences')
      .delete()
      .eq('user_id', userId);

    if (housingError) {
      console.error('Error deleting housing preferences:', housingError);
    }

    // Delete lifestyle preferences
    const { error: lifestyleError } = await supabase
      .from('lifestyle_preferences')
      .delete()
      .eq('user_id', userId);

    if (lifestyleError) {
      console.error('Error deleting lifestyle preferences:', lifestyleError);
    }

    res.json({ message: 'All preferences deleted successfully' });
  } catch (error) {
    console.error('Delete preferences error:', error);
    next(error);
  }
});

// Get housing priorities
router.get('/housing-priorities', authenticateToken as any, async (req: any, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const { data: priorities, error } = await supabase
      .from('housing_priorities')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('Error fetching housing priorities:', error);
      return res.status(500).json({ message: 'Failed to fetch housing priorities' });
    }

    if (!priorities) {
      // Return default priorities if none exist
      const defaultPriorities = {
        budget: 25,
        commute: 25,
        safety: 25,
        roommates: 25
      };
      return res.json({ priorities: defaultPriorities, isDefault: true });
    }

    res.json({
      priorities: priorities.preferences,
      isDefault: false,
      lastUpdated: priorities.updated_at
    });
  } catch (error) {
    console.error('Error getting housing priorities:', error);
    next(error);
  }
});

// Save housing priorities
router.post('/housing-priorities', authenticateToken as any, async (req: any, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const validatedData = housingPrioritiesSchema.parse(req.body);

    // Check if housing priorities already exist
    const { data: existing, error: checkError } = await supabase
      .from('housing_priorities')
      .select('id')
      .eq('user_id', userId)
      .maybeSingle();

    if (checkError) {
      console.error('Error checking existing housing priorities:', checkError);
      return res.status(500).json({ message: 'Failed to check existing priorities' });
    }

    if (existing) {
      // Update existing priorities
      const { error } = await supabase
        .from('housing_priorities')
        .update({
          preferences: validatedData,
        })
        .eq('user_id', userId);

      if (error) {
        console.error('Error updating housing priorities:', error);
        return res.status(500).json({ message: 'Failed to update housing priorities' });
      }
    } else {
      // Create new priorities
      const { error } = await supabase
        .from('housing_priorities')
        .insert({
          user_id: userId,
          preferences: validatedData,
        });

      if (error) {
        console.error('Error creating housing priorities:', error);
        return res.status(500).json({ message: 'Failed to create housing priorities' });
      }
    }

    res.json({ message: 'Housing priorities saved successfully' });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        message: 'Validation error',
        errors: error.errors,
      });
    }
    console.error('Housing priorities error:', error);
    next(error);
  }
});

export { router as preferencesRoutes };
