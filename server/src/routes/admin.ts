import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateToken, requireAdmin, AuthRequest } from '../middleware/auth';

const router = Router();
const prisma = new PrismaClient();

// Apply auth middleware to all admin routes
router.use(authenticateToken);
router.use(requireAdmin);

// Get all users
router.get('/users', async (req: AuthRequest, res, next) => {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        suspended: true,
        createdAt: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    res.json(users);
  } catch (error) {
    next(error);
  }
});

// Suspend user
router.post('/users/:id/suspend', async (req: AuthRequest, res, next) => {
  try {
    const { id } = req.params;

    // Don't allow admins to suspend themselves
    if (id === req.user?.id) {
      return res.status(400).json({ message: 'Cannot suspend yourself' });
    }

    // Check if user exists and is not already suspended
    const user = await prisma.user.findUnique({
      where: { id },
    });

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (user.suspended) {
      return res.status(400).json({ message: 'User is already suspended' });
    }

    // Don't allow suspending other admins
    if (user.role === 'admin') {
      return res.status(403).json({ message: 'Cannot suspend admin users' });
    }

    // Suspend the user
    await prisma.user.update({
      where: { id },
      data: { suspended: true },
    });

    res.json({ success: true, message: 'User suspended successfully' });
  } catch (error) {
    next(error);
  }
});

export { router as adminRoutes };