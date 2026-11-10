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
      className="group relative flex flex-col justify-between rounded-2xl border border-[#24203D] bg-[#24203D]/40 p-5 transition-all duration-200 hover:border-[#6955C9]/40 hover:bg-[#24203D]/70 cursor-pointer shadow-subtle hover:-translate-y-0.5"
    >
      <div>
        <div className="flex items-center justify-between gap-2 mb-3">
          <StatusIndicator status={deal.status} size="sm" />
          <span className="flex items-center gap-1 text-[11px] text-[#68657A] font-mono">
            <Calendar className="h-3 w-3" />
            {dateFormatted}
          </span>
        </div>

        <h4 className="text-sm font-semibold text-white group-hover:text-[#8F86D8] transition-colors line-clamp-1 mb-1.5">
          {deal.title}
        </h4>

        <p className="text-xs text-[#68657A] line-clamp-2 mb-3 italic">
          &ldquo;{deal.intent.rawQuery}&rdquo;
        </p>
      </div>

      <div className="pt-3 border-t border-[#24203D]/60 flex items-center justify-between text-xs">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1 text-[#E9E8F8] font-mono font-medium">
            <DollarSign className="h-3.5 w-3.5 text-[#4FAF91]" />
            Max {formatCurrency(deal.intent.maxBudget, deal.intent.currency)}
          </span>
          <span className="flex items-center gap-1 text-[#68657A] text-[11px]">
            <Shield className="h-3 w-3 text-[#8F86D8]" />
            {deal.intent.requiredCondition}
          </span>
        </div>

        <div className="flex items-center gap-1 text-[#8F86D8] group-hover:text-white group-hover:translate-x-1 transition-all font-medium">
          <span>Open</span>
          <ArrowRight className="h-3.5 w-3.5" />
        </div>
      </div>
    </div>
  );
};
