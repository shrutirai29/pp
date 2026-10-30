import React from 'react';
import { UserIntent } from '../../types/deal';
import { formatCurrency } from '../../lib/currency';
import { Shield, Clock, Box, DollarSign, Ban, FileCheck } from 'lucide-react';
import { Badge } from '../ui/Badge';

interface OriginalRequirementsCardProps {
  intent: UserIntent;
  onEdit?: () => void;
}

export const OriginalRequirementsCard: React.FC<OriginalRequirementsCardProps> = ({
  intent,
  onEdit,
}) => {
  return (
    <div className="rounded-xl border border-navy-800 bg-navy-900/60 p-5 backdrop-blur-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-navy-800 pb-4">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-electric-500/10 text-electric-400 border border-electric-500/20">
            <Shield className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-100">Original Buyer Intent & Hard Constraints</h3>
            <p className="text-xs text-slate-400">Non-negotiable parameters enforced by IntentLock™</p>
          </div>
        </div>

        {onEdit && (
          <button
            onClick={onEdit}
            className="text-xs text-electric-400 hover:text-electric-300 underline underline-offset-4"
          >
            Refine Intent
          </button>
        )}
      </div>

      {/* Raw Prompt Quote */}
      <div className="mt-3.5 rounded-lg bg-navy-950/80 p-3 border border-navy-800/80">
        <p className="text-xs font-mono text-slate-300 italic">
          &ldquo;{intent.rawQuery}&rdquo;
        </p>
      </div>

      {/* Parameter Grid */}
      <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="rounded-lg bg-navy-950/50 p-2.5 border border-navy-850">
          <div className="flex items-center gap-1.5 text-slate-400 text-[11px] mb-1">
            <DollarSign className="h-3 w-3 text-emerald-400" />
            <span>Max Budget</span>
          </div>
          <span className="text-sm font-semibold text-white font-mono">
            {formatCurrency(intent.maxBudget, intent.currency)}
          </span>
          <Badge variant="outline" size="sm" className="mt-1 block text-[10px] w-fit">
            Strict Ceiling
          </Badge>
        </div>

        <div className="rounded-lg bg-navy-950/50 p-2.5 border border-navy-850">
          <div className="flex items-center gap-1.5 text-slate-400 text-[11px] mb-1">
            <Box className="h-3 w-3 text-electric-400" />
            <span>Condition</span>
          </div>
          <span className="text-sm font-semibold text-white capitalize">
            {intent.requiredCondition}
          </span>
          <Badge variant={intent.requiredCondition === 'new' ? 'purple' : 'default'} size="sm" className="mt-1 block text-[10px] w-fit">
            {intent.requiredCondition === 'new' ? 'Factory New Only' : 'Flexible'}
          </Badge>
        </div>

        <div className="rounded-lg bg-navy-950/50 p-2.5 border border-navy-850">
          <div className="flex items-center gap-1.5 text-slate-400 text-[11px] mb-1">
            <Clock className="h-3 w-3 text-amber-400" />
            <span>Delivery Limit</span>
          </div>
          <span className="text-sm font-semibold text-white font-mono">
            ≤ {intent.maxDeliveryDays} days
          </span>
          <Badge variant="outline" size="sm" className="mt-1 block text-[10px] w-fit">
            Hard Window
          </Badge>
        </div>

        <div className="rounded-lg bg-navy-950/50 p-2.5 border border-navy-850">
          <div className="flex items-center gap-1.5 text-slate-400 text-[11px] mb-1">
            <Ban className="h-3 w-3 text-rose-400" />
            <span>Subscriptions</span>
          </div>
          <span className="text-sm font-semibold text-white">
            {intent.prohibitSubscriptions ? 'Prohibited' : 'Allowed'}
          </span>
          <Badge variant={intent.prohibitSubscriptions ? 'danger' : 'default'} size="sm" className="mt-1 block text-[10px] w-fit">
            Zero Recurring
          </Badge>
        </div>

        <div className="rounded-lg bg-navy-950/50 p-2.5 border border-navy-850">
          <div className="flex items-center gap-1.5 text-slate-400 text-[11px] mb-1">
            <FileCheck className="h-3 w-3 text-sky-400" />
            <span>Warranty</span>
          </div>
          <span className="text-sm font-semibold text-white font-mono">
            ≥ {intent.requiredWarrantyMonths} mo
          </span>
          <Badge variant="outline" size="sm" className="mt-1 block text-[10px] w-fit">
            Required
          </Badge>
        </div>

        <div className="rounded-lg bg-navy-950/50 p-2.5 border border-navy-850">
          <div className="flex items-center gap-1.5 text-slate-400 text-[11px] mb-1">
            <DollarSign className="h-3 w-3 text-violet-400" />
            <span>Fee Policy</span>
          </div>
          <span className="text-sm font-semibold text-white">
            All Included
          </span>
          <Badge variant="outline" size="sm" className="mt-1 block text-[10px] w-fit">
            No Hidden Fees
          </Badge>
        </div>
      </div>
    </div>
  );
};
