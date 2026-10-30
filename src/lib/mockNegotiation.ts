import { UserIntent } from '../types/deal';
import { ProductOffer } from '../types/offer';
import { NegotiationSession } from '../types/negotiation';
import { runIntelligentNegotiation } from './agents/negotiationEngine';

/**
 * Creates an autonomous negotiation session using the Phase 2 Intelligent Negotiation Engine.
 * Replaces the simplistic static 4-message script with modular multi-agent dialogue.
 */
export function createDeterministicNegotiationSession(
  dealId: string,
  offer: ProductOffer,
  intent: UserIntent,
  competingOffers: ProductOffer[] = []
): NegotiationSession {
  const result = runIntelligentNegotiation(intent, offer, competingOffers);
  return {
    ...result.session,
    dealId,
  };
}

export { runIntelligentNegotiation } from './agents/negotiationEngine';
