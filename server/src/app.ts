import express, { Express } from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { DatabaseSync } from './db/sqliteAdapter.js';
import { EnvConfig } from './config/env.js';
import { DealRepository } from './repositories/dealRepository.js';
import { VerificationRepository } from './repositories/verificationRepository.js';
import { ApprovalRepository } from './repositories/approvalRepository.js';
import { AuditRepository } from './repositories/auditRepository.js';
import { PaymentRepository } from './repositories/paymentRepository.js';
import { NegotiationRepository } from './repositories/negotiationRepository.js';
import { PaymentService } from './services/paymentService.js';
import { PayPalClient, HttpPayPalClient, MockPayPalClient } from './services/paypalClient.js';
import { LLMProvider } from './llm/types.js';
import { createLLMProvider } from './llm/providerFactory.js';
import { NegotiationCoordinator } from './services/negotiation/negotiationCoordinator.js';
import { createApiRouter } from './routes/api.js';
import { createAuthMiddleware, authMiddleware } from './middleware/auth.js';
import { rateLimiter } from './middleware/rateLimiter.js';
import { errorHandler } from './middleware/errorHandler.js';

export function createApp(
  db: DatabaseSync,
  config: EnvConfig,
  customPayPalClient?: PayPalClient,
  customLLMProvider?: LLMProvider
): Express {
  const app = express();

  // Explicit CORS configuration (allows localhost ports in dev, enforces strict origin in production)
  const allowedOrigin =
    config.NODE_ENV === 'production'
      ? (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
          // Allow same-origin (no origin header), configured CORS_ORIGIN, or any onrender.com domain
          if (!origin || origin === config.CORS_ORIGIN || origin.endsWith('.onrender.com') || /^https:\/\/[a-zA-Z0-9-]+\.onrender\.com$/.test(origin)) {
            callback(null, true);
          } else {
            callback(null, false);
          }
        }
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

  // Server-verified identity authentication middleware
  app.use(createAuthMiddleware(config));

  // Repositories
  const dealRepo = new DealRepository(db);
  const verifRepo = new VerificationRepository(db);
  const approvalRepo = new ApprovalRepository(db);
  const auditRepo = new AuditRepository(db);
  const paymentRepo = new PaymentRepository(db);
  const negRepo = new NegotiationRepository(db);

  // LLM Provider & Negotiation Coordinator
  const llmProvider = customLLMProvider || createLLMProvider(config);
  const negotiationCoordinator = new NegotiationCoordinator(
    llmProvider,
    negRepo,
    dealRepo,
    auditRepo
  );

  // PayPal client: Http client for live Sandbox credentials, Mock client for local dev/testing
  let paypalClient: PayPalClient;
  if (customPayPalClient) {
    paypalClient = customPayPalClient;
  } else if (config.PAYPAL_CLIENT_ID && config.PAYPAL_CLIENT_SECRET) {
    paypalClient = new HttpPayPalClient(
      config.PAYPAL_CLIENT_ID,
      config.PAYPAL_CLIENT_SECRET,
      config.PAYPAL_BASE_URL,
      config.PAYPAL_RETURN_URL,
      config.PAYPAL_CANCEL_URL
    );
  } else {
    if (config.NODE_ENV === 'production') {
      throw new Error(
        'Production configuration error: PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET are required in production. Simulated mock payment is prohibited in production.'
      );
    }
    paypalClient = new MockPayPalClient();
  }

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
      version: '6.0.0',
      timestamp: new Date().toISOString(),
    });
  });

  // Mount API endpoints
  app.use(
    '/api',
    createApiRouter(
      dealRepo,
      verifRepo,
      approvalRepo,
      auditRepo,
      paymentService,
      negRepo,
      negotiationCoordinator,
      config
    )
  );

  // Centralized error handler
  app.use(errorHandler);

  // Serve built frontend assets in production / unified deployment
  const possibleDistDirs = [
    path.resolve(process.cwd(), 'dist'),
    path.resolve(process.cwd(), '../dist'),
  ];
  const frontendDir = possibleDistDirs.find((dir) => fs.existsSync(path.join(dir, 'index.html')));

  if (frontendDir) {
    app.use(express.static(frontendDir));
    app.get('*', (req, res, next) => {
      if (req.path.startsWith('/api') || req.path.startsWith('/health')) {
        return next();
      }
      res.sendFile(path.join(frontendDir, 'index.html'));
    });
  }

  return app;
}
