import { CurrencyCode, ProductCondition } from '../../types/deal';
import { NegotiationStopReason } from '../../types/negotiation';

export type VerificationStatus = 'VERIFIED' | 'REJECTED' | 'NEEDS_REVIEW';

export type CheckStatus = 'passed' | 'failed' | 'needs_review';

export type CheckCategory = 
  | 'transaction_status'
  | 'currency'
  | 'product_integrity'
  | 'condition'
  | 'budget'
  | 'delivery'
  | 'subscription'
  | 'fees'
  | 'warranty';

export interface VerificationCheck {
  id: string;
  name: string;
  category: CheckCategory;
  status: CheckStatus;
  isHardConstraint: boolean;
  expected: string;
  actual: string;
  details: string;
  suggestedRemedy?: string;
}

export interface VerificationReport {
  id: string;
  dealId: string;
  originalIntentId: string;
  offerId: string;
  offerTitle: string;
  sellerName: string;
  sellerId: string;
  finalPrice: number;
  currency: CurrencyCode;
  dealFingerprint: string;
  verifiedAt: string;
  status: VerificationStatus;
  summary: string;
  checks: VerificationCheck[];
  passedCount: number;
  failedCount: number;
  needsReviewCount: number;
  rejectionReasons: string[];
  suggestedRemedies: string[];
  disclaimer: string;
}

/**
 * Lifecycle states of the IntentLock Approval State Machine:
 * 
 * NEGOTIATED -> VERIFYING -> [REJECTED | NEEDS_REVIEW | VERIFIED]
 *                                                        |
 *                                                        v
 *                                            AWAITING_USER_APPROVAL
 *                                                  |         |
 *                                                  v         v
 *                                              DECLINED   APPROVED
 *                                                           |
 *                                                           v
 *                                                   PAYMENT_AUTHORIZED
 */
export type ApprovalLifecycleState = 
  | 'NEGOTIATED'
  | 'VERIFYING'
  | 'REJECTED'
  | 'NEEDS_REVIEW'
  | 'VERIFIED'
  | 'AWAITING_USER_APPROVAL'
  | 'DECLINED'
  | 'APPROVED'
  | 'PAYMENT_AUTHORIZED'
  | 'APPROVAL_EXPIRED'
  | 'APPROVAL_INVALIDATED';

export interface UserApprovalRecord {
  approvalId: string;
  dealId: string;
  reportId: string;
  dealFingerprint: string;
  status: 'PENDING' | 'APPROVED' | 'DECLINED' | 'CONSUMED' | 'EXPIRED' | 'INVALIDATED';
  createdAt: string;
  expiresAt: string; // e.g., 15 minutes validity
  approvedAt?: string;
  declinedAt?: string;
  consumedAt?: string;
  invalidationReason?: string;
  authorizationToken?: string;
}

/**
 * Authoritative Canonical Canonical Representation of security-relevant deal terms.
 * Used for deterministic SHA-256 fingerprint generation.
 */
export interface CanonicalDealData {
  dealId: string;
  originalOfferId: string;
  sellerId: string;
  productTitle: string;
  condition: ProductCondition;
  productPrice: number;
  deliveryFee: number;
  otherCharges: number;
  totalPayable: number;
  deliveryEstimateDays: number;
  warrantyMonths: number | null;
  hasSubscription: boolean;
  subscriptionDetails: string;
  currency: CurrencyCode;
  isAcceptedBySeller: boolean;
  negotiationStatus: string;
  stopReason: NegotiationStopReason;
}
