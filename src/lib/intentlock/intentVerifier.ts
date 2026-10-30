import { UserIntent } from '../../types/deal';
import { FinalDeal } from '../../types/negotiation';
import { ProductOffer } from '../../types/offer';
import { VerificationReport, VerificationStatus } from './verificationTypes';
import { PolicyEngine } from './policyEngine';
import { generateDealFingerprint } from './transactionIntegrity';

/**
 * IntentLock Independent Verification Engine.
 * Serves as the independent security gate evaluating the final deal contract.
 * Generates an authoritative machine-readable VerificationReport bound to a cryptographic SHA-256 fingerprint.
 */
export class IntentVerifier {
  public static verify(
    intent: UserIntent,
    deal: FinalDeal,
    originalOffer?: ProductOffer
  ): VerificationReport {
    // 1. Generate canonical transaction fingerprint
    const dealFingerprint = generateDealFingerprint(deal);

    // 2. Evaluate all hard constraints and integrity policies
    const evaluation = PolicyEngine.evaluate(intent, deal, originalOffer);

    // 3. Determine aggregate verification verdict
    // Rule: Any hard failure -> REJECTED
    // If no hard failures, but missing evidence -> NEEDS_REVIEW
    // All checks pass -> VERIFIED
    let status: VerificationStatus = 'VERIFIED';
    let summary = '';

    if (evaluation.failedCount > 0) {
      status = 'REJECTED';
      summary = `IntentLock Transaction Security Gateway REJECTED this deal due to ${evaluation.failedCount} hard constraint breach${evaluation.failedCount > 1 ? 'es' : ''}. Payment authorization is strictly locked to protect user intent.`;
    } else if (evaluation.needsReviewCount > 0) {
      status = 'NEEDS_REVIEW';
      summary = `IntentLock identified ${evaluation.needsReviewCount} uncertain or missing requirement item${evaluation.needsReviewCount > 1 ? 's' : ''}. Independent verification requires explicit user or merchant confirmation.`;
    } else {
      status = 'VERIFIED';
      summary = `All ${evaluation.passedCount} transaction security and intent conformance criteria PASSED. Contract terms are cryptographically bound to fingerprint ${dealFingerprint.slice(0, 12)}... and ready for explicit human approval.`;
    }

    return {
      id: `ver-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      dealId: deal.dealId,
      originalIntentId: intent.id,
      offerId: deal.originalOfferId,
      offerTitle: deal.productTitle,
      sellerName: deal.sellerName,
      sellerId: deal.sellerId,
      finalPrice: deal.totalPayable,
      currency: deal.currency,
      dealFingerprint,
      verifiedAt: new Date().toISOString(),
      status,
      summary,
      checks: evaluation.checks,
      passedCount: evaluation.passedCount,
      failedCount: evaluation.failedCount,
      needsReviewCount: evaluation.needsReviewCount,
      rejectionReasons: evaluation.rejectionReasons,
      suggestedRemedies: evaluation.suggestedRemedies,
      disclaimer: 'DEMONSTRATION SECURITY GATEWAY: IntentLock provides cryptographic transaction fingerprinting and rule auditing. In production, tamper-resistant verification requires a trusted server-side execution environment with authoritative key management.',
    };
  }
}
