import { Router } from 'express';
import { supabase } from '../lib/supabase';
import { authenticateToken, requirePermission, AuthRequest } from '../middleware/auth';

const router = Router();

// Apply auth middleware to all analytics routes
router.use(authenticateToken);

/**
 * Get overview analytics
 * Requires: view_analytics permission (CONTENT_ADMIN, SUPER_ADMIN)
 */
router.get('/overview', requirePermission('view_analytics'), async (req: AuthRequest, res, next) => {
  try {
    const { startDate, endDate } = req.query;

    // Get total users
    const { count: totalUsers } = await supabase
      .from('users')
      .select('*', { count: 'exact', head: true });

    // Get new users in date range
    let newUsersQuery = supabase
      .from('users')
      .select('*', { count: 'exact', head: true });

    if (startDate) {
      newUsersQuery = newUsersQuery.gte('created_at', startDate);
    }
    if (endDate) {
      newUsersQuery = newUsersQuery.lte('created_at', endDate);
    }

    const { count: newUsers } = await newUsersQuery;

    // Get total listings
    const { count: totalListings } = await supabase
      .from('apartment_properties_listings')
      .select('*', { count: 'exact', head: true })
      .eq('is_active', true);

    // Get total room listings
    const { count: totalRoomListings } = await supabase
      .from('room_listings')
      .select('*', { count: 'exact', head: true })
      .eq('is_active', true);

    // Get total messages
    const { count: totalMessages } = await supabase
      .from('chat_messages')
      .select('*', { count: 'exact', head: true });

    // Get active connections
    const { count: activeConnections } = await supabase
      .from('roommate_connections')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'accepted');

    // Get total reviews
    const { count: totalReviews } = await supabase
      .from('property_reviews')
      .select('*', { count: 'exact', head: true })
      .eq('is_published', true);

    // Get favorites count
    const { count: totalFavorites } = await supabase
      .from('apartment_favorites')
      .select('*', { count: 'exact', head: true });

    res.json({
      users: {
        total: totalUsers || 0,
        new: newUsers || 0,
      },
      listings: {
        properties: totalListings || 0,
        rooms: totalRoomListings || 0,
        total: (totalListings || 0) + (totalRoomListings || 0),
      },
      engagement: {
        messages: totalMessages || 0,
        connections: activeConnections || 0,
        reviews: totalReviews || 0,
        favorites: totalFavorites || 0,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Get user growth analytics
 * Requires: view_analytics permission (CONTENT_ADMIN, SUPER_ADMIN)
 */
router.get('/users/growth', requirePermission('view_analytics'), async (req: AuthRequest, res, next) => {
  try {
    const { period = '30d' } = req.query;

    // Calculate date range based on period
    const now = new Date();
    let startDate = new Date();

    switch (period) {
      case '7d':
        startDate.setDate(now.getDate() - 7);
        break;
      case '30d':
        startDate.setDate(now.getDate() - 30);
        break;
      case '90d':
        startDate.setDate(now.getDate() - 90);
        break;
      case '1y':
        startDate.setFullYear(now.getFullYear() - 1);
        break;
      default:
        startDate.setDate(now.getDate() - 30);
    }

    // Get user signups grouped by date
    const { data: signups, error } = await supabase
      .from('users')
      .select('created_at')
      .gte('created_at', startDate.toISOString())
      .order('created_at', { ascending: true });

    if (error) {
      throw error;
    }

    // Group by date
    const signupsByDate: Record<string, number> = {};

    signups?.forEach((user: any) => {
      const date = new Date(user.created_at).toISOString().split('T')[0];
      signupsByDate[date] = (signupsByDate[date] || 0) + 1;
    });

    // Convert to array format for charts
    const growthData = Object.entries(signupsByDate).map(([date, count]) => ({
      date,
      signups: count,
    }));

    res.json(growthData);
  } catch (error) {
    next(error);
  }
});

/**
 * Get listing analytics
 * Requires: view_analytics permission (CONTENT_ADMIN, SUPER_ADMIN)
 */
router.get('/listings', requirePermission('view_analytics'), async (req: AuthRequest, res, next) => {
  try {
    // Get property listings by type
    const { data: properties } = await supabase
      .from('apartment_properties_listings')
      .select('property_type, is_active');

    // Count by type
    const propertyByType: Record<string, { active: number; inactive: number }> = {};

    properties?.forEach((prop: any) => {
      const type = prop.property_type || 'Unknown';
      if (!propertyByType[type]) {
        propertyByType[type] = { active: 0, inactive: 0 };
      }
      if (prop.is_active) {
        propertyByType[type].active++;
      } else {
        propertyByType[type].inactive++;
      }
    });

    // Get room listings by type
    const { data: rooms } = await supabase
      .from('room_listings')
      .select('listing_type, is_active');

    const roomsByType: Record<string, { active: number; inactive: number }> = {};

    rooms?.forEach((room: any) => {
      const type = room.listing_type || 'Unknown';
      if (!roomsByType[type]) {
        roomsByType[type] = { active: 0, inactive: 0 };
      }
      if (room.is_active) {
        roomsByType[type].active++;
      } else {
        roomsByType[type].inactive++;
      }
    });

    // Get most favorited properties
    const { data: topFavorites } = await supabase
      .from('apartment_favorites')
      .select(`
        property_id,
        property:property_id (
          id,
          name,
          address
        )
      `);

    // Count favorites per property
    const favoritesCount: Record<string, { count: number; property: any }> = {};

    topFavorites?.forEach((fav: any) => {
      const propId = fav.property_id;
      if (!favoritesCount[propId]) {
        favoritesCount[propId] = { count: 0, property: fav.property };
      }
      favoritesCount[propId].count++;
    });

    // Get top 10 most favorited
    const topFavoritedProperties = Object.values(favoritesCount)
      .sort((a, b) => b.count - a.count)
      .slice(0, 10)
      .map(item => ({
        property: item.property,
        favorites: item.count,
      }));

    res.json({
      propertyTypes: propertyByType,
      roomTypes: roomsByType,
      topFavorited: topFavoritedProperties,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Get engagement analytics
 * Requires: view_analytics permission (CONTENT_ADMIN, SUPER_ADMIN)
 */
router.get('/engagement', requirePermission('view_analytics'), async (req: AuthRequest, res, next) => {
  try {
    const { period = '30d' } = req.query;

    // Calculate date range
    const now = new Date();
    let startDate = new Date();

    switch (period) {
      case '7d':
        startDate.setDate(now.getDate() - 7);
        break;
      case '30d':
        startDate.setDate(now.getDate() - 30);
        break;
      case '90d':
        startDate.setDate(now.getDate() - 90);
        break;
      default:
        startDate.setDate(now.getDate() - 30);
    }

    // Get messages over time
    const { data: messages } = await supabase
      .from('chat_messages')
      .select('created_at')
      .gte('created_at', startDate.toISOString())
      .order('created_at', { ascending: true });

    // Get connections over time
    const { data: connections } = await supabase
      .from('roommate_connections')
      .select('created_at, status')
      .gte('created_at', startDate.toISOString())
      .order('created_at', { ascending: true });

    // Get reviews over time
    const { data: reviews } = await supabase
      .from('property_reviews')
      .select('created_at')
      .gte('created_at', startDate.toISOString())
      .order('created_at', { ascending: true });

    // Group by date
    const messagesByDate: Record<string, number> = {};
    const connectionsByDate: Record<string, number> = {};
    const reviewsByDate: Record<string, number> = {};

    messages?.forEach((msg: any) => {
      const date = new Date(msg.created_at).toISOString().split('T')[0];
      messagesByDate[date] = (messagesByDate[date] || 0) + 1;
    });

    connections?.forEach((conn: any) => {
      const date = new Date(conn.created_at).toISOString().split('T')[0];
      connectionsByDate[date] = (connectionsByDate[date] || 0) + 1;
    });

    reviews?.forEach((review: any) => {
      const date = new Date(review.created_at).toISOString().split('T')[0];
      reviewsByDate[date] = (reviewsByDate[date] || 0) + 1;
    });

    // Get connection acceptance rate
    const totalConnections = connections?.length || 0;
    const acceptedConnections = connections?.filter((c: any) => c.status === 'accepted').length || 0;
    const acceptanceRate = totalConnections > 0 ? (acceptedConnections / totalConnections) * 100 : 0;

    res.json({
      messages: messagesByDate,
      connections: connectionsByDate,
      reviews: reviewsByDate,
      metrics: {
        totalMessages: messages?.length || 0,
        totalConnections: totalConnections,
        acceptedConnections: acceptedConnections,
        acceptanceRate: Math.round(acceptanceRate * 100) / 100,
        totalReviews: reviews?.length || 0,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Get top users by activity
 * Requires: view_analytics permission (CONTENT_ADMIN, SUPER_ADMIN)
 */
router.get('/users/top', requirePermission('view_analytics'), async (req: AuthRequest, res, next) => {
  try {
    // Get users with most messages
    const { data: messageStats } = await supabase
      .from('chat_messages')
      .select(`
        sender_id,
        sender:sender_id (
          user_id,
          email,
          first_name,
          last_name
        )
      `);

    // Count messages per user
    const messagesPerUser: Record<number, { count: number; user: any }> = {};

    messageStats?.forEach((msg: any) => {
      const userId = msg.sender_id;
      if (!messagesPerUser[userId]) {
        messagesPerUser[userId] = { count: 0, user: msg.sender };
      }
      messagesPerUser[userId].count++;
    });

    // Get top 10 by messages
    const topMessageUsers = Object.values(messagesPerUser)
      .sort((a, b) => b.count - a.count)
      .slice(0, 10)
      .map(item => ({
        user: {
          id: item.user.user_id,
          email: item.user.email,
          name: `${item.user.first_name || ''} ${item.user.last_name || ''}`.trim(),
        },
        messageCount: item.count,
      }));

    res.json({
      topMessageUsers,
    });
  } catch (error) {
    next(error);
  }
});

export { router as analyticsRoutes };
