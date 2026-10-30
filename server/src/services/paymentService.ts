import crypto from 'node:crypto';
import { DealRepository } from '../repositories/dealRepository.js';
import { VerificationRepository } from '../repositories/verificationRepository.js';
import { ApprovalRepository } from '../repositories/approvalRepository.js';
import { AuditRepository } from '../repositories/auditRepository.js';
import { PaymentRepository, StoredPayment, PaymentStatus } from '../repositories/paymentRepository.js';
import { PayPalClient } from './paypalClient.js';
import { generateServerDealFingerprint, hashAuthorizationToken } from './integrityService.js';
import { EnvConfig } from '../config/env.js';

export class PaymentSecurityError extends Error {
  constructor(public statusCode: number, message: string) {
    super(message);
    this.name = 'PaymentSecurityError';
  }
}

export class PaymentService {
  constructor(
    private dealRepo: DealRepository,
    private verifRepo: VerificationRepository,
    private approvalRepo: ApprovalRepository,
    private auditRepo: AuditRepository,
    private paymentRepo: PaymentRepository,
    private paypalClient: PayPalClient,
    private config: EnvConfig
  ) {}

  /**
   * Validates all pre-conditions before PayPal order creation or capture:
   * 1. Deal ownership
   * 2. Final deal presence
   * 3. Server verification status (must be VERIFIED)
   * 4. Current terms match verification report fingerprint
   * 5. Human approval status (must be APPROVED)
   * 6. Human approval expiration (TTL)
   * 7. Current terms match approval fingerprint
   */
  public validateDealForCheckout(dealId: string, userId: string, authorizationToken?: string) {
    const deal = this.dealRepo.getDeal(dealId);
    if (!deal) {
      throw new PaymentSecurityError(404, 'Deal not found.');
    }

    if (deal.userId !== userId) {
      throw new PaymentSecurityError(403, "Unauthorized: Deal belongs to another user.");
    }

    if (!deal.finalDeal) {
      throw new PaymentSecurityError(400, 'Deal contract has not been finalized or negotiated.');
    }

    // 1. Verify latest server-side IntentLock report
    const latestReport = this.verifRepo.getLatestReportForDeal(dealId);
    if (!latestReport) {
      throw new PaymentSecurityError(400, 'Deal has not undergone IntentLock server verification.');
    }

    if (latestReport.status !== 'VERIFIED') {
      throw new PaymentSecurityError(
        400,
        `IntentLock rejected this deal with status ${latestReport.status}. Checkout is strictly blocked.`
      );
    }

    const currentFingerprint = generateServerDealFingerprint(deal.finalDeal);
    if (currentFingerprint !== latestReport.fingerprint) {
      throw new PaymentSecurityError(
        400,
        'Deal terms were modified after verification. Re-verification required before checkout.'
      );
    }

    // 2. Verify human approval record
    const latestApproval = this.approvalRepo.getLatestApprovalForDeal(dealId);
    if (!latestApproval) {
      throw new PaymentSecurityError(400, 'Explicit human approval is required before checkout.');
    }

    if (latestApproval.status !== 'APPROVED') {
      throw new PaymentSecurityError(
        400,
        `Cannot checkout deal with approval status: ${latestApproval.status}. Human approval is required.`
      );
    }

    // Check approval expiration
    if (new Date() > new Date(latestApproval.expiresAt)) {
      this.approvalRepo.updateToExpired(latestApproval.id);
      this.auditRepo.recordEvent(
        deal.id,
        'approval_expired',
        'Approval Validity Expired Before Checkout',
        'Human authorization window elapsed. New verification and approval required.',
        'intentlock_engine'
      );
      throw new PaymentSecurityError(400, 'Human approval has expired. Re-verification required.');
    }

    // Check for post-approval tampering
    if (currentFingerprint !== latestApproval.fingerprint) {
      this.approvalRepo.updateToInvalidated(
        latestApproval.id,
        'Terms were modified after human approval was granted.'
      );
      throw new PaymentSecurityError(
        400,
        'Deal terms were altered after approval was granted. Authorization invalidated.'
      );
    }

    // Check authorization token if supplied
    if (authorizationToken) {
      const hash = hashAuthorizationToken(authorizationToken, this.config.TOKEN_HMAC_SECRET);
      if (hash !== latestApproval.tokenHash) {
        throw new PaymentSecurityError(400, 'Invalid authorization token supplied for checkout.');
      }
    }

    return {
      deal,
      finalDeal: deal.finalDeal,
      report: latestReport,
      approval: latestApproval,
      fingerprint: currentFingerprint,
    };
  }

