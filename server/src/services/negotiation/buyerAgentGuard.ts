import { UserIntent, NegotiationTerms } from '../../schemas/dealSchemas.js';
import { LLMBuyerResponse } from '../../schemas/negotiationSchemas.js';

export interface ValidatedBuyerDecision {
  action: 'propose' | 'counter' | 'accept' | 'reject';
  terms: NegotiationTerms;
  rationale: string;
  buyerMessage: string;
  wasModifiedByGuard: boolean;
  guardAdjustments: string[];
}

export class BuyerAgentGuard {
  /**
   * Enforces backend-authoritative buyer non-negotiables on any LLM or external buyer response.
   * Ensures the LLM cannot exceed the buyer's budget ceiling or trade away non-negotiable constraints.
   */
  public static validateBuyerProposal(
    rawProposal: LLMBuyerResponse,
    intent: UserIntent,
    sellerCurrentTerms: NegotiationTerms,
    currentRound: number
  ): ValidatedBuyerDecision {
    const adjustments: string[] = [];
    let action = rawProposal.action;
    let productPrice = rawProposal.proposedPrice;
    let deliveryFee = sellerCurrentTerms.deliveryFee;
    let otherCharges = sellerCurrentTerms.otherCharges;
    let deliveryDays = sellerCurrentTerms.deliveryEstimateDays;
    let warrantyMonths = sellerCurrentTerms.warrantyMonths;

    // Strict recalculation of total
    let totalPayable = productPrice + deliveryFee + otherCharges;

    // 1. Budget Ceiling Enforcement
    if (totalPayable > intent.maxBudget) {
      adjustments.push(
        `LLM proposed total (${totalPayable}) exceeded buyer budget ceiling (${intent.maxBudget}). Clamped product price to fit ceiling.`
      );
      productPrice = Math.max(0, intent.maxBudget - deliveryFee - otherCharges);
      totalPayable = productPrice + deliveryFee + otherCharges;

      // If proposal had to be clamped to fit budget, action cannot remain accept
      if (action === 'accept') {
        action = sellerCurrentTerms.totalPayable <= intent.maxBudget ? 'counter' : 'reject';
        adjustments.push(
          `LLM attempted to accept but terms breached budget ceiling. Overridden to explicit ${action}.`
        );
      }
    }

    // 2. Acceptance Guard: Cannot accept if seller's terms violate non-negotiables
    if (action === 'accept') {
      if (sellerCurrentTerms.totalPayable > intent.maxBudget) {
        action = 'reject';
        adjustments.push('Cannot accept: seller total exceeds buyer budget.');
      }

      if (sellerCurrentTerms.hasSubscription && intent.prohibitSubscriptions) {
        action = 'reject';
        adjustments.push('Cannot accept: seller terms include prohibited recurring subscription.');
      }

      if (
        intent.requiredWarrantyMonths > 0 &&
        (!sellerCurrentTerms.warrantyMonths || sellerCurrentTerms.warrantyMonths < intent.requiredWarrantyMonths)
      ) {
        action = 'counter';
        adjustments.push('Cannot accept: warranty does not meet required duration. Overridden to counter.');
      }

      if (sellerCurrentTerms.deliveryEstimateDays > intent.maxDeliveryDays) {
        action = 'reject';
        adjustments.push('Cannot accept: delivery timeline exceeds maximum acceptable days.');
      }
    }

    let buyerMessage = rawProposal.buyerMessage;
    if (action === 'counter' && rawProposal.action === 'accept') {
      buyerMessage = `We cannot accept the proposed price as it exceeds authorized budget limits. We counter with our maximum authorized bid of ${productPrice}.`;
    } else if (action === 'reject' && rawProposal.action === 'accept') {
      buyerMessage = `We must decline this proposal as it violates our non-negotiable purchase requirements.`;
    }

    const terms: NegotiationTerms = {
      productPrice,
      deliveryFee,
      otherCharges,
      totalPayable,
      deliveryEstimateDays: deliveryDays,
      warrantyMonths,
      hasSubscription: false,
      condition: intent.requiredCondition === 'any' ? sellerCurrentTerms.condition : intent.requiredCondition,
    };

    return {
      action,
      terms,
      rationale: rawProposal.rationale,
      buyerMessage,
      wasModifiedByGuard: adjustments.length > 0,
      guardAdjustments: adjustments,
    };
  }
}
