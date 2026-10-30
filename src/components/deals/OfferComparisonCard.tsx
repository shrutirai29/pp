import React from 'react';
import { ProductOffer } from '../../types/offer';
import { UserIntent } from '../../types/deal';
import { evaluateOfferEligibility } from '../../lib/dealScoring';
import { formatCurrency } from '../../lib/currency';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { 
  Building2, 
  CheckCircle2, 
  XCircle, 
  AlertTriangle, 
  Truck, 
  ShieldAlert, 
  Clock, 
  Tag, 
  ArrowRight,
  Flame
} from 'lucide-react';

interface OfferComparisonCardProps {
  offer: ProductOffer;
  intent: UserIntent;
  onStartNegotiation: (offer: ProductOffer) => void;
  isBestOffer?: boolean;
}

export const OfferComparisonCard: React.FC<OfferComparisonCardProps> = ({
  offer,
  intent,
  onStartNegotiation,
  isBestOffer = false,
}) => {
  const scored = evaluateOfferEligibility(offer, intent);
  const isEligible = scored.isEligible;
  const isCheaperThanEligible = scored.totalPrice < intent.maxBudget && !isEligible;

  return (
    <div
      className={`relative flex flex-col rounded-xl border transition-all duration-200 ${
        isEligible
          ? 'border-navy-700 bg-navy-900/80 shadow-md hover:border-electric-500/50'
          : 'border-navy-800/70 bg-navy-950/60 opacity-90'
      }`}
    >
      {/* Top Banner Badges */}
      <div className="flex items-center justify-between border-b border-navy-800/80 px-5 py-3 bg-navy-950/40 rounded-t-xl">
        <div className="flex items-center gap-2">
          <Building2 className="h-4 w-4 text-slate-400" />
          <span className="text-xs font-semibold text-white">{offer.sellerName}</span>
          <span className="text-[10px] text-slate-500">|</span>
          <span className="text-[10px] text-slate-400">
            {offer.sellerReliabilityTier} ({offer.sellerReliabilityScore}% trust score)
          </span>
          <span className="text-[9px] text-slate-500 font-mono bg-navy-800 px-1 rounded">
            demo
          </span>
        </div>

        <div>
          {isEligible ? (
            <Badge variant="success" size="sm" dot>
              Compliant & Eligible
            </Badge>
          ) : (
            <Badge variant="danger" size="sm" dot>
              Disqualified
            </Badge>
          )}
        </div>
      </div>

      <div className="p-5 flex-1 flex flex-col justify-between">
        <div>
          {/* Header & Product Name */}
          <div className="flex items-start justify-between gap-3 mb-3">
            <div>
              {isBestOffer && isEligible && (
                <div className="inline-flex items-center gap-1 text-[11px] font-semibold text-electric-400 bg-electric-950/50 border border-electric-700/40 px-2 py-0.5 rounded mb-2">
                  <Flame className="h-3 w-3" /> Recommended Candidate
                </div>
              )}
              {isCheaperThanEligible && (
                <div className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-400 bg-amber-950/40 border border-amber-800/40 px-2 py-0.5 rounded mb-2">
                  <AlertTriangle className="h-3 w-3" /> Lower Listed Price But Non-Compliant
                </div>
              )}
              <h4 className="text-sm font-semibold text-white leading-snug">
                {offer.productTitle}
              </h4>
            </div>
            
            <div className="text-right shrink-0">
              <span className="text-xs text-slate-400 block">Total Price</span>
              <span className={`text-lg font-bold font-mono ${isEligible ? 'text-white' : 'text-slate-400'}`}>
                {formatCurrency(scored.totalPrice, offer.currency)}
              </span>
            </div>
          </div>

          {/* Price Breakdown */}
          <div className="rounded-lg bg-navy-950/80 p-2.5 border border-navy-850 text-xs mb-4 space-y-1">
            <div className="flex justify-between text-slate-400">
              <span>Item Listed Price:</span>
              <span className="font-mono text-slate-200">{formatCurrency(offer.basePrice, offer.currency)}</span>
            </div>
            <div className="flex justify-between text-slate-400">
              <span>Delivery / Shipping:</span>
              <span className="font-mono text-slate-200">
                {offer.deliveryFee === 0 ? 'Free Shipping' : formatCurrency(offer.deliveryFee, offer.currency)}
              </span>
            </div>
            {offer.otherCharges > 0 && (
              <div className="flex justify-between text-amber-400/90">
                <span>{offer.otherChargesDescription || 'Mandatory Surcharge'}:</span>
                <span className="font-mono">{formatCurrency(offer.otherCharges, offer.currency)}</span>
              </div>
            )}
          </div>

          {/* Key Attributes Grid */}
          <div className="grid grid-cols-2 gap-2 text-xs mb-4">
            <div className="rounded bg-navy-900/40 p-2 border border-navy-850 flex items-center gap-2">
              <Tag className="h-3.5 w-3.5 text-slate-400" />
              <div>
                <span className="text-[10px] text-slate-400 block">Condition</span>
                <span className={`font-medium ${offer.condition === 'new' ? 'text-slate-200' : 'text-rose-400'}`}>
                  {offer.condition.toUpperCase()}
                </span>
              </div>
            </div>

            <div className="rounded bg-navy-900/40 p-2 border border-navy-850 flex items-center gap-2">
              <Truck className="h-3.5 w-3.5 text-slate-400" />
              <div>
                <span className="text-[10px] text-slate-400 block">Delivery Time</span>
                <span className={`font-medium ${offer.estimatedDeliveryDays <= intent.maxDeliveryDays ? 'text-slate-200' : 'text-rose-400'}`}>
                  {offer.estimatedDeliveryDays} Business Days
                </span>
              </div>
            </div>

            <div className="rounded bg-navy-900/40 p-2 border border-navy-850 flex items-center gap-2">
              <Clock className="h-3.5 w-3.5 text-slate-400" />
              <div>
                <span className="text-[10px] text-slate-400 block">Warranty</span>
                <span className="text-slate-200 font-medium">
                  {offer.warrantyMonths !== null && offer.warrantyMonths !== undefined 
                    ? `${offer.warrantyMonths} Months` 
                    : 'Unstated / Unverified'}
                </span>
              </div>
            </div>

            <div className="rounded bg-navy-900/40 p-2 border border-navy-850 flex items-center gap-2">
              <ShieldAlert className="h-3.5 w-3.5 text-slate-400" />
              <div>
                <span className="text-[10px] text-slate-400 block">Subscription Lock-in</span>
                <span className={`font-medium ${offer.hasSubscription ? 'text-rose-400' : 'text-emerald-400'}`}>
                  {offer.hasSubscription ? 'Recurring Fee' : 'None (One-time)'}
                </span>
              </div>
            </div>
          </div>

          {/* Subscription note if applicable */}
          {offer.hasSubscription && offer.subscriptionDetails && (
            <div className="mb-4 rounded-lg bg-rose-950/30 border border-rose-800/40 p-2.5 text-xs text-rose-300">
              <span className="font-semibold block">⚠️ Recurring Charge Notice:</span>
              <span>{offer.subscriptionDetails}</span>
            </div>
          )}

          {/* Eligibility or Violations Box */}
          <div className="mb-4">
            {isEligible ? (
              <div className="flex items-start gap-2 rounded-lg bg-emerald-950/20 border border-emerald-800/30 p-2.5 text-xs text-emerald-300">
                <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400 mt-0.5" />
                <span>Complies with all non-negotiable buyer requirements. Ready for negotiation.</span>
              </div>
            ) : (
              <div className="rounded-lg bg-rose-950/20 border border-rose-800/30 p-2.5 text-xs text-rose-300 space-y-1">
                <div className="flex items-center gap-1.5 font-semibold text-rose-400">
                  <XCircle className="h-3.5 w-3.5 shrink-0" />
                  <span>Disqualified - Hard Constraint Violations:</span>
                </div>
                <ul className="list-disc pl-5 space-y-1 text-[11px] text-rose-200/90">
                  {scored.violations.map((violation, i) => (
                    <li key={i}>{violation}</li>
                  ))}
                  {scored.missingInfo.map((info, i) => (
                    <li key={i} className="text-amber-300">{info}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>

        {/* Action Button */}
        <div className="pt-2 border-t border-navy-800/80">
          <Button
            variant={isEligible ? 'primary' : 'outline'}
            className="w-full"
            disabled={!isEligible}
            onClick={() => onStartNegotiation(offer)}
            rightIcon={isEligible ? <ArrowRight className="h-4 w-4" /> : undefined}
          >
            {isEligible ? 'Start Mock Negotiation' : 'Disqualified from Negotiation'}
          </Button>
          {!isEligible && (
            <p className="mt-1.5 text-[10px] text-center text-slate-500">
              Rule 11 Enforced: Only compliant offers can enter negotiation workflow.
            </p>
          )}
        </div>
      </div>
    </div>
  );
};
