import { UserIntent } from '../../types/deal';
import { ProductOffer } from '../../types/offer';
import { NegotiationMessage, NegotiationTerms, NegotiationAction } from '../../types/negotiation';
import { calculateOpeningBuyerBid, calculateBuyerNextBid } from './negotiationStrategy';
import { formatCurrency } from '../currency';

export interface BuyerDecision {
  action: NegotiationAction;
  terms: NegotiationTerms;
  rationale: string;
  messageText: string;
  termsHighlights: string[];
}

/**
 * Intelligent Buyer Negotiation Agent.
 * Operates strictly on behalf of the buyer to negotiate prices and terms
 * while enforcing all non-negotiable IntentLock constraints.
 */
export class BuyerAgent {
  private intent: UserIntent;
  private offer: ProductOffer;
  private competingOffers: ProductOffer[];
  private maxRounds: number;

  constructor(
    intent: UserIntent,
    offer: ProductOffer,
    competingOffers: ProductOffer[] = [],
    maxRounds: number = 5
  ) {
    this.intent = intent;
    this.offer = offer;
    this.competingOffers = competingOffers;
    this.maxRounds = maxRounds;
  }

  /**
   * Generates the opening proposal for Round 1.
   */
  public generateOpeningProposal(): BuyerDecision {
    const { openingBasePrice, rationale } = calculateOpeningBuyerBid(
      this.offer,
      this.intent,
      this.competingOffers
    );

    const deliveryFee = this.offer.deliveryFee;
    const otherCharges = this.offer.otherCharges;
    const totalPayable = openingBasePrice + deliveryFee + otherCharges;

    const terms: NegotiationTerms = {
      productPrice: openingBasePrice,
      deliveryFee,
      otherCharges,
      totalPayable,
      deliveryEstimateDays: Math.min(this.offer.estimatedDeliveryDays, this.intent.maxDeliveryDays),
      warrantyMonths: this.offer.warrantyMonths ?? this.intent.requiredWarrantyMonths,
      hasSubscription: false,
      condition: this.intent.requiredCondition === 'any' ? this.offer.condition : this.intent.requiredCondition,
    };

    const highlights = [
      `Target Base: ${formatCurrency(openingBasePrice, this.intent.currency)}`,
      `Total Payable: ${formatCurrency(totalPayable, this.intent.currency)}`,
      `Delivery ≤ ${terms.deliveryEstimateDays} days`,
      'Immediate payment guarantee',
    ];

    const messageText = `Greetings ${this.offer.sellerName} sales desk. On behalf of our buyer, we propose an immediate settlement for "${this.offer.productTitle}" at ${formatCurrency(openingBasePrice, this.intent.currency)} (Total payable: ${formatCurrency(totalPayable, this.intent.currency)}). All non-negotiable buyer conditions apply: factory new condition, delivery within ${terms.deliveryEstimateDays} days, and zero recurring subscriptions.`;

    return {
      action: 'propose',
      terms,
      rationale,
      messageText,
      termsHighlights: highlights,
    };
  }

