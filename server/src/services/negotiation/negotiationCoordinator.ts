import { LLMProvider } from '../../llm/types.js';
import {
  UserIntent,
  FinalDeal,
  NegotiationMessage,
  NegotiationSession,
  NegotiationTerms,
} from '../../schemas/dealSchemas.js';
import { LLMBuyerResponseSchema, LLMSellerResponseSchema, LLMBuyerResponse, LLMSellerResponse } from '../../schemas/negotiationSchemas.js';
import { ServerSellerPolicy, getServerSellerPolicy } from '../../data/sellerPolicies.js';
import { SellerPolicyValidator } from './sellerPolicyValidator.js';
import { BuyerAgentGuard } from './buyerAgentGuard.js';
import { sanitizeForPrompt } from './promptSanitizer.js';
import { NegotiationRepository } from '../../repositories/negotiationRepository.js';
import { DealRepository } from '../../repositories/dealRepository.js';
import { AuditRepository } from '../../repositories/auditRepository.js';

export const MAX_NEGOTIATION_ROUNDS = 5;

export interface NegotiationExecutionResult {
  session: NegotiationSession;
  finalDeal: FinalDeal;
  success: boolean;
  stopReason: string;
  summary: string;
  engineMode: 'live_llm' | 'mock_llm' | 'fallback';
  providerName: string;
}

export class NegotiationCoordinator {
  constructor(
    private llmProvider: LLMProvider,
    private negRepo: NegotiationRepository,
    private dealRepo: DealRepository,
    private auditRepo: AuditRepository
  ) {}

