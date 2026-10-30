import { UserIntent } from '../types/deal';
import { ProductOffer } from '../types/offer';

export interface ScoredOffer {
  offer: ProductOffer;
  totalPrice: number;
  isEligible: boolean;
  violations: string[];
  warnings: string[];
  missingInfo: string[];
  score: number; // 0 to 100 ranking score
}

/**
 * Calculates total price strictly according to Rule 1:
 * Total = basePrice + deliveryFee + otherCharges
 */
export function calculateTotalPrice(offer: Pick<ProductOffer, 'basePrice' | 'deliveryFee' | 'otherCharges'>): number {
  return Number(offer.basePrice) + Number(offer.deliveryFee || 0) + Number(offer.otherCharges || 0);
}

/**
 * Evaluates an offer against user intent and enforces hard constraints.
 * Rule 3: Prohibited subscription is a hard violation.
 * Rule 4: Refurbished product is invalid when user requires new.
 * Rule 5: Delivery beyond hard max is invalid.
 * Rule 6: Total price exceeding hard budget is invalid.
 * Rule 7: Missing information for a hard requirement results in review/warning.
 * Rule 8 & 9: Flexible preferences rank offers, but lower price NEVER overrides hard constraints.
 */
export function evaluateOfferEligibility(offer: ProductOffer, intent: UserIntent): ScoredOffer {
  const totalPrice = calculateTotalPrice(offer);
  const violations: string[] = [];
  const warnings: string[] = [];
  const missingInfo: string[] = [];

  // Check 1: Budget constraint
  if (totalPrice > intent.maxBudget) {
    violations.push(
      `Total price (${totalPrice.toLocaleString()} ${offer.currency}) exceeds your maximum budget of ${intent.maxBudget.toLocaleString()} ${intent.currency}.`
    );
  }

  // Check 2: Condition constraint
  if (intent.requiredCondition === 'new' && offer.condition !== 'new') {
    violations.push(
      `Product condition is '${offer.condition}', but your requirement specifies strictly 'new'.`
    );
  }

  // Check 3: Delivery time constraint
  if (offer.estimatedDeliveryDays > intent.maxDeliveryDays) {
    violations.push(
      `Estimated delivery of ${offer.estimatedDeliveryDays} days exceeds your maximum allowed limit of ${intent.maxDeliveryDays} days.`
    );
  }

  // Check 4: Subscription constraint
  if (intent.prohibitSubscriptions && offer.hasSubscription) {
    const detail = offer.subscriptionDetails ? ` (${offer.subscriptionDetails})` : '';
    violations.push(
      `Includes a recurring subscription${detail}, which violates your non-negotiable condition prohibiting subscriptions.`
    );
  }

  // Check 5: Warranty constraint
  if (intent.requiredWarrantyMonths > 0) {
    if (offer.warrantyMonths === null || offer.warrantyMonths === undefined) {
      missingInfo.push(
        `Warranty duration is unspecified by seller. Your requirement is ${intent.requiredWarrantyMonths} months.`
      );
    } else if (offer.warrantyMonths < intent.requiredWarrantyMonths) {
      violations.push(
        `Warranty of ${offer.warrantyMonths} months is less than the required ${intent.requiredWarrantyMonths} months.`
      );
    }
  }

  // Check 6: Stock status
  if (!offer.inStock) {
    violations.push('Item is currently out of stock.');
  }

  const isEligible = violations.length === 0 && missingInfo.length === 0;

  // Compute ranking score for eligible offers (0-100)
  let score = 0;
  if (isEligible) {
    // Price savings factor (up to 40 pts)
    const budgetMargin = (intent.maxBudget - totalPrice) / intent.maxBudget;
    score += Math.max(0, Math.min(40, budgetMargin * 100));

    // Seller reliability factor (up to 30 pts)
    score += (offer.sellerReliabilityScore / 100) * 30;

    // Delivery speed factor (up to 20 pts)
    const deliveryBonus = Math.max(0, (intent.maxDeliveryDays - offer.estimatedDeliveryDays) / intent.maxDeliveryDays) * 20;
    score += deliveryBonus;

    // Warranty bonus (up to 10 pts)
    if (offer.warrantyMonths && offer.warrantyMonths >= intent.requiredWarrantyMonths) {
      score += 10;
    }
  } else {
    // Ineligible offers always get zero ranking score so they can NEVER outrank eligible ones
    score = 0;
  }

  return {
    offer: {
      ...offer,
      totalPrice,
      eligibilityStatus: isEligible ? 'eligible' : 'ineligible',
      eligibilityReasons: violations.length > 0 ? violations : (missingInfo.length > 0 ? missingInfo : ['Fully complies with all stated requirements.']),
    },
    totalPrice,
    isEligible,
    violations,
    warnings,
    missingInfo,
    score: Math.round(score),
  };
}
