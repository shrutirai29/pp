import { describe, it, expect } from 'vitest';
import { UserIntent } from '../../types/deal';
import { ProductOffer } from '../../types/offer';
import { SellerPolicy } from '../../types/sellerPolicy';
import { runIntelligentNegotiation } from '../agents/negotiationEngine';
import { BuyerAgent } from '../agents/buyerAgent';
import { SellerAgent } from '../agents/sellerAgent';
import { verifyDealWithIntentLock } from '../mockVerification';
import { rankOffers } from '../dealScoring';

const mockIntent: UserIntent = {
  id: 'intent-ssd-p2',
  rawQuery: 'Find me a new 1 TB SSD under ₹8,000, delivered within three days, with no subscriptions or additional charges.',
  productTitle: '1TB NVMe M.2 SSD',
  maxBudget: 8000,
  currency: 'INR',
  requiredCondition: 'new',
  maxDeliveryDays: 3,
  requiredWarrantyMonths: 12,
  prohibitSubscriptions: true,
  requireAllFeesIncluded: true,
  hardConstraints: ['budget', 'condition', 'delivery', 'no_subscription', 'warranty'],
  flexiblePreferences: ['seller_rating', 'faster_shipping'],
  createdAt: new Date().toISOString(),
};

const baseEligibleOffer: ProductOffer = {
  id: 'off-techhaven-01',
  sellerName: 'TechHaven Direct',
  sellerReliabilityScore: 98,
  sellerReliabilityTier: 'Verified Enterprise',
  productTitle: 'Samsung 980 1TB PCIe 3.0 NVMe M.2 SSD',
  condition: 'new',
  basePrice: 7299,
  deliveryFee: 0,
  otherCharges: 0,
  hasSubscription: false,
  estimatedDeliveryDays: 2,
  warrantyMonths: 60,
  currency: 'INR',
  totalPrice: 7299,
  inStock: true,
  eligibilityStatus: 'eligible',
  eligibilityReasons: [],
};

