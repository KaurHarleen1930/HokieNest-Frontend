import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { ragService, ChatbotContext, ChatbotRequest } from '../services/ragService';

const router = Router();

// Validation schemas
const chatbotRequestSchema = z.object({
  message: z.string().min(1, 'Message is required').max(1000, 'Message too long'),
  sessionId: z.string().optional(),
  currentPage: z.string().optional(),
});

const faqItemSchema = z.object({
  question: z.string().min(1, 'Question is required'),
  answer: z.string().min(1, 'Answer is required'),
  category: z.string().min(1, 'Category is required'),
  tags: z.array(z.string()).default([]),
  priority: z.number().int().min(1).max(10).default(5),
});

// Chat endpoint
router.post('/chat', authenticateToken as any, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.id;
    const validatedData = chatbotRequestSchema.parse(req.body);

    const context: ChatbotContext = {
      userId: userId ? parseInt(userId) : undefined,
      userEmail: req.user?.email,
      currentPage: validatedData.currentPage,
      sessionId: validatedData.sessionId || `session-${Date.now()}`,
      timestamp: new Date(),
    };

    const request: ChatbotRequest = {
      message: validatedData.message,
      context,
    };

    const response = await ragService.generateResponse(request);

    res.json({
      success: true,
      data: response,
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: error.errors,
      });
    }

    console.error('Chatbot error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
});

// Public chat endpoint (no authentication required)
router.post('/chat/public', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const validatedData = chatbotRequestSchema.parse(req.body);

    const context: ChatbotContext = {
      currentPage: validatedData.currentPage,
      sessionId: validatedData.sessionId || `public-session-${Date.now()}`,
      timestamp: new Date(),
    };

    const request: ChatbotRequest = {
      message: validatedData.message,
      context,
    };

    const response = await ragService.generateResponse(request);

    res.json({
      success: true,
      data: response,
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: error.errors,
      });
    }

    console.error('Public chatbot error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
});

// Get FAQ items
router.get('/faq', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const category = req.query.category as string;
    const limit = parseInt(req.query.limit as string) || 50;

    // Get FAQ items from RAG service
    const faqItems = ragService.getFAQItems(category, limit);

    res.json({
      success: true,
      data: faqItems,
      count: faqItems.length,
    });

  } catch (error) {
    console.error('FAQ retrieval error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve FAQ items',
    });
  }
});

// Add FAQ item (admin only)
router.post('/faq', authenticateToken as any, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    // Check if user is admin
    if (req.user?.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Admin access required',
      });
    }

    const validatedData = faqItemSchema.parse(req.body);
    const faqId = await ragService.addFAQItem(validatedData);

    res.json({
      success: true,
      data: { id: faqId },
      message: 'FAQ item added successfully',
    });

  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: error.errors,
      });
    }

    console.error('FAQ creation error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create FAQ item',
    });
  }
});

// Update FAQ item (admin only)
router.put('/faq/:id', authenticateToken as any, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (req.user?.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Admin access required',
      });
    }

    const { id } = req.params;
    const validatedData = faqItemSchema.partial().parse(req.body);
    
    const success = await ragService.updateFAQItem(id, validatedData);

    if (!success) {
      return res.status(404).json({
        success: false,
        message: 'FAQ item not found',
      });
    }

    res.json({
      success: true,
      message: 'FAQ item updated successfully',
    });

  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: error.errors,
      });
    }

    console.error('FAQ update error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update FAQ item',
    });
  }
});

// Delete FAQ item (admin only)
router.delete('/faq/:id', authenticateToken as any, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (req.user?.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Admin access required',
      });
    }

    const { id } = req.params;
    const success = await ragService.deleteFAQItem(id);

    if (!success) {
      return res.status(404).json({
        success: false,
        message: 'FAQ item not found',
      });
    }

    res.json({
      success: true,
      message: 'FAQ item deleted successfully',
    });

  } catch (error) {
    console.error('FAQ deletion error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete FAQ item',
    });
  }
});

// Get cost logs (admin only)
router.get('/costs', authenticateToken as any, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (req.user?.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Admin access required',
      });
    }

    const limit = parseInt(req.query.limit as string) || 100;
    const costLogs = ragService.getCostLogs(limit);
    const totalCost = ragService.getTotalCost();

    res.json({
      success: true,
      data: {
        logs: costLogs,
        totalCost,
        count: costLogs.length,
      },
    });

  } catch (error) {
    console.error('Cost logs error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve cost logs',
    });
  }
});

// Get rate limit status
router.get('/rate-limit/:userId', authenticateToken as any, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { userId } = req.params;
    const status = ragService.getRateLimitStatus(userId);

    res.json({
      success: true,
      data: status || { count: 0, resetTime: Date.now() },
    });

  } catch (error) {
    console.error('Rate limit status error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get rate limit status',
    });
  }
});

// Reset rate limit (admin only)
router.post('/rate-limit/:userId/reset', authenticateToken as any, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (req.user?.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Admin access required',
      });
    }

    const { userId } = req.params;
    ragService.resetRateLimit(userId);

    res.json({
      success: true,
      message: 'Rate limit reset successfully',
    });

  } catch (error) {
    console.error('Rate limit reset error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to reset rate limit',
    });
  }
});

// Get chat logs (admin only)
router.get('/logs', authenticateToken as any, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (req.user?.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Admin access required',
      });
    }

    const limit = parseInt(req.query.limit as string) || 100;
    const chatLogs = ragService.getChatLogs(limit);
    const stats = ragService.getChatStats();

    res.json({
      success: true,
      data: {
        logs: chatLogs,
        stats,
        count: chatLogs.length,
      },
    });

  } catch (error) {
    console.error('Chat logs error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve chat logs',
    });
  }
});

// Get chatbot statistics (admin only)
router.get('/stats', authenticateToken as any, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (req.user?.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Admin access required',
      });
    }

    const stats = ragService.getChatStats();
    const costLogs = ragService.getCostLogs(50);
    const totalCost = ragService.getTotalCost();

    res.json({
      success: true,
      data: {
        ...stats,
        totalCost,
        recentCosts: costLogs,
      },
    });

  } catch (error) {
    console.error('Chatbot stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve chatbot statistics',
    });
  }
});

// Health check endpoint
router.get('/health', async (req: Request, res: Response, next: NextFunction) => {
  try {
    res.json({
      success: true,
      message: 'Chatbot service is healthy',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Chatbot service is unhealthy',
    });
  }
});

export default router;

