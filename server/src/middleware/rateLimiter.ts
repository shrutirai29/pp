import { Request, Response, NextFunction } from 'express';

interface RateLimitRecord {
  count: number;
  resetAt: number;
}

const ipBuckets = new Map<string, RateLimitRecord>();

export function rateLimiter(maxRequests: number = 200, windowMs: number = 60000) {
  return (req: Request, res: Response, next: NextFunction) => {
    const ip = req.ip || req.socket.remoteAddress || 'unknown-ip';
    const now = Date.now();

    const record = ipBuckets.get(ip);
    if (!record || now > record.resetAt) {
      ipBuckets.set(ip, {
        count: 1,
        resetAt: now + windowMs,
      });
      return next();
    }

    record.count++;
    if (record.count > maxRequests) {
      return res.status(429).json({
        success: false,
        error: 'Too many requests. Please slow down.',
      });
    }

    next();
  };
}
