import { UserIntent } from '../types/deal';
import { ProductOffer } from '../types/offer';
import { NegotiationSession, NegotiationMessage } from '../types/negotiation';
import { formatCurrency } from './currency';

/**
 * Simulates a deterministic 4-step negotiation conversation between
 * DealMind Autonomous Buyer Agent and the Seller's Automated Sales Desk.
 */
export function createDeterministicNegotiationSession(
  dealId: string,
  offer: ProductOffer,
  intent: UserIntent
): NegotiationSession {
  const initialPrice = offer.totalPrice;
  
  // Deterministic calculation: Aim for ~7% to 9% savings, rounded to nearest 50/100
  const targetSavings = Math.max(150, Math.round((initialPrice * 0.08) / 50) * 50);
  const finalPrice = Math.max(1, initialPrice - targetSavings);
  const totalSaved = initialPrice - finalPrice;

  // Round 1: Buyer opens with a competitive offer (~12% below initial)
  const buyerOpeningPrice = Math.round((initialPrice * 0.88) / 50) * 50;
  
  // Round 2: Seller counters (~4% below initial)
  const sellerCounterPrice = Math.round((initialPrice * 0.96) / 50) * 50;
  
  // Round 3: Buyer counter-proposes meeting in the middle (~8% below initial)
  const buyerMiddlePrice = finalPrice;

  const now = Date.now();
  const formatTime = (offsetSeconds: number) => 
    new Date(now + offsetSeconds * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

  const messages: NegotiationMessage[] = [
    {
      id: `msg-1-${offer.id}`,
      sender: 'buyer_agent',
      senderName: 'DealMind Autonomous Agent',
      timestamp: formatTime(0),
      proposedPrice: buyerOpeningPrice,
      currency: offer.currency,
      text: `Hello ${offer.sellerName} sales desk. On behalf of our verified buyer, we are prepared to complete an immediate PayPal checkout for "${offer.productTitle}" if you can accommodate our target price of ${formatCurrency(buyerOpeningPrice, offer.currency)}. We require fulfillment within ${intent.maxDeliveryDays} days and zero hidden recurring subscriptions.`,
      termsHighlights: [
        `Target price: ${formatCurrency(buyerOpeningPrice, offer.currency)}`,
        `Delivery ≤ ${intent.maxDeliveryDays} days`,
        'Immediate settlement guaranteed',
      ],
      isCounterOffer: false,
    },
    {
      id: `msg-2-${offer.id}`,
      sender: 'seller_agent',
      senderName: `${offer.sellerName} Automated Sales Desk`,
      timestamp: formatTime(3),
      proposedPrice: sellerCounterPrice,
      currency: offer.currency,
      text: `Greetings DealMind Agent. While our inventory allocation for this tier is limited, we value prompt buyer settlement. We cannot meet ${formatCurrency(buyerOpeningPrice, offer.currency)}, but we can offer a verified enterprise concession down to ${formatCurrency(sellerCounterPrice, offer.currency)} with priority dispatch and standard ${offer.warrantyMonths ?? 12}-month warranty.`,
      termsHighlights: [
        `Counter: ${formatCurrency(sellerCounterPrice, offer.currency)}`,
        'Priority courier dispatch',
        `Standard ${offer.warrantyMonths ?? 12}-month warranty preserved`,
      ],
      isCounterOffer: true,
    },
    {
      id: `msg-3-${offer.id}`,
      sender: 'buyer_agent',
      senderName: 'DealMind Autonomous Agent',
      timestamp: formatTime(7),
      proposedPrice: buyerMiddlePrice,
      currency: offer.currency,
      text: `Thank you for the concession. We are willing to close the difference and lock in ${formatCurrency(buyerMiddlePrice, offer.currency)} as our final best offer. At this figure, our buyer will authorize the IntentLock verification protocol immediately without seeking alternate marketplace quotes.`,
      termsHighlights: [
        `Counter proposal: ${formatCurrency(buyerMiddlePrice, offer.currency)}`,
        'IntentLock verification upon confirmation',
        'Direct checkout authorization',
      ],
      isCounterOffer: false,
    },
    {
      id: `msg-4-${offer.id}`,
      sender: 'seller_agent',
      senderName: `${offer.sellerName} Automated Sales Desk`,
      timestamp: formatTime(11),
      proposedPrice: finalPrice,
      currency: offer.currency,
      text: `Agreement reached. We accept ${formatCurrency(finalPrice, offer.currency)} as our final binding proposal. We have reserved item serial units in stock, waived secondary handling surcharges, and locked the terms. Please proceed with IntentLock verification.`,
      termsHighlights: [
        `Final Price: ${formatCurrency(finalPrice, offer.currency)}`,
        `Direct savings: ${formatCurrency(totalSaved, offer.currency)}`,
        'Terms locked for buyer review',
      ],
      isCounterOffer: true,
    },
  ];

  return {
    id: `neg-${offer.id}-${Date.now()}`,
    dealId,
    offerId: offer.id,
    sellerName: offer.sellerName,
    initialPrice,
    currentOfferPrice: finalPrice,
    finalPrice,
    currency: offer.currency,
    totalSaved,
    status: 'agreed',
    round: 4,
    messages,
  };
}
