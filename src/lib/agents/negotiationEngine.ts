import { UserIntent } from '../../types/deal';
import { ProductOffer } from '../../types/offer';
import { SellerPolicy } from '../../types/sellerPolicy';
import { 
  FinalDeal, 
  NegotiationSession, 
  NegotiationResult, 
  NegotiationMessage, 
  NegotiationTerms,
  NegotiationStopReason 
} from '../../types/negotiation';
import { BuyerAgent } from './buyerAgent';
import { SellerAgent } from './sellerAgent';
import { getSellerPolicyForOffer } from '../../data/mockSellerPolicies';
import { evaluateOfferEligibility } from '../dealScoring';
import { formatCurrency } from '../currency';

export const MAX_NEGOTIATION_ROUNDS = 5;

/**
 * Stateful Negotiation Engine for DealMind.
 * Executes modular multi-round autonomous dialogue between Buyer Agent and Seller Agent.
 */
export class NegotiationEngine {
  private intent: UserIntent;
  private offer: ProductOffer;
  private sellerPolicy: SellerPolicy;
  private buyerAgent: BuyerAgent;
  private sellerAgent: SellerAgent;
  private messages: NegotiationMessage[] = [];
  private currentRound: number = 0;
  private isTerminated: boolean = false;
  private stopReason: NegotiationStopReason = 'max_rounds_reached';
  private finalTerms?: NegotiationTerms;
  private isAgreed: boolean = false;
  private terminationRationale: string = '';

  constructor(
    intent: UserIntent,
    offer: ProductOffer,
    competingOffers: ProductOffer[] = [],
    customSellerPolicy?: SellerPolicy
  ) {
    this.intent = intent;
    this.offer = offer;
    this.sellerPolicy = customSellerPolicy ?? getSellerPolicyForOffer(offer.id, offer.sellerName, offer.basePrice);

    this.buyerAgent = new BuyerAgent(intent, offer, competingOffers, MAX_NEGOTIATION_ROUNDS);
    this.sellerAgent = new SellerAgent(this.sellerPolicy);
  }

