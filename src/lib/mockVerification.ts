import { UserIntent } from '../types/deal';
import { ProductOffer } from '../types/offer';
import { FinalDeal } from '../types/negotiation';
import { VerificationReport } from '../types/verification';
import { IntentVerifier } from './intentlock/intentVerifier';

/**
 * IntentLock Transaction Security Gateway entry point.
 * Directs verification through the modular IntentLock Phase 3 verification engine.
 */
export function verifyDealWithIntentLock(
  intent: UserIntent,
  offerOrDeal: ProductOffer | FinalDeal,
  _negotiatedFinalPrice?: number
): VerificationReport {
  const isFinalDeal = 'totalPayable' in offerOrDeal && 'roundCount' in offerOrDeal;

  let deal: FinalDeal;

  if (isFinalDeal) {
    deal = offerOrDeal as FinalDeal;
  } else {
    const offer = offerOrDeal as ProductOffer;
    const basePrice = Number(offer.basePrice);
    const deliveryFee = Number(offer.deliveryFee || 0);
    const otherCharges = Number(offer.otherCharges || 0);
    const totalPayable = basePrice + deliveryFee + otherCharges;

    deal = {
      dealId: intent.id,
      originalOfferId: offer.id,
      sellerId: offer.id,
      sellerName: offer.sellerName,
      productTitle: offer.productTitle,
      condition: offer.condition,
      productPrice: basePrice,
      deliveryFee,
      otherCharges,
      otherChargesDescription: offer.otherChargesDescription,
      totalPayable,
      deliveryEstimateDays: offer.estimatedDeliveryDays,
      warrantyMonths: offer.warrantyMonths,
      hasSubscription: offer.hasSubscription,
      subscriptionDetails: offer.subscriptionDetails,
      negotiationStatus: 'agreed',
      roundCount: 1,
      messages: [],
      isAcceptedBySeller: true,
      currency: offer.currency,
      totalSaved: 0,
      stopReason: 'agreed',
    };
  }

  return IntentVerifier.verify(intent, deal);
}

export * from './intentlock/intentVerifier';
export * from './intentlock/transactionIntegrity';
export * from './intentlock/policyEngine';
export * from './intentlock/approvalManager';
export * from './intentlock/verificationTypes';
