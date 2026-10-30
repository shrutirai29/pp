import React from 'react';
import { DealStatus } from '../../types/deal';
import { Badge, BadgeVariant } from './Badge';

interface StatusIndicatorProps {
  status: DealStatus;
  size?: 'sm' | 'md';
  className?: string;
}

export const StatusIndicator: React.FC<StatusIndicatorProps> = ({
  status,
  size = 'md',
  className = '',
}) => {
  const statusConfig: Record<DealStatus, { label: string; variant: BadgeVariant; dot: boolean }> = {
    draft: {
      label: 'Draft',
      variant: 'default',
      dot: true,
    },
    negotiating: {
      label: 'Negotiating',
      variant: 'info',
      dot: true,
    },
    verification_required: {
      label: 'Verification Required',
      variant: 'warning',
      dot: true,
    },
    verified: {
      label: 'Verified (IntentLock)',
      variant: 'success',
      dot: true,
    },
    rejected: {
      label: 'Rejected',
      variant: 'danger',
      dot: true,
    },
    payment_completed: {
      label: 'Payment Completed',
      variant: 'purple',
      dot: true,
    },
  };

  const config = statusConfig[status] || {
    label: status,
    variant: 'default',
    dot: false,
  };

  return (
    <Badge variant={config.variant} size={size} dot={config.dot} className={className}>
      {config.label}
    </Badge>
  );
};
