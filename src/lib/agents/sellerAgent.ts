import { SellerPolicy } from '../../types/sellerPolicy';
import { NegotiationTerms, NegotiationMessage, NegotiationAction } from '../../types/negotiation';
import { roundToNearest } from './negotiationStrategy';

export interface SellerDecision {
  action: NegotiationAction;
  terms: NegotiationTerms;
  rationale: string;
  messageText: string;
  termsHighlights: string[];
}

/**
 * Simulated Seller Agent.
 * Evaluates buyer proposals against private seller reservation policies.
 * Note: Simulates merchant sales desk behaviors for demonstration.
 */
export class SellerAgent {
  private policy: SellerPolicy;
  private currentAskPrice: number;
  private deliveryFee: number;
  private otherCharges: number;
  private warrantyMonths: number | null;
  private deliveryDays: number;

  constructor(policy: SellerPolicy) {
    this.policy = policy;
    this.currentAskPrice = policy.startingPrice;
    this.deliveryFee = policy.deliveryFee;
    this.otherCharges = policy.otherCharges;
    this.warrantyMonths = policy.warrantyMonths;
    this.deliveryDays = policy.deliveryOptions.standardDays;
  }

  /**
   * Responds to a proposal from the Buyer Agent.
   */
  public evaluateBuyerProposal(
    buyerTerms: NegotiationTerms,
    _history: NegotiationMessage[],
    currentRound: number,
    maxRounds: number = 5
  ): SellerDecision {
    const buyerBid = buyerTerms.productPrice;
    const floor = this.policy.privateMinimumAcceptablePrice;

    // -------------------------------------------------------------------------
    // 1. Check if Seller Does Not Accept Negotiation At All
    // -------------------------------------------------------------------------
    if (!this.policy.acceptsNegotiation) {
      const terms: NegotiationTerms = this.buildTerms(this.policy.startingPrice);
      return {
        action: 'reject',
        terms,
        rationale: 'Seller policy operates strictly on fixed non-negotiable list pricing.',
        messageText: `${this.policy.sellerName} pricing policy is fixed. We do not participate in automated price concessions.`,
        termsHighlights: ['Fixed Price Policy: Negotiation Rejected'],
      };
    }

    // -------------------------------------------------------------------------
    // 2. Acceptance Condition
    // -------------------------------------------------------------------------
    // If buyer matches or exceeds current ask, or is within minimal delta (<= 50) and >= floor
    if (buyerBid >= this.currentAskPrice || (buyerBid >= floor && (this.currentAskPrice - buyerBid) <= 50)) {
      const acceptedPrice = Math.max(buyerBid, floor);
      const terms = this.buildTerms(acceptedPrice);
      return {
        action: 'accept',
        terms,
        rationale: `Buyer bid of ${buyerBid} meets or exceeds reservation threshold (Floor: ${floor}). Deal terms locked.`,
        messageText: `Agreement confirmed. ${this.policy.sellerName} accepts ${acceptedPrice} as our final binding proposal. Inventory has been allocated.`,
        termsHighlights: [
          `Final Agreed Base: ${acceptedPrice}`,
          `Total Payable: ${terms.totalPayable}`,
          'Inventory Units Reserved',
        ],
      };
    }

    // -------------------------------------------------------------------------
    // 3. Profile-Specific Negotiation Policy
    // -------------------------------------------------------------------------
    switch (this.policy.profileType) {
      // -----------------------------------------------------------------------
      // STRICT SELLER PROFILE
      // -----------------------------------------------------------------------
      case 'strict': {
        // If buyer bid is substantially below floor and round >= 2, strict seller rejects
        if (buyerBid < floor) {
          if (currentRound >= 2 && (floor - buyerBid) > 150) {
            const terms = this.buildTerms(floor);
            return {
              action: 'reject',
              terms,
              rationale: `Buyer bid (${buyerBid}) is below strict reservation floor of ${floor}. Merchant rejects concession.`,
              messageText: `${this.policy.sellerName} cannot accommodate bids below our enterprise floor of ${floor}. Proposal rejected.`,
              termsHighlights: [
                `Floor Breach: Min Acceptable is ${floor}`,
                'Strict Margin Protection Active',
              ],
            };
          }

          // Otherwise offer exactly floor as non-negotiable counter
          this.currentAskPrice = floor;
          const terms = this.buildTerms(floor);
          return {
            action: 'counter',
            terms,
            rationale: `Strict seller policy permits maximum ${Math.round(this.policy.maxPermittedDiscount * 100)}% discount down to hard floor of ${floor}.`,
            messageText: `Our wholesale distributor margins are strict. Our bottom-line firm counter-offer is ${floor}. We cannot discount further.`,
            termsHighlights: [
              `Strict Minimum Counter: ${floor}`,
              'Zero Further Concession Permitted',
            ],
          };
        }

        // Small incremental concession down towards floor
        const step = Math.min(50, Math.max(25, this.currentAskPrice - floor));
        this.currentAskPrice = Math.max(floor, this.currentAskPrice - step);
        const terms = this.buildTerms(this.currentAskPrice);
        return {
          action: 'counter',
          terms,
          rationale: `Strict seller made token concession of ${step} down to ${this.currentAskPrice}.`,
          messageText: `We can offer a minor adjustment to ${this.currentAskPrice} for prompt settlement.`,
          termsHighlights: [`Counter: ${this.currentAskPrice}`],
        };
      }

      // -----------------------------------------------------------------------
      // CONDITIONAL SELLER PROFILE
      // -----------------------------------------------------------------------
      case 'conditional': {
        // Can waive delivery fee or extend warranty as a non-price concession
        let nonPriceConcessionMade = false;
        const concessionNotes: string[] = [];

        if (this.policy.canWaiveDeliveryFee && this.deliveryFee > 0) {
          this.deliveryFee = 0; // Waive shipping!
          nonPriceConcessionMade = true;
          concessionNotes.push('Courier delivery fee waived (Free Shipping)');
        }

        if (this.policy.canExtendWarranty && this.policy.extendedWarrantyMonths) {
          this.warrantyMonths = this.policy.extendedWarrantyMonths;
          concessionNotes.push(`Warranty extended to ${this.warrantyMonths} months`);
        }

        // Move price towards buyer bid, bounded by floor
        const targetCounter = Math.max(
          floor,
          roundToNearest(this.currentAskPrice - (this.currentAskPrice - buyerBid) * 0.40, 50)
        );
        this.currentAskPrice = targetCounter;
        const terms = this.buildTerms(this.currentAskPrice);

        const concessionStr = nonPriceConcessionMade
          ? ` We have waived our ₹200 shipping fee and extended warranty to ${this.warrantyMonths} months.`
          : '';

        return {
          action: 'counter',
          terms,
          rationale: `Conditional seller offered concession to ${this.currentAskPrice} bundled with non-price value adds (waived fees & warranty extension).`,
          messageText: `We value your business.${concessionStr} In exchange for locking the deal, our counter-proposal is ${this.currentAskPrice} (Total payable: ${terms.totalPayable}).`,
          termsHighlights: [
            `Counter Price: ${this.currentAskPrice}`,
            `Total: ${terms.totalPayable}`,
            ...concessionNotes,
          ],
        };
      }

      // -----------------------------------------------------------------------
      // FLEXIBLE SELLER PROFILE (Default)
      // -----------------------------------------------------------------------
      case 'flexible':
      default: {
        // Move 45% - 55% of the distance towards the buyer bid, bounded by floor
        const distance = this.currentAskPrice - Math.max(buyerBid, floor);
        const concession = roundToNearest(distance * (currentRound >= maxRounds - 1 ? 0.65 : 0.45), 50);
        
        const newAsk = Math.max(floor, this.currentAskPrice - concession);
        this.currentAskPrice = newAsk;

        // If at floor or very close to buyer bid
        if (Math.abs(newAsk - buyerBid) <= 50 || (currentRound >= maxRounds && newAsk === floor)) {
          // If buyer bid is at least floor, accept!
          if (buyerBid >= floor) {
            const terms = this.buildTerms(buyerBid);
            return {
              action: 'accept',
              terms,
              rationale: `Flexible seller converged to buyer bid of ${buyerBid} (Floor: ${floor}).`,
              messageText: `We accept ${buyerBid} as our final agreed price. Terms confirmed.`,
              termsHighlights: [
                `Agreed Base: ${buyerBid}`,
                `Total Payable: ${terms.totalPayable}`,
              ],
            };
          }
        }

        const terms = this.buildTerms(newAsk);
        return {
          action: 'counter',
          terms,
          rationale: `Flexible seller conceded ${concession} towards buyer bid, landing at ${newAsk} (Floor: ${floor}).`,
          messageText: `Thank you for the opening proposal. We cannot quite meet ${buyerBid}, but we can offer an enterprise concession down to ${newAsk} with priority dispatch.`,
          termsHighlights: [
            `Counter Offer: ${newAsk}`,
            `Total Payable: ${terms.totalPayable}`,
            `Standard ${terms.warrantyMonths}mo warranty preserved`,
          ],
        };
      }
    }
  }

  /**
   * Helper to construct complete NegotiationTerms including itemized charges.
   */
  private buildTerms(price: number): NegotiationTerms {
    const totalPayable = price + this.deliveryFee + this.otherCharges;
    return {
      productPrice: price,
      deliveryFee: this.deliveryFee,
      otherCharges: this.otherCharges,
      totalPayable,
      deliveryEstimateDays: this.deliveryDays,
      warrantyMonths: this.warrantyMonths,
      hasSubscription: this.policy.hasSubscription,
      subscriptionDetails: this.policy.subscriptionDetails,
      condition: this.policy.condition,
    };
  }
}
