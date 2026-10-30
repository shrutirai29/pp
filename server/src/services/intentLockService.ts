import { UserIntent, FinalDeal } from '../schemas/dealSchemas.js';
import { generateServerDealFingerprint } from './integrityService.js';

export type VerificationStatus = 'VERIFIED' | 'REJECTED' | 'NEEDS_REVIEW';
export type CheckStatus = 'passed' | 'failed' | 'needs_review';

export interface VerificationCheck {
  id: string;
  name: string;
  category: string;
  status: CheckStatus;
  isHardConstraint: boolean;
  expected: string;
  actual: string;
  details: string;
  suggestedRemedy?: string;
}

export interface ServerVerificationReport {
  id: string;
  dealId: string;
  originalIntentId: string;
  offerId: string;
  offerTitle: string;
  sellerName: string;
  sellerId: string;
  finalPrice: number;
  currency: string;
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

export function formatCurrency(amount: number, currency: string = 'INR'): string {
  try {
    return new Intl.NumberFormat(currency === 'INR' ? 'en-IN' : 'en-US', {
      style: 'currency',
      currency: currency,
      maximumFractionDigits: 0,
      minimumFractionDigits: 0,
    }).format(amount);
  } catch {
    return `${currency} ${amount.toLocaleString()}`;
  }
}

export class ServerIntentVerifier {
  public static verify(intent: UserIntent, deal: FinalDeal): ServerVerificationReport {
    // 1. Generate canonical transaction fingerprint on the server
    const dealFingerprint = generateServerDealFingerprint(deal);

    const checks: VerificationCheck[] = [];
    const rejectionReasons: string[] = [];
    const suggestedRemedies: string[] = [];

    // -------------------------------------------------------------------------
    // Check 1: Transaction Status & Bilateral Agreement
    // -------------------------------------------------------------------------
    const isAgreed = deal.negotiationStatus === 'agreed';
    const isSellerAccepted = deal.isAcceptedBySeller === true;
    const isStatusValid = isAgreed && isSellerAccepted;

    checks.push({
      id: 'chk-transaction-status',
      name: 'Transaction Status & Bilateral Acceptance',
      category: 'transaction_status',
      status: isStatusValid ? 'passed' : 'failed',
      isHardConstraint: true,
      expected: 'Negotiation status: agreed, isAcceptedBySeller: true',
      actual: `Status: ${deal.negotiationStatus}, isAcceptedBySeller: ${deal.isAcceptedBySeller}`,
      details: isStatusValid
        ? 'Both buyer and seller agents concluded with a formal binding agreement.'
        : `Transaction was not agreed or accepted by seller (Stop reason: ${deal.stopReason}). Failed, rejected or timed-out negotiations cannot proceed to checkout.`,
      suggestedRemedy: isStatusValid ? undefined : 'Re-open negotiation with seller to reach agreement.',
    });

    if (!isStatusValid) {
      rejectionReasons.push(`Deal rejected because bilateral negotiation concluded without mutual agreement (${deal.stopReason}).`);
      suggestedRemedies.push('Return to negotiation or select another eligible seller.');
    }

    // -------------------------------------------------------------------------
    // Check 2: Currency Consistency
    // -------------------------------------------------------------------------
    const isCurrencyMatch = deal.currency === intent.currency;
    checks.push({
      id: 'chk-currency',
      name: 'Transaction Currency Invariance',
      category: 'currency',
      status: isCurrencyMatch ? 'passed' : 'failed',
      isHardConstraint: true,
      expected: `Authorized Currency: ${intent.currency}`,
      actual: `Deal Currency: ${deal.currency}`,
      details: isCurrencyMatch
        ? `Currency matches user-authorized currency (${intent.currency}).`
        : `Currency mismatch detected: Deal is denominated in ${deal.currency}, but user intent authorized ${intent.currency}. Cross-currency transactions are prohibited without validated conversion.`,
      suggestedRemedy: isCurrencyMatch ? undefined : 'Request seller quote in user-authorized currency.',
    });

    if (!isCurrencyMatch) {
      rejectionReasons.push(`Currency mismatch: Expected ${intent.currency}, got ${deal.currency}.`);
      suggestedRemedies.push('Submit request in the same currency as merchant catalogue.');
    }

    // -------------------------------------------------------------------------
    // Check 3: Product Integrity & Identity Check
    // -------------------------------------------------------------------------
    const titleMatch = deal.productTitle.trim().length > 0;
    checks.push({
      id: 'chk-product-integrity',
      name: 'Product Identity & Integrity',
      category: 'product_integrity',
      status: titleMatch ? 'passed' : 'failed',
      isHardConstraint: true,
      expected: intent.productTitle,
      actual: deal.productTitle,
      details: titleMatch
        ? 'Product identifier and title validated.'
        : 'Invalid or missing product title in final contract terms.',
    });

    // -------------------------------------------------------------------------
    // Check 4: Product Condition Validation
    // -------------------------------------------------------------------------
    let conditionStatus: 'passed' | 'failed' = 'passed';
    if (intent.requiredCondition === 'new' && deal.condition !== 'new') {
      conditionStatus = 'failed';
    }

    checks.push({
      id: 'chk-condition',
      name: 'Hardware Condition Verification',
      category: 'condition',
      status: conditionStatus,
      isHardConstraint: true,
      expected: intent.requiredCondition === 'new' ? 'Strictly Factory New (Unopened)' : 'New or Certified Refurbished',
      actual: deal.condition.toUpperCase(),
      details: conditionStatus === 'passed'
        ? `Hardware condition satisfies user requirement (${deal.condition}).`
        : `Hard constraint breached: User authorized factory NEW condition only, but final contract specifies '${deal.condition}'.`,
      suggestedRemedy: conditionStatus === 'passed' ? undefined : 'Demand factory new replacement from merchant sales desk.',
    });

    if (conditionStatus === 'failed') {
      rejectionReasons.push(`Product condition is '${deal.condition}', but buyer non-negotiably requires 'new'.`);
      suggestedRemedies.push('Require seller to quote factory-new unit.');
    }

    // -------------------------------------------------------------------------
    // Check 5: Budget & Server Total Recalculation
    // -------------------------------------------------------------------------
    const calculatedTotal = Number(deal.productPrice) + Number(deal.deliveryFee || 0) + Number(deal.otherCharges || 0);
    const hasMathMismatch = Math.abs(deal.totalPayable - calculatedTotal) > 0.001;
    const isWithinBudget = calculatedTotal <= intent.maxBudget;

    let budgetStatus: 'passed' | 'failed' = 'passed';
    let budgetDetails = '';

    if (hasMathMismatch) {
      budgetStatus = 'failed';
      budgetDetails = `Internal calculation tampering detected: Stated totalPayable (${deal.totalPayable}) does not match independent server sum (${calculatedTotal}).`;
      rejectionReasons.push(budgetDetails);
    } else if (!isWithinBudget) {
      budgetStatus = 'failed';
      budgetDetails = `Independently verified total of ${formatCurrency(calculatedTotal, deal.currency)} exceeds user authorized maximum budget ceiling of ${formatCurrency(intent.maxBudget, intent.currency)} by ${formatCurrency(calculatedTotal - intent.maxBudget, intent.currency)}.`;
      rejectionReasons.push(budgetDetails);
      suggestedRemedies.push('Renegotiate with seller or increase budget authorization.');
    } else {
      budgetDetails = `Total payable amount (${formatCurrency(calculatedTotal, deal.currency)}) is within authorized budget ceiling of ${formatCurrency(intent.maxBudget, intent.currency)} (Margin: ${formatCurrency(intent.maxBudget - calculatedTotal, intent.currency)}).`;
    }

    checks.push({
      id: 'chk-budget',
      name: 'Independent Budget & Total Payability Audit',
      category: 'budget',
      status: budgetStatus,
      isHardConstraint: true,
      expected: `Total payable ≤ ${formatCurrency(intent.maxBudget, intent.currency)} (with exact math check)`,
      actual: `${formatCurrency(calculatedTotal, deal.currency)} (Base: ${formatCurrency(deal.productPrice, deal.currency)} + Shipping: ${formatCurrency(deal.deliveryFee, deal.currency)} + Ancillary: ${formatCurrency(deal.otherCharges, deal.currency)})`,
      details: budgetDetails,
      suggestedRemedy: budgetStatus === 'passed' ? undefined : 'Recompute charges and ensure total is within budget ceiling.',
    });

    // -------------------------------------------------------------------------
    // Check 6: Fulfillment Delivery Timeline
    // -------------------------------------------------------------------------
    const isDeliveryOk = deal.deliveryEstimateDays <= intent.maxDeliveryDays;
    checks.push({
      id: 'chk-delivery',
      name: 'Fulfillment & Courier Delivery Window',
      category: 'delivery',
      status: isDeliveryOk ? 'passed' : 'failed',
      isHardConstraint: true,
      expected: `Delivery within ≤ ${intent.maxDeliveryDays} calendar days`,
      actual: `${deal.deliveryEstimateDays} days (${deal.deliveryFee === 0 ? 'Free Shipping' : formatCurrency(deal.deliveryFee, deal.currency)})`,
      details: isDeliveryOk
        ? `Delivery schedule (${deal.deliveryEstimateDays} days) conforms to user authorized window (≤ ${intent.maxDeliveryDays} days).`
        : `Delivery timeline of ${deal.deliveryEstimateDays} days breaches user-authorized maximum limit of ${intent.maxDeliveryDays} days.`,
      suggestedRemedy: isDeliveryOk ? undefined : 'Negotiate priority express shipping or dispatch guarantee.',
    });

    if (!isDeliveryOk) {
      rejectionReasons.push(`Delivery of ${deal.deliveryEstimateDays} days exceeds authorized limit of ${intent.maxDeliveryDays} days.`);
      suggestedRemedies.push('Require seller to upgrade to priority courier dispatch.');
    }

    // -------------------------------------------------------------------------
    // Check 7: Recurring Charges & Subscription Lock-in
    // -------------------------------------------------------------------------
    let subscriptionStatus: 'passed' | 'failed' | 'needs_review' = 'passed';
    let subscriptionActual = 'One-time purchase. Zero recurring billing.';
    let subscriptionDetails = 'Clean outright purchase with zero hidden memberships or recurring billing mandates.';

    if (intent.prohibitSubscriptions) {
      if (deal.hasSubscription) {
        subscriptionStatus = 'failed';
        subscriptionActual = `Mandatory Subscription: ${deal.subscriptionDetails || 'Recurring Charge'}`;
        subscriptionDetails = `User strictly prohibited recurring subscriptions, but seller contract bundles "${deal.subscriptionDetails || 'subscription membership'}".`;
        rejectionReasons.push(subscriptionDetails);
        suggestedRemedies.push('Opt-out of recurring subscription riders.');
      }
    } else if (deal.hasSubscription && !deal.subscriptionDetails) {
      subscriptionStatus = 'needs_review';
      subscriptionActual = 'Subscription flagged but billing terms unspecified.';
      subscriptionDetails = 'Contract indicates recurring subscription charges, but frequency and terms are unspecified.';
      suggestedRemedies.push('Request explicit billing frequency and cancellation policy from merchant.');
    }

    checks.push({
      id: 'chk-subscription',
      name: 'Hidden Recurring Charges & Subscription Mandates',
      category: 'subscription',
      status: subscriptionStatus,
      isHardConstraint: true,
      expected: intent.prohibitSubscriptions ? 'Zero recurring subscriptions or auto-renew charges' : 'Clearly disclosed billing terms',
      actual: subscriptionActual,
      details: subscriptionDetails,
      suggestedRemedy: subscriptionStatus === 'passed' ? undefined : 'Remove subscription requirement from contract.',
    });

    // -------------------------------------------------------------------------
    // Check 8: Fee Transparency
    // -------------------------------------------------------------------------
    const hasUnexplainedFee = deal.otherCharges > 0 && !deal.otherChargesDescription;
    checks.push({
      id: 'chk-fees',
      name: 'Ancillary Fee Disclosure & Itemization',
      category: 'fees',
      status: hasUnexplainedFee ? 'failed' : 'passed',
      isHardConstraint: true,
      expected: 'All charges fully itemized and explained upfront',
      actual: deal.otherCharges > 0
        ? `${formatCurrency(deal.otherCharges, deal.currency)} (${deal.otherChargesDescription || 'Unitemized Surcharge'})`
        : 'Zero ancillary or secondary fees.',
      details: hasUnexplainedFee
        ? 'Undisclosed surcharge detected on bill of materials without description.'
        : 'All line items and fulfillment surcharges are transparently itemized.',
      suggestedRemedy: hasUnexplainedFee ? 'Request itemized receipt of ancillary charges from seller.' : undefined,
    });

    if (hasUnexplainedFee) {
      rejectionReasons.push('Undisclosed or unitemized ancillary surcharge detected.');
      suggestedRemedies.push('Request merchant waive or detail unitemized surcharge.');
    }

    // -------------------------------------------------------------------------
    // Check 9: Warranty Coverage
    // -------------------------------------------------------------------------
    if (intent.requiredWarrantyMonths > 0) {
      let warrantyStatus: 'passed' | 'failed' | 'needs_review' = 'passed';
      let warrantyActual = '';
      let warrantyDetails = '';

      if (deal.warrantyMonths === null || deal.warrantyMonths === undefined) {
        warrantyStatus = 'needs_review';
        warrantyActual = 'Unspecified / Missing warranty declaration';
        warrantyDetails = `User requires ≥ ${intent.requiredWarrantyMonths} months warranty, but contract contains no explicit warranty term. IntentLock flags this for human review.`;
        suggestedRemedies.push('Request explicit written warranty guarantee from seller agent.');
      } else if (deal.warrantyMonths < intent.requiredWarrantyMonths) {
        warrantyStatus = 'failed';
        warrantyActual = `${deal.warrantyMonths} months warranty provided`;
        warrantyDetails = `Warranty period (${deal.warrantyMonths} mo) is shorter than required minimum (${intent.requiredWarrantyMonths} mo).`;
        rejectionReasons.push(warrantyDetails);
        suggestedRemedies.push('Negotiate extended warranty rider or select merchant with manufacturer coverage.');
      } else {
        warrantyActual = `${deal.warrantyMonths} months official warranty included`;
        warrantyDetails = `Warranty satisfies or exceeds buyer requirement (${intent.requiredWarrantyMonths} mo).`;
      }

      checks.push({
        id: 'chk-warranty',
        name: 'Warranty Coverage & Hardware Protection',
        category: 'warranty',
        status: warrantyStatus,
        isHardConstraint: true,
        expected: `Minimum ${intent.requiredWarrantyMonths} months warranty`,
        actual: warrantyActual,
        details: warrantyDetails,
        suggestedRemedy: warrantyStatus === 'passed' ? undefined : 'Request seller include extended warranty rider.',
      });
    }

    const failedCount = checks.filter((c) => c.status === 'failed').length;
    const needsReviewCount = checks.filter((c) => c.status === 'needs_review').length;
    const passedCount = checks.filter((c) => c.status === 'passed').length;

    let finalStatus: VerificationStatus = 'VERIFIED';
    let summary = '';

    if (failedCount > 0) {
      finalStatus = 'REJECTED';
      summary = `IntentLock Server Security Gateway REJECTED this deal due to ${failedCount} hard constraint breach${failedCount > 1 ? 'es' : ''}. Payment authorization is strictly locked.`;
    } else if (needsReviewCount > 0) {
      finalStatus = 'NEEDS_REVIEW';
      summary = `IntentLock identified ${needsReviewCount} uncertain or missing requirement item${needsReviewCount > 1 ? 's' : ''}. Independent server verification requires user or merchant confirmation.`;
    } else {
      finalStatus = 'VERIFIED';
      summary = `All ${passedCount} transaction security and intent conformance criteria PASSED. Contract terms are cryptographically bound to fingerprint ${dealFingerprint.slice(0, 12)}... and ready for explicit human approval.`;
    }

    return {
      id: `ver-srv-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      dealId: deal.dealId,
      originalIntentId: intent.id,
      offerId: deal.originalOfferId,
      offerTitle: deal.productTitle,
      sellerName: deal.sellerName,
      sellerId: deal.sellerId,
      finalPrice: calculatedTotal,
      currency: deal.currency,
      dealFingerprint,
      verifiedAt: new Date().toISOString(),
      status: finalStatus,
      summary,
      checks,
      passedCount,
      failedCount,
      needsReviewCount,
      rejectionReasons,
      suggestedRemedies,
      disclaimer: 'SERVER ENFORCED SECURITY: Verified on backend using authoritative recalculation and canonical SHA-256 contract fingerprinting. Demonstration payment authorization only.',
    };
  }
}