  /**
   * Evaluates a counteroffer received from the Seller Agent.
   */
  public evaluateSellerCounter(
    sellerTerms: NegotiationTerms,
    history: NegotiationMessage[],
    currentRound: number
  ): BuyerDecision {
    // -------------------------------------------------------------------------
    // CRITICAL HARD-CONSTRAINT VERIFICATION
    // The buyer agent must NEVER accept or trade away hard constraints!
    // -------------------------------------------------------------------------

    // 1. Condition Violation Check
    if (this.intent.requiredCondition === 'new' && sellerTerms.condition !== 'new') {
      const rationale = `Hard constraint breach: Seller offered '${sellerTerms.condition}' condition, but buyer strictly requires 'new'.`;
      return {
        action: 'reject',
        terms: sellerTerms,
        rationale,
        messageText: `Negotiation halted. Our buyer requires strictly factory NEW units. Refurbished or opened merchandise violates hard purchasing requirements.`,
        termsHighlights: ['Hard Violation: Non-new Condition Rejected'],
      };
    }

    // 2. Subscription Prohibition Check
    if (this.intent.prohibitSubscriptions && sellerTerms.hasSubscription) {
      const detail = sellerTerms.subscriptionDetails ? ` (${sellerTerms.subscriptionDetails})` : '';
      const rationale = `Hard constraint breach: Seller attached recurring subscription${detail}, which is explicitly prohibited.`;
      return {
        action: 'reject',
        terms: sellerTerms,
        rationale,
        messageText: `Negotiation terminated. The attached recurring subscription${detail} breaches our buyer's mandatory zero-subscription policy.`,
        termsHighlights: ['Hard Violation: Recurring Subscription Rejected'],
      };
    }

    // 3. Delivery Cutoff Check
    if (sellerTerms.deliveryEstimateDays > this.intent.maxDeliveryDays) {
      const rationale = `Hard constraint breach: Estimated delivery of ${sellerTerms.deliveryEstimateDays} days exceeds buyer maximum limit of ${this.intent.maxDeliveryDays} days.`;
      return {
        action: 'reject',
        terms: sellerTerms,
        rationale,
        messageText: `We cannot accept this schedule. Fulfillment within ${this.intent.maxDeliveryDays} days is mandatory. Your proposal of ${sellerTerms.deliveryEstimateDays} days exceeds our buyer's delivery window.`,
        termsHighlights: ['Hard Violation: Late Delivery Rejected'],
      };
    }

    // 4. Budget Ceiling Check
    const totalPayable = sellerTerms.totalPayable;
    if (totalPayable > this.intent.maxBudget) {
      // If round limit is reached and seller is still over budget, we must reject
      if (currentRound >= this.maxRounds) {
        const rationale = `Hard constraint breach: Total payable ${formatCurrency(totalPayable, this.intent.currency)} exceeds maximum budget of ${formatCurrency(this.intent.maxBudget, this.intent.currency)} after ${this.maxRounds} rounds.`;
        return {
          action: 'reject',
          terms: sellerTerms,
          rationale,
          messageText: `Negotiation unsuccessful. The final total of ${formatCurrency(totalPayable, this.intent.currency)} exceeds our buyer's strict budget ceiling of ${formatCurrency(this.intent.maxBudget, this.intent.currency)}.`,
          termsHighlights: ['Budget Ceiling Exceeded'],
        };
      }
    }

    // -------------------------------------------------------------------------
    // EVALUATE PRICE & CONCESSION ACCEPTABILITY
    // -------------------------------------------------------------------------
    const lastBuyerMessage = [...history].reverse().find((m) => m.sender === 'buyer_agent');
    const lastBuyerBid = lastBuyerMessage?.proposedPrice ?? this.offer.basePrice * 0.88;

    // Check if seller accepted or came within acceptable delta (<= 1% or <= 100 currency units)
    const priceGap = sellerTerms.productPrice - lastBuyerBid;
    const isWithinBudget = totalPayable <= this.intent.maxBudget;
    
    // Accept if seller matched buyer bid or gap is minimal and under budget
    const isPriceAcceptable = isWithinBudget && (
      priceGap <= 50 || 
      (currentRound >= 3 && priceGap <= 150) ||
      (currentRound >= this.maxRounds && isWithinBudget)
    );

    if (isPriceAcceptable) {
      const savings = this.offer.totalPrice - totalPayable;
      const rationale = `Seller proposal of ${formatCurrency(sellerTerms.productPrice, this.intent.currency)} (Total: ${formatCurrency(totalPayable, this.intent.currency)}) satisfies all non-negotiable criteria and budget limits, yielding ${formatCurrency(savings, this.intent.currency)} in buyer savings.`;

      return {
        action: 'accept',
        terms: sellerTerms,
        rationale,
        messageText: `Offer accepted. The proposed terms (${formatCurrency(sellerTerms.productPrice, this.intent.currency)} product price, ${sellerTerms.deliveryFee === 0 ? 'Free Delivery' : formatCurrency(sellerTerms.deliveryFee, this.intent.currency) + ' shipping'}, total ${formatCurrency(totalPayable, this.intent.currency)}) comply fully with our buyer's requirements. We lock these terms for IntentLock verification.`,
        termsHighlights: [
          `Final Agreed Total: ${formatCurrency(totalPayable, this.intent.currency)}`,
          `Buyer Savings: ${formatCurrency(savings, this.intent.currency)}`,
          `Condition: ${sellerTerms.condition.toUpperCase()}`,
          `Delivery: ${sellerTerms.deliveryEstimateDays} Days`,
        ],
      };
    }

    // If max rounds reached and still not acceptable
    if (currentRound >= this.maxRounds) {
      return {
        action: 'reject',
        terms: sellerTerms,
        rationale: `Maximum rounds (${this.maxRounds}) reached without reaching price convergence under required targets.`,
        messageText: `Negotiation timed out after ${this.maxRounds} rounds without reaching mutual agreement.`,
        termsHighlights: ['Max Rounds Limit Reached'],
      };
    }

    // -------------------------------------------------------------------------
    // COUNTER-OFFER GENERATION
    // -------------------------------------------------------------------------
    const { nextBid, rationale } = calculateBuyerNextBid(
      lastBuyerBid,
      sellerTerms.productPrice,
      this.intent,
      currentRound,
      this.maxRounds
    );

    const counterDelivery = sellerTerms.deliveryFee;
    const counterCharges = sellerTerms.otherCharges;
    const counterTotal = nextBid + counterDelivery + counterCharges;

    // Strict guard: ensure next counter NEVER exceeds budget
    if (counterTotal > this.intent.maxBudget) {
      const adjustedNextBid = Math.max(100, this.intent.maxBudget - counterDelivery - counterCharges);
      const adjustedTotal = adjustedNextBid + counterDelivery + counterCharges;

      const adjustedTerms: NegotiationTerms = {
        ...sellerTerms,
        productPrice: adjustedNextBid,
        totalPayable: adjustedTotal,
      };

      return {
        action: 'counter',
        terms: adjustedTerms,
        rationale: `Counter capped strictly by user maximum budget of ${formatCurrency(this.intent.maxBudget, this.intent.currency)}.`,
        messageText: `We appreciate the progress, but our buyer's maximum ceiling is ${formatCurrency(this.intent.maxBudget, this.intent.currency)}. Our best counter-proposal is ${formatCurrency(adjustedNextBid, this.intent.currency)} (Total: ${formatCurrency(adjustedTotal, this.intent.currency)}).`,
        termsHighlights: [
          `Counter Bid: ${formatCurrency(adjustedNextBid, this.intent.currency)}`,
          `Budget Capped Total: ${formatCurrency(adjustedTotal, this.intent.currency)}`,
        ],
      };
    }

    const nextTerms: NegotiationTerms = {
      ...sellerTerms,
      productPrice: nextBid,
      totalPayable: counterTotal,
    };

    return {
      action: 'counter',
      terms: nextTerms,
      rationale,
      messageText: `Thank you for the concession. We can close the gap and propose ${formatCurrency(nextBid, this.intent.currency)} (Total payable: ${formatCurrency(counterTotal, this.intent.currency)}). At this level, our buyer is authorized to lock the agreement immediately.`,
      termsHighlights: [
        `Counter Proposal: ${formatCurrency(nextBid, this.intent.currency)}`,
        `Total Payable: ${formatCurrency(counterTotal, this.intent.currency)}`,
        `Round ${currentRound}/${this.maxRounds}`,
      ],
    };
  }
}
