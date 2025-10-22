import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { supabase } from '../lib/supabase';

export interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
    name: string;
    role: 'student' | 'staff' | 'admin';
  };
}

export const authenticateToken = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ message: 'Access token required' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as { userId: string };

    const { data: user } = await supabase
      .from('users')
      .select('user_id, email, first_name, last_name, is_admin')
      .eq('user_id', decoded.userId)
      .single();

    if (!user) {
      return res.status(401).json({ message: 'Invalid token' });
    }

    // Format user for the application
    const formattedUser = {
      id: user.user_id, // Keep as original type (UUID or integer)
      email: user.email,
      name: `${user.first_name || ''} ${user.last_name || ''}`.trim() || 'User',
      role: user.is_admin ? 'admin' : 'student'
    };

    req.user = formattedUser;
    next();
  } catch (error) {
    return res.status(403).json({ message: 'Invalid token' });
  }
};

export const requireAdmin = (req: AuthRequest, res: Response, next: NextFunction) => {
  if (!req.user) {
    return res.status(401).json({ message: 'Authentication required' });
  }

  if (req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Admin access required' });
  }

  next();
};