  /**
   * Runs the full stateful negotiation sequence until agreement, rejection, or 5-round timeout.
   */
  public executeFullNegotiation(): NegotiationResult {
    // -------------------------------------------------------------------------
    // Rule 11 Enforcement: Ineligible offers cannot enter negotiation!
    // -------------------------------------------------------------------------
    const eligibility = evaluateOfferEligibility(this.offer, this.intent);
    if (!eligibility.isEligible) {
      this.isTerminated = true;
      this.stopReason = 'ineligible_offer';
      this.terminationRationale = `Offer disqualified: ${eligibility.violations.join('; ')}`;

      const sysMessage: NegotiationMessage = {
        id: `sys-ineligible-${Date.now()}`,
        round: 0,
        sender: 'system',
        senderName: 'DealMind IntentLock Guard',
        timestamp: new Date().toLocaleTimeString(),
        text: `Negotiation aborted. Offer does not meet baseline buyer requirements: ${eligibility.violations.join('; ')}`,
        action: 'reject',
        decisionRationale: this.terminationRationale,
        currency: this.offer.currency,
        termsHighlights: ['Offer Ineligible: Negotiation Blocked'],
      };
      this.messages.push(sysMessage);

      return this.buildResult();
    }

    const now = Date.now();
    const formatTime = (offsetSec: number) => 
      new Date(now + offsetSec * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

    let timeOffset = 0;

    // -------------------------------------------------------------------------
    // Round 1: Buyer Opening Offer
    // -------------------------------------------------------------------------
    this.currentRound = 1;
    const openingDecision = this.buyerAgent.generateOpeningProposal();
    
    this.messages.push({
      id: `msg-r1-buyer-${this.offer.id}`,
      round: 1,
      sender: 'buyer_agent',
      senderName: 'DealMind Autonomous Buyer Agent',
      timestamp: formatTime(timeOffset++),
      text: openingDecision.messageText,
      action: openingDecision.action,
      decisionRationale: openingDecision.rationale,
      proposedPrice: openingDecision.terms.productPrice,
      terms: openingDecision.terms,
      currency: this.intent.currency,
      termsHighlights: openingDecision.termsHighlights,
    });

    // Seller responds to Round 1
    const sellerR1 = this.sellerAgent.evaluateBuyerProposal(
      openingDecision.terms,
      this.messages,
      1,
      MAX_NEGOTIATION_ROUNDS
    );

    this.messages.push({
      id: `msg-r1-seller-${this.offer.id}`,
      round: 1,
      sender: 'seller_agent',
      senderName: `${this.offer.sellerName} Automated Sales Desk`,
      timestamp: formatTime(timeOffset++),
      text: sellerR1.messageText,
      action: sellerR1.action,
      decisionRationale: sellerR1.rationale,
      proposedPrice: sellerR1.terms.productPrice,
      terms: sellerR1.terms,
      currency: this.offer.currency,
      termsHighlights: sellerR1.termsHighlights,
      isCounterOffer: sellerR1.action === 'counter',
    });

    if (sellerR1.action === 'accept') {
      this.isAgreed = true;
      this.isTerminated = true;
      this.stopReason = 'agreed';
      this.finalTerms = sellerR1.terms;
      this.terminationRationale = sellerR1.rationale;
      return this.buildResult();
    }

    if (sellerR1.action === 'reject') {
      this.isTerminated = true;
      this.stopReason = 'seller_rejected';
      this.finalTerms = sellerR1.terms;
      this.terminationRationale = sellerR1.rationale;
      return this.buildResult();
    }

    let lastSellerTerms = sellerR1.terms;

    // -------------------------------------------------------------------------
    // Multi-Round Negotiation Loop (Rounds 2 through 5)
    // -------------------------------------------------------------------------
    while (this.currentRound < MAX_NEGOTIATION_ROUNDS && !this.isTerminated) {
      this.currentRound++;

      // Buyer evaluates seller counter
      const buyerDecision = this.buyerAgent.evaluateSellerCounter(
        lastSellerTerms,
        this.messages,
        this.currentRound
      );

      this.messages.push({
        id: `msg-r${this.currentRound}-buyer-${this.offer.id}`,
        round: this.currentRound,
        sender: 'buyer_agent',
        senderName: 'DealMind Autonomous Buyer Agent',
        timestamp: formatTime(timeOffset++),
        text: buyerDecision.messageText,
        action: buyerDecision.action,
        decisionRationale: buyerDecision.rationale,
        proposedPrice: buyerDecision.terms.productPrice,
        terms: buyerDecision.terms,
        currency: this.intent.currency,
        termsHighlights: buyerDecision.termsHighlights,
      });

      if (buyerDecision.action === 'accept') {
        this.isAgreed = true;
        this.isTerminated = true;
        this.stopReason = 'agreed';
        this.finalTerms = buyerDecision.terms;
        this.terminationRationale = buyerDecision.rationale;
        break;
      }

      if (buyerDecision.action === 'reject') {
        this.isTerminated = true;
        this.stopReason = 'buyer_rejected';
        this.finalTerms = buyerDecision.terms;
        this.terminationRationale = buyerDecision.rationale;
        break;
      }

      // Seller responds to buyer counter
      const sellerDecision = this.sellerAgent.evaluateBuyerProposal(
        buyerDecision.terms,
        this.messages,
        this.currentRound,
        MAX_NEGOTIATION_ROUNDS
      );

      this.messages.push({
        id: `msg-r${this.currentRound}-seller-${this.offer.id}`,
        round: this.currentRound,
        sender: 'seller_agent',
        senderName: `${this.offer.sellerName} Automated Sales Desk`,
        timestamp: formatTime(timeOffset++),
        text: sellerDecision.messageText,
        action: sellerDecision.action,
        decisionRationale: sellerDecision.rationale,
        proposedPrice: sellerDecision.terms.productPrice,
        terms: sellerDecision.terms,
        currency: this.offer.currency,
        termsHighlights: sellerDecision.termsHighlights,
        isCounterOffer: sellerDecision.action === 'counter',
      });

      if (sellerDecision.action === 'accept') {
        this.isAgreed = true;
        this.isTerminated = true;
        this.stopReason = 'agreed';
        this.finalTerms = sellerDecision.terms;
        this.terminationRationale = sellerDecision.rationale;
        break;
      }

      if (sellerDecision.action === 'reject') {
        this.isTerminated = true;
        this.stopReason = 'seller_rejected';
        this.finalTerms = sellerDecision.terms;
        this.terminationRationale = sellerDecision.rationale;
        break;
      }

      lastSellerTerms = sellerDecision.terms;
    }

    // If loop finishes without agreement
    if (!this.isTerminated) {
      this.isTerminated = true;
      this.stopReason = 'max_rounds_reached';
      this.finalTerms = lastSellerTerms;
      this.terminationRationale = `Negotiation completed ${MAX_NEGOTIATION_ROUNDS} rounds without final price lock.`;
    }

    return this.buildResult();
  }

  /**
   * Constructs the structured FinalDeal, NegotiationSession, and NegotiationResult.
   */
  private buildResult(): NegotiationResult {
    const terms = this.finalTerms ?? {
      productPrice: this.offer.basePrice,
      deliveryFee: this.offer.deliveryFee,
      otherCharges: this.offer.otherCharges,
      totalPayable: this.offer.totalPrice,
      deliveryEstimateDays: this.offer.estimatedDeliveryDays,
      warrantyMonths: this.offer.warrantyMonths,
      hasSubscription: this.offer.hasSubscription,
      subscriptionDetails: this.offer.subscriptionDetails,
      condition: this.offer.condition,
    };

    const initialTotal = this.offer.totalPrice;
    const finalTotal = terms.totalPayable;
    const totalSaved = this.isAgreed ? Math.max(0, initialTotal - finalTotal) : 0;

    const negotiationStatus = this.isAgreed 
      ? 'agreed' 
      : (this.stopReason === 'max_rounds_reached' ? 'failed_timeout' : 'rejected');

    const finalDeal: FinalDeal = {
      dealId: this.intent.id,
      originalOfferId: this.offer.id,
      sellerId: this.sellerPolicy.sellerId,
      sellerName: this.offer.sellerName,
      productTitle: this.offer.productTitle,
      condition: terms.condition,
      productPrice: terms.productPrice,
      deliveryFee: terms.deliveryFee,
      otherCharges: terms.otherCharges,
      otherChargesDescription: this.offer.otherChargesDescription,
      totalPayable: terms.totalPayable,
      deliveryEstimateDays: terms.deliveryEstimateDays,
      warrantyMonths: terms.warrantyMonths,
      hasSubscription: terms.hasSubscription,
      subscriptionDetails: terms.subscriptionDetails,
      negotiationStatus,
      roundCount: this.currentRound,
      messages: [...this.messages],
      isAcceptedBySeller: this.isAgreed,
      currency: this.intent.currency,
      totalSaved,
      agreedAt: this.isAgreed ? new Date().toISOString() : undefined,
      stopReason: this.stopReason,
      rationale: this.terminationRationale,
    };

    const session: NegotiationSession = {
      id: `neg-${this.offer.id}-${Date.now()}`,
      dealId: this.intent.id,
      offerId: this.offer.id,
      sellerName: this.offer.sellerName,
      initialPrice: initialTotal,
      currentOfferPrice: terms.totalPayable,
      finalPrice: this.isAgreed ? terms.totalPayable : undefined,
      currency: this.intent.currency,
      totalSaved,
      status: this.isAgreed ? 'agreed' : 'rejected',
      round: this.currentRound,
      messages: [...this.messages],
      finalDeal,
    };

    let summary = '';
    if (this.isAgreed) {
      summary = `Agreement reached with ${this.offer.sellerName} after ${this.currentRound} rounds. Final payable total: ${formatCurrency(terms.totalPayable, this.intent.currency)} (Total saved: ${formatCurrency(totalSaved, this.intent.currency)}).`;
    } else {
      summary = `Negotiation did not conclude in agreement (${this.stopReason}): ${this.terminationRationale}`;
    }

    return {
      session,
      finalDeal,
      success: this.isAgreed,
      stopReason: this.stopReason,
      summary,
    };
  }
}

/**
 * Public factory function replacing the old simplistic mock negotiation.
 * Backward compatible with existing callers while delivering Phase 2 modular agent intelligence.
 */
export function runIntelligentNegotiation(
  intent: UserIntent,
  offer: ProductOffer,
  competingOffers: ProductOffer[] = [],
  customPolicy?: SellerPolicy
): NegotiationResult {
  const engine = new NegotiationEngine(intent, offer, competingOffers, customPolicy);
  return engine.executeFullNegotiation();
}
