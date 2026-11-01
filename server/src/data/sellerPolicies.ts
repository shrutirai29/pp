export type SellerProfileType = 'flexible' | 'strict' | 'conditional';

export interface ServerSellerPolicy {
  sellerId: string;
  sellerName: string;
  profileType: SellerProfileType;
  startingPrice: number;
  privateMinimumAcceptablePrice: number;
  maxPermittedDiscount: number;
  deliveryOptions: {
    standardDays: number;
    expressDays?: number;
  };
  deliveryFee: number;
  otherCharges: number;
  otherChargesDescription?: string;
  condition: 'new' | 'refurbished' | 'used';
  warrantyMonths: number | null;
  hasSubscription: boolean;
  subscriptionDetails?: string;
  canWaiveDeliveryFee: boolean;
  canExtendWarranty: boolean;
  extendedWarrantyMonths?: number;
  acceptsNegotiation: boolean;
  policyNotes?: string;
}

export const SERVER_SELLER_POLICIES: Record<string, ServerSellerPolicy> = {
  'off-techhaven-01': {
    sellerId: 'off-techhaven-01',
    sellerName: 'TechHaven Direct',
    profileType: 'flexible',
    startingPrice: 7299,
    privateMinimumAcceptablePrice: 6600,
    maxPermittedDiscount: 0.1,
    deliveryOptions: { standardDays: 2, expressDays: 1 },
    deliveryFee: 0,
    otherCharges: 0,
    condition: 'new',
    warrantyMonths: 60,
    hasSubscription: false,
    canWaiveDeliveryFee: true,
    canExtendWarranty: false,
    acceptsNegotiation: true,
    policyNotes: 'High volume enterprise vendor. Accepts counteroffers down to reservation floor.',
  },
  'off-strict-titan': {
    sellerId: 'off-strict-titan',
    sellerName: 'Titan Silicon Direct',
    profileType: 'strict',
    startingPrice: 7900,
    privateMinimumAcceptablePrice: 7650,
    maxPermittedDiscount: 0.035,
    deliveryOptions: { standardDays: 2 },
    deliveryFee: 100,
    otherCharges: 0,
    condition: 'new',
    warrantyMonths: 36,
    hasSubscription: false,
    canWaiveDeliveryFee: false,
    canExtendWarranty: false,
    acceptsNegotiation: true,
    policyNotes: 'Exclusive distributor policy. Fixed price model with minimal flexibility.',
  },
  'off-conditional-prime': {
    sellerId: 'off-conditional-prime',
    sellerName: 'Prime Storage Solutions',
    profileType: 'conditional',
    startingPrice: 7600,
    privateMinimumAcceptablePrice: 6900,
    maxPermittedDiscount: 0.09,
    deliveryOptions: { standardDays: 3, expressDays: 2 },
    deliveryFee: 200,
    otherCharges: 0,
    condition: 'new',
    warrantyMonths: 24,
    hasSubscription: false,
    canWaiveDeliveryFee: true,
    canExtendWarranty: true,
    extendedWarrantyMonths: 36,
    acceptsNegotiation: true,
    policyNotes: 'Logistics-oriented merchant. Concedes on shipping charges and bundles warranty.',
  },
  'off-apex-03': {
    sellerId: 'off-apex-03',
    sellerName: 'Apex Silicon Hub',
    profileType: 'strict',
    startingPrice: 8499,
    privateMinimumAcceptablePrice: 8150,
    maxPermittedDiscount: 0.04,
    deliveryOptions: { standardDays: 2 },
    deliveryFee: 150,
    otherCharges: 0,
    condition: 'new',
    warrantyMonths: 60,
    hasSubscription: false,
    canWaiveDeliveryFee: false,
    canExtendWarranty: false,
    acceptsNegotiation: true,
    policyNotes: 'Flagship SSD inventory. High demand keeps prices above consumer ceilings.',
  },
  'off-fixed-retail': {
    sellerId: 'off-fixed-retail',
    sellerName: 'Fixed Retail Outlets',
    profileType: 'strict',
    startingPrice: 7500,
    privateMinimumAcceptablePrice: 7500,
    maxPermittedDiscount: 0,
    deliveryOptions: { standardDays: 2 },
    deliveryFee: 150,
    otherCharges: 0,
    condition: 'new',
    warrantyMonths: 12,
    hasSubscription: false,
    canWaiveDeliveryFee: false,
    canExtendWarranty: false,
    acceptsNegotiation: false,
    policyNotes: 'Strict fixed list pricing. Zero negotiation permitted.',
  },
};

export function getServerSellerPolicy(
  offerId: string,
  sellerName?: string,
  basePrice?: number
): ServerSellerPolicy {
  if (SERVER_SELLER_POLICIES[offerId]) {
    const policy = SERVER_SELLER_POLICIES[offerId];
    // If basePrice is supplied and indicates a USD-scale offer (< 500), adapt dynamically to the offer scale:
    if (basePrice !== undefined && basePrice < 500 && policy.startingPrice > 1000) {
      const discount = policy.maxPermittedDiscount;
      return {
        ...policy,
        startingPrice: basePrice,
        privateMinimumAcceptablePrice: Math.round(basePrice * (1 - discount)),
        deliveryFee: policy.deliveryFee > 0 ? Math.min(policy.deliveryFee, 10) : 0,
      };
    }
    return policy;
  }

  // Fallback policy generated deterministically from listing price
  const price = basePrice || 80;
  return {
    sellerId: offerId,
    sellerName: sellerName || 'Simulated Merchant',
    profileType: 'flexible',
    startingPrice: price,
    privateMinimumAcceptablePrice: Math.round(price * 0.92),
    maxPermittedDiscount: 0.08,
    deliveryOptions: { standardDays: 3 },
    deliveryFee: price > 1000 ? 100 : 5,
    otherCharges: 0,
    condition: 'new',
    warrantyMonths: 24,
    hasSubscription: false,
    canWaiveDeliveryFee: true,
    canExtendWarranty: false,
    acceptsNegotiation: true,
    policyNotes: 'Dynamically generated merchant baseline policy.',
  };
}
