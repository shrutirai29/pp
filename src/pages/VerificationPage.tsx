import React from 'react';
import { VerificationReport, UserApprovalRecord } from '../types/verification';
import { UserIntent } from '../types/deal';
import { FinalDeal } from '../types/negotiation';
import { VerificationReportCard } from '../components/intentlock/VerificationReportCard';

interface VerificationPageProps {
  report: VerificationReport;
  intent: UserIntent;
  deal?: FinalDeal;
  approvalRecord?: UserApprovalRecord | null;
  onApprove?: () => void;
  onDecline?: () => void;
  authorizationToken?: string;
  onReturnToNegotiation: () => void;
  onReturnToWorkspace: () => void;
}

export const VerificationPage: React.FC<VerificationPageProps> = ({
  report,
  intent,
  deal,
  approvalRecord,
  onApprove,
  onDecline,
  authorizationToken,
  onReturnToNegotiation,
  onReturnToWorkspace,
}) => {
  return (
    <div className="space-y-6">
      <VerificationReportCard
        report={report}
        intent={intent}
        deal={deal}
        approvalRecord={approvalRecord}
        onApprove={onApprove}
        onDecline={onDecline}
        authorizationToken={authorizationToken}
        onReturnToNegotiation={onReturnToNegotiation}
        onReturnToWorkspace={onReturnToWorkspace}
      />
    </div>
  );
};