  /**
   * Phase 5C Step 1-9: Initiates checkout by creating a PayPal Sandbox order
   * bound to the verified deal and approved amount.
   */
  public async initiateCheckout(params: {
    dealId: string;
    userId: string;
    authorizationToken?: string;
    idempotencyKey?: string;
  }): Promise<{
    paymentId: string;
    paypalOrderId: string;
    status: PaymentStatus;
    amount: number;
    currency: string;
    approvalUrl?: string;
  }> {
    // Check if an existing payment is already completed
    const existingPayment = this.paymentRepo.getPaymentByDealId(params.dealId);
    if (existingPayment) {
      if (existingPayment.status === 'COMPLETED') {
        throw new PaymentSecurityError(400, 'Payment for this deal has already been completed.');
      }
      // If order already created and active, return existing order (idempotency)
      if (existingPayment.status === 'ORDER_CREATED' && existingPayment.paypalOrderId) {
        return {
          paymentId: existingPayment.id,
          paypalOrderId: existingPayment.paypalOrderId,
          status: existingPayment.status,
          amount: existingPayment.amount,
          currency: existingPayment.currency,
        };
      }
    }

    const { deal, finalDeal, approval } = this.validateDealForCheckout(
      params.dealId,
      params.userId,
      params.authorizationToken
    );

    // Authoritative amount and currency from server deal terms ONLY
    const authoritativeAmount = finalDeal.totalPayable;
    const authoritativeCurrency = deal.intent.currency;

    // Create PayPal order via SDK/REST API
    const orderResult = await this.paypalClient.createOrder({
      dealId: deal.id,
      referenceId: `DM-${deal.id.slice(0, 16)}`,
      description: `DealMind: ${deal.title || finalDeal.productTitle}`,
      amount: authoritativeAmount,
      currency: authoritativeCurrency,
      idempotencyKey: params.idempotencyKey,
    });

    const paymentId = `pay-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
    const approvalLink = orderResult.links?.find((l) => l.rel === 'approve')?.href;

    // Persist payment record
    const payment = this.paymentRepo.createPayment({
      id: paymentId,
      dealId: deal.id,
      userId: params.userId,
      approvalId: approval.id,
      paypalOrderId: orderResult.id,
      amount: authoritativeAmount,
      currency: authoritativeCurrency,
      idempotencyKey: params.idempotencyKey,
    });

    this.auditRepo.recordEvent(
      deal.id,
      'paypal_order_created',
      'PayPal Sandbox Order Created',
      `Created PayPal Sandbox order ${orderResult.id} for ${authoritativeCurrency} ${authoritativeAmount}. Bound to approved contract fingerprint.`,
      'paypal_gateway',
      {
        paymentId: payment.id,
        paypalOrderId: orderResult.id,
        amount: authoritativeAmount,
        currency: authoritativeCurrency,
      }
    );

    return {
      paymentId: payment.id,
      paypalOrderId: orderResult.id,
      status: payment.status,
      amount: authoritativeAmount,
      currency: authoritativeCurrency,
      approvalUrl: approvalLink,
    };
  }

  /**
   * Phase 5C Step 11-16: Captures PayPal order after buyer approval in sandbox.
   * Atomically consumes authorization token upon successful capture.
   */
  public async capturePayment(params: {
    dealId: string;
    userId: string;
    paypalOrderId: string;
    idempotencyKey?: string;
  }): Promise<{
    success: boolean;
    paymentId: string;
    status: PaymentStatus;
    paypalOrderId: string;
    captureId?: string;
    amount: number;
    currency: string;
    payerEmail?: string;
    message: string;
  }> {
    const deal = this.dealRepo.getDeal(params.dealId);
    if (!deal) throw new PaymentSecurityError(404, 'Deal not found.');
    if (deal.userId !== params.userId) {
      throw new PaymentSecurityError(403, "Unauthorized: Deal belongs to another user.");
    }

    const payment = this.paymentRepo.getPaymentByOrderId(params.paypalOrderId);
    if (!payment) {
      throw new PaymentSecurityError(404, 'Payment record for this PayPal order does not exist.');
    }

    if (payment.dealId !== params.dealId || payment.userId !== params.userId) {
      throw new PaymentSecurityError(403, 'Order does not match specified deal or user.');
    }

    // Idempotency: If already completed, return existing completed record
    if (payment.status === 'COMPLETED') {
      return {
        success: true,
        paymentId: payment.id,
        status: 'COMPLETED',
        paypalOrderId: payment.paypalOrderId,
        captureId: payment.paypalCaptureId || undefined,
        amount: payment.amount,
        currency: payment.currency,
        payerEmail: payment.payerEmail || undefined,
        message: 'Payment was already captured and completed.',
      };
    }

    // Check approval state and expiration before capturing
    const approval = this.approvalRepo.getApprovalById(payment.approvalId);
    if (!approval || approval.status !== 'APPROVED') {
      throw new PaymentSecurityError(
        400,
        `Cannot capture order: Approval status is ${approval?.status || 'MISSING'}.`
      );
    }

    if (new Date() > new Date(approval.expiresAt)) {
      this.approvalRepo.updateToExpired(approval.id);
      throw new PaymentSecurityError(400, 'Authorization expired prior to capture.');
    }

    // Atomic transition to CAPTURE_PENDING to prevent double captures
    const transitioned = this.paymentRepo.atomicTransitionStatus(
      payment.id,
      payment.status,
      'CAPTURE_PENDING'
    );
    if (!transitioned && payment.status !== 'CAPTURE_PENDING') {
      throw new PaymentSecurityError(409, 'Payment state changed concurrently.');
    }

    let captureResult;
    try {
      captureResult = await this.paypalClient.captureOrder(
        params.paypalOrderId,
        params.idempotencyKey
      );
    } catch (err: unknown) {
      // Handle network failure: set state to REQUIRES_RECONCILIATION
      const errMsg = err instanceof Error ? err.message : 'Capture communication error';
      this.paymentRepo.updateStatus(payment.id, 'REQUIRES_RECONCILIATION', {
        errorMessage: errMsg,
      });

      this.auditRepo.recordEvent(
        deal.id,
        'payment_reconciliation_needed',
        'Payment Network Interruption — Reconciliation Required',
        `Network error during capture of order ${params.paypalOrderId}. Attempting verification against PayPal.`,
        'paypal_gateway',
        { error: errMsg }
      );

      // Attempt immediate recovery/reconciliation probe against PayPal
      try {
        const orderProbe = await this.paypalClient.getOrder(params.paypalOrderId);
        if (orderProbe.status === 'COMPLETED') {
          captureResult = orderProbe;
        } else {
          throw new PaymentSecurityError(
            502,
            `Network error communicating with PayPal. Order status is ${orderProbe.status}. Please retry reconciliation.`
          );
        }
      } catch {
        throw new PaymentSecurityError(
          502,
          'Payment network interruption. Reconciliation required before retrying capture.'
        );
      }
    }

    if (captureResult.status === 'COMPLETED') {
      // 1. Consume authorization token atomically in SQLite
      this.approvalRepo.atomicConsumeApproval(approval.id);

      // 2. Mark payment as completed
      this.paymentRepo.updateStatus(payment.id, 'COMPLETED', {
        captureId: captureResult.captureId,
        payerEmail: captureResult.payerEmail,
        payerId: captureResult.payerId,
      });

      // 3. Update deal status
      this.dealRepo.updateDealStatus(deal.id, 'payment_completed');

      // 4. Audit trail
      this.auditRepo.recordEvent(
        deal.id,
        'paypal_payment_completed',
        'PayPal Sandbox Payment Captured Successfully',
        `Successfully captured funds (${payment.currency} ${payment.amount}) via PayPal. Capture ID: ${captureResult.captureId}. Single-use authorization consumed.`,
        'paypal_gateway',
        {
          paypalOrderId: params.paypalOrderId,
          captureId: captureResult.captureId,
          amount: payment.amount,
          currency: payment.currency,
          payerEmail: captureResult.payerEmail,
        }
      );

      return {
        success: true,
        paymentId: payment.id,
        status: 'COMPLETED',
        paypalOrderId: params.paypalOrderId,
        captureId: captureResult.captureId,
        amount: payment.amount,
        currency: payment.currency,
        payerEmail: captureResult.payerEmail,
        message: 'PayPal Sandbox payment completed successfully.',
      };
    } else {
      this.paymentRepo.updateStatus(payment.id, 'FAILED', {
        errorMessage: `PayPal reported capture status: ${captureResult.status}`,
      });

      this.auditRepo.recordEvent(
        deal.id,
        'paypal_payment_failed',
        'PayPal Sandbox Payment Failed',
        `PayPal capture returned non-completed status: ${captureResult.status}`,
        'paypal_gateway',
        { status: captureResult.status }
      );

      throw new PaymentSecurityError(
        400,
        `Payment was not completed by PayPal. Status: ${captureResult.status}`
      );
    }
  }

  /**
   * Records buyer cancellation
   */
  public recordCancellation(dealId: string, userId: string, paypalOrderId: string) {
    const deal = this.dealRepo.getDeal(dealId);
    if (!deal || deal.userId !== userId) {
      throw new PaymentSecurityError(403, 'Unauthorized access.');
    }

    const payment = this.paymentRepo.getPaymentByOrderId(paypalOrderId);
    if (payment) {
      this.paymentRepo.updateStatus(payment.id, 'CANCELLED', {
        errorMessage: 'Buyer cancelled PayPal checkout modal.',
      });

      this.auditRepo.recordEvent(
        dealId,
        'paypal_payment_cancelled',
        'PayPal Checkout Cancelled by Buyer',
        'Buyer closed or cancelled the PayPal checkout interface.',
        'user',
        { paypalOrderId }
      );
    }
  }

  /**
   * Retrieves the current payment record and status for a deal
   */
  public getPaymentForDeal(dealId: string, userId: string): StoredPayment | null {
    const deal = this.dealRepo.getDeal(dealId);
    if (!deal) throw new PaymentSecurityError(404, 'Deal not found.');
    if (deal.userId !== userId) {
      throw new PaymentSecurityError(403, 'Unauthorized access.');
    }

    return this.paymentRepo.getPaymentByDealId(dealId);
  }
}
