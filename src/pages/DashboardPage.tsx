import React from 'react';
import { Deal } from '../types/deal';
import { DealCard } from '../components/deals/DealCard';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { 
  Search, 
  ShieldCheck, 
  ShieldAlert, 
  Clock, 
  CheckCircle2, 
  ArrowUpRight,
  TrendingUp,
  HelpCircle
} from 'lucide-react';

interface DashboardPageProps {
  deals: Deal[];
  onSelectDeal: (deal: Deal) => void;
  onNewDeal: () => void;
  onViewAudit: () => void;
}

export const DashboardPage: React.FC<DashboardPageProps> = ({
  deals,
  onSelectDeal,
  onNewDeal,
  onViewAudit,
}) => {
  // Compute summary metrics for recent verification decisions
  const verifiedCount = deals.filter((d) => d.status === 'verified').length;
  const rejectedCount = deals.filter((d) => d.status === 'rejected').length;
  const inProgressCount = deals.filter(
    (d) => d.status === 'negotiating' || d.status === 'verification_required'
  ).length;

  return (
    <div className="space-y-8">
      {/* Welcome Hero Section */}
      <div className="relative overflow-hidden rounded-2xl border border-navy-800 bg-gradient-to-br from-navy-900 via-navy-900 to-navy-850 p-6 sm:p-8 shadow-xl">
        <div className="relative z-10 max-w-3xl space-y-4">
          <div className="flex items-center gap-2">
            <span className="flex h-2 w-2 rounded-full bg-electric-400" />
            <span className="text-xs font-semibold uppercase tracking-wider text-electric-400">
              Autonomous Deal Agent & Security Quarantine
            </span>
            <Badge variant="outline" size="sm" className="font-mono text-[10px]">
              Phase 1 MVP
            </Badge>
          </div>

          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-tight text-white">
            Negotiate Confidently. <br />
            <span className="bg-gradient-to-r from-electric-400 to-violet-400 bg-clip-text text-transparent">
              IntentLock™ Guarantees Your Terms.
            </span>
          </h1>

          <p className="text-sm sm:text-base text-slate-300 leading-relaxed max-w-2xl">
            DealMind discovers real-time product quotes and simulates autonomous agent negotiation. 
            Before any transaction can proceed, IntentLock independently audits seller terms against 
            your non-negotiable budget, condition, and subscription constraints.
          </p>

          <div className="flex flex-wrap items-center gap-3 pt-2">
            <Button
              variant="primary"
              size="lg"
              onClick={onNewDeal}
              leftIcon={<Search className="h-5 w-5" />}
              className="bg-gradient-to-r from-electric-500 to-violet-600 hover:from-electric-600 hover:to-violet-700 shadow-lg shadow-electric-500/25 text-white font-semibold"
            >
              Find My Deal
            </Button>

            <Button
              variant="outline"
              size="lg"
              onClick={onViewAudit}
              leftIcon={<ShieldCheck className="h-4 w-4 text-emerald-400" />}
            >
              Inspect Audit Ledger
            </Button>
          </div>
        </div>

        {/* Subtle decorative background graphic */}
        <div className="absolute right-0 top-0 -mt-10 -mr-10 h-64 w-64 rounded-full bg-electric-500/10 blur-3xl pointer-events-none" />
        <div className="absolute right-20 bottom-0 -mb-10 h-64 w-64 rounded-full bg-violet-500/10 blur-3xl pointer-events-none" />
      </div>

      {/* Verification Decisions Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-xl border border-navy-800 bg-navy-900/60 p-4">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-2">
            <span>Total Managed Deals</span>
            <TrendingUp className="h-4 w-4 text-electric-400" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold font-mono text-white">{deals.length}</span>
            <span className="text-xs text-slate-500 font-mono">sessions recorded</span>
          </div>
        </div>

        <div className="rounded-xl border border-navy-800 bg-navy-900/60 p-4">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-2">
            <span>IntentLock Verified</span>
            <CheckCircle2 className="h-4 w-4 text-emerald-400" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold font-mono text-emerald-400">{verifiedCount}</span>
            <span className="text-xs text-emerald-500/80">passed all constraints</span>
          </div>
        </div>

        <div className="rounded-xl border border-navy-800 bg-navy-900/60 p-4">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-2">
            <span>Violations Blocked</span>
            <ShieldAlert className="h-4 w-4 text-rose-400" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold font-mono text-rose-400">{rejectedCount}</span>
            <span className="text-xs text-rose-500/80">locked from checkout</span>
          </div>
        </div>

        <div className="rounded-xl border border-navy-800 bg-navy-900/60 p-4">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-2">
            <span>Active / In Review</span>
            <Clock className="h-4 w-4 text-amber-400" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold font-mono text-amber-400">{inProgressCount}</span>
            <span className="text-xs text-amber-500/80">awaiting completion</span>
          </div>
        </div>
      </div>

      {/* Deals Section */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
              Recent Negotiation Sessions & Deals
            </h2>
            <p className="text-xs text-slate-400">
              Demonstration session records illustrating various verification states.
            </p>
          </div>

          <Button
            variant="ghost"
            size="sm"
            onClick={onNewDeal}
            rightIcon={<ArrowUpRight className="h-4 w-4" />}
          >
            Create New Request
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-4">
          {deals.map((deal) => (
            <DealCard key={deal.id} deal={deal} onSelect={onSelectDeal} />
          ))}
        </div>
      </div>

      {/* Architecture Notice Banner */}
      <div className="rounded-xl border border-navy-800 bg-navy-950/70 p-4 text-xs text-slate-400 flex items-start gap-3">
        <HelpCircle className="h-4 w-4 text-slate-500 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <p className="font-semibold text-slate-300">Phase 1 Controlled Demonstration Catalogue:</p>
          <p>
            All merchant offers and negotiation transcripts are generated locally by deterministic algorithms for testing state compliance and IntentLock verification. No live web scraper, real LLM token expenditure, or live payment authorization is engaged in this phase.
          </p>
        </div>
      </div>
    </div>
  );
};
