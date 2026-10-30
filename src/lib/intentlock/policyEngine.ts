import { UserIntent } from '../../types/deal';
import { FinalDeal } from '../../types/negotiation';
import { ProductOffer } from '../../types/offer';
import { VerificationCheck } from './verificationTypes';
import { formatCurrency } from '../currency';

export interface PolicyEvaluationResult {
  checks: VerificationCheck[];
  passedCount: number;
  failedCount: number;
  needsReviewCount: number;
  rejectionReasons: string[];
  suggestedRemedies: string[];
}

/**
 * IntentLock Policy Engine.
 * Evaluates a complete seller-accepted FinalDeal against the buyer's original immutable UserIntent.
 * Independently recalculates totals, validates currency, guarantees transaction bilateral acceptance,
 * and audits all constraints without trusting buyer agent assertions.
 */
export class PolicyEngine {
  public static evaluate(
    intent: UserIntent,
    deal: FinalDeal,
    originalOffer?: ProductOffer
  ): PolicyEvaluationResult {
    const checks: VerificationCheck[] = [];
    const rejectionReasons: string[] = [];
    const suggestedRemedies: string[] = [];

    // -------------------------------------------------------------------------
    // Rule A: Transaction Status & Bilateral Agreement
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
        ? 'Both buyer agent and seller agent concluded with formal binding agreement.'
        : `Transaction was not completed or agreed upon (Stop reason: ${deal.stopReason}). Failed, rejected or timed-out negotiations cannot proceed to checkout.`,
      suggestedRemedy: isStatusValid ? undefined : 'Re-open negotiation with this or an alternate merchant to reach agreement.',
    });

    if (!isStatusValid) {
      rejectionReasons.push(`Deal rejected because bilateral negotiation concluded without mutual agreement (${deal.stopReason}).`);
      suggestedRemedies.push('Return to negotiation or select another eligible seller.');
    }

    // -------------------------------------------------------------------------
    // Rule I: Currency Consistency
    // -------------------------------------------------------------------------
    const isCurrencyMatch = deal.currency === intent.currency && (!originalOffer || originalOffer.currency === intent.currency);
    checks.push({
      id: 'chk-currency',
      name: 'Transaction Currency Invariance',
      category: 'currency',
      status: isCurrencyMatch ? 'passed' : 'failed',
      isHardConstraint: true,
      expected: `Authorized Currency: ${intent.currency}`,
      actual: `Deal Currency: ${deal.currency}`,
      details: isCurrencyMatch
        ? `Currency matches user-authorized authorization currency (${intent.currency}).`
        : `Currency mismatch detected: Deal is denominated in ${deal.currency}, but user intent authorized ${intent.currency}. Cross-currency transactions are prohibited without validated conversion.`,
      suggestedRemedy: isCurrencyMatch ? undefined : 'Request seller quote in user-authorized currency.',
    });

    if (!isCurrencyMatch) {
      rejectionReasons.push(`Currency mismatch: Expected ${intent.currency}, got ${deal.currency}.`);
      suggestedRemedies.push('Submit request in the same currency as merchant catalogue.');
    }

    // -------------------------------------------------------------------------
    // Rule H: Product Integrity & Identity Check
    // -------------------------------------------------------------------------
    let productIntegrityOk = true;
    let productDetails = 'Product title and identifier match selected offer.';
    if (originalOffer) {
      if (deal.originalOfferId !== originalOffer.id || deal.sellerId !== originalOffer.id) {
        // Compare with original offer
        if (!deal.productTitle.toLowerCase().includes(originalOffer.productTitle.toLowerCase().slice(0, 15))) {
          productIntegrityOk = false;
          productDetails = `Product title deviation detected between selected offer ("${originalOffer.productTitle}") and final agreement ("${deal.productTitle}").`;
        }
      }
    }

    checks.push({
      id: 'chk-product-integrity',
      name: 'Product Identity & Catalogue Integrity',
      category: 'product_integrity',
      status: productIntegrityOk ? 'passed' : 'failed',
      isHardConstraint: true,
      expected: originalOffer ? originalOffer.productTitle : intent.productTitle,
      actual: deal.productTitle,
      details: productDetails,
      suggestedRemedy: productIntegrityOk ? undefined : 'Ensure merchant binds quotation to exact requested catalog SKU.',
    });

    if (!productIntegrityOk) {
      rejectionReasons.push(productDetails);
    }

    // -------------------------------------------------------------------------
    // Rule B: Product Condition Validation
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
    // Rule C: Budget & Independent Total Recalculation
    // -------------------------------------------------------------------------
    const calculatedTotal = Number(deal.productPrice) + Number(deal.deliveryFee || 0) + Number(deal.otherCharges || 0);
    const hasMathMismatch = Math.abs(deal.totalPayable - calculatedTotal) > 0.001;
    const isWithinBudget = calculatedTotal <= intent.maxBudget;

    let budgetStatus: 'passed' | 'failed' = 'passed';
    let budgetDetails = '';

    if (hasMathMismatch) {
      budgetStatus = 'failed';
      budgetDetails = `Internal calculation tampering detected: Stated totalPayable (${deal.totalPayable}) does not match independent sum (${calculatedTotal}).`;
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
    // Rule D: Fulfillment Delivery Timeline
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
    // Rule E: Recurring Charges & Subscription Lock-in
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
        suggestedRemedies.push('Opt-out of recurring cloud/maintenance subscription riders.');
      }
    } else if (deal.hasSubscription && !deal.subscriptionDetails) {
      subscriptionStatus = 'needs_review';
      subscriptionActual = 'Subscription flagged but billing terms unspecified.';
      subscriptionDetails = 'Contract indicates recurring subscription charges, but frequency and cancellation terms are unspecified.';
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
    // Rule G: Fee Transparency
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
    // Rule F: Warranty Coverage
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

    return {
      checks,
      passedCount,
      failedCount,
      needsReviewCount,
      rejectionReasons,
      suggestedRemedies,
    };
  }
}
