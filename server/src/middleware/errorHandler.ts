import { Request, Response, NextFunction } from 'express';

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  console.error('[SERVER ERROR]:', err);

  const message = err instanceof Error ? err.message : 'Internal server error';
  const status = (err as { status?: number }).status || 500;

  res.status(status).json({
    success: false,
    error: message,
  });
}
