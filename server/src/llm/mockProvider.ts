import { LLMMessage, LLMCompletionOptions, LLMProvider } from './types.js';

export interface MockProviderBehavior {
  simulateTimeout?: boolean;
  simulateRateLimit?: boolean;
  simulateMalformedJson?: boolean;
  simulateInternalError?: boolean;
  customResponse?: string;
}

/**
 * Deterministic Mock LLM Provider for unit tests, local development,
 * and offline continuous integration.
 */
export class MockLLMProvider implements LLMProvider {
  public readonly name = 'mock-llm-provider';
  private behavior: MockProviderBehavior = {};

  constructor(behavior?: MockProviderBehavior) {
    if (behavior) {
      this.behavior = { ...behavior };
    }
  }

  public setBehavior(behavior: MockProviderBehavior): void {
    this.behavior = { ...behavior };
  }

  public resetBehavior(): void {
    this.behavior = {};
  }

  public async generateCompletion(
    messages: LLMMessage[],
    _options?: LLMCompletionOptions
  ): Promise<string> {
    if (this.behavior.simulateTimeout) {
      throw new Error('LLM provider request timed out after 15000ms');
    }

    if (this.behavior.simulateRateLimit) {
      const err = new Error('429 Too Many Requests: Rate limit exceeded');
      (err as any).status = 429;
      throw err;
    }

    if (this.behavior.simulateInternalError) {
      throw new Error('500 Internal Provider Service Unavailable');
    }

    if (this.behavior.simulateMalformedJson) {
      return '{ "action": "counter", "proposedPrice": 7200, INVALID_JSON ...';
    }

    if (this.behavior.customResponse) {
      return this.behavior.customResponse;
    }

    // Inspect message context to decide whether this is a Buyer Agent prompt or Seller Agent prompt
    const promptText = messages.map((m) => m.content).join('\n');

    // 1. Check if this is a Buyer Agent decision prompt
    if (promptText.includes('ROLE: BUYER_NEGOTIATION_AGENT')) {
      return this.handleBuyerPrompt(promptText);
    }

    // 2. Check if this is a Seller Agent decision prompt
    if (promptText.includes('ROLE: SELLER_NEGOTIATION_AGENT')) {
      return this.handleSellerPrompt(promptText);
    }

    // Fallback default structured response
    return JSON.stringify({
      action: 'counter',
      proposedPrice: 7200,
      rationale: 'Balanced automated counter-proposal.',
      message: 'Here is our revised offer.',
    });
  }

  private handleBuyerPrompt(prompt: string): string {
    // If prompt injection attempt is embedded in prompt, simulate model that either ignores or reflects it
    // Our backend guards must catch whatever the model does!
    const roundMatch = prompt.match(/ROUND:\s*(\d+)/i);
    const round = roundMatch ? parseInt(roundMatch[1], 10) : 1;

    const budgetMatch = prompt.match(/MAX_BUDGET:\s*(\d+(?:\.\d+)?)/i);
    const budget = budgetMatch ? parseFloat(budgetMatch[1]) : 7500;

    const currentPriceMatch = prompt.match(/CURRENT_PRICE:\s*(\d+(?:\.\d+)?)/i);
    const currentPrice = currentPriceMatch ? parseFloat(currentPriceMatch[1]) : 7299;

    // Check if seller's price is already within acceptable budget & close enough to accept
    if (currentPrice <= budget && round >= 3) {
      return JSON.stringify({
        action: 'accept',
        proposedPrice: currentPrice,
        targetDeliveryDays: 2,
        targetWarrantyMonths: 24,
        rationale: `Seller current total ${currentPrice} complies with budget ceiling ${budget}. Terms accepted.`,
        buyerMessage: `We accept your proposal of ${currentPrice}. Please reserve the inventory.`,
      });
    }

    // Opening or counter offer: offer 8-12% below current ask, bounded by budget
    const targetBid = Math.min(budget, Math.round(currentPrice * (1 - 0.08)));

    return JSON.stringify({
      action: round === 1 ? 'propose' : 'counter',
      proposedPrice: targetBid,
      targetDeliveryDays: 2,
      targetWarrantyMonths: 24,
      rationale: `Targeting competitive settlement below budget ceiling (${targetBid} vs budget ${budget}).`,
      buyerMessage: `We propose a revised price of ${targetBid} with standard fulfillment.`,
    });
  }

  private handleSellerPrompt(prompt: string): string {
    const floorMatch = prompt.match(/PRIVATE_MINIMUM_PRICE:\s*(\d+(?:\.\d+)?)/i);
    const floor = floorMatch ? parseFloat(floorMatch[1]) : 6600;

    const buyerBidMatch = prompt.match(/BUYER_BID:\s*(\d+(?:\.\d+)?)/i);
    const buyerBid = buyerBidMatch ? parseFloat(buyerBidMatch[1]) : 6800;

    const currentAskMatch = prompt.match(/CURRENT_ASK:\s*(\d+(?:\.\d+)?)/i);
    const currentAsk = currentAskMatch ? parseFloat(currentAskMatch[1]) : 7299;

    const acceptsNeg = !prompt.includes('ACCEPTS_NEGOTIATION: false');

    if (!acceptsNeg) {
      return JSON.stringify({
        action: 'reject',
        proposedPrice: currentAsk,
        deliveryFee: 0,
        otherCharges: 0,
        warrantyMonths: 24,
        deliveryDays: 2,
        rationale: 'Merchant operates strictly on fixed non-negotiable list pricing.',
        sellerMessage: 'Our listed price is fixed and non-negotiable.',
      });
    }

    // If buyer bid meets or exceeds floor and within 100 of current ask, accept
    if (buyerBid >= floor && (currentAsk - buyerBid <= 100)) {
      return JSON.stringify({
        action: 'accept',
        proposedPrice: buyerBid,
        deliveryFee: 0,
        otherCharges: 0,
        warrantyMonths: 24,
        deliveryDays: 2,
        rationale: `Buyer bid of ${buyerBid} meets reservation floor (${floor}). Deal confirmed.`,
        sellerMessage: `We accept your bid of ${buyerBid}. Units allocated.`,
      });
    }

    // If buyer bid is below floor, counter with floor or slightly above
    const counterPrice = Math.max(floor, Math.round((currentAsk + floor) / 2));

    return JSON.stringify({
      action: 'counter',
      proposedPrice: counterPrice,
      deliveryFee: 0,
      otherCharges: 0,
      warrantyMonths: 24,
      deliveryDays: 2,
      rationale: `Conceding towards reservation floor without breaching minimum (${counterPrice} >= ${floor}).`,
      sellerMessage: `We can offer a revised concession of ${counterPrice}.`,
    });
  }
}
