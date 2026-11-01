import crypto from 'node:crypto';
import { DealRepository } from '../repositories/dealRepository.js';
import { VerificationRepository } from '../repositories/verificationRepository.js';
import { ApprovalRepository } from '../repositories/approvalRepository.js';
import { AuditRepository } from '../repositories/auditRepository.js';
import { PaymentRepository, StoredPayment, PaymentStatus } from '../repositories/paymentRepository.js';
import { PayPalClient } from './paypalClient.js';
import { generateServerDealFingerprint, hashAuthorizationToken } from './integrityService.js';
import { EnvConfig } from '../config/env.js';
import { isPayPalSupportedCurrency, PAYPAL_SUPPORTED_CURRENCIES, isAmountEqual } from '../config/currencies.js';

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
   * Validates all pre-conditions before PayPal order creation:
   * 1. Authorization token presence, signature/hash validity, ownership, and unconsumed state
   * 2. Deal ownership
   * 3. Final deal presence & policy/budget compliance
   * 4. Server verification status (must be VERIFIED)
   * 5. Current terms match verification report fingerprint
   * 6. Human approval status (must be APPROVED)
   * 7. Human approval expiration (TTL)
   * 8. Current terms match approval fingerprint
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

    // Defensive check: deal must be agreed and accepted by seller
    if (!deal.finalDeal.isAcceptedBySeller || deal.finalDeal.negotiationStatus !== 'agreed') {
      throw new PaymentSecurityError(400, 'Cannot checkout deal: Negotiation status is not agreed or accepted by seller.');
    }

    // Defensive check: currency match between intent and final deal
    if (deal.finalDeal.currency !== deal.intent.currency) {
      throw new PaymentSecurityError(400, 'Currency mismatch between authorized intent and final deal.');
    }

    // Defensive check: currency must be on PayPal supported currencies allowlist
    if (!isPayPalSupportedCurrency(deal.intent.currency)) {
      throw new PaymentSecurityError(
        400,
        `Currency '${deal.intent.currency}' is not supported by PayPal. Checkout requires a supported currency (${PAYPAL_SUPPORTED_CURRENCIES.join(', ')}).`
      );
    }

    // Defensive check: totalPayable mathematical consistency
    const calculatedTotal =
      Number(deal.finalDeal.productPrice) +
      Number(deal.finalDeal.deliveryFee || 0) +
      Number(deal.finalDeal.otherCharges || 0);
    if (!isAmountEqual(calculatedTotal, deal.finalDeal.totalPayable, deal.finalDeal.currency)) {
      throw new PaymentSecurityError(
        400,
        'Deal terms are mathematically inconsistent: totalPayable does not match itemized sum.'
      );
    }

    // Defensive check: budget limit
    if (deal.finalDeal.totalPayable > deal.intent.maxBudget) {
      throw new PaymentSecurityError(400, 'Final payable amount exceeds authorized user budget ceiling.');
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

    // Must belong to the correct deal and user
    if (latestApproval.dealId !== dealId || latestApproval.userId !== userId) {
      throw new PaymentSecurityError(403, 'Authorization token does not belong to this user or deal.');
    }

    if (latestApproval.status === 'CONSUMED') {
      throw new PaymentSecurityError(
        409,
        'Authorization token has already been consumed and cannot be reused.'
      );
    }

    if (latestApproval.status === 'EXPIRED') {
      throw new PaymentSecurityError(400, 'Human approval has expired. Re-verification required.');
    }

    if (latestApproval.status === 'INVALIDATED') {
      throw new PaymentSecurityError(400, 'Approval token was invalidated due to term modifications.');
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

    // Mandatory authorization token validation: HMAC hash must match approved token hash
    if (!authorizationToken || typeof authorizationToken !== 'string' || authorizationToken.trim().length === 0) {
      throw new PaymentSecurityError(400, 'Authorization token is mandatory for checkout.');
    }

    const submittedHash = hashAuthorizationToken(authorizationToken.trim(), this.config.TOKEN_HMAC_SECRET);
    if (submittedHash !== latestApproval.tokenHash) {
      throw new PaymentSecurityError(400, 'Invalid authorization token supplied for checkout.');
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
   * Pre-capture validation: verifies the bound approval record and deal terms before capture.
   */
  public validateDealForCapture(dealId: string, userId: string, boundApprovalId: string) {
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

    const latestReport = this.verifRepo.getLatestReportForDeal(dealId);
    if (!latestReport || latestReport.status !== 'VERIFIED') {
      throw new PaymentSecurityError(400, 'Deal verification is missing or not verified.');
    }

    const currentFingerprint = generateServerDealFingerprint(deal.finalDeal);
    if (currentFingerprint !== latestReport.fingerprint) {
      throw new PaymentSecurityError(400, 'Deal terms were modified after verification.');
    }

    const approval = this.approvalRepo.getApprovalById(boundApprovalId);
    if (!approval) {
      throw new PaymentSecurityError(400, 'Bound approval record not found.');
    }

    if (approval.dealId !== dealId || approval.userId !== userId) {
      throw new PaymentSecurityError(403, 'Approval record does not match deal or user.');
    }

    if (approval.status !== 'APPROVED') {
      throw new PaymentSecurityError(400, `Cannot capture payment under approval status: ${approval.status}.`);
    }

    if (new Date() > new Date(approval.expiresAt)) {
      this.approvalRepo.updateToExpired(approval.id);
      throw new PaymentSecurityError(400, 'Human approval expired prior to capture.');
    }

    if (currentFingerprint !== approval.fingerprint) {
      this.approvalRepo.updateToInvalidated(approval.id, 'Deal terms were modified after approval.');
      throw new PaymentSecurityError(400, 'Deal terms were modified after approval.');
    }

    return {
      deal,
      finalDeal: deal.finalDeal,
      report: latestReport,
      approval,
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
    isSimulated?: boolean;
    gatewayMode?: 'live_sandbox' | 'mock_sandbox';
  }> {
    // Check if an existing payment is already completed
    const existingPayment = this.paymentRepo.getPaymentByDealId(params.dealId);
    if (existingPayment && existingPayment.status === 'COMPLETED') {
      throw new PaymentSecurityError(400, 'Payment for this deal has already been completed.');
    }

    const { deal, finalDeal, approval } = this.validateDealForCheckout(
      params.dealId,
      params.userId,
      params.authorizationToken
    );

    const isMock = Boolean(this.paypalClient.isMock);
    const gatewayMode = this.paypalClient.gatewayMode || (isMock ? 'mock_sandbox' : 'live_sandbox');

    // If order already created and active, return existing order (idempotency)
    if (existingPayment && existingPayment.status === 'ORDER_CREATED' && existingPayment.paypalOrderId) {
      if (existingPayment.currency !== deal.intent.currency) {
        throw new PaymentSecurityError(400, 'Currency inconsistency detected between existing payment and current deal terms.');
      }
      return {
        paymentId: existingPayment.id,
        paypalOrderId: existingPayment.paypalOrderId,
        status: existingPayment.status,
        amount: existingPayment.amount,
        currency: existingPayment.currency,
        isSimulated: isMock,
        gatewayMode,
      };
    }

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
      isMock ? '[SIMULATED MOCK] PayPal Order Created' : 'PayPal Sandbox Order Created',
      isMock
        ? `[SIMULATED] Created mock PayPal order ${orderResult.id} for ${authoritativeCurrency} ${authoritativeAmount}. Bound to approved contract fingerprint.`
        : `Created PayPal Sandbox order ${orderResult.id} for ${authoritativeCurrency} ${authoritativeAmount}. Bound to approved contract fingerprint.`,
      'paypal_gateway',
      {
        paymentId: payment.id,
        paypalOrderId: orderResult.id,
        amount: authoritativeAmount,
        currency: authoritativeCurrency,
        isSimulated: isMock,
        gatewayMode,
      }
    );

    return {
      paymentId: payment.id,
      paypalOrderId: orderResult.id,
      status: payment.status,
      amount: authoritativeAmount,
      currency: authoritativeCurrency,
      approvalUrl: approvalLink,
      isSimulated: isMock,
      gatewayMode,
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
    isSimulated?: boolean;
    gatewayMode?: 'live_sandbox' | 'mock_sandbox';
  }> {
    const payment = this.paymentRepo.getPaymentByOrderId(params.paypalOrderId);
    if (!payment) {
      throw new PaymentSecurityError(404, 'Payment record for this PayPal order does not exist.');
    }

    if (payment.dealId !== params.dealId || payment.userId !== params.userId) {
      throw new PaymentSecurityError(403, 'Order does not match specified deal or user.');
    }

    const isMock = Boolean(this.paypalClient.isMock);
    const gatewayMode = this.paypalClient.gatewayMode || (isMock ? 'mock_sandbox' : 'live_sandbox');

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
        isSimulated: isMock,
        gatewayMode,
      };
    }

    // Check approval state on payment record prior to full re-validation
    const approvalRecord = this.approvalRepo.getApprovalById(payment.approvalId);
    if (!approvalRecord || approvalRecord.status !== 'APPROVED') {
      throw new PaymentSecurityError(
        400,
        `Cannot capture order: Approval status is ${approvalRecord?.status || 'MISSING'}.`
      );
    }

    // 1. Authoritative deal and approval re-verification before capture
    const validation = this.validateDealForCapture(params.dealId, params.userId, payment.approvalId);
    const { deal, finalDeal, approval } = validation;

    // Defensive check: payment amount and currency must match authoritative approved deal terms
    if (
      payment.currency !== finalDeal.currency ||
      !isAmountEqual(payment.amount, finalDeal.totalPayable, finalDeal.currency)
    ) {
      throw new PaymentSecurityError(
        400,
        `Payment record mismatch: expected ${finalDeal.currency} ${finalDeal.totalPayable}, but payment record has ${payment.currency} ${payment.amount}.`
      );
    }

    // If payment status was REQUIRES_RECONCILIATION, probe PayPal first
    if (payment.status === 'REQUIRES_RECONCILIATION') {
      try {
        const probe = await this.paypalClient.getOrder(params.paypalOrderId);
        const validProbe = this.validateCaptureResult(
          probe,
          finalDeal,
          payment,
          deal.id,
          isMock,
          gatewayMode,
          true // isReconciliation
        );

        this.approvalRepo.atomicConsumeApproval(approval.id);
        this.paymentRepo.updateStatus(payment.id, 'COMPLETED', {
          captureId: validProbe.captureId,
          payerEmail: probe.payerEmail,
          payerId: probe.payerId,
        });
        this.dealRepo.updateDealStatus(deal.id, 'payment_completed');
        this.auditRepo.recordEvent(
          deal.id,
          'paypal_payment_completed',
          isMock ? '[SIMULATED MOCK] PayPal Payment Reconciled' : 'PayPal Sandbox Payment Reconciled & Confirmed',
          isMock
            ? `[SIMULATED] Reconciliation confirmed completed mock capture. Capture ID: ${validProbe.captureId}.`
            : `Reconciliation confirmed completed capture with PayPal Sandbox. Capture ID: ${validProbe.captureId}.`,
          'paypal_gateway',
          {
            paypalOrderId: params.paypalOrderId,
            captureId: validProbe.captureId,
            isSimulated: isMock,
            gatewayMode,
          }
        );
        return {
          success: true,
          paymentId: payment.id,
          status: 'COMPLETED',
          paypalOrderId: params.paypalOrderId,
          captureId: validProbe.captureId,
          amount: payment.amount,
          currency: payment.currency,
          payerEmail: probe.payerEmail,
          message: isMock
            ? 'Simulated mock payment confirmed via reconciliation.'
            : 'PayPal Sandbox payment confirmed via reconciliation.',
          isSimulated: isMock,
          gatewayMode,
        };
      } catch (err: unknown) {
        if (err instanceof PaymentSecurityError) throw err;
        throw new PaymentSecurityError(
          502,
          'Network interruption: Unable to reconcile order status with PayPal. Please retry.'
        );
      }
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
        if (orderProbe && orderProbe.status === 'COMPLETED') {
          captureResult = orderProbe;
        } else {
          throw new PaymentSecurityError(
            502,
            'Payment network interruption. Reconciliation required before retrying capture.'
          );
        }
      } catch (probeErr: unknown) {
        if (probeErr instanceof PaymentSecurityError) throw probeErr;
        throw new PaymentSecurityError(
          502,
          'Payment network interruption. Reconciliation required before retrying capture.'
        );
      }
    }

    // Comprehensive validation of PayPal capture response
    const validCapture = this.validateCaptureResult(
      captureResult,
      finalDeal,
      payment,
      deal.id,
      isMock,
      gatewayMode
    );

    // 1. Consume authorization token atomically in SQLite
    this.approvalRepo.atomicConsumeApproval(approval.id);

    // 2. Mark payment as completed
    this.paymentRepo.updateStatus(payment.id, 'COMPLETED', {
      captureId: validCapture.captureId,
      payerEmail: captureResult.payerEmail,
      payerId: captureResult.payerId,
    });

    // 3. Update deal status
    this.dealRepo.updateDealStatus(deal.id, 'payment_completed');

    // 4. Audit trail
    this.auditRepo.recordEvent(
      deal.id,
      'paypal_payment_completed',
      isMock ? '[SIMULATED MOCK] PayPal Payment Captured' : 'PayPal Sandbox Payment Captured Successfully',
      isMock
        ? `[SIMULATED] Successfully captured funds (${payment.currency} ${payment.amount}) via mock client. Capture ID: ${validCapture.captureId}. Single-use authorization consumed.`
        : `Successfully captured funds (${payment.currency} ${payment.amount}) via PayPal Sandbox. Capture ID: ${validCapture.captureId}. Single-use authorization consumed.`,
      'paypal_gateway',
      {
        paypalOrderId: params.paypalOrderId,
        captureId: validCapture.captureId,
        amount: payment.amount,
        currency: payment.currency,
        payerEmail: captureResult.payerEmail,
        isSimulated: isMock,
        gatewayMode,
      }
    );

    return {
      success: true,
      paymentId: payment.id,
      status: 'COMPLETED',
      paypalOrderId: params.paypalOrderId,
      captureId: validCapture.captureId,
      amount: payment.amount,
      currency: payment.currency,
      payerEmail: captureResult.payerEmail,
      message: isMock
        ? 'Simulated mock payment completed successfully.'
        : 'PayPal Sandbox payment completed successfully.',
      isSimulated: isMock,
      gatewayMode,
    };
  }

  /**
   * Strictly validates PayPal capture result fields against authoritative deal terms:
   * 1. Requires status === 'COMPLETED'
   * 2. Requires non-empty string captureId
   * 3. Requires explicit numeric amount
   * 4. Requires explicit string currency
   * 5. Verifies currency match
   * 6. Verifies amount match
   * If any check fails, transitions to REQUIRES_RECONCILIATION, records audit event, and throws PaymentSecurityError.
   */
  private validateCaptureResult(
    captureResult: any,
    finalDeal: any,
    payment: StoredPayment,
    dealId: string,
    isMock: boolean,
    gatewayMode: string,
    isReconciliation: boolean = false
  ): { captureId: string; amount: number; currency: string } {
    let failureReason: string | null = null;

    if (!captureResult || typeof captureResult !== 'object') {
      failureReason = 'Incomplete or empty PayPal capture API response.';
    } else if (captureResult.status !== 'COMPLETED') {
      failureReason = `PayPal capture status is '${captureResult.status || 'UNKNOWN'}' instead of COMPLETED.`;
    } else if (!captureResult.captureId || typeof captureResult.captureId !== 'string' || captureResult.captureId.trim().length === 0) {
      failureReason = 'PayPal capture response is missing a valid capture ID.';
    } else if (captureResult.amount === undefined || captureResult.amount === null || typeof captureResult.amount !== 'number' || isNaN(captureResult.amount)) {
      failureReason = 'PayPal capture response is missing an explicit captured amount.';
    } else if (!captureResult.currency || typeof captureResult.currency !== 'string' || captureResult.currency.trim().length === 0) {
      failureReason = 'PayPal capture response is missing an explicit captured currency.';
    } else if (captureResult.currency.trim().toUpperCase() !== finalDeal.currency.trim().toUpperCase()) {
      failureReason = isReconciliation
        ? `PayPal order currency '${captureResult.currency}' does not match verified deal currency '${finalDeal.currency}'.`
        : `PayPal captured currency '${captureResult.currency}' does not match verified deal currency '${finalDeal.currency}'.`;
    } else if (!isAmountEqual(captureResult.amount, finalDeal.totalPayable, finalDeal.currency)) {
      failureReason = isReconciliation
        ? `PayPal order amount '${captureResult.amount}' does not match verified deal amount '${finalDeal.totalPayable}'.`
        : `PayPal captured amount '${captureResult.amount}' does not match verified deal amount '${finalDeal.totalPayable}'.`;
    }

    if (failureReason) {
      const prefix = isReconciliation ? 'Reconciliation security failure' : 'Capture security failure';
      const extractedCaptureId = (captureResult && typeof captureResult.captureId === 'string' && captureResult.captureId.trim().length > 0)
        ? captureResult.captureId.trim()
        : null;

      this.paymentRepo.updateStatus(payment.id, 'REQUIRES_RECONCILIATION', {
        captureId: extractedCaptureId || undefined,
        payerEmail: captureResult?.payerEmail,
        payerId: captureResult?.payerId,
        errorMessage: `${prefix}: ${failureReason}`,
      });

      this.auditRepo.recordEvent(
        dealId,
        'payment_reconciliation_needed',
        'Payment Capture Discrepancy — Reconciliation Required',
        `PayPal capture validation failed: ${failureReason} Payment held in reconciliation.`,
        'paypal_gateway',
        {
          paypalOrderId: payment.paypalOrderId,
          captureId: extractedCaptureId,
          expectedAmount: finalDeal.totalPayable,
          expectedCurrency: finalDeal.currency,
          capturedAmount: captureResult?.amount,
          capturedCurrency: captureResult?.currency,
          isSimulated: isMock,
          gatewayMode,
          error: failureReason,
        }
      );

      throw new PaymentSecurityError(400, `${prefix}: ${failureReason}`);
    }

    return {
      captureId: captureResult.captureId.trim(),
      amount: captureResult.amount,
      currency: captureResult.currency.trim().toUpperCase(),
    };
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
