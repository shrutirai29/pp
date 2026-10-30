import { VerificationReport, UserApprovalRecord } from './verificationTypes';
import { FinalDeal } from '../../types/negotiation';
import { generateDealFingerprint } from './transactionIntegrity';

export const DEFAULT_APPROVAL_VALIDITY_MS = 15 * 60 * 1000; // 15 minutes validity

/**
 * IntentLock Approval Manager.
 * Governs the explicit human approval lifecycle:
 * - Requires explicit human approval before payment authorization.
 * - Enforces approval expiration.
 * - Cryptographically binds approvals to the exact FinalDeal fingerprint.
 * - Invalidates approvals immediately if relevant transaction terms are modified.
 * - Enforces one-time consumption of authorization tokens.
 * - Blocks unverified or failed negotiations from ever requesting or obtaining approval.
 */
export class ApprovalManager {
  /**
   * Creates a pending approval request for a fully VERIFIED report.
   * Throws an error if the report is not VERIFIED.
   */
  public static createApprovalRequest(
    report: VerificationReport,
    validityMs: number = DEFAULT_APPROVAL_VALIDITY_MS
  ): UserApprovalRecord {
    if (String(report.status).toUpperCase() !== 'VERIFIED') {
      throw new Error(`Cannot request user approval for an unverified deal (Current status: ${report.status}).`);
    }

    const now = Date.now();
    return {
      approvalId: `appr-${now}-${Math.floor(Math.random() * 1000)}`,
      dealId: report.dealId,
      reportId: report.id,
      dealFingerprint: report.dealFingerprint,
      status: 'PENDING',
      createdAt: new Date(now).toISOString(),
      expiresAt: new Date(now + validityMs).toISOString(),
    };
  }

  /**
   * User explicitly approves a verified deal.
   * Binds the current deal fingerprint and generates a one-time demonstration payment authorization token.
   */
  public static approveDeal(
    approval: UserApprovalRecord,
    currentDeal: FinalDeal
  ): { approval: UserApprovalRecord; authorizationToken: string } {
    // 1. Verify approval state is PENDING
    if (approval.status !== 'PENDING') {
      throw new Error(`Cannot approve transaction with status: ${approval.status}.`);
    }

    // 2. Check Expiration
    if (new Date() > new Date(approval.expiresAt)) {
      approval.status = 'EXPIRED';
      throw new Error('Approval request has expired. Re-verification required.');
    }

    // 3. Check for Post-Verification Modification / Tampering
    const currentFingerprint = generateDealFingerprint(currentDeal);
    if (currentFingerprint !== approval.dealFingerprint) {
      approval.status = 'INVALIDATED';
      approval.invalidationReason = `Deal terms were modified after verification report was generated. Original fingerprint: ${approval.dealFingerprint.slice(0, 8)}..., Current fingerprint: ${currentFingerprint.slice(0, 8)}...`;
      throw new Error(`Approval invalidated: Transaction terms were altered after verification.`);
    }

    // 4. Issue one-time authorization token
    const token = `AUTH-DEMO-${Date.now()}-${currentFingerprint.slice(0, 16)}`;
    const updatedApproval: UserApprovalRecord = {
      ...approval,
      status: 'APPROVED',
      approvedAt: new Date().toISOString(),
      authorizationToken: token,
    };

    return {
      approval: updatedApproval,
      authorizationToken: token,
    };
  }

  /**
   * User explicitly declines a deal.
   */
  public static declineDeal(approval: UserApprovalRecord): UserApprovalRecord {
    return {
      ...approval,
      status: 'DECLINED',
      declinedAt: new Date().toISOString(),
    };
  }

  /**
   * One-time consumption of an authorization token at the payment gateway boundary.
   * Prevents replay attacks or reused authorization tokens.
   */
  public static consumeAuthorization(
    approval: UserApprovalRecord,
    currentDeal: FinalDeal,
    submittedToken: string
  ): { isConsumed: boolean; failureReason?: string } {
    if (approval.status !== 'APPROVED') {
      return {
        isConsumed: false,
        failureReason: `Cannot consume authorization. Current status is ${approval.status}.`,
      };
    }

    if (new Date() > new Date(approval.expiresAt)) {
      approval.status = 'EXPIRED';
      return {
        isConsumed: false,
        failureReason: 'Authorization token has expired. Re-verification and approval required.',
      };
    }

    if (approval.authorizationToken !== submittedToken) {
      return {
        isConsumed: false,
        failureReason: 'Invalid authorization token supplied.',
      };
    }

    // Ensure terms have not changed between user approval and checkout click
    const currentFingerprint = generateDealFingerprint(currentDeal);
    if (currentFingerprint !== approval.dealFingerprint) {
      approval.status = 'INVALIDATED';
      approval.invalidationReason = 'Transaction terms modified prior to authorization consumption.';
      return {
        isConsumed: false,
        failureReason: 'Approval invalidated: Deal terms were altered after human approval was granted.',
      };
    }

    approval.status = 'CONSUMED';
    approval.consumedAt = new Date().toISOString();

    return {
      isConsumed: true,
    };
  }

  /**
   * Checks whether a deal modification invalidates an existing approval record.
   */
  public static validateApprovalBinding(approval: UserApprovalRecord, currentDeal: FinalDeal): boolean {
    if (approval.status !== 'PENDING' && approval.status !== 'APPROVED') {
      return false;
    }
    const currentFingerprint = generateDealFingerprint(currentDeal);
    return currentFingerprint === approval.dealFingerprint;
  }
}
