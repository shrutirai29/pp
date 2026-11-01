import { SellerPolicy } from '../types/sellerPolicy';

/**
 * Controlled sample seller policies with private reservation prices and behavior rules.
 * CRITICAL ARCHITECTURE RULE:
 * Private seller policy data (such as privateMinimumAcceptablePrice) is strictly kept
 * separate from buyer-visible offer data. The buyer agent NEVER has direct access to this.
 */
export const MOCK_SELLER_POLICIES: Record<string, SellerPolicy> = {
  // 1. Flexible Seller: TechHaven Direct
  'off-techhaven-01': {
    sellerId: 'off-techhaven-01',
    sellerName: 'TechHaven Direct',
    profileType: 'flexible',
    startingPrice: 74,
    privateMinimumAcceptablePrice: 66,
    maxPermittedDiscount: 0.11, // up to 11%
    deliveryOptions: {
      standardDays: 2,
      expressDays: 1,
    },
    deliveryFee: 0,
    otherCharges: 0,
    condition: 'new',
    warrantyMonths: 60,
    hasSubscription: false,
    canWaiveDeliveryFee: true,
    canExtendWarranty: false,
    acceptsNegotiation: true,
    policyNotes: 'High volume enterprise vendor. Welcomes verified fast settlement and accepts balanced counteroffers down to reservation floor.',
  },

  // 2. Strict Seller: Titan Silicon Direct
  'off-strict-titan': {
    sellerId: 'off-strict-titan',
    sellerName: 'Titan Silicon Direct',
    profileType: 'strict',
    startingPrice: 84,
    privateMinimumAcceptablePrice: 80, // tight floor
    maxPermittedDiscount: 0.05,
    deliveryOptions: {
      standardDays: 2,
    },
    deliveryFee: 4,
    otherCharges: 0,
    condition: 'new',
    warrantyMonths: 36,
    hasSubscription: false,
    canWaiveDeliveryFee: false,
    canExtendWarranty: false,
    acceptsNegotiation: true,
    policyNotes: 'Exclusive distributor policy. Fixed price model with minimal flexibility (<5%). Rejects aggressively below minimum floor.',
  },

  // 3. Conditional Seller: Prime Storage Solutions
  'off-conditional-prime': {
    sellerId: 'off-conditional-prime',
    sellerName: 'Prime Storage Solutions',
    profileType: 'conditional',
    startingPrice: 78,
    privateMinimumAcceptablePrice: 70,
    maxPermittedDiscount: 0.10,
    deliveryOptions: {
      standardDays: 3,
      expressDays: 2,
    },
    deliveryFee: 5,
    otherCharges: 0,
    condition: 'new',
    warrantyMonths: 24,
    hasSubscription: false,
    canWaiveDeliveryFee: true, // willing to waive $5 delivery fee as concession
    canExtendWarranty: true,
    extendedWarrantyMonths: 36,
    acceptsNegotiation: true,
    policyNotes: 'Logistics-oriented merchant. Concedes on shipping charges and bundles warranty riders in exchange for firm purchase commitment.',
  },

  // 4. Over-Budget Strict Seller: Apex Silicon Hub
  'off-apex-03': {
    sellerId: 'off-apex-03',
    sellerName: 'Apex Silicon Hub',
    profileType: 'strict',
    startingPrice: 98,
    privateMinimumAcceptablePrice: 92,
    maxPermittedDiscount: 0.06,
    deliveryOptions: {
      standardDays: 2,
    },
    deliveryFee: 5,
    otherCharges: 0,
    condition: 'new',
    warrantyMonths: 60,
    hasSubscription: false,
    canWaiveDeliveryFee: false,
    canExtendWarranty: false,
    acceptsNegotiation: true,
    policyNotes: 'Flagship SSD inventory. High demand keeps prices above standard consumer ceilings.',
  },
};

/**
 * Helper to fetch a seller policy by ID or generate a sensible profile based on offer parameters.
 */
export function getSellerPolicyForOffer(offerId: string, sellerName: string, basePrice: number): SellerPolicy {
  if (MOCK_SELLER_POLICIES[offerId]) {
    return MOCK_SELLER_POLICIES[offerId];
  }

  // Fallback profile if custom offer is provided
  return {
    sellerId: offerId,
    sellerName: sellerName,
    profileType: 'flexible',
    startingPrice: basePrice,
    privateMinimumAcceptablePrice: Math.round(basePrice * 0.90),
    maxPermittedDiscount: 0.10,
    deliveryOptions: { standardDays: 3 },
    deliveryFee: 0,
    otherCharges: 0,
    condition: 'new',
    warrantyMonths: 12,
    hasSubscription: false,
    canWaiveDeliveryFee: true,
    canExtendWarranty: false,
    acceptsNegotiation: true,
  };
}
