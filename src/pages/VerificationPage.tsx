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
  isServerOnline?: boolean;
  onReturnToNegotiation: () => void;
  onReturnToWorkspace: () => void;
  onPaymentSuccess?: (captureResult: any) => void;
}

export const VerificationPage: React.FC<VerificationPageProps> = ({
  report,
  intent,
  deal,
  approvalRecord,
  onApprove,
  onDecline,
  authorizationToken,
  isServerOnline = false,
  onReturnToNegotiation,
  onReturnToWorkspace,
  onPaymentSuccess,
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
        isServerOnline={isServerOnline}
        onReturnToNegotiation={onReturnToNegotiation}
        onReturnToWorkspace={onReturnToWorkspace}
        onPaymentSuccess={onPaymentSuccess}
      />
    </div>
  );
};
