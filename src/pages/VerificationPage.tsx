import React from 'react';
import { VerificationReport } from '../types/verification';
import { UserIntent } from '../types/deal';
import { VerificationReportCard } from '../components/intentlock/VerificationReportCard';

interface VerificationPageProps {
  report: VerificationReport;
  intent: UserIntent;
  onReturnToNegotiation: () => void;
  onReturnToWorkspace: () => void;
}

export const VerificationPage: React.FC<VerificationPageProps> = ({
  report,
  intent,
  onReturnToNegotiation,
  onReturnToWorkspace,
}) => {
  return (
    <div className="space-y-6">
      <VerificationReportCard
        report={report}
        intent={intent}
        onReturnToNegotiation={onReturnToNegotiation}
        onReturnToWorkspace={onReturnToWorkspace}
      />
    </div>
  );
};
