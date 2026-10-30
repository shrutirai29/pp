import { CurrencyCode, ProductCondition } from './deal';

export type MessageSender = 'buyer_agent' | 'seller_agent' | 'system';

export type NegotiationAction = 
  | 'propose' 
  | 'counter' 
  | 'accept' 
  | 'reject' 
  | 'conclude';

export interface NegotiationTerms {
  productPrice: number;
  deliveryFee: number;
  otherCharges: number;
  totalPayable: number;
  deliveryEstimateDays: number;
  warrantyMonths: number | null;
  hasSubscription: boolean;
  subscriptionDetails?: string;
  condition: ProductCondition;
}

export interface NegotiationMessage {
  id: string;
  round: number;
  sender: MessageSender;
  senderName: string;
  timestamp: string;
  text: string;
  action?: NegotiationAction;
  decisionRationale?: string;
  proposedPrice?: number;
  terms?: NegotiationTerms;
  currency: CurrencyCode;
  termsHighlights?: string[];
  isCounterOffer?: boolean;
}

export type NegotiationStage = 
  | 'INITIALIZED'
  | 'BUYER_OFFER'
  | 'SELLER_COUNTER'
  | 'BUYER_EVALUATION'
  | 'BUYER_COUNTER'
  | 'SELLER_ACCEPTANCE'
  | 'SELLER_REJECTION'
  | 'FINAL_DEAL';

export type NegotiationStopReason = 
  | 'agreed' 
  | 'seller_rejected' 
  | 'buyer_rejected' 
  | 'max_rounds_reached'
  | 'ineligible_offer';

export interface FinalDeal {
  dealId: string;
  originalOfferId: string;
  sellerId: string;
  sellerName: string;
  productTitle: string;
  condition: ProductCondition;
  productPrice: number; // Integer / safe decimal
  deliveryFee: number;
  otherCharges: number;
  otherChargesDescription?: string;
  totalPayable: number; // productPrice + deliveryFee + otherCharges
  deliveryEstimateDays: number;
  warrantyMonths: number | null;
  hasSubscription: boolean;
  subscriptionDetails?: string;
  negotiationStatus: 'agreed' | 'rejected' | 'failed_timeout';
  roundCount: number;
  messages: NegotiationMessage[];
  isAcceptedBySeller: boolean;
  currency: CurrencyCode;
  totalSaved: number;
  agreedAt?: string;
  stopReason: NegotiationStopReason;
  rationale?: string;
}

export interface NegotiationSession {
  id: string;
  dealId: string;
  offerId: string;
  sellerName: string;
  initialPrice: number;
  currentOfferPrice: number;
  finalPrice?: number;
  currency: CurrencyCode;
  totalSaved: number;
  status: 'active' | 'agreed' | 'rejected';
  round: number;
  messages: NegotiationMessage[];
  finalDeal?: FinalDeal;
}

export interface NegotiationResult {
  session: NegotiationSession;
  finalDeal: FinalDeal;
  success: boolean;
  stopReason: NegotiationStopReason;
  summary: string;
}
