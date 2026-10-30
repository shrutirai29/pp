import { ServerSellerPolicy } from '../../data/sellerPolicies.js';
import { LLMSellerResponse } from '../../schemas/negotiationSchemas.js';
import { NegotiationTerms } from '../../schemas/dealSchemas.js';

export interface ValidatedSellerDecision {
  action: 'counter' | 'accept' | 'reject';
  terms: NegotiationTerms;
  rationale: string;
  sellerMessage: string;
  wasModifiedByPolicyGuard: boolean;
  guardAdjustments: string[];
}

export class SellerPolicyValidator {
  /**
   * Enforces backend-authoritative seller constraints on any LLM or external seller response.
   * Never trusts the LLM to respect the merchant's reservation price or policy limits.
   */
  public static validateSellerProposal(
    rawProposal: LLMSellerResponse,
    policy: ServerSellerPolicy,
    buyerBidPrice: number
  ): ValidatedSellerDecision {
    const adjustments: string[] = [];
    let action = rawProposal.action;
    let productPrice = rawProposal.proposedPrice;
    let deliveryFee = rawProposal.deliveryFee ?? policy.deliveryFee;
    let otherCharges = rawProposal.otherCharges ?? policy.otherCharges;
    let warrantyMonths = rawProposal.warrantyMonths ?? policy.warrantyMonths;
    let deliveryDays = rawProposal.deliveryDays ?? policy.deliveryOptions.standardDays;

    // 1. Fixed Price / No-Negotiation Policy Guard
    if (!policy.acceptsNegotiation) {
      return {
        action: 'reject',
        terms: {
          productPrice: policy.startingPrice,
          deliveryFee: policy.deliveryFee,
          otherCharges: policy.otherCharges,
          totalPayable: policy.startingPrice + policy.deliveryFee + policy.otherCharges,
          deliveryEstimateDays: policy.deliveryOptions.standardDays,
          warrantyMonths: policy.warrantyMonths,
          hasSubscription: policy.hasSubscription,
          subscriptionDetails: policy.subscriptionDetails,
          condition: policy.condition,
        },
        rationale: 'Merchant policy is strictly fixed list pricing. Concessions rejected by policy guard.',
        sellerMessage: `${policy.sellerName} does not participate in automated price concessions.`,
        wasModifiedByPolicyGuard: true,
        guardAdjustments: ['Fixed price merchant policy enforced: concessions blocked'],
      };
    }

    // 2. Reservation Floor Guard (Private minimum acceptable price)
    if (productPrice < policy.privateMinimumAcceptablePrice) {
      adjustments.push(
        `LLM proposed price (${productPrice}) breached private minimum floor (${policy.privateMinimumAcceptablePrice}). Clamped to reservation floor.`
      );
      productPrice = policy.privateMinimumAcceptablePrice;
    }

    // 3. Maximum Permitted Discount Guard
    const maxDiscountFloor = Math.round(policy.startingPrice * (1 - policy.maxPermittedDiscount));
    if (productPrice < maxDiscountFloor) {
      adjustments.push(
        `LLM proposed price (${productPrice}) exceeded maximum permitted discount (${(policy.maxPermittedDiscount * 100).toFixed(1)}%). Clamped to ${maxDiscountFloor}.`
      );
      productPrice = maxDiscountFloor;
    }

    // 4. Delivery Fee Concession Guard
    if (deliveryFee < policy.deliveryFee && !policy.canWaiveDeliveryFee) {
      adjustments.push(
        `LLM attempted to waive delivery fee to ${deliveryFee}, but policy forbids shipping concessions. Restored to ${policy.deliveryFee}.`
      );
      deliveryFee = policy.deliveryFee;
    }

    // 5. Warranty Extension Guard
    if (
      warrantyMonths &&
      policy.warrantyMonths &&
      warrantyMonths > policy.warrantyMonths &&
      !policy.canExtendWarranty
    ) {
      adjustments.push(
        `LLM attempted to grant ${warrantyMonths}mo warranty, but merchant policy forbids extension beyond ${policy.warrantyMonths}mo.`
      );
      warrantyMonths = policy.warrantyMonths;
    }

    // 6. Acceptance Sanity Check
    // If terms were adjusted by policy guard, action CANNOT remain 'accept'.
    // It must become an explicit, transparent counteroffer.
    if (action === 'accept' && (adjustments.length > 0 || buyerBidPrice < policy.privateMinimumAcceptablePrice)) {
      action = 'counter';
      if (buyerBidPrice < policy.privateMinimumAcceptablePrice) {
        productPrice = policy.privateMinimumAcceptablePrice;
        adjustments.push(
          `LLM mistakenly marked offer accepted even though buyer bid (${buyerBidPrice}) was below reservation floor (${policy.privateMinimumAcceptablePrice}). Overridden to explicit counteroffer at floor.`
        );
      } else {
        adjustments.push(
          'Offer terms were modified by backend policy guard; transformed from accepted offer to explicit counteroffer.'
        );
      }
    }

    // Strict recalculation of totalPayable on the backend
    const totalPayable = productPrice + deliveryFee + otherCharges;

    const terms: NegotiationTerms = {
      productPrice,
      deliveryFee,
      otherCharges,
      totalPayable,
      deliveryEstimateDays: deliveryDays,
      warrantyMonths,
      hasSubscription: policy.hasSubscription,
      subscriptionDetails: policy.subscriptionDetails,
      condition: policy.condition,
    };

    let sellerMessage = rawProposal.sellerMessage;
    if (action === 'counter' && rawProposal.action === 'accept') {
      sellerMessage = `We cannot accept those terms as proposed. We counter with our binding policy terms at ${productPrice}.`;
    }

    return {
      action,
      terms,
      rationale: rawProposal.rationale,
      sellerMessage,
      wasModifiedByPolicyGuard: adjustments.length > 0,
      guardAdjustments: adjustments,
    };
  }
}
