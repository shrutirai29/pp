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
   * FIX ISSUE A: Does not manufacture deliveryEstimateDays with Math.min().
   * Reflects seller's actual listing delivery timeline while requesting adherence to buyer ceiling.
   * FIX ISSUE B: Enforces strict mathematical invariant totalPayable = productPrice + deliveryFee + otherCharges.
   */
  public generateOpeningProposal(): BuyerDecision {
    const { openingBasePrice, rationale } = calculateOpeningBuyerBid(
      this.offer,
      this.intent,
      this.competingOffers
    );

    const deliveryFee = Number(this.offer.deliveryFee || 0);
    const otherCharges = Number(this.offer.otherCharges || 0);
    // Strict recalculation of total
    const totalPayable = openingBasePrice + deliveryFee + otherCharges;

    // Issue A Fix: Use seller's actual estimated delivery timeline, do not manufacture one with Math.min!
    const sellerListingDeliveryDays = this.offer.estimatedDeliveryDays;

    const terms: NegotiationTerms = {
      productPrice: openingBasePrice,
      deliveryFee,
      otherCharges,
      totalPayable,
      deliveryEstimateDays: sellerListingDeliveryDays,
      warrantyMonths: this.offer.warrantyMonths ?? this.intent.requiredWarrantyMonths,
      hasSubscription: false,
      condition: this.intent.requiredCondition === 'any' ? this.offer.condition : this.intent.requiredCondition,
    };

    const highlights = [
      `Target Base: ${formatCurrency(openingBasePrice, this.intent.currency)}`,
      `Total Payable: ${formatCurrency(totalPayable, this.intent.currency)}`,
      `Requested Delivery: ≤ ${this.intent.maxDeliveryDays} days (Quoted: ${sellerListingDeliveryDays}d)`,
      'Immediate payment guarantee',
    ];

    const messageText = `Greetings ${this.offer.sellerName} sales desk. On behalf of our buyer, we propose an immediate settlement for "${this.offer.productTitle}" at ${formatCurrency(openingBasePrice, this.intent.currency)} (Total payable: ${formatCurrency(totalPayable, this.intent.currency)}). All non-negotiable buyer conditions apply: factory new condition, fulfillment within ${this.intent.maxDeliveryDays} days, and zero recurring subscriptions.`;

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
   * FIX ISSUE B: Strictly recalculates itemized sum and rejects internally inconsistent proposals.
   * FIX ISSUE A: Inspects seller's actual counter deliveryEstimateDays without manufacturing compliance.
   */
  public evaluateSellerCounter(
    sellerTerms: NegotiationTerms,
    history: NegotiationMessage[],
    currentRound: number
  ): BuyerDecision {
    // -------------------------------------------------------------------------
    // ISSUE B: STRICT TOTAL RECALCULATION & INCONSISTENCY GUARD
    // Independently calculate productPrice + deliveryFee + otherCharges
    // and reject any internally inconsistent or deceptive offer immediately.
    // -------------------------------------------------------------------------
    const computedTotal = Number(sellerTerms.productPrice) + Number(sellerTerms.deliveryFee || 0) + Number(sellerTerms.otherCharges || 0);
    if (Math.abs(sellerTerms.totalPayable - computedTotal) > 0.001) {
      const rationale = `Internally inconsistent pricing detected: Stated totalPayable (${sellerTerms.totalPayable}) does not match itemized sum: productPrice (${sellerTerms.productPrice}) + deliveryFee (${sellerTerms.deliveryFee}) + otherCharges (${sellerTerms.otherCharges}) = ${computedTotal}.`;
      return {
        action: 'reject',
        terms: sellerTerms,
        rationale,
        messageText: `Negotiation aborted due to invalid counteroffer terms. The stated total (${formatCurrency(sellerTerms.totalPayable, this.intent.currency)}) differs from the itemized sum of charges (${formatCurrency(computedTotal, this.intent.currency)}).`,
        termsHighlights: ['Internal Pricing Inconsistency Rejected'],
      };
    }

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

    // 3. Delivery Cutoff Check (Issue A: Evaluates seller's genuine delivery timeline)
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
    const totalPayable = computedTotal;
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
        terms: {
          ...sellerTerms,
          totalPayable: computedTotal,
        },
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

    const counterDelivery = Number(sellerTerms.deliveryFee || 0);
    const counterCharges = Number(sellerTerms.otherCharges || 0);
    const counterTotal = nextBid + counterDelivery + counterCharges;

    // Strict guard: ensure next counter NEVER exceeds budget
    if (counterTotal > this.intent.maxBudget) {
      const adjustedNextBid = Math.max(100, this.intent.maxBudget - counterDelivery - counterCharges);
      const adjustedTotal = adjustedNextBid + counterDelivery + counterCharges;

      const adjustedTerms: NegotiationTerms = {
        ...sellerTerms,
        productPrice: adjustedNextBid,
        deliveryFee: counterDelivery,
        otherCharges: counterCharges,
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
      deliveryFee: counterDelivery,
      otherCharges: counterCharges,
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
