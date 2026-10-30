import React from 'react';
import { VerificationCheck } from '../../types/verification';
import { Badge, BadgeVariant } from '../ui/Badge';
import { CheckCircle2, XCircle, AlertCircle } from 'lucide-react';

interface CheckDetailItemProps {
  check: VerificationCheck;
}

export const CheckDetailItem: React.FC<CheckDetailItemProps> = ({ check }) => {
  const statusConfig: Record<
    VerificationCheck['status'],
    { label: string; variant: BadgeVariant; icon: React.ReactNode; border: string; bg: string }
  > = {
    passed: {
      label: 'PASSED',
      variant: 'success',
      icon: <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />,
      border: 'border-navy-800 hover:border-emerald-700/50',
      bg: 'bg-navy-900/60',
    },
    failed: {
      label: 'FAILED',
      variant: 'danger',
      icon: <XCircle className="h-4 w-4 text-rose-400 shrink-0" />,
      border: 'border-rose-900/50 bg-rose-950/20',
      bg: 'bg-rose-950/20',
    },
    needs_review: {
      label: 'NEEDS REVIEW',
      variant: 'warning',
      icon: <AlertCircle className="h-4 w-4 text-amber-400 shrink-0" />,
      border: 'border-amber-900/50 bg-amber-950/20',
      bg: 'bg-amber-950/20',
    },
  };

  const config = statusConfig[check.status];

  return (
    <div className={`rounded-xl border p-4 transition-all ${config.border} ${config.bg}`}>
      <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-2">
          {config.icon}
          <h4 className="text-xs sm:text-sm font-semibold text-white">{check.name}</h4>
          {check.isHardConstraint && (
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-navy-950 text-slate-400 border border-navy-800">
              Hard Constraint
            </span>
          )}
        </div>

        <Badge variant={config.variant} size="sm" dot>
          {config.label}
        </Badge>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs mb-2.5 pt-1">
        <div className="rounded-lg bg-navy-950/70 p-2.5 border border-navy-850">
          <span className="text-[10px] font-medium text-slate-400 block mb-0.5">
            Original Buyer Expectation:
          </span>
          <span className="text-slate-200 font-mono text-[11px] sm:text-xs">{check.expected}</span>
        </div>

        <div className="rounded-lg bg-navy-950/70 p-2.5 border border-navy-850">
          <span className="text-[10px] font-medium text-slate-400 block mb-0.5">
            Seller Deal Contract Terms:
          </span>
          <span className={`font-mono text-[11px] sm:text-xs ${
            check.status === 'passed' ? 'text-slate-200' : check.status === 'failed' ? 'text-rose-300 font-semibold' : 'text-amber-300'
          }`}>
            {check.actual}
          </span>
        </div>
      </div>

      <p className="text-xs text-slate-400 leading-relaxed">
        {check.details}
      </p>

      {check.suggestedRemedy && (
        <div className="mt-2.5 rounded bg-navy-950/90 px-3 py-1.5 border border-navy-800 text-[11px] text-amber-300 flex items-center gap-1.5">
          <span className="font-semibold text-amber-400 shrink-0">Remedy Action:</span>
          <span>{check.suggestedRemedy}</span>
        </div>
      )}
    </div>
  );
};
