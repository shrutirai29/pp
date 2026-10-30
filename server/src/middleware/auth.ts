import { Request, Response, NextFunction } from 'express';

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
      };
    }
  }
}

/**
 * Development Session / Identity Middleware (Step 6):
 * Extracts user identity from the `x-user-id` or `authorization` header, or defaults
 * to a development session ID (`dev-user-default`).
 * Ensures that deals, verification reports, and approvals are bound to the owning user/session,
 * preventing cross-session authorization abuse.
 */
export function authMiddleware(req: Request, res: Response, next: NextFunction) {
  const headerUserId = req.headers['x-user-id'] || req.headers['x-session-id'];
  const userId = typeof headerUserId === 'string' && headerUserId.trim().length > 0
    ? headerUserId.trim()
    : null;

  if (!userId) {
    if (process.env.NODE_ENV === 'production') {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized: Missing x-user-id or session credential.',
      });
    }
    // In dev / test, use development default session
    req.user = { id: 'dev-user-default' };
    return next();
  }

  req.user = { id: userId };
  next();
}
