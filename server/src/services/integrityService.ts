import crypto from 'node:crypto';
import { FinalDeal } from '../schemas/dealSchemas.js';

export interface CanonicalDealData {
  dealId: string;
  originalOfferId: string;
  sellerId: string;
  productTitle: string;
  condition: string;
  productPrice: number;
  deliveryFee: number;
  otherCharges: number;
  totalPayable: number;
  deliveryEstimateDays: number;
  warrantyMonths: number | null;
  hasSubscription: boolean;
  subscriptionDetails: string;
  currency: string;
  isAcceptedBySeller: boolean;
  negotiationStatus: string;
  stopReason: string;
}

export function extractCanonicalDealData(deal: FinalDeal): CanonicalDealData {
  return {
    dealId: String(deal.dealId).trim(),
    originalOfferId: String(deal.originalOfferId).trim(),
    sellerId: String(deal.sellerId).trim(),
    productTitle: String(deal.productTitle).trim(),
    condition: deal.condition,
    productPrice: Number(deal.productPrice),
    deliveryFee: Number(deal.deliveryFee || 0),
    otherCharges: Number(deal.otherCharges || 0),
    totalPayable: Number(deal.productPrice) + Number(deal.deliveryFee || 0) + Number(deal.otherCharges || 0),
    deliveryEstimateDays: Number(deal.deliveryEstimateDays),
    warrantyMonths: deal.warrantyMonths !== null && deal.warrantyMonths !== undefined ? Number(deal.warrantyMonths) : null,
    hasSubscription: Boolean(deal.hasSubscription),
    subscriptionDetails: deal.subscriptionDetails ? String(deal.subscriptionDetails).trim() : '',
    currency: deal.currency,
    isAcceptedBySeller: Boolean(deal.isAcceptedBySeller),
    negotiationStatus: String(deal.negotiationStatus).trim(),
    stopReason: deal.stopReason,
  };
}

export function serializeCanonicalDealData(data: CanonicalDealData): string {
  const sortedKeys = Object.keys(data).sort() as (keyof CanonicalDealData)[];
  const sortedObj: Record<string, unknown> = {};
  for (const key of sortedKeys) {
    sortedObj[key] = data[key];
  }
  return JSON.stringify(sortedObj);
}

export function generateServerDealFingerprint(deal: FinalDeal): string {
  const canonicalData = extractCanonicalDealData(deal);
  const serialized = serializeCanonicalDealData(canonicalData);
  return crypto.createHash('sha256').update(serialized).digest('hex');
}

export function hashAuthorizationToken(token: string, secret: string): string {
  return crypto.createHmac('sha256', secret).update(token).digest('hex');
}
