import { UserIntent } from '../../schemas/dealSchemas.js';

export interface EvaluatedOffer {
  id: string;
  sellerId: string;
  sellerName: string;
  productTitle: string;
  basePrice: number;
  deliveryFee: number;
  otherCharges: number;
  totalPrice: number;
  estimatedDeliveryDays: number;
  warrantyMonths: number | null;
  hasSubscription: boolean;
  condition: string;
  currency: string;
  sellerRating?: number; // e.g. 96 (%)
  isEligible: boolean;
  ineligibilityReasons: string[];
  score: number;
  rank: number;
  recommendationExplanation: string;
}

export class OfferRankingService {
  /**
   * Deterministically evaluates and ranks offers against user intent.
   * Evaluates mandatory non-negotiable requirements strictly before optional preferences.
   */
  public static rankOffers(offers: any[], intent: UserIntent): EvaluatedOffer[] {
    const evaluated: EvaluatedOffer[] = offers.map((offer) => {
      const ineligibilityReasons: string[] = [];
      const basePrice = Number(offer.basePrice || 0);
      const deliveryFee = Number(offer.deliveryFee || 0);
      const otherCharges = Number(offer.otherCharges || 0);
      const totalPrice = basePrice + deliveryFee + otherCharges;

      // 1. Mandatory Constraint: Currency
      if (offer.currency !== intent.currency) {
        ineligibilityReasons.push(
          `Currency mismatch: offer in ${offer.currency}, intent requires ${intent.currency}`
        );
      }

      // 2. Mandatory Constraint: Condition
      if (
        intent.requiredCondition !== 'any' &&
        offer.condition &&
        offer.condition !== intent.requiredCondition
      ) {
        ineligibilityReasons.push(
          `Condition mismatch: offer is '${offer.condition}', required '${intent.requiredCondition}'`
        );
      }

      // 3. Mandatory Constraint: No Subscriptions
      if (intent.prohibitSubscriptions && offer.hasSubscription) {
        ineligibilityReasons.push('Offer includes prohibited recurring subscription');
      }

      // 4. Mandatory Constraint: Warranty duration
      if (
        intent.requiredWarrantyMonths > 0 &&
        (!offer.warrantyMonths || offer.warrantyMonths < intent.requiredWarrantyMonths)
      ) {
        ineligibilityReasons.push(
          `Insufficient warranty: ${offer.warrantyMonths || 0} months vs ${intent.requiredWarrantyMonths} months required`
        );
      }

      // 5. Mandatory Constraint: Delivery timeline
      if (offer.estimatedDeliveryDays > intent.maxDeliveryDays) {
        ineligibilityReasons.push(
          `Delivery too slow: ${offer.estimatedDeliveryDays} days vs max ${intent.maxDeliveryDays} days`
        );
      }

      // Ineligibility flag
      const isEligible = ineligibilityReasons.length === 0;

      // Scoring calculation:
      // Eligible offers receive base score of 1000 + discounts/savings + perks
      // Ineligible offers receive score of 0
      let score = 0;
      let explanation = '';

      if (isEligible) {
        // Price factor: up to 500 points based on budget efficiency
        const priceRatio = Math.max(0, 1 - totalPrice / intent.maxBudget);
        const priceScore = Math.round(priceRatio * 500);

        // Warranty factor: 100 points
        const warrantyScore = Math.min(100, (offer.warrantyMonths || 0) * 5);

        // Delivery speed factor: 100 points
        const deliverySpeedScore = Math.max(0, (intent.maxDeliveryDays - offer.estimatedDeliveryDays) * 20);

        // Seller reliability rating factor: up to 200 points
        const rating = Number(offer.sellerReliabilityScore || offer.sellerRating || 90);
        const ratingScore = Math.round((rating / 100) * 200);

        score = 1000 + priceScore + warrantyScore + deliverySpeedScore + ratingScore;

        explanation = `Eligible: Meets all non-negotiables. Priced at ${intent.currency} ${totalPrice} (${priceRatio > 0 ? (priceRatio * 100).toFixed(0) + '% under budget' : 'at budget'}). Delivery in ${offer.estimatedDeliveryDays}d with ${offer.warrantyMonths || 0}mo warranty.`;
      } else {
        score = 0;
        explanation = `Ineligible: Disqualified due to non-negotiable violations: ${ineligibilityReasons.join('; ')}`;
      }

      return {
        id: offer.id,
        sellerId: offer.sellerId || offer.id,
        sellerName: offer.sellerName || 'Merchant',
        productTitle: offer.productTitle,
        basePrice,
        deliveryFee,
        otherCharges,
        totalPrice,
        estimatedDeliveryDays: offer.estimatedDeliveryDays,
        warrantyMonths: offer.warrantyMonths,
        hasSubscription: Boolean(offer.hasSubscription),
        condition: offer.condition,
        currency: offer.currency,
        sellerRating: offer.sellerReliabilityScore || offer.sellerRating,
        isEligible,
        ineligibilityReasons,
        score,
        rank: 0,
        recommendationExplanation: explanation,
      };
    });

    // Deterministic sort:
    // 1. Eligible offers first
    // 2. Highest score first (lower price, faster shipping, higher warranty/rating)
    // 3. Lowest totalPrice as tiebreaker
    evaluated.sort((a, b) => {
      if (a.isEligible !== b.isEligible) {
        return a.isEligible ? -1 : 1;
      }
      if (b.score !== a.score) {
        return b.score - a.score;
      }
      return a.totalPrice - b.totalPrice;
    });

    // Assign 1-based ranks
    evaluated.forEach((item, idx) => {
      item.rank = idx + 1;
    });

    return evaluated;
  }
}
