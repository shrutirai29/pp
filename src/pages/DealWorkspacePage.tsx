import React from 'react';
import { UserIntent } from '../types/deal';
import { ProductOffer } from '../types/offer';
import { OriginalRequirementsCard } from '../components/deals/OriginalRequirementsCard';
import { OfferComparisonCard } from '../components/deals/OfferComparisonCard';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { 
  Layers, 
  ShieldCheck, 
  HelpCircle,
  RotateCcw
} from 'lucide-react';

interface DealWorkspacePageProps {
  intent: UserIntent;
  offers: ProductOffer[];
  onStartNegotiation: (offer: ProductOffer) => void;
  onEditIntent: () => void;
  onResetOffers: () => void;
}

export const DealWorkspacePage: React.FC<DealWorkspacePageProps> = ({
  intent,
  offers,
  onStartNegotiation,
  onEditIntent,
  onResetOffers,
}) => {
  const eligibleCount = offers.filter((o) => o.eligibilityStatus === 'eligible').length;
  const disqualifiedCount = offers.length - eligibleCount;

  return (
    <div className="space-y-6">
      {/* Workspace Header */}
      <div className="rounded-xl border border-navy-800 bg-navy-900/60 p-6 backdrop-blur-md">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="h-2 w-2 rounded-full bg-electric-400" />
              <span className="text-xs font-semibold uppercase tracking-wider text-electric-400">
                Active Deal Workspace
              </span>
              <span className="text-xs text-slate-500 font-mono">• 3 Fictional Sellers Compared</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-white flex items-center gap-2">
              <Layers className="h-6 w-6 text-electric-400" />
              Multi-Seller Offer Comparison & Policy Evaluation
            </h1>
            <p className="text-xs sm:text-sm text-slate-400 mt-1">
              DealMind filters incoming seller inventory against your IntentLock policies before allowing negotiation.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Button
              variant="outline"
              size="sm"
              onClick={onResetOffers}
              leftIcon={<RotateCcw className="h-3.5 w-3.5" />}
            >
              Reset Offers
            </Button>
          </div>
        </div>
      </div>

      {/* Original Requirements Panel (Rule Enforcement) */}
      <OriginalRequirementsCard intent={intent} onEdit={onEditIntent} />

      {/* Filter / Summary Strip */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-navy-800 bg-navy-900/40 px-5 py-3.5">
        <div className="flex items-center gap-3">
          <span className="text-xs font-semibold text-slate-300">Catalogue Scan Results:</span>
          <Badge variant="success" size="sm" dot>
            {eligibleCount} Compliant & Negotiable
          </Badge>
          <Badge variant="danger" size="sm" dot>
            {disqualifiedCount} Violating & Disqualified
          </Badge>
        </div>

        <div className="flex items-center gap-2 text-[11px] text-slate-400">
          <ShieldCheck className="h-3.5 w-3.5 text-electric-400" />
          <span>Rule 9 Active: Low listing price never overrides hard constraints.</span>
        </div>
      </div>

      {/* Offers Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {offers.map((offer, index) => (
          <OfferComparisonCard
            key={offer.id}
            offer={offer}
            intent={intent}
            onStartNegotiation={onStartNegotiation}
            isBestOffer={index === 0 && offer.eligibilityStatus === 'eligible'}
          />
        ))}
      </div>

      {/* Explanatory Guide on Mock Sellers */}
      <div className="rounded-xl border border-navy-800 bg-navy-950/70 p-5 text-xs text-slate-400 space-y-2">
        <div className="flex items-center gap-2 font-semibold text-slate-300">
          <HelpCircle className="h-4 w-4 text-slate-500" />
          <span>Understanding the Three Test Offer Archetypes:</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-1">
          <div className="rounded-lg bg-navy-900/50 p-3 border border-navy-850">
            <span className="text-emerald-400 font-semibold block mb-1">1. TechHaven Direct (Compliant)</span>
            <p className="text-[11px] leading-relaxed text-slate-300">
              Factory new condition, $74 total (under $85 budget), 2-day delivery, 60-mo warranty, and zero subscriptions. Eligible for immediate autonomous negotiation.
            </p>
          </div>

          <div className="rounded-lg bg-navy-900/50 p-3 border border-navy-850">
            <span className="text-rose-400 font-semibold block mb-1">2. SpeedyStorage (Cheaper Trap)</span>
            <p className="text-[11px] leading-relaxed text-slate-300">
              Listed at $59 base price to appear enticing, but bundles a hidden $4.99/mo subscription, 5-day delivery, and refurbished condition. Disqualified automatically.
            </p>
          </div>

          <div className="rounded-lg bg-navy-900/50 p-3 border border-navy-850">
            <span className="text-amber-400 font-semibold block mb-1">3. Apex Silicon (Over-Budget Flagship)</span>
            <p className="text-[11px] leading-relaxed text-slate-300">
              Factory new high-end SSD with heatsink, but $103 total price breaches the buyer's maximum ceiling of $85. Locked out from negotiation.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
