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
  engineMode?: 'live_llm' | 'mock_llm' | 'deterministic_fallback';
  providerName?: string;
  isNegotiating?: boolean;
  onProceedToVerification: () => void;
  onBackToWorkspace: () => void;
  onReRunNegotiation?: () => void;
}

export const NegotiationPage: React.FC<NegotiationPageProps> = ({
  session,
  intent,
  engineMode,
  providerName,
  isNegotiating,
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
        engineMode={engineMode}
        providerName={providerName}
        isNegotiating={isNegotiating}
        onProceedToVerification={onProceedToVerification}
        onBackToWorkspace={onBackToWorkspace}
        onReRunNegotiation={onReRunNegotiation}
      />
    </div>
  );
};