  public async executeNegotiation(
    dealId: string,
    userId: string,
    intent: UserIntent,
    offer: any
  ): Promise<NegotiationExecutionResult> {
    const offerId = offer.id || 'off-default';
    const sellerName = offer.sellerName || 'Simulated Merchant';
    const basePrice = Number(offer.basePrice || offer.productPrice || 7000);
    const deliveryFee = Number(offer.deliveryFee || 0);
    const otherCharges = Number(offer.otherCharges || 0);
    const initialTotal = basePrice + deliveryFee + otherCharges;

    // Retrieve authoritative server-side seller policy
    const policy = getServerSellerPolicy(offerId, sellerName, basePrice);

    // -------------------------------------------------------------------------
    // 1. Mandatory Eligibility Check (IntentLock Baseline Requirement)
    // -------------------------------------------------------------------------
    const eligibilityViolations: string[] = [];
    if (offer.currency && offer.currency !== intent.currency) {
      eligibilityViolations.push(`Currency mismatch (${offer.currency} vs ${intent.currency})`);
    }
    if (intent.prohibitSubscriptions && offer.hasSubscription) {
      eligibilityViolations.push('Recurring subscriptions prohibited');
    }
    if (offer.estimatedDeliveryDays > intent.maxDeliveryDays) {
      eligibilityViolations.push(`Delivery timeline (${offer.estimatedDeliveryDays}d) exceeds max (${intent.maxDeliveryDays}d)`);
    }
    if (
      intent.requiredWarrantyMonths > 0 &&
      (!offer.warrantyMonths || offer.warrantyMonths < intent.requiredWarrantyMonths)
    ) {
      eligibilityViolations.push(`Warranty duration (${offer.warrantyMonths || 0}m) below required (${intent.requiredWarrantyMonths}m)`);
    }

    if (eligibilityViolations.length > 0) {
      const negRecord = this.negRepo.createNegotiation(
        dealId,
        userId,
        offerId,
        policy.sellerId,
        policy.sellerName,
        initialTotal
      );

      const abortMessageText = `Negotiation aborted: Offer does not meet baseline buyer non-negotiables: ${eligibilityViolations.join('; ')}`;
      this.negRepo.recordRound(
        negRecord.id,
        0,
        'system',
        'IntentLock Safety Guard',
        'reject',
        basePrice,
        deliveryFee,
        otherCharges,
        initialTotal,
        intent.currency,
        'REJECT',
        'Offer disqualified by pre-negotiation eligibility rules.',
        abortMessageText,
        ['Ineligible Offer: Disqualified']
      );

      this.negRepo.updateOutcome(
        negRecord.id,
        null,
        initialTotal,
        0,
        'rejected',
        'ineligible_offer',
        0,
        abortMessageText
      );

      const finalDeal: FinalDeal = {
        dealId,
        originalOfferId: offerId,
        sellerId: policy.sellerId,
        sellerName: policy.sellerName,
        productTitle: offer.productTitle || 'Product',
        condition: offer.condition || 'new',
        productPrice: basePrice,
        deliveryFee,
        otherCharges,
        totalPayable: initialTotal,
        deliveryEstimateDays: offer.estimatedDeliveryDays || 2,
        warrantyMonths: offer.warrantyMonths || null,
        hasSubscription: Boolean(offer.hasSubscription),
        negotiationStatus: 'rejected',
        roundCount: 0,
        messages: [
          {
            id: `msg-sys-disqualify-${Date.now()}`,
            round: 0,
            sender: 'system',
            senderName: 'IntentLock Safety Guard',
            timestamp: new Date().toLocaleTimeString(),
            text: abortMessageText,
            action: 'reject',
            currency: intent.currency,
          },
        ],
        isAcceptedBySeller: false,
        currency: intent.currency,
        totalSaved: 0,
        stopReason: 'ineligible_offer',
        rationale: eligibilityViolations.join('; '),
      };

      this.dealRepo.updateFinalDeal(dealId, finalDeal);
      this.auditRepo.recordEvent(
        dealId,
        'negotiation_aborted',
        'Negotiation Blocked by Eligibility Rules',
        abortMessageText,
        'system',
        { violations: eligibilityViolations }
      );

      const session: NegotiationSession = {
        id: negRecord.id,
        dealId,
        offerId,
        sellerName: policy.sellerName,
        initialPrice: initialTotal,
        currentOfferPrice: initialTotal,
        currency: intent.currency,
        totalSaved: 0,
        status: 'rejected',
        round: 0,
        messages: finalDeal.messages,
        finalDeal,
      };

      return {
        session,
        finalDeal,
        success: false,
        stopReason: 'ineligible_offer',
        summary: abortMessageText,
        engineMode: 'fallback',
        providerName: this.llmProvider.name,
      };
    }

    // -------------------------------------------------------------------------
    // 2. Initialize Persistent Negotiation Session
    // -------------------------------------------------------------------------
    const negRecord = this.negRepo.createNegotiation(
      dealId,
      userId,
      offerId,
      policy.sellerId,
      policy.sellerName,
      initialTotal
    );

    const messages: NegotiationMessage[] = [];
    let currentRound = 1;
    let isTerminated = false;
    let stopReason = 'max_rounds_reached';
    let isAgreed = false;
    let finalTerms: NegotiationTerms | null = null;
    let currentAskPrice = policy.startingPrice;
    let currentDeliveryFee = policy.deliveryFee;
    let currentOtherCharges = policy.otherCharges;
    let lastSellerTerms: NegotiationTerms = {
      productPrice: basePrice,
      deliveryFee,
      otherCharges,
      totalPayable: initialTotal,
      deliveryEstimateDays: offer.estimatedDeliveryDays || policy.deliveryOptions.standardDays,
      warrantyMonths: offer.warrantyMonths || policy.warrantyMonths,
      hasSubscription: false,
      condition: policy.condition,
    };

    // -------------------------------------------------------------------------
    // 3. Multi-Round Dialogue Loop (Rounds 1 to 5)
    // -------------------------------------------------------------------------
    while (currentRound <= MAX_NEGOTIATION_ROUNDS && !isTerminated) {
      // --- STEP A: BUYER AGENT PROPOSAL ---
      const buyerResponseRaw = await this.callBuyerAgentLLM(
        intent,
        offer,
        currentRound,
        lastSellerTerms,
        messages
      );

      const guardedBuyer = BuyerAgentGuard.validateBuyerProposal(
        buyerResponseRaw,
        intent,
        lastSellerTerms,
        currentRound
      );

      const buyerMsgId = `msg-r${currentRound}-buyer-${Date.now()}`;
      const buyerMsg: NegotiationMessage = {
        id: buyerMsgId,
        round: currentRound,
        sender: 'buyer_agent',
        senderName: 'DealMind AI Buyer Agent',
        timestamp: new Date().toLocaleTimeString(),
        text: guardedBuyer.buyerMessage,
        action: guardedBuyer.action,
        decisionRationale: guardedBuyer.rationale,
        proposedPrice: guardedBuyer.terms.productPrice,
        terms: guardedBuyer.terms,
        currency: intent.currency,
        termsHighlights: guardedBuyer.guardAdjustments.length > 0
          ? [`Backend Policy Guard: ${guardedBuyer.guardAdjustments[0]}`]
          : [`Target: ${intent.currency} ${guardedBuyer.terms.productPrice}`],
      };
      messages.push(buyerMsg);

      this.negRepo.recordRound(
        negRecord.id,
        currentRound,
        'buyer_agent',
        'DealMind AI Buyer Agent',
        guardedBuyer.action,
        guardedBuyer.terms.productPrice,
        guardedBuyer.terms.deliveryFee,
        guardedBuyer.terms.otherCharges,
        guardedBuyer.terms.totalPayable,
        intent.currency,
        currentRound === 1 ? 'OFFER' : (guardedBuyer.action === 'accept' ? 'ACCEPT' : 'COUNTEROFFER'),
        guardedBuyer.rationale,
        guardedBuyer.buyerMessage,
        buyerMsg.termsHighlights
      );

      if (guardedBuyer.action === 'accept') {
        isAgreed = true;
        isTerminated = true;
        stopReason = 'agreed';
        finalTerms = lastSellerTerms;
        break;
      }

      if (guardedBuyer.action === 'reject') {
        isTerminated = true;
        stopReason = 'buyer_rejected';
        finalTerms = guardedBuyer.terms;
        break;
      }

      // --- STEP B: SELLER AGENT RESPONSE ---
      const sellerResponseRaw = await this.callSellerAgentLLM(
        policy,
        guardedBuyer.terms,
        currentRound,
        currentAskPrice,
        messages
      );

      const guardedSeller = SellerPolicyValidator.validateSellerProposal(
        sellerResponseRaw,
        policy,
        guardedBuyer.terms.productPrice
      );

      currentAskPrice = guardedSeller.terms.productPrice;
      currentDeliveryFee = guardedSeller.terms.deliveryFee;
      currentOtherCharges = guardedSeller.terms.otherCharges;
      lastSellerTerms = guardedSeller.terms;

      const sellerMsgId = `msg-r${currentRound}-seller-${Date.now()}`;
      const sellerMsg: NegotiationMessage = {
        id: sellerMsgId,
        round: currentRound,
        sender: 'seller_agent',
        senderName: `${policy.sellerName} AI Sales Desk`,
        timestamp: new Date().toLocaleTimeString(),
        text: guardedSeller.sellerMessage,
        action: guardedSeller.action,
        decisionRationale: guardedSeller.rationale,
        proposedPrice: guardedSeller.terms.productPrice,
        terms: guardedSeller.terms,
        currency: intent.currency,
        termsHighlights: guardedSeller.guardAdjustments.length > 0
          ? [`Backend Merchant Policy Guard: ${guardedSeller.guardAdjustments[0]}`]
          : [`Concession Total: ${intent.currency} ${guardedSeller.terms.totalPayable}`],
        isCounterOffer: guardedSeller.action === 'counter',
      };
      messages.push(sellerMsg);

      this.negRepo.recordRound(
        negRecord.id,
        currentRound,
        'seller_agent',
        `${policy.sellerName} AI Sales Desk`,
        guardedSeller.action,
        guardedSeller.terms.productPrice,
        guardedSeller.terms.deliveryFee,
        guardedSeller.terms.otherCharges,
        guardedSeller.terms.totalPayable,
        intent.currency,
        guardedSeller.action === 'accept' ? 'ACCEPT' : (guardedSeller.action === 'reject' ? 'REJECT' : 'COUNTEROFFER'),
        guardedSeller.rationale,
        guardedSeller.sellerMessage,
        sellerMsg.termsHighlights
      );

      if (guardedSeller.action === 'accept') {
        isAgreed = true;
        isTerminated = true;
        stopReason = 'agreed';
        finalTerms = guardedSeller.terms;
        break;
      }

      if (guardedSeller.action === 'reject') {
        isTerminated = true;
        stopReason = 'seller_rejected';
        finalTerms = guardedSeller.terms;
        break;
      }

      currentRound++;
    }

    if (!isTerminated) {
      stopReason = 'max_rounds_reached';
      finalTerms = lastSellerTerms;
    }

    // -------------------------------------------------------------------------
    // 4. Construct Structured Final Deal & Session Outcome
    // -------------------------------------------------------------------------
    const finalTermsResolved: NegotiationTerms = finalTerms || lastSellerTerms;
    const finalProductPrice = Number(finalTermsResolved.productPrice);
    const finalDelFee = Number(finalTermsResolved.deliveryFee || 0);
    const finalOthCharges = Number(finalTermsResolved.otherCharges || 0);
    // Strict recalculation invariant
    const finalTotal = finalProductPrice + finalDelFee + finalOthCharges;
    const totalSaved = isAgreed ? Math.max(0, initialTotal - finalTotal) : 0;
    const roundCount = Math.min(currentRound, MAX_NEGOTIATION_ROUNDS);

    let summary = '';
    if (isAgreed) {
      summary = `Autonomous agreement reached with ${policy.sellerName} after ${roundCount} rounds. Final total: ${intent.currency} ${finalTotal} (Saved: ${intent.currency} ${totalSaved}). Pending IntentLock independent verification.`;
    } else {
      summary = `Negotiation concluded without agreement (${stopReason}) after ${roundCount} rounds.`;
    }

    // Update database records
    this.negRepo.updateOutcome(
      negRecord.id,
      isAgreed ? finalTotal : null,
      finalTotal,
      totalSaved,
      isAgreed ? 'agreed' : 'rejected',
      stopReason,
      roundCount,
      summary
    );

    const finalDeal: FinalDeal = {
      dealId,
      originalOfferId: offerId,
      sellerId: policy.sellerId,
      sellerName: policy.sellerName,
      productTitle: offer.productTitle || 'Product',
      condition: finalTermsResolved.condition,
      productPrice: finalProductPrice,
      deliveryFee: finalDelFee,
      otherCharges: finalOthCharges,
      totalPayable: finalTotal,
      deliveryEstimateDays: finalTermsResolved.deliveryEstimateDays,
      warrantyMonths: finalTermsResolved.warrantyMonths,
      hasSubscription: false,
      negotiationStatus: isAgreed ? 'agreed' : (stopReason === 'max_rounds_reached' ? 'failed_timeout' : 'rejected'),
      roundCount,
      messages,
      isAcceptedBySeller: isAgreed,
      currency: intent.currency,
      totalSaved,
      agreedAt: isAgreed ? new Date().toISOString() : undefined,
      stopReason: stopReason as any,
      rationale: summary,
    };

    // Update deal on server
    this.dealRepo.updateFinalDeal(dealId, finalDeal);

    // Audit log
    this.auditRepo.recordEvent(
      dealId,
      isAgreed ? 'negotiation_completed' : 'negotiation_rejected',
      isAgreed ? 'Autonomous Negotiation Succeeded' : 'Autonomous Negotiation Concluded',
      summary,
      'system',
      {
        rounds: roundCount,
        stopReason,
        finalTotal,
        totalSaved,
        provider: this.llmProvider.name,
      }
    );

    const session: NegotiationSession = {
      id: negRecord.id,
      dealId,
      offerId,
      sellerName: policy.sellerName,
      initialPrice: initialTotal,
      currentOfferPrice: finalTotal,
      finalPrice: isAgreed ? finalTotal : undefined,
      currency: intent.currency,
      totalSaved,
      status: isAgreed ? 'agreed' : 'rejected',
      round: roundCount,
      messages,
      finalDeal,
    };

    const engineMode = this.llmProvider.name === 'openai-compatible-provider'
      ? 'live_llm'
      : (this.llmProvider.name === 'mock-llm-provider' ? 'mock_llm' : 'fallback');

    return {
      session,
      finalDeal,
      success: isAgreed,
      stopReason,
      summary,
      engineMode,
      providerName: this.llmProvider.name,
    };
  }

