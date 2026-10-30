export type CurrencyCode = 'INR' | 'USD' | 'EUR' | 'GBP';

export type ProductCondition = 'new' | 'refurbished' | 'used' | 'any';

export type IntentCondition = 'new' | 'refurbished' | 'any';

export type HardConstraintKey = 
  | 'budget' 
  | 'condition' 
  | 'delivery' 
  | 'no_subscription' 
  | 'warranty' 
  | 'all_fees_included';

export type FlexiblePreference = 
  | 'seller_rating' 
  | 'faster_shipping' 
  | 'extended_warranty'
  | 'brand';

export interface UserIntent {
  id: string;
  rawQuery: string;
  productTitle: string;
  maxBudget: number;
  currency: CurrencyCode;
  requiredCondition: IntentCondition;
  maxDeliveryDays: number;
  requiredWarrantyMonths: number;
  prohibitSubscriptions: boolean;
  requireAllFeesIncluded: boolean;
  hardConstraints: HardConstraintKey[];
  flexiblePreferences: FlexiblePreference[];
  createdAt: string;
}

export type DealStatus = 
  | 'draft' 
  | 'negotiating' 
  | 'verification_required' 
  | 'verified' 
  | 'rejected' 
  | 'payment_completed';

export interface Deal {
  id: string;
  title: string;
  intent: UserIntent;
  status: DealStatus;
  selectedOfferId?: string;
  negotiationSessionId?: string;
  verificationReportId?: string;
  createdAt: string;
  updatedAt: string;
}