describe('Phase 2: Intelligent Buyer Agent and Negotiation Engine', () => {
  // Test 1: Flexible seller accepts a reasonable offer
  it('1. Flexible seller accepts a reasonable offer above its private minimum', () => {
    const flexiblePolicy: SellerPolicy = {
      sellerId: 'flex-01',
      sellerName: 'FlexSeller',
      profileType: 'flexible',
      startingPrice: 7200,
      privateMinimumAcceptablePrice: 6500,
      maxPermittedDiscount: 0.10,
      deliveryOptions: { standardDays: 2 },
      deliveryFee: 0,
      otherCharges: 0,
      condition: 'new',
      warrantyMonths: 24,
      hasSubscription: false,
      canWaiveDeliveryFee: true,
      canExtendWarranty: false,
      acceptsNegotiation: true,
    };

    const offer: ProductOffer = {
      ...baseEligibleOffer,
      basePrice: 7200,
      totalPrice: 7200,
    };

    const result = runIntelligentNegotiation(mockIntent, offer, [], flexiblePolicy);

    expect(result.success).toBe(true);
    expect(result.stopReason).toBe('agreed');
    expect(result.finalDeal.isAcceptedBySeller).toBe(true);
    expect(result.finalDeal.totalPayable).toBeLessThanOrEqual(7200);
    expect(result.finalDeal.totalPayable).toBeGreaterThanOrEqual(flexiblePolicy.privateMinimumAcceptablePrice);
    expect(result.finalDeal.totalSaved).toBeGreaterThan(0);
  });

  // Test 2: Strict seller rejects an offer below its private minimum
  it('2. Strict seller rejects an offer below its private minimum floor', () => {
    const strictPolicy: SellerPolicy = {
      sellerId: 'strict-01',
      sellerName: 'StrictVendor',
      profileType: 'strict',
      startingPrice: 7900,
      privateMinimumAcceptablePrice: 7750, // Floor is 7750 (only 1.9% discount permitted)
      maxPermittedDiscount: 0.02,
      deliveryOptions: { standardDays: 2 },
      deliveryFee: 0,
      otherCharges: 0,
      condition: 'new',
      warrantyMonths: 12,
      hasSubscription: false,
      canWaiveDeliveryFee: false,
      canExtendWarranty: false,
      acceptsNegotiation: true,
    };

    const sellerAgent = new SellerAgent(strictPolicy);
    
    // Simulate buyer offering 6400 (which is far below 7750 floor in round 2)
    const response = sellerAgent.evaluateBuyerProposal(
      {
        productPrice: 6400,
        deliveryFee: 0,
        otherCharges: 0,
        totalPayable: 6400,
        deliveryEstimateDays: 2,
        warrantyMonths: 12,
        hasSubscription: false,
        condition: 'new',
      },
      [],
      2, // round 2
      5
    );

    expect(response.action).toBe('reject');
    expect(response.rationale).toContain('below strict reservation floor');
    expect(response.terms.productPrice).toBe(strictPolicy.privateMinimumAcceptablePrice);
  });

  // Test 3: Conditional seller can negotiate delivery terms (waiving shipping fee)
  it('3. Conditional seller can negotiate delivery terms by waiving delivery fee', () => {
    const conditionalPolicy: SellerPolicy = {
      sellerId: 'cond-01',
      sellerName: 'ConditionalStore',
      profileType: 'conditional',
      startingPrice: 7500,
      privateMinimumAcceptablePrice: 6800,
      maxPermittedDiscount: 0.10,
      deliveryOptions: { standardDays: 3 },
      deliveryFee: 250, // has delivery fee
      otherCharges: 0,
      condition: 'new',
      warrantyMonths: 24,
      hasSubscription: false,
      canWaiveDeliveryFee: true, // Can waive shipping fee!
      canExtendWarranty: true,
      extendedWarrantyMonths: 36,
      acceptsNegotiation: true,
    };

    const sellerAgent = new SellerAgent(conditionalPolicy);
    
    const response = sellerAgent.evaluateBuyerProposal(
      {
        productPrice: 6900,
        deliveryFee: 250,
        otherCharges: 0,
        totalPayable: 7150,
        deliveryEstimateDays: 3,
        warrantyMonths: 24,
        hasSubscription: false,
        condition: 'new',
      },
      [],
      1,
      5
    );

    expect(response.action).toBe('counter');
    // Delivery fee was waived to 0
    expect(response.terms.deliveryFee).toBe(0);
    expect(response.termsHighlights.some((h) => h.includes('waived'))).toBe(true);
  });

  // Test 4: Buyer agent never exceeds the user's hard budget
  it("4. Buyer agent never exceeds the user's hard budget during opening or counter bids", () => {
    const tightBudgetIntent: UserIntent = {
      ...mockIntent,
      maxBudget: 6000, // Very tight budget
    };

    const offer: ProductOffer = {
      ...baseEligibleOffer,
      basePrice: 5900,
      deliveryFee: 50,
      otherCharges: 0,
      totalPrice: 5950,
    };

    const buyerAgent = new BuyerAgent(tightBudgetIntent, offer, [], 5);
    const opening = buyerAgent.generateOpeningProposal();
    expect(opening.terms.totalPayable).toBeLessThanOrEqual(tightBudgetIntent.maxBudget);

    // Test counter when seller proposes something close to or over budget
    const counter = buyerAgent.evaluateSellerCounter(
      {
        productPrice: 6200, // over budget
        deliveryFee: 100,
        otherCharges: 0,
        totalPayable: 6300,
        deliveryEstimateDays: 2,
        warrantyMonths: 12,
        hasSubscription: false,
        condition: 'new',
      },
      [],
      2
    );

    // If counter-bidding, the buyer bid + fees must be <= maxBudget
    if (counter.action === 'counter') {
      expect(counter.terms.totalPayable).toBeLessThanOrEqual(tightBudgetIntent.maxBudget);
    } else {
      expect(counter.action).toBe('reject');
    }
  });

  // Test 5: Buyer agent never accepts a refurbished product when new is mandatory
  it('5. Buyer agent rejects a counteroffer with refurbished condition when new is mandatory', () => {
    const buyerAgent = new BuyerAgent(mockIntent, baseEligibleOffer, [], 5);

    const decision = buyerAgent.evaluateSellerCounter(
      {
        productPrice: 5000,
        deliveryFee: 0,
        otherCharges: 0,
        totalPayable: 5000,
        deliveryEstimateDays: 2,
        warrantyMonths: 12,
        hasSubscription: false,
        condition: 'refurbished', // Hard violation!
      },
      [],
      2
    );

    expect(decision.action).toBe('reject');
    expect(decision.rationale).toContain("buyer strictly requires 'new'");
  });

  // Test 6: Buyer agent rejects a subscription when prohibited
  it('6. Buyer agent rejects a counteroffer that introduces a recurring subscription', () => {
    const buyerAgent = new BuyerAgent(mockIntent, baseEligibleOffer, [], 5);

    const decision = buyerAgent.evaluateSellerCounter(
      {
        productPrice: 5500,
        deliveryFee: 0,
        otherCharges: 0,
        totalPayable: 5500,
        deliveryEstimateDays: 2,
        warrantyMonths: 12,
        hasSubscription: true, // Prohibited!
        subscriptionDetails: 'Mandatory Cloud Sync ₹199/mo',
        condition: 'new',
      },
      [],
      2
    );

    expect(decision.action).toBe('reject');
    expect(decision.rationale).toContain('recurring subscription');
  });

  // Test 7: Negotiation stops after five rounds
  it('7. Negotiation stops after a maximum of five rounds', () => {
    // Rigid seller policy that never concedes below starting price
    const unyieldingPolicy: SellerPolicy = {
      sellerId: 'rigid-01',
      sellerName: 'RigidCorp',
      profileType: 'strict',
      startingPrice: 7500,
      privateMinimumAcceptablePrice: 7500, // zero discount
      maxPermittedDiscount: 0,
      deliveryOptions: { standardDays: 2 },
      deliveryFee: 0,
      otherCharges: 0,
      condition: 'new',
      warrantyMonths: 12,
      hasSubscription: false,
      canWaiveDeliveryFee: false,
      canExtendWarranty: false,
      acceptsNegotiation: true,
    };

    const offer: ProductOffer = {
      ...baseEligibleOffer,
      basePrice: 7500,
      totalPrice: 7500,
    };

    const result = runIntelligentNegotiation(mockIntent, offer, [], unyieldingPolicy);

    expect(result.finalDeal.roundCount).toBeLessThanOrEqual(5);
    expect(result.session.messages.length).toBeGreaterThan(0);
  });

  // Test 8: Seller rejection ends negotiation
  it('8. Immediate seller rejection terminates the negotiation session', () => {
    const nonNegotiablePolicy: SellerPolicy = {
      sellerId: 'reject-01',
      sellerName: 'NoNegotiationStore',
      profileType: 'strict',
      startingPrice: 7500,
      privateMinimumAcceptablePrice: 7500,
      maxPermittedDiscount: 0,
      deliveryOptions: { standardDays: 2 },
      deliveryFee: 0,
      otherCharges: 0,
      condition: 'new',
      warrantyMonths: 12,
      hasSubscription: false,
      canWaiveDeliveryFee: false,
      canExtendWarranty: false,
      acceptsNegotiation: false, // Refuses negotiation!
    };

    const result = runIntelligentNegotiation(mockIntent, baseEligibleOffer, [], nonNegotiablePolicy);

    expect(result.success).toBe(false);
    expect(result.stopReason).toBe('seller_rejected');
    expect(result.finalDeal.isAcceptedBySeller).toBe(false);
    expect(result.finalDeal.negotiationStatus).toBe('rejected');
  });

  // Test 9: Final deal total includes all mandatory fees
  it('9. Final deal total payable strictly equals product price + delivery fee + mandatory charges', () => {
    const result = runIntelligentNegotiation(mockIntent, baseEligibleOffer);

    const deal = result.finalDeal;
    const computedTotal = Number(deal.productPrice) + Number(deal.deliveryFee) + Number(deal.otherCharges);
    expect(deal.totalPayable).toBe(computedTotal);
  });

  // Test 10: Complete negotiation result contains a valid structured FinalDeal
  it('10. Produces a complete structured FinalDeal with all required parameters for IntentLock', () => {
    const result = runIntelligentNegotiation(mockIntent, baseEligibleOffer);

    const deal = result.finalDeal;
    expect(deal).toBeDefined();
    expect(deal.dealId).toBe(mockIntent.id);
    expect(deal.originalOfferId).toBe(baseEligibleOffer.id);
    expect(deal.sellerId).toBeDefined();
    expect(deal.sellerName).toBe(baseEligibleOffer.sellerName);
    expect(deal.productTitle).toBe(baseEligibleOffer.productTitle);
    expect(deal.condition).toBe('new');
    expect(typeof deal.productPrice).toBe('number');
    expect(typeof deal.deliveryFee).toBe('number');
    expect(typeof deal.totalPayable).toBe('number');
    expect(typeof deal.deliveryEstimateDays).toBe('number');
    expect(deal.hasSubscription).toBe(false);
    expect(Array.isArray(deal.messages)).toBe(true);
    expect(deal.messages.length).toBeGreaterThan(0);

    // IntentLock verifies the complete FinalDeal object directly
    const verificationReport = verifyDealWithIntentLock(mockIntent, deal);
    expect(verificationReport).toBeDefined();
    expect(verificationReport.checks.length).toBeGreaterThanOrEqual(5);
  });

  // Test 11: An ineligible seller offer cannot enter negotiation
  it('11. An ineligible seller offer (Rule 11) is barred from entering negotiation', () => {
    const ineligibleOffer: ProductOffer = {
      ...baseEligibleOffer,
      id: 'off-ineligible-refurb',
      condition: 'refurbished', // Hard violation
      totalPrice: 6500,
      eligibilityStatus: 'ineligible',
    };

    const result = runIntelligentNegotiation(mockIntent, ineligibleOffer);

    expect(result.success).toBe(false);
    expect(result.stopReason).toBe('ineligible_offer');
    expect(result.finalDeal.isAcceptedBySeller).toBe(false);
    expect(result.session.messages[0].text).toContain('Negotiation aborted');
  });

  // Test 12: A failed negotiation never produces an accepted final deal
  it('12. A failed negotiation never produces an accepted final deal or isAcceptedBySeller=true', () => {
    const abortivePolicy: SellerPolicy = {
      sellerId: 'abort-01',
      sellerName: 'AbortSeller',
      profileType: 'strict',
      startingPrice: 7900,
      privateMinimumAcceptablePrice: 7900,
      maxPermittedDiscount: 0,
      deliveryOptions: { standardDays: 2 },
      deliveryFee: 0,
      otherCharges: 0,
      condition: 'new',
      warrantyMonths: 12,
      hasSubscription: false,
      canWaiveDeliveryFee: false,
      canExtendWarranty: false,
      acceptsNegotiation: false,
    };

    const result = runIntelligentNegotiation(mockIntent, baseEligibleOffer, [], abortivePolicy);

    expect(result.success).toBe(false);
    expect(result.finalDeal.isAcceptedBySeller).toBe(false);
    expect(result.finalDeal.negotiationStatus).not.toBe('agreed');

    // And IntentLock verifies that this unaccepted/rejected deal cannot pass verification without review
    if (!result.finalDeal.isAcceptedBySeller) {
      expect(result.finalDeal.negotiationStatus).toBe('rejected');
    }
  });

  // Additional Test: Offer ranking integrity
  it('Enhanced Ranking: Eligible offers always outrank ineligible ones regardless of price', () => {
    const cheapRefurb: ProductOffer = {
      ...baseEligibleOffer,
      id: 'cheap-refurb',
      condition: 'refurbished',
      basePrice: 4000, // Very cheap
      totalPrice: 4000,
      eligibilityStatus: 'ineligible',
    };

    const regularNew: ProductOffer = {
      ...baseEligibleOffer,
      id: 'regular-new',
      condition: 'new',
      basePrice: 7200,
      totalPrice: 7200,
      eligibilityStatus: 'eligible',
    };

    const ranked = rankOffers([cheapRefurb, regularNew], mockIntent);
    expect(ranked[0].offer.id).toBe('regular-new');
    expect(ranked[0].isEligible).toBe(true);
    expect(ranked[1].offer.id).toBe('cheap-refurb');
    expect(ranked[1].isEligible).toBe(false);
  });

  // Issue A Verification: Buyer does NOT manufacture delivery compliance with Math.min
  it('Issue A Fix: Buyer opening proposal does NOT manufacture delivery compliance with Math.min', () => {
    // Seller listing has 4-day delivery, but buyer intent specifies max 3 days
    const slowerOffer: ProductOffer = {
      ...baseEligibleOffer,
      estimatedDeliveryDays: 4,
    };

    const buyerAgent = new BuyerAgent(mockIntent, slowerOffer, [], 5);
    const opening = buyerAgent.generateOpeningProposal();

    // Must preserve the seller's actual quoted delivery time of 4 days, NOT arbitrarily clamp to 3!
    expect(opening.terms.deliveryEstimateDays).toBe(4);
    expect(opening.messageText).toContain(`fulfillment within ${mockIntent.maxDeliveryDays} days`);
  });

  // Issue B Verification: Strict recalculation rejects internally inconsistent counteroffer pricing
  it('Issue B Fix: Buyer strictly recalculates totalPayable and rejects deceptive/inconsistent counteroffers', () => {
    const buyerAgent = new BuyerAgent(mockIntent, baseEligibleOffer, [], 5);

    // Deceptive counteroffer: states totalPayable is 6500, but productPrice (6500) + deliveryFee (300) = 6800!
    const deceptiveCounter = {
      productPrice: 6500,
      deliveryFee: 300,
      otherCharges: 0,
      totalPayable: 6500, // Inconsistent! Should be 6800
      deliveryEstimateDays: 2,
      warrantyMonths: 12,
      hasSubscription: false,
      condition: 'new' as const,
    };

    const decision = buyerAgent.evaluateSellerCounter(deceptiveCounter, [], 2);

    expect(decision.action).toBe('reject');
    expect(decision.rationale).toContain('Internally inconsistent pricing detected');
    expect(decision.termsHighlights).toContain('Internal Pricing Inconsistency Rejected');
  });

  // Issue C Verification: IntentLock explicitly rejects any FinalDeal that is unagreed or not accepted by seller
  it('Issue C Fix: IntentLock explicitly rejects FinalDeal when negotiationStatus is not agreed or isAcceptedBySeller is false', () => {
    // Unagreed deal resulting from negotiation rejection
    const unagreedDeal = {
      dealId: mockIntent.id,
      originalOfferId: baseEligibleOffer.id,
      sellerId: 'seller-unagreed',
      sellerName: 'Unagreed Seller',
      productTitle: baseEligibleOffer.productTitle,
      condition: 'new' as const,
      productPrice: 7000,
      deliveryFee: 0,
      otherCharges: 0,
      totalPayable: 7000,
      deliveryEstimateDays: 2,
      warrantyMonths: 12,
      hasSubscription: false,
      negotiationStatus: 'rejected' as const, // NOT agreed!
      roundCount: 3,
      messages: [],
      isAcceptedBySeller: false, // NOT accepted!
      currency: 'INR' as const,
      totalSaved: 0,
      stopReason: 'seller_rejected' as const,
    };

    const report = verifyDealWithIntentLock(mockIntent, unagreedDeal);

    // IntentLock MUST reject this unagreed deal
    expect(report.status).toBe('rejected');
    const agreementCheck = report.checks.find((c) => c.id === 'chk-negotiation-acceptance');
    expect(agreementCheck).toBeDefined();
    expect(agreementCheck?.status).toBe('failed');
    expect(agreementCheck?.details).toContain('IntentLock explicitly rejects unagreed or non-accepted deals');
  });
});
