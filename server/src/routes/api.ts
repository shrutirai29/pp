import { Router, Request, Response, NextFunction } from 'express';
import crypto from 'node:crypto';
import { DealRepository } from '../repositories/dealRepository.js';
import { VerificationRepository } from '../repositories/verificationRepository.js';
import { ApprovalRepository } from '../repositories/approvalRepository.js';
import { AuditRepository } from '../repositories/auditRepository.js';
import { PaymentService, PaymentSecurityError } from '../services/paymentService.js';
import { ServerIntentVerifier } from '../services/intentLockService.js';
import {
  generateServerDealFingerprint,
  hashAuthorizationToken,
} from '../services/integrityService.js';
import {
  CreateDealPayloadSchema,
  FinalDealSchema,
  ConsumeAuthorizationPayloadSchema,
  CheckoutPayloadSchema,
  CapturePayloadSchema,
  CancelPaymentPayloadSchema,
} from '../schemas/dealSchemas.js';
import { EnvConfig } from '../config/env.js';

export function createApiRouter(
  dealRepo: DealRepository,
  verifRepo: VerificationRepository,
  approvalRepo: ApprovalRepository,
  auditRepo: AuditRepository,
  paymentService: PaymentService,
  config: EnvConfig
): Router {
  const router = Router();

  // ---------------------------------------------------------------------------
  // 0. GET /api/config/paypal - Public Sandbox Client Configuration (Safe)
  // ---------------------------------------------------------------------------
  router.get('/config/paypal', (_req: Request, res: Response) => {
    res.json({
      success: true,
      data: {
        clientId: config.PAYPAL_CLIENT_ID || 'sb',
        env: config.PAYPAL_ENV || 'sandbox',
        currency: 'USD',
      },
    });
  });

  // ---------------------------------------------------------------------------
  // 1. POST /api/deals - Create a deal record with UserIntent
  // ---------------------------------------------------------------------------
  router.post('/deals', (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = CreateDealPayloadSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          success: false,
          error: 'Invalid deal creation payload',
          details: parsed.error.format(),
        });
      }

      const userId = req.user?.id || 'dev-user-default';
      const { intent, finalDeal, title } = parsed.data;

      // Persist deal
      const deal = dealRepo.createDeal(userId, intent, finalDeal, title);

      // Record audit event
      auditRepo.recordEvent(
        deal.id,
        'requirements_created',
        'Buyer Intent Registered on Server',
        `User registered purchase intent: "${intent.rawQuery}". Ceiling: ${intent.currency} ${intent.maxBudget}`,
        'user',
        { maxBudget: intent.maxBudget, currency: intent.currency, condition: intent.requiredCondition }
      );

      res.status(201).json({
        success: true,
        data: deal,
      });
    } catch (err) {
      next(err);
    }
  });

  // ---------------------------------------------------------------------------
  // 1b. GET /api/deals - List deals for current authenticated user
  // ---------------------------------------------------------------------------
  router.get('/deals', (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user?.id || 'dev-user-default';
      const deals = dealRepo.listDealsForUser(userId);
      res.json({
        success: true,
        data: deals,
      });
    } catch (err) {
      next(err);
    }
  });

  // ---------------------------------------------------------------------------
  // 2. GET /api/deals/:id - Fetch deal & latest status
  // ---------------------------------------------------------------------------
  router.get('/deals/:id', (req: Request, res: Response, next: NextFunction) => {
    try {
      const deal = dealRepo.getDeal(req.params.id);
      if (!deal) {
        return res.status(404).json({
          success: false,
          error: 'Deal not found',
        });
      }

      // Check user authorization on deal
      const userId = req.user?.id || 'dev-user-default';
      if (deal.userId !== userId) {
        return res.status(403).json({
          success: false,
          error: "Unauthorized: Deal belongs to another user.",
        });
      }

      const latestReport = verifRepo.getLatestReportForDeal(deal.id);
      const latestApproval = approvalRepo.getLatestApprovalForDeal(deal.id);
      const latestPayment = paymentService.getPaymentForDeal(deal.id, userId);

      res.json({
        success: true,
        data: {
          ...deal,
          latestVerification: latestReport?.report || null,
          latestApproval: latestApproval || null,
          latestPayment: latestPayment || null,
        },
      });
    } catch (err) {
      next(err);
    }
  });

  // ---------------------------------------------------------------------------
  // 3. POST /api/deals/:id/verify - Server-side IntentLock Independent Verification
  // ---------------------------------------------------------------------------
  router.post('/deals/:id/verify', (req: Request, res: Response, next: NextFunction) => {
    try {
      const deal = dealRepo.getDeal(req.params.id);
      if (!deal) {
        return res.status(404).json({
          success: false,
          error: 'Deal not found',
        });
      }

      // Check user authorization on deal
      const userId = req.user?.id || 'dev-user-default';
      if (deal.userId !== userId) {
        return res.status(403).json({
          success: false,
          error: 'Unauthorized access to this deal',
        });
      }

      // Extract FinalDeal from request body or stored record
      let finalDeal = deal.finalDeal;
      if (req.body && req.body.finalDeal) {
        const parsedDeal = FinalDealSchema.safeParse(req.body.finalDeal);
        if (!parsedDeal.success) {
          return res.status(400).json({
            success: false,
            error: 'Invalid FinalDeal format',
            details: parsedDeal.error.format(),
          });
        }
        finalDeal = parsedDeal.data;
        // Update stored finalDeal
        dealRepo.updateFinalDeal(deal.id, finalDeal);
      }

      if (!finalDeal) {
        return res.status(400).json({
          success: false,
          error: 'No negotiated FinalDeal available to verify.',
        });
      }

      auditRepo.recordEvent(
        deal.id,
        'verification_started',
        'IntentLock Server Verification Started',
        'Independent policy engine evaluating final contract terms against user intent.',
        'intentlock_engine'
      );

      // Run authoritative server verification
      const report = ServerIntentVerifier.verify(deal.intent, finalDeal);

      // Persist verification report
      verifRepo.saveReport(report);

      // Invalidate any existing approval if deal terms/fingerprint changed upon re-verification
      const existingApproval = approvalRepo.getLatestApprovalForDeal(deal.id);
      if (
        existingApproval &&
        (existingApproval.status === 'PENDING' || existingApproval.status === 'APPROVED') &&
        existingApproval.fingerprint !== report.dealFingerprint
      ) {
        approvalRepo.updateToInvalidated(
          existingApproval.id,
          'Deal terms were modified and re-verified. Prior approval invalidated.'
        );
        auditRepo.recordEvent(
          deal.id,
          'approval_invalidated',
          'Prior Approval Invalidated by Re-Verification',
          'Deal was re-verified with altered terms; prior approval record invalidated.',
          'intentlock_engine',
          { priorApprovalId: existingApproval.id, newFingerprint: report.dealFingerprint }
        );
      }

      // Update deal status based on verification result
      const newStatus = report.status === 'VERIFIED' ? 'verified' : 'rejected';
      dealRepo.updateDealStatus(deal.id, newStatus);

      auditRepo.recordEvent(
        deal.id,
        report.status === 'VERIFIED' ? 'deal_verified' : 'deal_rejected',
        `IntentLock Verification Completed: ${report.status}`,
        report.summary,
        'intentlock_engine',
        {
          status: report.status,
          fingerprint: report.dealFingerprint,
          passedCount: report.passedCount,
          failedCount: report.failedCount,
          needsReviewCount: report.needsReviewCount,
        }
      );

      res.json({
        success: true,
        data: report,
      });
    } catch (err) {
      next(err);
    }
  });

  // ---------------------------------------------------------------------------
  // 4. POST /api/deals/:id/approval-request - Request Explicit Human Approval
  // ---------------------------------------------------------------------------
  router.post('/deals/:id/approval-request', (req: Request, res: Response, next: NextFunction) => {
    try {
      const deal = dealRepo.getDeal(req.params.id);
      if (!deal) {
        return res.status(404).json({ success: false, error: 'Deal not found' });
      }

      const userId = req.user?.id || 'dev-user-default';
      if (deal.userId !== userId) {
        return res.status(403).json({ success: false, error: 'Unauthorized: deal owned by another user' });
      }

      const latestReport = verifRepo.getLatestReportForDeal(deal.id);
      if (!latestReport) {
        return res.status(400).json({ success: false, error: 'No verification report exists for this deal.' });
      }

      // Strict requirement: Only VERIFIED deals can request approval
      if (latestReport.status !== 'VERIFIED') {
        return res.status(400).json({
          success: false,
          error: `Cannot request human approval for deal with verification status: ${latestReport.status}.`,
        });
      }

      // Check that finalDeal is present and matches fingerprint
      if (!deal.finalDeal) {
        return res.status(400).json({ success: false, error: 'No FinalDeal on file.' });
      }

      const currentFingerprint = generateServerDealFingerprint(deal.finalDeal);
      if (currentFingerprint !== latestReport.fingerprint) {
        return res.status(400).json({
          success: false,
          error: 'Deal was modified after verification report was issued. Complete re-verification required.',
        });
      }

      // Generate approval ID and expiration
      const approvalId = `appr-srv-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
      const expiresAt = new Date(Date.now() + config.APPROVAL_VALIDITY_SECONDS * 1000).toISOString();

      const approval = approvalRepo.createApprovalRequest(
        approvalId,
        deal.id,
        latestReport.id,
        userId,
        currentFingerprint,
        expiresAt
      );

      auditRepo.recordEvent(
        deal.id,
        'human_approval_requested',
        'Human Purchase Approval Requested',
        `Awaiting explicit buyer confirmation for contract fingerprint ${currentFingerprint.slice(0, 12)}...`,
        'intentlock_engine',
        { approvalId, expiresAt }
      );

      res.status(201).json({
        success: true,
        data: approval,
      });
    } catch (err) {
      next(err);
    }
  });

  // ---------------------------------------------------------------------------
  // 5. POST /api/deals/:id/approve - Explicit Human Approval
  // ---------------------------------------------------------------------------
  router.post('/deals/:id/approve', (req: Request, res: Response, next: NextFunction) => {
    try {
      const deal = dealRepo.getDeal(req.params.id);
      if (!deal) {
        return res.status(404).json({ success: false, error: 'Deal not found' });
      }

      const userId = req.user?.id || 'dev-user-default';
      if (deal.userId !== userId) {
        return res.status(403).json({ success: false, error: 'Unauthorized: Cannot approve another user\'s deal.' });
      }

      const approval = approvalRepo.getLatestApprovalForDeal(deal.id);
      if (!approval) {
        return res.status(400).json({ success: false, error: 'No active approval request found.' });
      }

      if (approval.status !== 'PENDING') {
        return res.status(400).json({
          success: false,
          error: `Cannot approve deal with status ${approval.status}.`,
        });
      }

      // Server-side expiration check
      if (new Date() > new Date(approval.expiresAt)) {
        approvalRepo.updateToExpired(approval.id);
        auditRepo.recordEvent(
          deal.id,
          'approval_expired',
          'Approval Request Expired',
          'Approval validity window elapsed before human confirmation was received.',
          'intentlock_engine'
        );
        return res.status(400).json({
          success: false,
          error: 'Approval request has expired. Re-verification required.',
        });
      }

      // Verify that final deal terms have not been altered
      if (!deal.finalDeal) {
        return res.status(400).json({ success: false, error: 'Deal contract missing.' });
      }

      const currentFingerprint = generateServerDealFingerprint(deal.finalDeal);
      if (currentFingerprint !== approval.fingerprint) {
        approvalRepo.updateToInvalidated(approval.id, 'Transaction terms were altered after approval request was generated.');
        auditRepo.recordEvent(
          deal.id,
          'approval_invalidated',
          'Approval Invalidated Due to Tampering',
          'Deal terms were altered after verification. Approval invalidated.',
          'intentlock_engine'
        );
        return res.status(400).json({
          success: false,
          error: 'Approval invalidated: Deal terms were altered after verification.',
        });
      }

      // Issue single-use demonstration authorization token
      const rawToken = `AUTH-SRV-${Date.now()}-${crypto.randomBytes(8).toString('hex')}`;
      const tokenHash = hashAuthorizationToken(rawToken, config.TOKEN_HMAC_SECRET);

      const ok = approvalRepo.updateToApproved(approval.id, tokenHash);
      if (!ok) {
        return res.status(409).json({ success: false, error: 'Conflict updating approval state.' });
      }

      auditRepo.recordEvent(
        deal.id,
        'approval_granted',
        'Human Purchase Approval Confirmed',
        `User explicitly approved transaction. Single-use token generated for fingerprint ${currentFingerprint.slice(0, 12)}...`,
        'user',
        { approvalId: approval.id, fingerprint: currentFingerprint }
      );

      res.json({
        success: true,
        data: {
          approvalId: approval.id,
          status: 'APPROVED',
          authorizationToken: rawToken,
          expiresAt: approval.expiresAt,
          dealFingerprint: currentFingerprint,
          message: 'Human approval granted. Demonstration authorization token issued.',
        },
      });
    } catch (err) {
      next(err);
    }
  });

  // ---------------------------------------------------------------------------
  // 6. POST /api/deals/:id/decline - Explicit Human Decline
  // ---------------------------------------------------------------------------
  router.post('/deals/:id/decline', (req: Request, res: Response, next: NextFunction) => {
    try {
      const deal = dealRepo.getDeal(req.params.id);
      if (!deal) return res.status(404).json({ success: false, error: 'Deal not found' });

      const userId = req.user?.id || 'dev-user-default';
      if (deal.userId !== userId) {
        return res.status(403).json({ success: false, error: 'Unauthorized.' });
      }

      const approval = approvalRepo.getLatestApprovalForDeal(deal.id);
      if (!approval || approval.status !== 'PENDING') {
        return res.status(400).json({ success: false, error: 'No pending approval request to decline.' });
      }

      approvalRepo.updateToDeclined(approval.id);

      auditRepo.recordEvent(
        deal.id,
        'approval_declined',
        'Human Purchase Approval Declined',
        'User explicitly declined the deal proposal.',
        'user',
        { approvalId: approval.id }
      );

      res.json({
        success: true,
        message: 'Deal explicitly declined.',
      });
    } catch (err) {
      next(err);
    }
  });

  // ---------------------------------------------------------------------------
  // 7. POST /api/deals/:id/consume-authorization - Atomic One-Time Consumption
  // ---------------------------------------------------------------------------
  router.post('/deals/:id/consume-authorization', (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = ConsumeAuthorizationPayloadSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ success: false, error: 'Invalid payload: authorizationToken is required.' });
      }

      const { authorizationToken } = parsed.data;

      const deal = dealRepo.getDeal(req.params.id);
      if (!deal) return res.status(404).json({ success: false, error: 'Deal not found' });

      const userId = req.user?.id || 'dev-user-default';
      if (deal.userId !== userId) {
        return res.status(403).json({ success: false, error: "Unauthorized: Deal belongs to another user." });
      }

      const approval = approvalRepo.getLatestApprovalForDeal(deal.id);
      if (!approval) {
        return res.status(400).json({ success: false, error: 'No approval record found.' });
      }

      // Check current approval status
      if (approval.status !== 'APPROVED') {
        return res.status(400).json({
          success: false,
          error: `Cannot consume authorization. Current status is ${approval.status}.`,
        });
      }

      // Check expiration
      if (new Date() > new Date(approval.expiresAt)) {
        approvalRepo.updateToExpired(approval.id);
        return res.status(400).json({
          success: false,
          error: 'Authorization token has expired. Re-verification required.',
        });
      }

      // Validate token hash
      const submittedHash = hashAuthorizationToken(authorizationToken, config.TOKEN_HMAC_SECRET);
      if (submittedHash !== approval.tokenHash) {
        return res.status(400).json({
          success: false,
          error: 'Invalid authorization token supplied.',
        });
      }

      // Check for tampering between approval and consumption
      if (!deal.finalDeal) {
        return res.status(400).json({ success: false, error: 'Missing contract terms.' });
      }

      const currentFingerprint = generateServerDealFingerprint(deal.finalDeal);
      if (currentFingerprint !== approval.fingerprint) {
        approvalRepo.updateToInvalidated(approval.id, 'Terms were modified prior to authorization consumption.');
        return res.status(400).json({
          success: false,
          error: 'Approval invalidated: Deal terms were altered after approval.',
        });
      }

      // ATOMIC CONSUMPTION: Database update ensures concurrent requests fail if status != 'APPROVED'
      const consumed = approvalRepo.atomicConsumeApproval(approval.id);
      if (!consumed) {
        return res.status(409).json({
          success: false,
          error: 'Authorization token was already consumed or altered concurrently.',
        });
      }

      dealRepo.updateDealStatus(deal.id, 'payment_completed');

      auditRepo.recordEvent(
        deal.id,
        'checkout_attempted',
        'Authorization Token Consumed at Gateway',
        'One-time authorization token validated and consumed. Demonstration transaction completed.',
        'checkout_gateway',
        { approvalId: approval.id, fingerprint: currentFingerprint }
      );

      res.json({
        success: true,
        data: {
          dealId: deal.id,
          status: 'PAYMENT_AUTHORIZED_DEMO',
          message: 'Demonstration payment authorization succeeded. Token has been consumed and cannot be reused.',
          fingerprint: currentFingerprint,
        },
      });
    } catch (err) {
      next(err);
    }
  });

  // ---------------------------------------------------------------------------
  // 8. POST /api/deals/:id/checkout - Create PayPal Sandbox Order (Phase 5)
  // ---------------------------------------------------------------------------
  router.post('/deals/:id/checkout', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = CheckoutPayloadSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          success: false,
          error: 'Invalid checkout request payload',
          details: parsed.error.format(),
        });
      }

      const userId = req.user?.id || 'dev-user-default';
      const result = await paymentService.initiateCheckout({
        dealId: req.params.id,
        userId,
        authorizationToken: parsed.data.authorizationToken,
        idempotencyKey: parsed.data.idempotencyKey,
      });

      res.status(201).json({
        success: true,
        data: result,
      });
    } catch (err) {
      if (err instanceof PaymentSecurityError) {
        return res.status(err.statusCode).json({
          success: false,
          error: err.message,
        });
      }
      next(err);
    }
  });

  // ---------------------------------------------------------------------------
  // 9. POST /api/deals/:id/capture - Server Capture of PayPal Sandbox Order (Phase 5)
  // ---------------------------------------------------------------------------
  router.post('/deals/:id/capture', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = CapturePayloadSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          success: false,
          error: 'Invalid capture request: paypalOrderId is required.',
          details: parsed.error.format(),
        });
      }

      const userId = req.user?.id || 'dev-user-default';
      const result = await paymentService.capturePayment({
        dealId: req.params.id,
        userId,
        paypalOrderId: parsed.data.paypalOrderId,
        idempotencyKey: parsed.data.idempotencyKey,
      });

      res.json({
        success: true,
        data: result,
      });
    } catch (err) {
      if (err instanceof PaymentSecurityError) {
        return res.status(err.statusCode).json({
          success: false,
          error: err.message,
        });
      }
      next(err);
    }
  });

  // ---------------------------------------------------------------------------
  // 10. GET /api/deals/:id/payment - Fetch current payment status
  // ---------------------------------------------------------------------------
  router.get('/deals/:id/payment', (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user?.id || 'dev-user-default';
      const payment = paymentService.getPaymentForDeal(req.params.id, userId);

      res.json({
        success: true,
        data: payment,
      });
    } catch (err) {
      if (err instanceof PaymentSecurityError) {
        return res.status(err.statusCode).json({
          success: false,
          error: err.message,
        });
      }
      next(err);
    }
  });

  // ---------------------------------------------------------------------------
  // 11. POST /api/deals/:id/cancel-payment - Buyer Cancelled PayPal Checkout
  // ---------------------------------------------------------------------------
  router.post('/deals/:id/cancel-payment', (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = CancelPaymentPayloadSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          success: false,
          error: 'Invalid payload: paypalOrderId is required.',
        });
      }

      const userId = req.user?.id || 'dev-user-default';
      paymentService.recordCancellation(req.params.id, userId, parsed.data.paypalOrderId);

      res.json({
        success: true,
        message: 'Payment cancellation recorded.',
      });
    } catch (err) {
      if (err instanceof PaymentSecurityError) {
        return res.status(err.statusCode).json({
          success: false,
          error: err.message,
        });
      }
      next(err);
    }
  });

  // ---------------------------------------------------------------------------
  // 12. GET /api/deals/:id/audit - Return persisted audit trail
  // ---------------------------------------------------------------------------
  router.get('/deals/:id/audit', (req: Request, res: Response, next: NextFunction) => {
    try {
      const deal = dealRepo.getDeal(req.params.id);
      if (!deal) return res.status(404).json({ success: false, error: 'Deal not found' });

      // Check user authorization on deal
      const userId = req.user?.id || 'dev-user-default';
      if (deal.userId !== userId) {
        return res.status(403).json({ success: false, error: "Unauthorized: Deal belongs to another user." });
      }

      const events = auditRepo.getEventsForDeal(deal.id);
      res.json({
        success: true,
        data: events,
      });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
