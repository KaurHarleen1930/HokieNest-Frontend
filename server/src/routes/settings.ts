import { Router, Response } from 'express';
import { z } from 'zod';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { supabase } from '../lib/supabase';

const router = Router();

const themeSchema = z.object({
  theme: z.enum(['light', 'dark', 'system']),
});

const respondWithLocalOnly = (res: Response, theme: string, message: string) =>
  res.json({
    message,
    theme,
    persisted: false,
  });

router.use(authenticateToken);

router.get('/theme', async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    const userId = Number(req.user.id);
    if (Number.isNaN(userId)) {
      return res.status(400).json({ message: 'Invalid user identifier' });
    }

    const { data, error } = await supabase
      .from('user_settings')
      .select('theme_preference, updated_at')
      .eq('user_id', userId)
      .maybeSingle();

    if (error) {
      if (error.code === '42P01') {
        console.warn('user_settings table not found; returning default theme.');
        return res.json({
          theme: 'system',
          lastUpdated: null,
          source: 'default',
        });
      }
      if (error.code !== 'PGRST116') {
        console.error('Error fetching theme preference:', error);
        return res.json({
          theme: 'system',
          lastUpdated: null,
          source: 'default',
        });
      }
    }

    if (!data) {
      return res.json({
        theme: 'system',
        lastUpdated: null,
        source: 'default',
      });
    }

    return res.json({
      theme: data.theme_preference ?? 'system',
      lastUpdated: data.updated_at,
      source: 'user',
    });
  } catch (error) {
    console.error('Unexpected error retrieving theme preference:', error);
    return res.status(500).json({ message: 'Failed to load theme preference' });
  }
});

router.put('/theme', async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    const userId = Number(req.user.id);
    if (Number.isNaN(userId)) {
      return res.status(400).json({ message: 'Invalid user identifier' });
    }

    const { theme } = themeSchema.parse(req.body);

    const { data: existing, error: fetchError } = await supabase
      .from('user_settings')
      .select('id')
      .eq('user_id', userId)
      .maybeSingle();

    if (fetchError) {
      if (fetchError.code === '42P01') {
        console.warn('user_settings table not found; skipping persistence.');
        return res.json({
          message: 'Theme preference saved locally (persistence unavailable)',
          theme,
          persisted: false,
        });
      }
      if (fetchError.code !== 'PGRST116') {
        console.error('Error checking existing theme preference:', fetchError);
        return respondWithLocalOnly(res, theme, 'Theme preference saved locally (persistence error).');
      }
    }

    if (existing) {
      const { error: updateError } = await supabase
        .from('user_settings')
        .update({ theme_preference: theme })
        .eq('user_id', userId);

      if (updateError) {
        if (updateError.code === '42P01') {
          console.warn('user_settings table missing during update; skipping persistence.');
          return res.json({
            message: 'Theme preference saved locally (persistence unavailable)',
            theme,
            persisted: false,
          });
        }
        console.error('Error updating theme preference:', updateError);
        return respondWithLocalOnly(res, theme, 'Theme preference saved locally (persistence error).');
      }
    } else {
      const { error: insertError } = await supabase
        .from('user_settings')
        .insert({ user_id: userId, theme_preference: theme });

      if (insertError) {
        if (insertError.code === '42P01') {
          console.warn('user_settings table missing during insert; skipping persistence.');
          return res.json({
            message: 'Theme preference saved locally (persistence unavailable)',
            theme,
            persisted: false,
          });
        }
        console.error('Error creating theme preference:', insertError);
        return respondWithLocalOnly(res, theme, 'Theme preference saved locally (persistence error).');
      }
    }

    return res.json({
      message: 'Theme preference saved successfully',
      theme,
      persisted: true,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        message: 'Validation error',
        errors: error.errors,
      });
    }
    console.error('Unexpected error saving theme preference:', error);
    return respondWithLocalOnly(res, 'system', 'Theme preference saved locally (unexpected error).');
  }
});

export default router;

