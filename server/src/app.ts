import express, { Express } from 'express';
import cors from 'cors';
import { DatabaseSync } from './db/sqliteAdapter.js';
import { EnvConfig } from './config/env.js';
import { DealRepository } from './repositories/dealRepository.js';
import { VerificationRepository } from './repositories/verificationRepository.js';
import { ApprovalRepository } from './repositories/approvalRepository.js';
import { AuditRepository } from './repositories/auditRepository.js';
import { PaymentRepository } from './repositories/paymentRepository.js';
import { PaymentService } from './services/paymentService.js';
import { PayPalClient, HttpPayPalClient } from './services/paypalClient.js';
import { createApiRouter } from './routes/api.js';
import { authMiddleware } from './middleware/auth.js';
import { rateLimiter } from './middleware/rateLimiter.js';
import { errorHandler } from './middleware/errorHandler.js';

export function createApp(
  db: DatabaseSync,
  config: EnvConfig,
  customPayPalClient?: PayPalClient
): Express {
  const app = express();

  // Explicit CORS configuration (allows localhost ports in dev, enforces strict origin in production)
  const allowedOrigin =
    config.NODE_ENV === 'production'
      ? config.CORS_ORIGIN
      : (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
          if (!origin || /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin) || origin === config.CORS_ORIGIN) {
            callback(null, true);
          } else {
            callback(null, false);
          }
        };

  app.use(
    cors({
      origin: allowedOrigin,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'x-user-id', 'x-session-id'],
      credentials: true,
    })
  );

  // Request body parsing with strict size limits
  app.use(express.json({ limit: '1mb' }));

  // Global rate limiter
  app.use(rateLimiter(300, 60000));

  // Development auth / identity session
  app.use(authMiddleware);

  // Repositories
  const dealRepo = new DealRepository(db);
  const verifRepo = new VerificationRepository(db);
  const approvalRepo = new ApprovalRepository(db);
  const auditRepo = new AuditRepository(db);
  const paymentRepo = new PaymentRepository(db);

  // PayPal client (Http client for live Sandbox, or injected mock for testing)
  const paypalClient =
    customPayPalClient ||
    new HttpPayPalClient(
      config.PAYPAL_CLIENT_ID,
      config.PAYPAL_CLIENT_SECRET,
      config.PAYPAL_BASE_URL
    );

  // Dedicated Payment Service
  const paymentService = new PaymentService(
    dealRepo,
    verifRepo,
    approvalRepo,
    auditRepo,
    paymentRepo,
    paypalClient,
    config
  );

  // Health check endpoint
  app.get('/health', (_req, res) => {
    res.json({
      status: 'ok',
      service: 'DealMind IntentLock Security Gateway',
      version: '5.0.0',
      timestamp: new Date().toISOString(),
    });
  });

  // Mount API endpoints
  app.use(
    '/api',
    createApiRouter(dealRepo, verifRepo, approvalRepo, auditRepo, paymentService, config)
  );

  // Centralized error handler
  app.use(errorHandler);

  return app;
}
