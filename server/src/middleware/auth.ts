import { Request, Response, NextFunction } from 'express';
import { EnvConfig } from '../config/env.js';
import { verifySessionToken } from '../services/authService.js';

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
 * Creates the server-verified authentication middleware.
 * Enforces cryptographic HMAC-SHA256 token verification on all protected endpoints.
 * Rejects arbitrary client-supplied identity headers (e.g., x-user-id, x-session-id).
 */
export function createAuthMiddleware(config: EnvConfig) {
  return function authMiddleware(req: Request, res: Response, next: NextFunction) {
    // 1. Whitelisted public endpoints
    if (
      req.path === '/health' ||
      req.path === '/api/config/paypal' ||
      req.path === '/api/auth/session' ||
      req.path === '/api/auth/dev-session'
    ) {
      return next();
    }

    // 2. Extract Bearer token from Authorization or x-session-token header
    const authHeader = req.headers['authorization'];
    const sessionTokenHeader = req.headers['x-session-token'];
    let token: string | null = null;

    if (typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7).trim();
    } else if (typeof sessionTokenHeader === 'string' && sessionTokenHeader.trim().length > 0) {
      token = sessionTokenHeader.trim();
    }

    // 3. Reject untrusted client-supplied identity headers if supplied without a valid token
    const untrustedIdentity = req.headers['x-user-id'] || req.headers['x-session-id'];
    if (untrustedIdentity && !token) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized: Arbitrary client identity headers (x-user-id/x-session-id) are untrusted and rejected. Provide a signed session token via Authorization: Bearer <token>.',
      });
    }

    // 4. If a token is provided, verify signature, expiration, and payload
    if (token) {
      const verification = verifySessionToken(token, config.TOKEN_HMAC_SECRET);
      if (!verification.valid || !verification.userId) {
        return res.status(401).json({
          success: false,
          error: `Unauthorized: ${verification.reason || 'Invalid or expired session token.'}`,
        });
      }

      // If client also supplied an untrusted identity header that doesn't match the verified token, reject
      if (untrustedIdentity && typeof untrustedIdentity === 'string' && untrustedIdentity.trim() !== verification.userId) {
        return res.status(401).json({
          success: false,
          error: 'Unauthorized: Identity header mismatch with verified token payload.',
        });
      }

      req.user = { id: verification.userId };
      return next();
    }

    // 5. If no token provided:
    // In production, reject immediately
    if (config.NODE_ENV === 'production') {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized: Authentication token is required in production.',
      });
    }

    // In isolated development / test mode, allow fallback to a default isolated dev session ONLY when no token is passed
    req.user = { id: 'dev-user-default' };
    res.setHeader('x-dealmind-auth-mode', 'isolated-dev-default');
    return next();
  };
}

/**
 * Backward compatibility fallback for tests or callers that do not use the factory.
 */
export function authMiddleware(req: Request, res: Response, next: NextFunction) {
  const secret = process.env.TOKEN_HMAC_SECRET || 'dev_insecure_hmac_secret_for_demo_only';
  const nodeEnv = (process.env.NODE_ENV || 'development') as any;
  const config = { TOKEN_HMAC_SECRET: secret, NODE_ENV: nodeEnv } as EnvConfig;
  return createAuthMiddleware(config)(req, res, next);
}
