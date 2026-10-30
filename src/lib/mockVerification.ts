import { UserIntent } from '../types/deal';
import { ProductOffer } from '../types/offer';
import { VerificationReport, VerificationCheck, VerificationStatus } from '../types/verification';
import { calculateTotalPrice } from './dealScoring';
import { formatCurrency } from './currency';

/**
 * IntentLock Verification Engine (Deterministic Mock Implementation)
 * Evaluates a proposed deal against the buyer's original non-negotiable intent.
 * Note: Demonstration logic only - not production transaction security.
 */
export function verifyDealWithIntentLock(
  intent: UserIntent,
  offer: ProductOffer,
  negotiatedFinalPrice?: number
): VerificationReport {
  const activePrice = negotiatedFinalPrice !== undefined ? negotiatedFinalPrice : calculateTotalPrice(offer);
  const checks: VerificationCheck[] = [];

  // Check 1: Budget Ceiling
  const isBudgetOk = activePrice <= intent.maxBudget;
  checks.push({
    id: 'chk-budget',
    name: 'Total Cost vs Maximum Budget',
    category: 'budget',
    status: isBudgetOk ? 'passed' : 'failed',
    isHardConstraint: true,
    expected: `Total payable ≤ ${formatCurrency(intent.maxBudget, intent.currency)}`,
    actual: `${formatCurrency(activePrice, offer.currency)} (Base + Delivery + Charges)`,
    details: isBudgetOk
      ? `Deal total is within budget by ${formatCurrency(intent.maxBudget - activePrice, intent.currency)}.`
      : `Proposed price exceeds budget ceiling by ${formatCurrency(activePrice - intent.maxBudget, intent.currency)}.`,
    suggestedRemedy: isBudgetOk ? undefined : 'Renegotiate with seller or increase budget threshold.',
  });

  // Check 2: Product Condition
  let conditionStatus: 'passed' | 'failed' = 'passed';
  if (intent.requiredCondition === 'new' && offer.condition !== 'new') {
    conditionStatus = 'failed';
  }
  checks.push({
    id: 'chk-condition',
    name: 'Hardware Condition Verification',
    category: 'condition',
    status: conditionStatus,
    isHardConstraint: true,
    expected: intent.requiredCondition === 'new' ? 'Strictly Factory New (Unopened)' : 'New or Certified Refurbished',
    actual: offer.condition.toUpperCase(),
    details: conditionStatus === 'passed'
      ? `Item condition matches buyer requirement (${offer.condition}).`
      : `Buyer required strictly factory NEW, but seller is providing ${offer.condition}.`,
    suggestedRemedy: conditionStatus === 'passed' ? undefined : 'Request seller replace item with a genuine factory-new unit.',
  });

  // Check 3: Delivery Timeline
  const isDeliveryOk = offer.estimatedDeliveryDays <= intent.maxDeliveryDays;
  checks.push({
    id: 'chk-delivery',
    name: 'Fulfillment & Delivery Window',
    category: 'delivery',
    status: isDeliveryOk ? 'passed' : 'failed',
    isHardConstraint: true,
    expected: `Arrival within ${intent.maxDeliveryDays} calendar days`,
    actual: `Estimated ${offer.estimatedDeliveryDays} days (${offer.deliveryFee === 0 ? 'Free Shipping' : formatCurrency(offer.deliveryFee, offer.currency)})`,
    details: isDeliveryOk
      ? `Delivery schedule fits within buyer's ${intent.maxDeliveryDays}-day window.`
      : `Delivery of ${offer.estimatedDeliveryDays} days breaches buyer's maximum acceptable limit of ${intent.maxDeliveryDays} days.`,
    suggestedRemedy: isDeliveryOk ? undefined : 'Negotiate for express or priority courier dispatch.',
  });

  // Check 4: Recurring Charges & Subscriptions
  let subscriptionStatus: 'passed' | 'failed' = 'passed';
  if (intent.prohibitSubscriptions && offer.hasSubscription) {
    subscriptionStatus = 'failed';
  }
  checks.push({
    id: 'chk-subscription',
    name: 'Hidden Recurring Charges & Subscription Lock-in',
    category: 'subscription',
    status: subscriptionStatus,
    isHardConstraint: true,
    expected: 'No recurring subscriptions or hidden memberships',
    actual: offer.hasSubscription
      ? `Subscription detected: ${offer.subscriptionDetails || 'Recurring membership'}`
      : 'One-time outright purchase. Zero recurring charges.',
    details: subscriptionStatus === 'passed'
      ? 'Clean one-time purchase with no recurring payment mandates.'
      : `Hard requirement violated: Buyer prohibited subscriptions, but contract attaches "${offer.subscriptionDetails}".`,
    suggestedRemedy: subscriptionStatus === 'passed' ? undefined : 'Negotiate opt-out from auto-renewing subscriptions.',
  });

  // Check 5: Fee Transparency
  const hasHiddenFees = offer.otherCharges > 0 && !offer.otherChargesDescription;
  checks.push({
    id: 'chk-fees',
    name: 'Fee Transparency & Breakdown',
    category: 'fees',
    status: hasHiddenFees ? 'failed' : 'passed',
    isHardConstraint: true,
    expected: 'All fees itemized, transparent, and disclosed upfront',
    actual: offer.otherCharges > 0 
      ? `Extra charges: ${formatCurrency(offer.otherCharges, offer.currency)} (${offer.otherChargesDescription || 'Unitemized surcharge'})` 
      : 'No ancillary or surcharge fees.',
    details: hasHiddenFees
      ? 'Undisclosed ancillary surcharge detected on bill of materials.'
      : 'All delivery and checkout fees are accounted for in total price.',
    suggestedRemedy: hasHiddenFees ? 'Request itemized receipt of ancillary charges.' : undefined,
  });

  // Check 6: Warranty & Protection Plan (Tests Rule 7: Missing info -> Needs Review)
  if (intent.requiredWarrantyMonths > 0) {
    let warrantyStatus: 'passed' | 'failed' | 'needs_review' = 'passed';
    let warrantyActual = '';
    let warrantyDetails = '';
    let remedy: string | undefined = undefined;

    if (offer.warrantyMonths === null || offer.warrantyMonths === undefined) {
      warrantyStatus = 'needs_review';
      warrantyActual = 'Unspecified / Missing seller warranty declaration';
      warrantyDetails = `Buyer requires ${intent.requiredWarrantyMonths} months warranty, but seller listing contains no explicit warranty term. IntentLock flags this as unverified.`;
      remedy = 'Request explicit written warranty guarantee from seller agent.';
    } else if (offer.warrantyMonths < intent.requiredWarrantyMonths) {
      warrantyStatus = 'failed';
      warrantyActual = `${offer.warrantyMonths} months warranty provided`;
      warrantyDetails = `Warranty period (${offer.warrantyMonths} mo) is shorter than buyer required minimum (${intent.requiredWarrantyMonths} mo).`;
      remedy = 'Request seller include extended warranty rider.';
    } else {
      warrantyActual = `${offer.warrantyMonths} months official warranty included`;
      warrantyDetails = `Warranty satisfies buyer minimum (${intent.requiredWarrantyMonths} mo).`;
    }

    checks.push({
      id: 'chk-warranty',
      name: 'Warranty & Protection Coverage',
      category: 'warranty',
      status: warrantyStatus,
      isHardConstraint: true,
      expected: `Minimum ${intent.requiredWarrantyMonths} months manufacturer/seller warranty`,
      actual: warrantyActual,
      details: warrantyDetails,
      suggestedRemedy: remedy,
    });
  }

  // Calculate counts and aggregate status
  const failedCount = checks.filter((c) => c.status === 'failed').length;
  const needsReviewCount = checks.filter((c) => c.status === 'needs_review').length;
  const passedCount = checks.filter((c) => c.status === 'passed').length;

  let finalStatus: VerificationStatus = 'verified';
  let summary = '';

  if (failedCount > 0) {
    finalStatus = 'rejected';
    summary = `IntentLock verification REJECTED this deal due to ${failedCount} hard constraint breach${failedCount > 1 ? 'es' : ''}. Checkout is locked to prevent unauthorized purchase.`;
  } else if (needsReviewCount > 0) {
    finalStatus = 'needs_review';
    summary = `IntentLock identified ${needsReviewCount} uncertain or missing requirement item${needsReviewCount > 1 ? 's' : ''}. Deal cannot be verified automatically without seller confirmation.`;
  } else {
    finalStatus = 'verified';
    summary = `All ${passedCount} security and requirement criteria PASSED. The deal strictly conforms to your non-negotiable intent.`;
  }

  return {
    id: `ver-${Date.now()}`,
    dealId: intent.id,
    offerId: offer.id,
    offerTitle: offer.productTitle,
    sellerName: offer.sellerName,
    finalPrice: activePrice,
    currency: offer.currency,
    verifiedAt: new Date().toISOString(),
    status: finalStatus,
    summary,
    checks,
    passedCount,
    failedCount,
    needsReviewCount,
    disclaimer: 'DEMO INTENTLOCK SECURITY REPORT: IntentLock simulated verification model. This demonstrates deterministic compliance verification for the hackathon MVP and does not guarantee financial indemnity or real transaction safety.',
  };
}
