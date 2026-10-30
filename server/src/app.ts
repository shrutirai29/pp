import express, { Express } from 'express';
import cors from 'cors';
import { DatabaseSync } from './db/sqliteAdapter.js';
import { EnvConfig } from './config/env.js';
import { DealRepository } from './repositories/dealRepository.js';
import { VerificationRepository } from './repositories/verificationRepository.js';
import { ApprovalRepository } from './repositories/approvalRepository.js';
import { AuditRepository } from './repositories/auditRepository.js';
import { createApiRouter } from './routes/api.js';
import { authMiddleware } from './middleware/auth.js';
import { rateLimiter } from './middleware/rateLimiter.js';
import { errorHandler } from './middleware/errorHandler.js';

export function createApp(db: DatabaseSync, config: EnvConfig): Express {
  const app = express();

  // Explicit CORS configuration
  app.use(
    cors({
      origin: config.CORS_ORIGIN || '*',
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

  // Health check endpoint
  app.get('/health', (_req, res) => {
    res.json({
      status: 'ok',
      service: 'DealMind IntentLock Security Gateway',
      version: '4.0.0',
      timestamp: new Date().toISOString(),
    });
  });

  // Mount API endpoints
  app.use('/api', createApiRouter(dealRepo, verifRepo, approvalRepo, auditRepo, config));

  // Centralized error handler
  app.use(errorHandler);

  return app;
}
