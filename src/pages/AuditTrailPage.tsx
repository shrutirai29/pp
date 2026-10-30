import React from 'react';
import { AuditEvent } from '../types/audit';
import { AuditTimeline } from '../components/audit/AuditTimeline';
import { Button } from '../components/ui/Button';
import { RotateCcw } from 'lucide-react';

interface AuditTrailPageProps {
  events: AuditEvent[];
  onResetEvents?: () => void;
  onBackToDashboard: () => void;
}

export const AuditTrailPage: React.FC<AuditTrailPageProps> = ({
  events,
  onResetEvents,
  onBackToDashboard,
}) => {
  return (
    <div className="space-y-6">
      <AuditTimeline events={events} />

      <div className="flex items-center justify-between pt-4 border-t border-navy-800">
        <Button variant="outline" onClick={onBackToDashboard}>
          Back to Dashboard
        </Button>

        {onResetEvents && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onResetEvents}
            leftIcon={<RotateCcw className="h-3.5 w-3.5" />}
          >
            Reset Demo Events
          </Button>
        )}
      </div>
    </div>
  );
};
