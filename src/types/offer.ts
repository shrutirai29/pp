import { CurrencyCode, ProductCondition } from './deal';

export type SellerTier = 'Verified Enterprise' | 'Established Merchant' | 'Marketplace Seller';

export interface ProductOffer {
  id: string;
  dealId?: string;
  sellerName: string;
  sellerReliabilityScore: number; // e.g. 96 (%)
  sellerReliabilityTier: SellerTier;
  productTitle: string;
  condition: ProductCondition;
  basePrice: number;
  deliveryFee: number;
  otherCharges: number;
  otherChargesDescription?: string;
  hasSubscription: boolean;
  subscriptionDetails?: string; // e.g. "Cloud backup ₹299/mo after 30 days"
  estimatedDeliveryDays: number;
  warrantyMonths: number | null; // null represents missing / uncertain warranty info
  currency: CurrencyCode;
  totalPrice: number; // Calculated basePrice + deliveryFee + otherCharges
  inStock: boolean;
  notes?: string;
  eligibilityStatus: 'eligible' | 'ineligible';
  eligibilityReasons: string[];
}
