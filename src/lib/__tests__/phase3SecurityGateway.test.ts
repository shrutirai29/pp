import { describe, it, expect } from 'vitest';
import { UserIntent } from '../../types/deal';
import { FinalDeal } from '../../types/negotiation';
import { IntentVerifier } from '../intentlock/intentVerifier';
import { ApprovalManager } from '../intentlock/approvalManager';
import { generateDealFingerprint } from '../intentlock/transactionIntegrity';

const mockAuthorizedIntent: UserIntent = {
  id: 'intent-sec-001',
  rawQuery: 'Samsung 980 1TB SSD under ₹8,000, new condition, delivery in 3 days, no subscriptions.',
  productTitle: 'Samsung 980 1TB NVMe SSD',
  maxBudget: 8000,
  currency: 'INR',
  requiredCondition: 'new',
  maxDeliveryDays: 3,
  requiredWarrantyMonths: 12,
  prohibitSubscriptions: true,
  requireAllFeesIncluded: true,
  hardConstraints: ['budget', 'condition', 'delivery', 'no_subscription', 'warranty'],
  flexiblePreferences: ['seller_rating'],
  createdAt: '2026-10-30T09:00:00Z',
};

const mockValidFinalDeal: FinalDeal = {
  dealId: 'intent-sec-001',
  originalOfferId: 'off-techhaven-01',
  sellerId: 'off-techhaven-01',
  sellerName: 'TechHaven Direct',
  productTitle: 'Samsung 980 1TB NVMe SSD',
  condition: 'new',
  productPrice: 6750,
  deliveryFee: 0,
  otherCharges: 0,
  otherChargesDescription: undefined,
  totalPayable: 6750,
  deliveryEstimateDays: 2,
  warrantyMonths: 60,
  hasSubscription: false,
  subscriptionDetails: undefined,
  negotiationStatus: 'agreed',
  roundCount: 4,
  messages: [],
  isAcceptedBySeller: true,
  currency: 'INR',
  totalSaved: 549,
  stopReason: 'agreed',
};

