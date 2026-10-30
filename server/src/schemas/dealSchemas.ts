import { z } from 'zod';

export const CurrencyCodeSchema = z.enum(['INR', 'USD', 'EUR', 'GBP']);
export const ProductConditionSchema = z.enum(['new', 'refurbished', 'used', 'any']);
export const IntentConditionSchema = z.enum(['new', 'refurbished', 'any']);

export const HardConstraintKeySchema = z.enum([
  'budget',
  'condition',
  'delivery',
  'no_subscription',
  'warranty',
  'all_fees_included'
]);

export const FlexiblePreferenceSchema = z.enum([
  'seller_rating',
  'faster_shipping',
  'extended_warranty',
  'brand'
]);

export const UserIntentSchema = z.object({
  id: z.string().min(1),
  rawQuery: z.string().min(1),
  productTitle: z.string().min(1),
  maxBudget: z.number().positive(),
  currency: CurrencyCodeSchema,
  requiredCondition: IntentConditionSchema,
  maxDeliveryDays: z.number().int().positive(),
  requiredWarrantyMonths: z.number().int().nonnegative(),
  prohibitSubscriptions: z.boolean(),
  requireAllFeesIncluded: z.boolean(),
  hardConstraints: z.array(HardConstraintKeySchema),
  flexiblePreferences: z.array(FlexiblePreferenceSchema),
  createdAt: z.string(),
});

export const NegotiationStopReasonSchema = z.enum([
  'agreed',
  'seller_rejected',
  'buyer_rejected',
  'max_rounds_reached',
  'ineligible_offer'
]);

export const NegotiationTermsSchema = z.object({
  productPrice: z.number(),
  deliveryFee: z.number(),
  otherCharges: z.number(),
  totalPayable: z.number(),
  deliveryEstimateDays: z.number().int(),
  warrantyMonths: z.number().int().nullable(),
  hasSubscription: z.boolean(),
  subscriptionDetails: z.string().optional(),
  condition: ProductConditionSchema,
});

export const NegotiationMessageSchema = z.object({
  id: z.string(),
  round: z.number().int(),
  sender: z.enum(['buyer_agent', 'seller_agent', 'system']),
  senderName: z.string(),
  timestamp: z.string(),
  text: z.string(),
  action: z.enum(['propose', 'counter', 'accept', 'reject', 'conclude']).optional(),
  decisionRationale: z.string().optional(),
  proposedPrice: z.number().optional(),
  terms: NegotiationTermsSchema.optional(),
  currency: CurrencyCodeSchema,
  termsHighlights: z.array(z.string()).optional(),
  isCounterOffer: z.boolean().optional(),
});

export const FinalDealSchema = z.object({
  dealId: z.string().min(1),
  originalOfferId: z.string().min(1),
  sellerId: z.string().min(1),
  sellerName: z.string().min(1),
  productTitle: z.string().min(1),
  condition: ProductConditionSchema,
  productPrice: z.number(),
  deliveryFee: z.number(),
  otherCharges: z.number(),
  otherChargesDescription: z.string().optional(),
  totalPayable: z.number(),
  deliveryEstimateDays: z.number().int(),
  warrantyMonths: z.number().int().nullable(),
  hasSubscription: z.boolean(),
  subscriptionDetails: z.string().optional(),
  negotiationStatus: z.enum(['agreed', 'rejected', 'failed_timeout']),
  roundCount: z.number().int(),
  messages: z.array(NegotiationMessageSchema),
  isAcceptedBySeller: z.boolean(),
  currency: CurrencyCodeSchema,
  totalSaved: z.number(),
  agreedAt: z.string().optional(),
  stopReason: NegotiationStopReasonSchema,
  rationale: z.string().optional(),
});

export const CreateDealPayloadSchema = z.object({
  id: z.string().optional(),
  intent: UserIntentSchema,
  finalDeal: FinalDealSchema.optional(),
  title: z.string().optional(),
});

export const ConsumeAuthorizationPayloadSchema = z.object({
  authorizationToken: z.string().min(1),
});

export type UserIntent = z.infer<typeof UserIntentSchema>;
export type FinalDeal = z.infer<typeof FinalDealSchema>;
export type CreateDealPayload = z.infer<typeof CreateDealPayloadSchema>;
export type CurrencyCode = z.infer<typeof CurrencyCodeSchema>;
export type ProductCondition = z.infer<typeof ProductConditionSchema>;