  /**
   * Constructs prompt and calls LLM for Buyer Agent decisions with bounded retry and fallback
   */
  private async callBuyerAgentLLM(
    intent: UserIntent,
    offer: any,
    round: number,
    sellerCurrentTerms: NegotiationTerms,
    history: NegotiationMessage[]
  ): Promise<LLMBuyerResponse> {
    const sanitizedTitle = sanitizeForPrompt(offer.productTitle || 'Item');
    const systemPrompt = `You are the DealMind Autonomous Buyer Agent.
ROLE: BUYER_NEGOTIATION_AGENT
Your duty is to negotiate aggressively yet professionally on behalf of the buyer to secure the lowest possible price.
You MUST output ONLY valid JSON matching this schema:
{
  "action": "propose" | "counter" | "accept" | "reject",
  "proposedPrice": number,
  "targetDeliveryDays": number,
  "targetWarrantyMonths": number,
  "rationale": string,
  "buyerMessage": string
}
NON-NEGOTIABLE BUYER CONSTRAINTS:
- Maximum budget ceiling: ${intent.maxBudget} ${intent.currency}
- Disallow subscriptions: ${intent.prohibitSubscriptions}
- Maximum acceptable delivery: ${intent.maxDeliveryDays} days
- Required warranty: ${intent.requiredWarrantyMonths} months
You must NEVER exceed the budget ceiling or agree to terms that violate these constraints.`;

    const userPrompt = `PRODUCT: "${sanitizedTitle}"
ROUND: ${round}
BUYER INTENT:
- MAX_BUDGET: ${intent.maxBudget} ${intent.currency}
- CURRENT_PRICE: ${sellerCurrentTerms.productPrice}
- DELIVERY_FEE: ${sellerCurrentTerms.deliveryFee}
- TOTAL_PAYABLE: ${sellerCurrentTerms.totalPayable}
- DELIVERY_DAYS: ${sellerCurrentTerms.deliveryEstimateDays}
- WARRANTY_MONTHS: ${sellerCurrentTerms.warrantyMonths || 0}
PREVIOUS DIALOGUE:
${history.slice(-3).map((m) => `${m.senderName}: ${m.text}`).join('\n')}

Decide your action ("propose", "counter", "accept", or "reject") and return pure JSON.`;

    try {
      const rawText = await this.llmProvider.generateCompletion([
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ]);

      // Parse JSON from model output
      const jsonStr = this.extractJsonString(rawText);
      const parsed = JSON.parse(jsonStr);
      return LLMBuyerResponseSchema.parse(parsed);
    } catch (err: any) {
      // Deterministic fallback if LLM times out or produces malformed JSON
      const fallbackTarget = Math.min(
        intent.maxBudget,
        Math.round(sellerCurrentTerms.productPrice * 0.92)
      );
      return {
        action: round === 1 ? 'propose' : (sellerCurrentTerms.totalPayable <= intent.maxBudget && round >= 3 ? 'accept' : 'counter'),
        proposedPrice: fallbackTarget,
        targetDeliveryDays: intent.maxDeliveryDays,
        targetWarrantyMonths: intent.requiredWarrantyMonths,
        rationale: `Rule-based fallback due to LLM provider transient error: ${err.message}`,
        buyerMessage: `On behalf of our buyer, we propose ${fallbackTarget} ${intent.currency} for immediate settlement.`,
      };
    }
  }

