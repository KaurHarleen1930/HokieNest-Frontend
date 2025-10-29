import { Router, Request, Response } from 'express';
import { supabase } from '../lib/supabase';
import { authenticateToken } from '../middleware/auth';

const router = Router();

/**
 * GET /api/v1/community/property-vt-counts
 * Query: propertyIds (comma-separated or repeating param)
 * Returns: { [propertyId]: count }
 */
router.get('/property-vt-counts', async (req: Request, res: Response) => {
  try {
    let propertyIds: string[] = [];
    if (req.query.propertyIds) {
      if (Array.isArray(req.query.propertyIds)) {
        propertyIds = (req.query.propertyIds as string[]).filter(Boolean);
      } else if (typeof req.query.propertyIds === 'string') {
        propertyIds = (req.query.propertyIds as string).split(',').map(s => s.trim()).filter(Boolean);
      }
    }

    if (!propertyIds.length) return res.json({});

    // Get housing preferences for these properties
    const { data: prefs, error: prefsError } = await supabase
      .from('housing_preferences')
      .select('user_id,current_property_id')
      .in('current_property_id', propertyIds);

    if (prefsError) throw prefsError;
    if (!prefs || prefs.length === 0) return res.json({});

    const userIds = [...new Set(prefs.map((p: any) => p.user_id))];

    // Get users that are VT (email ends with @vt.edu)
    const { data: users } = await supabase
      .from('users')
      .select('user_id,email')
      .in('user_id', userIds)
      .ilike('email', '%@vt.edu');

    const vtUserIds = new Set((users || []).map((u: any) => u.user_id));

    // Count VT users per property
    const counts: Record<string, number> = {};
    for (const p of prefs) {
      const propId = p.current_property_id as string;
      const uid = p.user_id;
      if (!propId) continue;
      if (!vtUserIds.has(uid)) continue;
      counts[propId] = (counts[propId] || 0) + 1;
    }

    res.json(counts);
  } catch (error: any) {
    console.error('Error fetching VT counts:', error);
    res.status(500).json({ message: 'Failed to fetch VT counts', error: error?.message || String(error) });
  }
});

/**
 * Community posts for properties
 */
// Get posts for a property
router.get('/properties/:id/posts', async (req: Request, res: Response) => {
  try {
    const propertyId = req.params.id;
    const { data: posts, error } = await supabase
      .from('property_community_posts')
      .select('id, user_id, content, created_at')
      .eq('property_id', propertyId)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) throw error;

    // Fetch user info for the posts
    const userIds = [...new Set((posts || []).map((p: any) => p.user_id))];
    const { data: users } = await supabase
      .from('users')
      .select('user_id, first_name, last_name, email')
      .in('user_id', userIds);

    const usersById = new Map((users || []).map((u: any) => [u.user_id, u]));

    const enriched = (posts || []).map((p: any) => ({
      id: p.id,
      user_id: p.user_id,
      content: p.content,
      created_at: p.created_at,
      user: usersById.get(p.user_id) || null,
    }));

    res.json(enriched);
  } catch (error: any) {
    console.error('Error fetching property posts:', error);
    res.status(500).json({ message: 'Failed to fetch posts', error: error?.message || String(error) });
  }
});

// Create a post (authenticated)
router.post('/properties/:id/posts', authenticateToken as any, async (req: Request & any, res: Response) => {
  try {
    const propertyId = req.params.id;
    const userId = req.user?.id;
    const { content } = req.body;

    if (!userId) return res.status(401).json({ message: 'Unauthorized' });
    if (!content || typeof content !== 'string' || content.trim().length === 0) {
      return res.status(400).json({ message: 'Content is required' });
    }

    // Check user is VT (email ends with @vt.edu)
    const { data: user } = await supabase
      .from('users')
      .select('user_id, email')
      .eq('user_id', userId)
      .single();

    if (!user || !user.email || !user.email.endsWith('@vt.edu')) {
      return res.status(403).json({ message: 'Community posts are only available to Virginia Tech users' });
    }

    const { data: inserted, error } = await supabase
      .from('property_community_posts')
      .insert({ property_id: propertyId, user_id: userId, content })
      .select()
      .single();

    if (error) throw error;

    res.status(201).json(inserted);
  } catch (error: any) {
    console.error('Error creating property post:', error);
    res.status(500).json({ message: 'Failed to create post', error: error?.message || String(error) });
  }
});

export { router as communityRoutes };
