import { z } from 'zod';
import { CurrencyCodeSchema, ProductConditionSchema } from './dealSchemas.js';

export const MoneyValueSchema = z
  .number()
  .nonnegative()
  .finite()
  .refine(
    (val) => Number.isInteger(Math.round(val * 100)),
    { message: 'Monetary value cannot exceed 2 decimal places precision' }
  );

export const NegotiationMessageTypeSchema = z.enum([
  'OFFER',
  'COUNTEROFFER',
  'ACCEPT',
  'REJECT',
  'EXPIRED',
  'ROUND_LIMIT_REACHED',
]);

/**
 * Strict schema for parsing and validating Buyer Agent LLM response
 */
export const LLMBuyerResponseSchema = z.object({
  action: z.enum(['propose', 'counter', 'accept', 'reject']),
  proposedPrice: MoneyValueSchema,
  targetDeliveryDays: z.number().int().positive().optional(),
  targetWarrantyMonths: z.number().int().nonnegative().optional(),
  rationale: z.string().min(1).max(500),
  buyerMessage: z.string().min(1).max(1000),
});

export type LLMBuyerResponse = z.infer<typeof LLMBuyerResponseSchema>;

/**
 * Strict schema for parsing and validating Seller Agent LLM response
 */
export const LLMSellerResponseSchema = z.object({
  action: z.enum(['counter', 'accept', 'reject']),
  proposedPrice: MoneyValueSchema,
  deliveryFee: MoneyValueSchema.optional().default(0),
  otherCharges: MoneyValueSchema.optional().default(0),
  warrantyMonths: z.number().int().nonnegative().optional(),
  deliveryDays: z.number().int().positive().optional(),
  rationale: z.string().min(1).max(500),
  sellerMessage: z.string().min(1).max(1000),
});

export type LLMSellerResponse = z.infer<typeof LLMSellerResponseSchema>;

/**
 * Payload to start or execute negotiation via backend API
 */
export const ExecuteNegotiationPayloadSchema = z.object({
  offerId: z.string().min(1),
  sellerId: z.string().optional(),
  provider: z.enum(['mock', 'openai', 'anthropic', 'gemini', 'groq']).optional(),
  productOffer: z
    .object({
      id: z.string(),
      sellerName: z.string(),
      productTitle: z.string(),
      basePrice: MoneyValueSchema,
      deliveryFee: MoneyValueSchema,
      otherCharges: MoneyValueSchema,
      otherChargesDescription: z.string().optional(),
      estimatedDeliveryDays: z.number().int().positive(),
      warrantyMonths: z.number().int().nullable(),
      hasSubscription: z.boolean(),
      subscriptionDetails: z.string().optional(),
      condition: ProductConditionSchema,
      currency: CurrencyCodeSchema,
    })
    .optional(),
});

export type ExecuteNegotiationPayload = z.infer<typeof ExecuteNegotiationPayloadSchema>;
