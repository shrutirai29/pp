import React from 'react';
import { Deal } from '../../types/deal';
import { StatusIndicator } from '../ui/StatusIndicator';
import { formatCurrency } from '../../lib/currency';
import { ArrowRight, Calendar, DollarSign, Shield } from 'lucide-react';

interface DealCardProps {
  deal: Deal;
  onSelect: (deal: Deal) => void;
}

export const DealCard: React.FC<DealCardProps> = ({ deal, onSelect }) => {
  const dateFormatted = new Date(deal.createdAt).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  return (
    <div
      onClick={() => onSelect(deal)}
      className="group relative flex flex-col justify-between rounded-xl border border-navy-800 bg-navy-900/60 p-5 transition-all duration-200 hover:border-electric-500/50 hover:bg-navy-900/90 cursor-pointer shadow-sm hover:shadow-md"
    >
      <div>
        <div className="flex items-center justify-between gap-2 mb-3">
          <StatusIndicator status={deal.status} size="sm" />
          <span className="flex items-center gap-1 text-[11px] text-slate-500 font-mono">
            <Calendar className="h-3 w-3" />
            {dateFormatted}
          </span>
        </div>

        <h4 className="text-sm font-semibold text-white group-hover:text-electric-400 transition-colors line-clamp-1 mb-1.5">
          {deal.title}
        </h4>

        <p className="text-xs text-slate-400 line-clamp-2 mb-3 italic">
          &ldquo;{deal.intent.rawQuery}&rdquo;
        </p>
      </div>

      <div className="pt-3 border-t border-navy-850 flex items-center justify-between text-xs">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1 text-slate-300 font-mono font-medium">
            <DollarSign className="h-3.5 w-3.5 text-emerald-400" />
            Max {formatCurrency(deal.intent.maxBudget, deal.intent.currency)}
          </span>
          <span className="flex items-center gap-1 text-slate-400 text-[11px]">
            <Shield className="h-3 w-3 text-violet-400" />
            {deal.intent.requiredCondition}
          </span>
        </div>

        <div className="flex items-center gap-1 text-electric-400 group-hover:translate-x-1 transition-transform font-medium">
          <span>Open</span>
          <ArrowRight className="h-3.5 w-3.5" />
        </div>
      </div>
    </div>
  );
};
