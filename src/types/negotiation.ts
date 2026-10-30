import { CurrencyCode } from './deal';

export type MessageSender = 'buyer_agent' | 'seller_agent' | 'system';

export interface NegotiationMessage {
  id: string;
  sender: MessageSender;
  senderName: string;
  timestamp: string;
  text: string;
  proposedPrice?: number;
  currency: CurrencyCode;
  termsHighlights?: string[];
  isCounterOffer?: boolean;
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
}
