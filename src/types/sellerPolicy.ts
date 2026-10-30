export type SellerProfileType = 'flexible' | 'strict' | 'conditional';

export interface SellerPolicy {
  sellerId: string;
  sellerName: string;
  profileType: SellerProfileType;
  startingPrice: number;
  /** Private minimum price the seller will accept. MUST NEVER be exposed to Buyer Agent! */
  privateMinimumAcceptablePrice: number;
  maxPermittedDiscount: number; // e.g. 0.12 (12%)
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
