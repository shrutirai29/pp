import { describe, it, expect } from 'vitest';
import { UserIntent } from '../../types/deal';
import { ProductOffer } from '../../types/offer';
import { evaluateOfferEligibility, calculateTotalPrice } from '../dealScoring';
import { verifyDealWithIntentLock } from '../mockVerification';

const baseMockIntent: UserIntent = {
  id: 'test-intent-001',
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

const baseCompliantOffer: ProductOffer = {
  id: 'off-compliant-01',
  sellerName: 'TechHaven Direct',
  sellerReliabilityScore: 98,
  sellerReliabilityTier: 'Verified Enterprise',
  productTitle: 'Samsung 980 1TB NVMe SSD',
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

describe('DealMind & IntentLock Business Rules', () => {
  // Test Rule 1: Calculate total price accurately from base + delivery + other charges
  it('Rule 1: calculates total price from base, delivery, and mandatory charges', () => {
    const total = calculateTotalPrice({
      basePrice: 5000,
      deliveryFee: 250,
      otherCharges: 150,
    });
    expect(total).toBe(5400);
  });

  // Test Case A: A fully compliant offer
  it('Test Case A: accepts a fully compliant offer as eligible and passes IntentLock verification', () => {
    const scored = evaluateOfferEligibility(baseCompliantOffer, baseMockIntent);
    expect(scored.isEligible).toBe(true);
    expect(scored.violations.length).toBe(0);
    expect(scored.offer.eligibilityStatus).toBe('eligible');

    const report = verifyDealWithIntentLock(baseMockIntent, baseCompliantOffer, 7000);
    expect(report.status).toBe('verified');
    expect(report.failedCount).toBe(0);
  });

  // Test Case B: A refurbished product when new is required
  it('Test Case B: rejects a refurbished product when new is required (Rule 4)', () => {
    const refurbishedOffer: ProductOffer = {
      ...baseCompliantOffer,
      id: 'off-refurb',
      condition: 'refurbished',
    };

    const scored = evaluateOfferEligibility(refurbishedOffer, baseMockIntent);
    expect(scored.isEligible).toBe(false);
    expect(scored.violations.some((v) => v.includes("condition is 'refurbished'"))).toBe(true);

    const report = verifyDealWithIntentLock(baseMockIntent, refurbishedOffer);
    expect(report.status).toBe('rejected');
    const conditionCheck = report.checks.find((c) => c.category === 'condition');
    expect(conditionCheck?.status).toBe('failed');
  });

  // Test Case C: A total price over budget
  it('Test Case C: rejects an offer whose total price exceeds the budget ceiling (Rule 6)', () => {
    const overBudgetOffer: ProductOffer = {
      ...baseCompliantOffer,
      id: 'off-overbudget',
      basePrice: 8200,
      deliveryFee: 100,
      totalPrice: 8300,
    };

    const scored = evaluateOfferEligibility(overBudgetOffer, baseMockIntent);
    expect(scored.isEligible).toBe(false);
    expect(scored.violations.some((v) => v.includes('exceeds your maximum budget'))).toBe(true);

    const report = verifyDealWithIntentLock(baseMockIntent, overBudgetOffer);
    expect(report.status).toBe('rejected');
    const budgetCheck = report.checks.find((c) => c.category === 'budget');
    expect(budgetCheck?.status).toBe('failed');
  });

  // Test Case D: Delivery later than permitted
  it('Test Case D: rejects an offer with delivery time beyond the maximum allowed limit (Rule 5)', () => {
    const slowDeliveryOffer: ProductOffer = {
      ...baseCompliantOffer,
      id: 'off-slow',
      estimatedDeliveryDays: 5, // Ceiling is 3 days
    };

    const scored = evaluateOfferEligibility(slowDeliveryOffer, baseMockIntent);
    expect(scored.isEligible).toBe(false);
    expect(scored.violations.some((v) => v.includes('exceeds your maximum allowed limit of 3 days'))).toBe(true);

    const report = verifyDealWithIntentLock(baseMockIntent, slowDeliveryOffer);
    expect(report.status).toBe('rejected');
    const deliveryCheck = report.checks.find((c) => c.category === 'delivery');
    expect(deliveryCheck?.status).toBe('failed');
  });

  // Test Case E: A prohibited subscription
  it('Test Case E: rejects an offer with a subscription when user prohibits subscriptions (Rule 3)', () => {
    const subscriptionOffer: ProductOffer = {
      ...baseCompliantOffer,
      id: 'off-sub',
      hasSubscription: true,
      subscriptionDetails: 'Cloud Sync ₹199/mo',
    };

    const scored = evaluateOfferEligibility(subscriptionOffer, baseMockIntent);
    expect(scored.isEligible).toBe(false);
    expect(scored.violations.some((v) => v.includes('recurring subscription'))).toBe(true);

    const report = verifyDealWithIntentLock(baseMockIntent, subscriptionOffer);
    expect(report.status).toBe('rejected');
    const subCheck = report.checks.find((c) => c.category === 'subscription');
    expect(subCheck?.status).toBe('failed');
  });

  // Test Case F: Missing information for a hard requirement
  it('Test Case F: flags missing warranty information as Needs Review, never auto-passing (Rule 7)', () => {
    const missingWarrantyOffer: ProductOffer = {
      ...baseCompliantOffer,
      id: 'off-missing-warranty',
      warrantyMonths: null, // Unspecified warranty
    };

    const scored = evaluateOfferEligibility(missingWarrantyOffer, baseMockIntent);
    expect(scored.isEligible).toBe(false);
    expect(scored.missingInfo.some((m) => m.includes('Warranty duration is unspecified'))).toBe(true);

    const report = verifyDealWithIntentLock(baseMockIntent, missingWarrantyOffer);
    expect(report.status).toBe('needs_review');
    const warrantyCheck = report.checks.find((c) => c.category === 'warranty');
    expect(warrantyCheck?.status).toBe('needs_review');
  });

  // Test Case G: A cheaper offer that violates a hard constraint
  it('Test Case G: cheaper listing price NEVER overrides a hard constraint violation (Rules 8, 9, 11)', () => {
    const cheapTrappingOffer: ProductOffer = {
      id: 'off-cheap-trap',
      sellerName: 'SpeedyStorage Bazaar',
      sellerReliabilityScore: 80,
      sellerReliabilityTier: 'Marketplace Seller',
      productTitle: 'Refurbished 1TB SSD with Cloud Lock-in',
      condition: 'refurbished', // Hard violation
      basePrice: 4500, // Very cheap! (Intent budget is 8000)
      deliveryFee: 200,
      otherCharges: 300,
      hasSubscription: true, // Hard violation
      subscriptionDetails: 'Mandatory Cloud Backup ₹299/mo',
      estimatedDeliveryDays: 6, // Hard violation
      warrantyMonths: 3,
      currency: 'INR',
      totalPrice: 5000,
      inStock: true,
      eligibilityStatus: 'ineligible',
      eligibilityReasons: [],
    };

    const scored = evaluateOfferEligibility(cheapTrappingOffer, baseMockIntent);
    
    // Despite being ₹3,000 cheaper than budget, it must be ineligible and have 0 ranking score!
    expect(scored.isEligible).toBe(false);
    expect(scored.score).toBe(0);
    expect(scored.violations.length).toBeGreaterThanOrEqual(3);

    // Rule 11: Ineligible offer fails IntentLock and cannot pass
    const report = verifyDealWithIntentLock(baseMockIntent, cheapTrappingOffer);
    expect(report.status).toBe('rejected');
    expect(report.failedCount).toBeGreaterThanOrEqual(2);
  });
});
