import type { Request, Response, NextFunction } from 'express';
import { verifyAccessToken } from '../utils/useJwt.ts';

export const verifyTokenMiddleware = (req: Request, res: Response, next: NextFunction) => {
  try {
    // Try to get token from cookie first (more secure)
    let token = req.cookies.accessToken;

    // Fallback to Authorization header for mobile apps
    if (!token) {
      const authHeader = req.headers.authorization;
      if (authHeader?.startsWith('Bearer ')) {
        token = authHeader.slice(7);
      }
    }

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'No authentication token provided'
      });
    }

    const user = verifyAccessToken(token);
    req.user = user;
    next();
  } catch (error: any) {
    return res.status(401).json({
      success: false,
      message: error.message || 'Invalid or expired token'
    });
  }
};

// Optional: Role-based access control
export const requireRole = (...roles: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'User not authenticated'
      });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'Insufficient permissions'
      });
    }

    next();
  };
};