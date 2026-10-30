import { UserIntent } from '../../types/deal';
import { ProductOffer } from '../../types/offer';

/**
 * Utility to safely round money to integer units (e.g. nearest 10 or 50)
 * to avoid floating-point imprecision in commerce math.
 */
export function roundToNearest(amount: number, step: number = 10): number {
  return Math.round(amount / step) * step;
}

/**
 * Calculates a rational opening price for the buyer agent.
 * Opening bid targets an aggressive but defensible 10% - 14% discount
 * below the listed base price, strictly capped by the buyer's hard budget.
 */
export function calculateOpeningBuyerBid(
  offer: ProductOffer,
  intent: UserIntent,
  competingOffers: ProductOffer[] = []
): { openingBasePrice: number; rationale: string } {
  const listingBase = offer.basePrice;

  // Check if competing offers provide a benchmark leverage
  const otherEligible = competingOffers.filter(
    (o) => o.id !== offer.id && o.eligibilityStatus === 'eligible'
  );
  
  let targetDiscountRate = 0.12; // default 12% opening concession request

  let rationale = `Targeting an opening discount of 12% based on volume parity.`;

  if (otherEligible.length > 0) {
    const lowestOther = Math.min(...otherEligible.map((o) => o.basePrice));
    if (lowestOther < listingBase) {
      targetDiscountRate = Math.min(0.15, Math.max(0.10, (listingBase - lowestOther * 0.95) / listingBase));
      rationale = `Applying market leverage from competing eligible quotes (${lowestOther} ${offer.currency}).`;
    }
  }

  // Calculate opening base price
  let openingBase = roundToNearest(listingBase * (1 - targetDiscountRate), 50);

  // Hard safety check: ensure base + current delivery + charges does NOT exceed intent budget
  const estimatedTotal = openingBase + offer.deliveryFee + offer.otherCharges;
  if (estimatedTotal > intent.maxBudget) {
    openingBase = Math.max(100, intent.maxBudget - offer.deliveryFee - offer.otherCharges);
    rationale = `Opening bid constrained by buyer hard budget ceiling (${intent.maxBudget} ${intent.currency}).`;
  }

  return {
    openingBasePrice: openingBase,
    rationale,
  };
}

/**
 * Computes buyer concession for subsequent counter-rounds.
 * Increments the buyer's bid towards the seller's counter, strictly capped by budget.
 */
export function calculateBuyerNextBid(
  currentBuyerBid: number,
  sellerCounterBase: number,
  _intent: UserIntent,
  currentRound: number,
  maxRounds: number
): { nextBid: number; rationale: string } {
  // Move 45% - 55% towards seller counter
  const gap = sellerCounterBase - currentBuyerBid;
  
  // Progressively larger step as round nears maximum to encourage agreement
  const paceFactor = currentRound >= maxRounds - 1 ? 0.65 : 0.45;
  const increment = Math.max(50, roundToNearest(gap * paceFactor, 50));
  
  const nextBid = Math.min(sellerCounterBase, currentBuyerBid + increment);

  return {
    nextBid,
    rationale: `Bridging the price gap by ${increment} (Round ${currentRound}/${maxRounds}) towards seller counter of ${sellerCounterBase}.`,
  };
}
