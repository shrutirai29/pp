import React from 'react';
import { NegotiationSession } from '../types/negotiation';
import { UserIntent } from '../types/deal';
import { ProductOffer } from '../types/offer';
import { NegotiationTimeline } from '../components/negotiation/NegotiationTimeline';
import { OriginalRequirementsCard } from '../components/deals/OriginalRequirementsCard';

interface NegotiationPageProps {
  session: NegotiationSession;
  intent: UserIntent;
  offer: ProductOffer;
  onProceedToVerification: () => void;
  onBackToWorkspace: () => void;
  onReRunNegotiation?: () => void;
}

export const NegotiationPage: React.FC<NegotiationPageProps> = ({
  session,
  intent,
  onProceedToVerification,
  onBackToWorkspace,
  onReRunNegotiation,
}) => {
  return (
    <div className="space-y-6">
      {/* Context banner showing the user's non-negotiable intent */}
      <OriginalRequirementsCard intent={intent} />

      {/* Main Negotiation Timeline */}
      <NegotiationTimeline
        session={session}
        onProceedToVerification={onProceedToVerification}
        onBackToWorkspace={onBackToWorkspace}
        onReRunNegotiation={onReRunNegotiation}
      />
    </div>
  );
};
