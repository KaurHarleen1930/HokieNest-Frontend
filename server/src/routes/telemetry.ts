// server/src/routes/telemetry.ts
// Simplified telemetry API endpoints

import { Router, Request, Response } from 'express';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { telemetryService } from '../services/telemetryService';
import { guardrailsService } from '../services/guardrailsService';

const router = Router();

/**
 * GET /api/v1/telemetry/stats
 * Get simple telemetry statistics (admin only)
 */
router.get('/stats', authenticateToken as any, async (req: AuthRequest, res: Response) => {
  try {
    if (req.user?.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Admin access required',
      });
    }

    const stats = telemetryService.getStats();
    const recentErrors = telemetryService.getRecentErrors(10);

    res.json({
      success: true,
      data: {
        stats,
        recentErrors,
      },
    });
  } catch (error) {
    console.error('Telemetry stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve telemetry statistics',
    });
  }
});

/**
 * GET /api/v1/telemetry/health
 * Get telemetry service health status
 */
router.get('/health', async (req: Request, res: Response) => {
  try {
    res.json({
      success: true,
      message: 'Telemetry service is healthy',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Telemetry service is unhealthy',
    });
  }
});

export default router;
