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
    const validation = this.validateDealForCheckout(params.dealId, params.userId);
    const { deal, finalDeal, approval } = validation;

    if (payment.approvalId !== approval.id) {
      throw new PaymentSecurityError(400, 'Payment was initiated under a different or outdated approval record.');
    }

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
        if (probe.status === 'COMPLETED') {
          // Validate currency and amount against verified deal terms
          if (probe.currency && probe.currency.toUpperCase() !== finalDeal.currency.toUpperCase()) {
            throw new PaymentSecurityError(
              400,
              `Reconciliation security failure: PayPal order currency '${probe.currency}' does not match verified deal currency '${finalDeal.currency}'.`
            );
          }
          if (probe.amount !== undefined && !isAmountEqual(probe.amount, finalDeal.totalPayable, finalDeal.currency)) {
            throw new PaymentSecurityError(
              400,
              `Reconciliation security failure: PayPal order amount '${probe.amount}' does not match verified deal amount '${finalDeal.totalPayable}'.`
            );
          }
          this.approvalRepo.atomicConsumeApproval(approval.id);
          this.paymentRepo.updateStatus(payment.id, 'COMPLETED', {
            captureId: probe.captureId,
            payerEmail: probe.payerEmail,
            payerId: probe.payerId,
          });
          this.dealRepo.updateDealStatus(deal.id, 'payment_completed');
          this.auditRepo.recordEvent(
            deal.id,
            'paypal_payment_completed',
            isMock ? '[SIMULATED MOCK] PayPal Payment Reconciled' : 'PayPal Sandbox Payment Reconciled & Confirmed',
            isMock
              ? `[SIMULATED] Reconciliation confirmed completed mock capture. Capture ID: ${probe.captureId}.`
              : `Reconciliation confirmed completed capture with PayPal Sandbox. Capture ID: ${probe.captureId}.`,
            'paypal_gateway',
            {
              paypalOrderId: params.paypalOrderId,
              captureId: probe.captureId,
              isSimulated: isMock,
              gatewayMode,
            }
          );
          return {
            success: true,
            paymentId: payment.id,
            status: 'COMPLETED',
            paypalOrderId: params.paypalOrderId,
            captureId: probe.captureId,
            amount: payment.amount,
            currency: payment.currency,
            payerEmail: probe.payerEmail,
            message: isMock
              ? 'Simulated mock payment confirmed via reconciliation.'
              : 'PayPal Sandbox payment confirmed via reconciliation.',
            isSimulated: isMock,
            gatewayMode,
          };
        }
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
        if (orderProbe.status === 'COMPLETED') {
          if (orderProbe.currency && orderProbe.currency.toUpperCase() !== finalDeal.currency.toUpperCase()) {
            throw new PaymentSecurityError(
              400,
              `Reconciliation security failure: PayPal order currency '${orderProbe.currency}' does not match verified deal currency '${finalDeal.currency}'.`
            );
          }
          if (orderProbe.amount !== undefined && !isAmountEqual(orderProbe.amount, finalDeal.totalPayable, finalDeal.currency)) {
            throw new PaymentSecurityError(
              400,
              `Reconciliation security failure: PayPal order amount '${orderProbe.amount}' does not match verified deal amount '${finalDeal.totalPayable}'.`
            );
          }
          captureResult = orderProbe;
        } else {
          throw new PaymentSecurityError(
            502,
            `Network error communicating with PayPal. Order status is ${orderProbe.status}. Please retry reconciliation.`
          );
        }
      } catch (err: unknown) {
        if (err instanceof PaymentSecurityError) throw err;
        throw new PaymentSecurityError(
          502,
          'Payment network interruption. Reconciliation required before retrying capture.'
        );
      }
    }

    if (captureResult.status === 'COMPLETED') {
      // Validate currency and amount returned from PayPal capture against verified finalDeal
      const currencyMismatch =
        captureResult.currency &&
        captureResult.currency.toUpperCase() !== finalDeal.currency.toUpperCase();
      const amountMismatch =
        captureResult.amount !== undefined &&
        !isAmountEqual(captureResult.amount, finalDeal.totalPayable, finalDeal.currency);

      if (currencyMismatch || amountMismatch) {
        // PayPal captured funds, but post-capture validation detected a discrepancy!
        // Transition payment to REQUIRES_RECONCILIATION with captureId to prevent orphaning funds.
        const discrepancy = currencyMismatch
          ? `PayPal captured currency '${captureResult.currency}' does not match verified deal currency '${finalDeal.currency}'.`
          : `PayPal captured amount '${captureResult.amount}' does not match verified deal amount '${finalDeal.totalPayable}'.`;

        this.paymentRepo.updateStatus(payment.id, 'REQUIRES_RECONCILIATION', {
          captureId: captureResult.captureId,
          payerEmail: captureResult.payerEmail,
          payerId: captureResult.payerId,
          errorMessage: `Post-capture validation discrepancy: ${discrepancy}`,
        });

        this.auditRepo.recordEvent(
          deal.id,
          'payment_reconciliation_needed',
          'Payment Captured with Terms Discrepancy — Investigation Required',
          `PayPal successfully captured funds (Capture ID: ${captureResult.captureId}), but terms mismatch was detected: ${discrepancy} Payment held in reconciliation.`,
          'paypal_gateway',
          {
            paypalOrderId: params.paypalOrderId,
            captureId: captureResult.captureId,
            expectedAmount: finalDeal.totalPayable,
            expectedCurrency: finalDeal.currency,
            capturedAmount: captureResult.amount,
            capturedCurrency: captureResult.currency,
            isSimulated: isMock,
            gatewayMode,
          }
        );

        throw new PaymentSecurityError(
          400,
          `Capture security failure: ${discrepancy} Order captured with ID ${captureResult.captureId} and held in reconciliation for investigation.`
        );
      }

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
        isMock ? '[SIMULATED MOCK] PayPal Payment Captured' : 'PayPal Sandbox Payment Captured Successfully',
        isMock
          ? `[SIMULATED] Successfully captured funds (${payment.currency} ${payment.amount}) via mock client. Capture ID: ${captureResult.captureId}. Single-use authorization consumed.`
          : `Successfully captured funds (${payment.currency} ${payment.amount}) via PayPal Sandbox. Capture ID: ${captureResult.captureId}. Single-use authorization consumed.`,
        'paypal_gateway',
        {
          paypalOrderId: params.paypalOrderId,
          captureId: captureResult.captureId,
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
        captureId: captureResult.captureId,
        amount: payment.amount,
        currency: payment.currency,
        payerEmail: captureResult.payerEmail,
        message: isMock
          ? 'Simulated mock payment completed successfully.'
          : 'PayPal Sandbox payment completed successfully.',
        isSimulated: isMock,
        gatewayMode,
      };
    } else {
      this.paymentRepo.updateStatus(payment.id, 'FAILED', {
        errorMessage: `PayPal reported capture status: ${captureResult.status}`,
      });

      this.auditRepo.recordEvent(
        deal.id,
        'paypal_payment_failed',
        isMock ? '[SIMULATED MOCK] PayPal Payment Failed' : 'PayPal Sandbox Payment Failed',
        `PayPal capture returned non-completed status: ${captureResult.status}`,
        'paypal_gateway',
        { status: captureResult.status, isSimulated: isMock, gatewayMode }
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