describe('Phase 3: IntentLock Independent Transaction Security Gateway', () => {
  // 1. Valid seller-accepted FinalDeal passes
  it('1. Valid seller-accepted FinalDeal passes all IntentLock security checks', () => {
    const report = IntentVerifier.verify(mockAuthorizedIntent, mockValidFinalDeal);
    expect(report.status).toBe('VERIFIED');
    expect(report.failedCount).toBe(0);
    expect(report.dealFingerprint).toBeDefined();
    expect(report.dealFingerprint.length).toBe(64); // SHA-256 hex string length
  });

  // 2. Unaccepted seller agreement fails
  it('2. Unaccepted seller agreement (isAcceptedBySeller: false) fails verification', () => {
    const unaccepted = {
      ...mockValidFinalDeal,
      isAcceptedBySeller: false,
    };
    const report = IntentVerifier.verify(mockAuthorizedIntent, unaccepted);
    expect(report.status).toBe('REJECTED');
    const statusCheck = report.checks.find((c) => c.category === 'transaction_status');
    expect(statusCheck?.status).toBe('failed');
  });

  // 3. Failed negotiation is rejected
  it('3. Failed negotiation is rejected', () => {
    const failedDeal = {
      ...mockValidFinalDeal,
      negotiationStatus: 'rejected' as const,
      isAcceptedBySeller: false,
      stopReason: 'seller_rejected' as const,
    };
    const report = IntentVerifier.verify(mockAuthorizedIntent, failedDeal);
    expect(report.status).toBe('REJECTED');
    expect(report.rejectionReasons.some((r) => r.includes('without mutual agreement'))).toBe(true);
  });

  // 4. Timeout negotiation is rejected
  it('4. Timeout negotiation (5 rounds exceeded) is rejected', () => {
    const timeoutDeal = {
      ...mockValidFinalDeal,
      negotiationStatus: 'failed_timeout' as const,
      isAcceptedBySeller: false,
      stopReason: 'max_rounds_reached' as const,
    };
    const report = IntentVerifier.verify(mockAuthorizedIntent, timeoutDeal);
    expect(report.status).toBe('REJECTED');
    const statusCheck = report.checks.find((c) => c.category === 'transaction_status');
    expect(statusCheck?.status).toBe('failed');
  });

  // 5. Budget mismatch is rejected
  it('5. Deal exceeding budget ceiling is rejected', () => {
    const overBudgetDeal = {
      ...mockValidFinalDeal,
      productPrice: 8500,
      totalPayable: 8500,
    };
    const report = IntentVerifier.verify(mockAuthorizedIntent, overBudgetDeal);
    expect(report.status).toBe('REJECTED');
    const budgetCheck = report.checks.find((c) => c.category === 'budget');
    expect(budgetCheck?.status).toBe('failed');
  });

  // 6. Recalculated total mismatch is rejected
  it('6. Recalculated total mismatch (tampered totalPayable) is rejected immediately', () => {
    const tamperedMathDeal = {
      ...mockValidFinalDeal,
      productPrice: 6500,
      deliveryFee: 400,
      otherCharges: 100,
      totalPayable: 6500, // Deceptive! Actual sum is 7000
    };
    const report = IntentVerifier.verify(mockAuthorizedIntent, tamperedMathDeal);
    expect(report.status).toBe('REJECTED');
    const budgetCheck = report.checks.find((c) => c.category === 'budget');
    expect(budgetCheck?.status).toBe('failed');
    expect(budgetCheck?.details).toContain('Internal calculation tampering detected');
  });

  // 7. Currency mismatch is rejected
  it('7. Currency mismatch between user intent and deal is rejected', () => {
    const usdDeal = {
      ...mockValidFinalDeal,
      currency: 'USD' as const,
    };
    const report = IntentVerifier.verify(mockAuthorizedIntent, usdDeal);
    expect(report.status).toBe('REJECTED');
    const currencyCheck = report.checks.find((c) => c.category === 'currency');
    expect(currencyCheck?.status).toBe('failed');
    expect(currencyCheck?.details).toContain('Currency mismatch detected');
  });

  // 8. Refurbished item violates new-only intent
  it('8. Refurbished condition violates new-only intent and is rejected', () => {
    const refurbDeal = {
      ...mockValidFinalDeal,
      condition: 'refurbished' as const,
    };
    const report = IntentVerifier.verify(mockAuthorizedIntent, refurbDeal);
    expect(report.status).toBe('REJECTED');
    const condCheck = report.checks.find((c) => c.category === 'condition');
    expect(condCheck?.status).toBe('failed');
  });

  // 9. Late delivery is rejected
  it('9. Delivery beyond authorized maximum is rejected', () => {
    const lateDeal = {
      ...mockValidFinalDeal,
      deliveryEstimateDays: 5, // Intent max is 3 days
    };
    const report = IntentVerifier.verify(mockAuthorizedIntent, lateDeal);
    expect(report.status).toBe('REJECTED');
    const delivCheck = report.checks.find((c) => c.category === 'delivery');
    expect(delivCheck?.status).toBe('failed');
  });

  // 10. Subscription violation is rejected
  it('10. Subscription violation is rejected when user prohibited subscriptions', () => {
    const subDeal = {
      ...mockValidFinalDeal,
      hasSubscription: true,
      subscriptionDetails: 'Cloud Sync ₹299/mo',
    };
    const report = IntentVerifier.verify(mockAuthorizedIntent, subDeal);
    expect(report.status).toBe('REJECTED');
    const subCheck = report.checks.find((c) => c.category === 'subscription');
    expect(subCheck?.status).toBe('failed');
  });

  // 11. Missing subscription information requires review
  it('11. Missing subscription terms require review when subscription is flagged', () => {
    const permissiveIntent: UserIntent = {
      ...mockAuthorizedIntent,
      prohibitSubscriptions: false, // User allows subscriptions
    };
    const ambiguousSubDeal = {
      ...mockValidFinalDeal,
      hasSubscription: true,
      subscriptionDetails: undefined, // Missing terms!
    };
    const report = IntentVerifier.verify(permissiveIntent, ambiguousSubDeal);
    expect(report.status).toBe('NEEDS_REVIEW');
    const subCheck = report.checks.find((c) => c.category === 'subscription');
    expect(subCheck?.status).toBe('needs_review');
  });

  // 12. Missing warranty requires review
  it('12. Missing warranty declaration requires review (never auto-passes)', () => {
    const noWarrantyDeal = {
      ...mockValidFinalDeal,
      warrantyMonths: null,
    };
    const report = IntentVerifier.verify(mockAuthorizedIntent, noWarrantyDeal);
    expect(report.status).toBe('NEEDS_REVIEW');
    const warCheck = report.checks.find((c) => c.category === 'warranty');
    expect(warCheck?.status).toBe('needs_review');
  });

  // 13. Insufficient warranty is rejected
  it('13. Warranty duration below required minimum is rejected', () => {
    const shortWarrantyDeal = {
      ...mockValidFinalDeal,
      warrantyMonths: 6, // Intent requires 12 months
    };
    const report = IntentVerifier.verify(mockAuthorizedIntent, shortWarrantyDeal);
    expect(report.status).toBe('REJECTED');
    const warCheck = report.checks.find((c) => c.category === 'warranty');
    expect(warCheck?.status).toBe('failed');
  });

  // 14. Missing charge description is flagged
  it('14. Mandatory charge with missing description is flagged as fee violation', () => {
    const hiddenFeeDeal = {
      ...mockValidFinalDeal,
      otherCharges: 250,
      otherChargesDescription: undefined, // Missing description!
      totalPayable: 7000,
    };
    const report = IntentVerifier.verify(mockAuthorizedIntent, hiddenFeeDeal);
    expect(report.status).toBe('REJECTED');
    const feeCheck = report.checks.find((c) => c.category === 'fees');
    expect(feeCheck?.status).toBe('failed');
  });

  // 15. Fingerprint remains stable for equivalent canonical objects
  it('15. Fingerprint remains stable and deterministic for equivalent canonical objects', () => {
    const fp1 = generateDealFingerprint(mockValidFinalDeal);
    const copyDeal = { ...mockValidFinalDeal };
    const fp2 = generateDealFingerprint(copyDeal);

    expect(fp1).toBe(fp2);
    expect(typeof fp1).toBe('string');
    expect(fp1.length).toBe(64);
  });

  // 16. Price alteration changes fingerprint
  it('16. Price alteration changes fingerprint', () => {
    const originalFp = generateDealFingerprint(mockValidFinalDeal);
    const alteredDeal = {
      ...mockValidFinalDeal,
      productPrice: 6760, // Changed by 10
      totalPayable: 6760,
    };
    const alteredFp = generateDealFingerprint(alteredDeal);
    expect(alteredFp).not.toBe(originalFp);
  });

  // 17. Delivery alteration changes fingerprint
  it('17. Delivery alteration changes fingerprint', () => {
    const originalFp = generateDealFingerprint(mockValidFinalDeal);
    const alteredDeal = {
      ...mockValidFinalDeal,
      deliveryEstimateDays: 1, // Changed delivery days
    };
    const alteredFp = generateDealFingerprint(alteredDeal);
    expect(alteredFp).not.toBe(originalFp);
  });

  // 18. Subscription alteration changes fingerprint
  it('18. Subscription status alteration changes fingerprint', () => {
    const originalFp = generateDealFingerprint(mockValidFinalDeal);
    const alteredDeal = {
      ...mockValidFinalDeal,
      hasSubscription: true,
      subscriptionDetails: 'Cloud Sync',
    };
    const alteredFp = generateDealFingerprint(alteredDeal);
    expect(alteredFp).not.toBe(originalFp);
  });

  // 19. Warranty alteration changes fingerprint
  it('19. Warranty alteration changes fingerprint', () => {
    const originalFp = generateDealFingerprint(mockValidFinalDeal);
    const alteredDeal = {
      ...mockValidFinalDeal,
      warrantyMonths: 36, // Altered from 60
    };
    const alteredFp = generateDealFingerprint(alteredDeal);
    expect(alteredFp).not.toBe(originalFp);
  });

  // 20. Unverified deals cannot request user approval
  it('20. Unverified deals (Rejected or Needs Review) cannot request user approval', () => {
    const rejectedReport = IntentVerifier.verify(mockAuthorizedIntent, {
      ...mockValidFinalDeal,
      condition: 'refurbished' as const,
    });
    expect(rejectedReport.status).toBe('REJECTED');

    expect(() => {
      ApprovalManager.createApprovalRequest(rejectedReport);
    }).toThrow(/Cannot request user approval for an unverified deal/);
  });

  // 21. User can explicitly approve a verified deal
  it('21. User can explicitly approve a verified deal and receive a payment authorization token', () => {
    const verifiedReport = IntentVerifier.verify(mockAuthorizedIntent, mockValidFinalDeal);
    expect(verifiedReport.status).toBe('VERIFIED');

    const approvalRequest = ApprovalManager.createApprovalRequest(verifiedReport);
    expect(approvalRequest.status).toBe('PENDING');

    const result = ApprovalManager.approveDeal(approvalRequest, mockValidFinalDeal);
    expect(result.approval.status).toBe('APPROVED');
    expect(result.authorizationToken).toBeDefined();
    expect(result.authorizationToken.startsWith('AUTH-DEMO-')).toBe(true);
  });

  // 22. User can explicitly decline a verified deal
  it('22. User can explicitly decline a verified deal', () => {
    const verifiedReport = IntentVerifier.verify(mockAuthorizedIntent, mockValidFinalDeal);
    const approvalRequest = ApprovalManager.createApprovalRequest(verifiedReport);

    const declined = ApprovalManager.declineDeal(approvalRequest);
    expect(declined.status).toBe('DECLINED');
    expect(declined.declinedAt).toBeDefined();
  });

  // 23. Expired approval cannot be consumed
  it('23. Expired approval cannot be consumed or approved', () => {
    const verifiedReport = IntentVerifier.verify(mockAuthorizedIntent, mockValidFinalDeal);
    // Create approval with -1 ms validity (already expired)
    const expiredRequest = ApprovalManager.createApprovalRequest(verifiedReport, -1000);

    expect(() => {
      ApprovalManager.approveDeal(expiredRequest, mockValidFinalDeal);
    }).toThrow(/Approval request has expired/);
  });

  // 24. Modified deal invalidates approval
  it('24. Modifying transaction terms after report generation invalidates approval binding', () => {
    const verifiedReport = IntentVerifier.verify(mockAuthorizedIntent, mockValidFinalDeal);
    const approvalRequest = ApprovalManager.createApprovalRequest(verifiedReport);

    // Merchant secretly tampers with price before user approval click
    const secretlyModifiedDeal = {
      ...mockValidFinalDeal,
      productPrice: 6950,
      totalPayable: 6950,
    };

    expect(() => {
      ApprovalManager.approveDeal(approvalRequest, secretlyModifiedDeal);
    }).toThrow(/Approval invalidated: Transaction terms were altered/);

    expect(approvalRequest.status).toBe('INVALIDATED');
  });

  // 25. An approval can only be consumed once
  it('25. An authorization token can only be consumed once at checkout (replay prevention)', () => {
    const verifiedReport = IntentVerifier.verify(mockAuthorizedIntent, mockValidFinalDeal);
    const approvalRequest = ApprovalManager.createApprovalRequest(verifiedReport);
    const { approval, authorizationToken } = ApprovalManager.approveDeal(approvalRequest, mockValidFinalDeal);

    // First consumption at checkout gateway: succeeds
    const firstConsumption = ApprovalManager.consumeAuthorization(approval, mockValidFinalDeal, authorizationToken);
    expect(firstConsumption.isConsumed).toBe(true);
    expect(approval.status).toBe('CONSUMED');

    // Second consumption attempt: fails
    const secondConsumption = ApprovalManager.consumeAuthorization(approval, mockValidFinalDeal, authorizationToken);
    expect(secondConsumption.isConsumed).toBe(false);
    expect(secondConsumption.failureReason).toContain('Cannot consume authorization. Current status is CONSUMED');
  });

  // 26. Failed negotiation cannot produce payment authorization
  it('26. Failed negotiation cannot produce payment authorization under any circumstances', () => {
    const failedDeal = {
      ...mockValidFinalDeal,
      negotiationStatus: 'rejected' as const,
      isAcceptedBySeller: false,
    };
    const report = IntentVerifier.verify(mockAuthorizedIntent, failedDeal);
    expect(report.status).toBe('REJECTED');

    expect(() => {
      ApprovalManager.createApprovalRequest(report);
    }).toThrow();
  });
});
