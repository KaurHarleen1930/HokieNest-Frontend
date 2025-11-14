import { Router } from 'express';
import { supabase } from '../lib/supabase';
import { authenticateToken, requirePermission, AuthRequest } from '../middleware/auth';
import { createAdminLogger, AdminAction } from '../middleware/adminLogger';

const router = Router();

// Apply auth middleware to all report routes
router.use(authenticateToken);

/**
 * Get all reports (user reports and flagged posts)
 * Requires: review_reports permission (COMMUNITY_ADMIN, SUPER_ADMIN)
 */
router.get('/', requirePermission('review_reports'), async (req: AuthRequest, res, next) => {
  try {
    const { status, type, page = 1, limit = 50 } = req.query;

    let query = supabase
      .from('reports')
      .select(`
        *,
        reporter:reporter_id (user_id, email, first_name, last_name),
        reported_user:reported_user_id (user_id, email, first_name, last_name),
        reported_property:reported_property_id (id, name),
        reported_review:reported_review_id (id, rating, review_text),
        reviewed_by_admin:reviewed_by (admin_id, email, first_name, last_name)
      `)
      .order('created_at', { ascending: false });

    // Filter by status (pending, resolved, dismissed)
    if (status && typeof status === 'string') {
      query = query.eq('status', status);
    }

    // Filter by report type
    if (type && typeof status === 'string') {
      query = query.eq('report_type', type);
    }

    // Pagination
    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const offset = (pageNum - 1) * limitNum;

    query = query.range(offset, offset + limitNum - 1);

    const { data: reports, error, count } = await query;

    if (error) {
      throw error;
    }

    res.json({
      reports,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limitNum),
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Get flagged community posts
 * Requires: review_reports permission (COMMUNITY_ADMIN, SUPER_ADMIN)
 */
router.get('/flagged-posts', requirePermission('review_reports'), async (req: AuthRequest, res, next) => {
  try {
    const { resolved, page = 1, limit = 50 } = req.query;

    let query = supabase
      .from('post_flags')
      .select(`
        *,
        post:post_id (
          id,
          title,
          content,
          author_id,
          created_at
        ),
        user:user_id (user_id, email, first_name, last_name)
      `)
      .order('created_at', { ascending: false });

    // Filter by resolved status
    if (resolved !== undefined) {
      query = query.eq('resolved', resolved === 'true');
    }

    // Pagination
    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const offset = (pageNum - 1) * limitNum;

    query = query.range(offset, offset + limitNum - 1);

    const { data: flags, error } = await query;

    if (error) {
      throw error;
    }

    res.json(flags);
  } catch (error) {
    next(error);
  }
});

/**
 * Resolve a report
 * Requires: review_reports permission (COMMUNITY_ADMIN, SUPER_ADMIN)
 */
router.put('/:id/resolve', requirePermission('review_reports'), createAdminLogger('review_report' as AdminAction), async (req: AuthRequest, res, next) => {
  try {
    const { id } = req.params;
    const { resolution_notes, action } = req.body;

    // Get admin_id from admin_users table
    const { data: adminUser } = await supabase
      .from('admin_users')
      .select('admin_id')
      .eq('user_id', req.user!.id)
      .single();

    if (!adminUser) {
      return res.status(403).json({ message: 'Admin user not found' });
    }

    // Update report status
    const { error: updateError } = await supabase
      .from('reports')
      .update({
        status: 'resolved',
        reviewed_by: adminUser.admin_id,
        reviewed_at: new Date().toISOString(),
        resolution_notes: resolution_notes || null,
      })
      .eq('id', id);

    if (updateError) {
      throw updateError;
    }

    // Perform action based on resolution (optional)
    if (action === 'suspend_user') {
      // Get the reported user id from the report
      const { data: report } = await supabase
        .from('reports')
        .select('reported_user_id')
        .eq('id', id)
        .single();

      if (report?.reported_user_id) {
        await supabase
          .from('users')
          .update({ suspended: true })
          .eq('user_id', report.reported_user_id);
      }
    } else if (action === 'delete_content') {
      // Get the report to determine what to delete
      const { data: report } = await supabase
        .from('reports')
        .select('reported_review_id, reported_property_id')
        .eq('id', id)
        .single();

      if (report?.reported_review_id) {
        // Delete/hide the review
        await supabase
          .from('property_reviews')
          .update({ is_published: false })
          .eq('id', report.reported_review_id);
      }
    }

    res.json({ success: true, message: 'Report resolved successfully' });
  } catch (error) {
    next(error);
  }
});

/**
 * Dismiss a report (mark as not actionable)
 * Requires: review_reports permission (COMMUNITY_ADMIN, SUPER_ADMIN)
 */
router.put('/:id/dismiss', requirePermission('review_reports'), createAdminLogger('review_report' as AdminAction), async (req: AuthRequest, res, next) => {
  try {
    const { id } = req.params;
    const { resolution_notes } = req.body;

    // Get admin_id from admin_users table
    const { data: adminUser } = await supabase
      .from('admin_users')
      .select('admin_id')
      .eq('user_id', req.user!.id)
      .single();

    if (!adminUser) {
      return res.status(403).json({ message: 'Admin user not found' });
    }

    // Update report status
    const { error: updateError } = await supabase
      .from('reports')
      .update({
        status: 'dismissed',
        reviewed_by: adminUser.admin_id,
        reviewed_at: new Date().toISOString(),
        resolution_notes: resolution_notes || 'Dismissed - no action taken',
      })
      .eq('id', id);

    if (updateError) {
      throw updateError;
    }

    res.json({ success: true, message: 'Report dismissed successfully' });
  } catch (error) {
    next(error);
  }
});

/**
 * Resolve a flagged post
 * Requires: review_reports permission (COMMUNITY_ADMIN, SUPER_ADMIN)
 */
router.put('/flagged-posts/:id/resolve', requirePermission('review_reports'), createAdminLogger('review_flagged_post' as AdminAction), async (req: AuthRequest, res, next) => {
  try {
    const { id } = req.params;
    const { action } = req.body;

    // Mark flag as resolved
    const { error: updateError } = await supabase
      .from('post_flags')
      .update({ resolved: true })
      .eq('id', id);

    if (updateError) {
      throw updateError;
    }

    // Perform action
    if (action === 'delete_post') {
      // Get the post_id from the flag
      const { data: flag } = await supabase
        .from('post_flags')
        .select('post_id')
        .eq('id', id)
        .single();

      if (flag?.post_id) {
        // Delete the community post
        await supabase
          .from('community_posts')
          .delete()
          .eq('id', flag.post_id);
      }
    }

    res.json({ success: true, message: 'Flagged post resolved successfully' });
  } catch (error) {
    next(error);
  }
});

/**
 * Get report statistics
 * Requires: review_reports permission (COMMUNITY_ADMIN, SUPER_ADMIN)
 */
router.get('/stats', requirePermission('review_reports'), async (req: AuthRequest, res, next) => {
  try {
    // Get counts for different report statuses
    const { data: reportStats } = await supabase
      .from('reports')
      .select('status', { count: 'exact' });

    // Get counts for flagged posts
    const { data: flaggedStats, count: totalFlags } = await supabase
      .from('post_flags')
      .select('*', { count: 'exact', head: true });

    const { count: resolvedFlags } = await supabase
      .from('post_flags')
      .select('*', { count: 'exact', head: true })
      .eq('resolved', true);

    // Group report stats by status
    const statusCounts = reportStats?.reduce((acc: any, report: any) => {
      acc[report.status] = (acc[report.status] || 0) + 1;
      return acc;
    }, {}) || {};

    res.json({
      reports: {
        total: reportStats?.length || 0,
        pending: statusCounts.pending || 0,
        resolved: statusCounts.resolved || 0,
        dismissed: statusCounts.dismissed || 0,
      },
      flaggedPosts: {
        total: totalFlags || 0,
        pending: (totalFlags || 0) - (resolvedFlags || 0),
        resolved: resolvedFlags || 0,
      },
    });
  } catch (error) {
    next(error);
  }
});

export { router as reportsRoutes };