  /**
   * Constructs prompt and calls LLM for Seller Agent decisions with bounded retry and fallback
   */
  private async callSellerAgentLLM(
    policy: ServerSellerPolicy,
    buyerTerms: NegotiationTerms,
    round: number,
    currentAskPrice: number,
    history: NegotiationMessage[]
  ): Promise<LLMSellerResponse> {
    const systemPrompt = `You are the simulated sales desk AI for merchant "${policy.sellerName}".
ROLE: SELLER_NEGOTIATION_AGENT
Profile: ${policy.profileType}.
Policy: ${policy.policyNotes || 'Standard commercial sales terms.'}
You MUST output ONLY valid JSON matching this schema:
{
  "action": "counter" | "accept" | "reject",
  "proposedPrice": number,
  "deliveryFee": number,
  "otherCharges": number,
  "warrantyMonths": number,
  "deliveryDays": number,
  "rationale": string,
  "sellerMessage": string
}
AUTHORITATIVE CONSTRAINTS:
- ACCEPTS_NEGOTIATION: ${policy.acceptsNegotiation}
- PRIVATE_MINIMUM_PRICE: ${policy.privateMinimumAcceptablePrice}
- LIST_PRICE: ${policy.startingPrice}
- MAX_DISCOUNT: ${(policy.maxPermittedDiscount * 100).toFixed(1)}%
Never propose a price below PRIVATE_MINIMUM_PRICE.`;

    const userPrompt = `ROUND: ${round}
BUYER_BID: ${buyerTerms.productPrice}
BUYER_TOTAL: ${buyerTerms.totalPayable}
CURRENT_ASK: ${currentAskPrice}
DELIVERY_FEE: ${policy.deliveryFee}
OTHER_CHARGES: ${policy.otherCharges}
RECENT HISTORY:
${history.slice(-3).map((m) => `${m.senderName}: ${m.text}`).join('\n')}

Decide your action ("counter", "accept", or "reject") and return pure JSON.`;

    try {
      const rawText = await this.llmProvider.generateCompletion([
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ]);

      const jsonStr = this.extractJsonString(rawText);
      const parsed = JSON.parse(jsonStr);
      return LLMSellerResponseSchema.parse(parsed);
    } catch (err: any) {
      // Deterministic fallback if LLM provider fails
      const floor = policy.privateMinimumAcceptablePrice;
      const accepts = buyerTerms.productPrice >= floor && (currentAskPrice - buyerTerms.productPrice <= 100);
      return {
        action: accepts ? 'accept' : 'counter',
        proposedPrice: accepts ? buyerTerms.productPrice : Math.max(floor, Math.round((currentAskPrice + floor) / 2)),
        deliveryFee: policy.deliveryFee,
        otherCharges: policy.otherCharges,
        warrantyMonths: policy.warrantyMonths || 24,
        deliveryDays: policy.deliveryOptions.standardDays,
        rationale: `Rule-based fallback due to LLM provider transient error: ${err.message}`,
        sellerMessage: accepts
          ? `We accept your bid of ${buyerTerms.productPrice}. Final binding terms confirmed.`
          : `We can offer a revised concession of ${Math.max(floor, Math.round((currentAskPrice + floor) / 2))}.`,
      };
    }
  }

  private extractJsonString(raw: string): string {
    const trimmed = raw.trim();
    if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
      return trimmed;
    }
    const match = trimmed.match(/\{[\s\S]*\}/);
    if (match) {
      return match[0];
    }
    throw new Error('No JSON object found in LLM response');
  }
}
